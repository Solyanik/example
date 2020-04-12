import crypto from 'crypto';
import rest from 'request-promise-native';
import db from '../db/db';
import config from '../config';
import log from '../models/log';
import unique from '../helpers/unique';
import messageModel from '../models/message';

export default class PinterestProvider {
    static async SetActive(connection, value) {
        const { status } = connection.provider_data;
        if (value && status === 'inactive') {
            await PinterestProvider.Activate(connection);
        } else if (!value && status === 'active') {
            await PinterestProvider.Deactivate(connection);
        }
    }

    static async Receive(request, response) {
        try {
            console.log("RECEIVE MESSAGE");
            console.log(request.body);
            const { user_id: id, channel_id: channelId, channel_name: name, avatar, msg: texts } = request.body;
            const connection = await db.connections.findOne({ 'provider_data.id': id, provider: 'pinterest', active: true });
            console.log(connection);
            console.log(channelId);
            if (!connection || !channelId) throw new Error('Connection not found');
            let client = await db.clients.findOne({ bot_id: connection.bot_id, provider: 'pinterest', 'provider_data.channel_id': channelId });
            if (!client) {
                client = {
                    client_id: await unique.Get('clients', 'client_id', null, 'generate', 15),
                    bot_id: connection.bot_id,
                    portal_id: connection.portal_id,
                    account_id: connection.account_id,
                    provider: connection.provider,
                    provider_data: {
                        channel_id: channelId,
                    },
                    name: name || `Pinterest ${channelId}`,
                    profile: { username: name || `Pinterest ${channelId}` },
                    avatar: avatar || `${config.host}/img/default-client-avatar.png`,
                };
                await db.clients.create(client);
            }
            console.log(client);
            await PinterestProvider.SaveMessage(client, { type: 'text', text: texts });
            console.log('RECIEVED AND')
            response.json({
                status: true,
            });
        } catch (error) {
            response.json({
                status: false,
                error: error.message,
            });
        }
    }

    static async SaveMessage(client, message) {
        console.log('MESSAGE');
        console.log(message);
        const { type, text: texts } = message;
        if (type === 'text') {
            console.log('b');
            for (let i = 0; i < texts.length; i++) {
                console.log(texts[i]);
                const options = (i) ? { skip: true } : {};
                await messageModel.Save(client, type, { text: texts[i] }, 'client', options);
            }
            console.log('c');
        }
    }

    static async Send(client, message) {
        try {
            console.log("SEND MESSAGE");
            console.log(client);
            console.log(message);
            const connection = await db.connections.findOne({ bot_id: client.bot_id, provider: 'pinterest' });
            console.log(connection);
            if (!connection || !connection.active || !connection.provider_data) throw new Error('No connection avaliable to send message');
            const sent = await rest.post({
                uri: `${config.pinterest.host}/dm/${connection.provider_data.id}/${client.provider_data.channel_id}`,
                body: PinterestProvider.GetMessage(message),
                json: true,
            });
            console.log(sent);
            console.log("MESSAGE SENT");
            if (sent.status === 'error') {
                throw new Error('Sending failed');
            }
        } catch (error) {
            throw new Error(`Unable to send message to Pinterest: ${error.message}`)
        }
    }

    static GetMessage(message) {
        if (!['text', 'suggest', 'image', 'audio', 'video', 'file'].includes(message.type)) throw new Error('Unsupported message type');
        const text = (['text', 'suggest'].includes(message.type)) ? message.content.text : message.content.url;
        return { msg: text };
    }

    static async Connect(connection) {
        const { provider_data: { email, password, proxy, has_accepting: hasAccepting, username }, provider, bot_id: botId, account_id: accountId, portal_id: portalId } = connection;
        if (!email || !password) throw new Error('Login or password is absent');
        if (!proxy) throw new Error('Proxy is absent');
        if (!username) throw new Error('Username is absent');
        const existing = await db.connections.findOne({ provider, 'provider_data.email': email, bot_id: { $ne: botId } });
        if (existing) throw new Error('This Pinterest account already connected to other bot');
        const bot = await db.bots.findOne({ bot_id: botId });
        if (!bot) throw new Error('Bot id is incorrect');
        const create = await rest.post({
            uri: `${config.pinterest.host}/account`,
            body: { email, password, proxy, has_accepting: Boolean(hasAccepting) },
            json: true,
        });
        console.log(create);
        if (create.status === 'error') throw new Error('Connection creating failed');
        if (bot.active) {
            connection.provider_data.id = create.account;
            await PinterestProvider.Activate(connection);
        } else {
            const providerData = {
                email,
                hash: PinterestProvider.Encrypt(email, password),
                proxy,
                id: create.account,
                username,
                has_accepting: Boolean(hasAccepting),
                status: 'inactive',
            };
            await db.connections.update({ bot_id: botId, provider }, { $set: { provider_data: providerData, active: false, account_id: accountId, portal_id: portalId } }, { upsert: true });
        }
        return { status: true, id: create.id };
    }

    static async Activate(connection) {
        console.log("ACTIVATE");
        const { provider_data: providerData, provider, bot_id: botId, account_id: accountId, portal_id: portalId } = connection;
        const active = await rest.get({
            uri: `${config.pinterest.host}/activate-chat/${providerData.id}`,
            json: true,
        });
        console.log(active);
        if (active.status === 'error') {
            log.Alert({ type: 'warning', category: 'connection', bot_id: connection.bot_id, message: "Pinterest connection can't be activated" });
        } else {
            const newData = {
                email: providerData.email,
                hash: PinterestProvider.Encrypt(providerData.email, providerData.password),
                proxy: providerData.proxy,
                id: providerData.id,
                username: providerData.username,
                has_accepting: Boolean(providerData.has_accepting),
                status: 'active',
            };
            console.log(newData);
            await db.connections.update({ bot_id: botId, provider }, { $set: { provider_data: newData, active: true, account_id: accountId, portal_id: portalId } }, { upsert: true });
            log.Alert({ type: 'info', category: 'connection', bot_id: connection.bot_id, alert_data: { status: 'started' }, message: 'Pinterest connection is activated' });
        }
    }

    static async Disconnect(connection) {
        await PinterestProvider.Deactivate(connection, true);
    }

    static async Deactivate(connection, isDisconnect) {
        console.log("ACTIVATE");
        const { provider_data: providerData, provider, bot_id: botId } = connection;
        const stop = await rest.get({
            uri: `${config.pinterest.host}/deactivate-chat/${providerData.id}`,
            json: true,
        });
        console.log(stop);
        if (stop.status === 'error') {
            log.Alert({ type: 'warning', category: 'connection', bot_id: connection.bot_id, message: "Pinterest connection doesn't exist" });
            if (!isDisconnect) await db.connections.deleteOne({ bot_id: connection.bot_id, provider: 'pinterest' });
        } else {
            if (!isDisconnect) await db.connections.update({ bot_id: botId, provider }, { $set: { 'provider_data.status': 'inactive', active: false } });
            log.Alert({ type: 'info', category: 'connection', bot_id: connection.bot_id, alert_data: { status: 'deactivation started' }, message: 'Pinterest connection is deactivated' });
        }
    }

    static async Typing(client) {
        return true;
    }

    static async Attachment(connection, type, url){
        return true;
    }

    static Encrypt(email, password) {
        const cipher = crypto.createCipher('aes-256-ctr', PinterestProvider.GetSalt(email));
        let hash = cipher.update(password, 'utf8', 'hex');
        hash += cipher.final('hex');
        return hash;
    }

    static Decrypt(email, hash) {
        const decipher = crypto.createDecipher('aes-256-ctr', PinterestProvider.GetSalt(email));
        let password = decipher.update(hash, 'hex', 'utf8');
        password += decipher.final('utf8');
        return password;
    }

    static GetSalt(email) {
        const salt = crypto.createHmac('sha512', config.pinterest.secret);
        salt.update(email);
        return salt.digest('hex');
    }
}
