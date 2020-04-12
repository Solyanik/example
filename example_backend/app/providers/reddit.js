import randomstring from 'randomstring';
import rest from 'request-promise-native';
import os from 'os';
import db from '../db/db';
import messageModel from '../models/message';
import config from '../config';
import jobModel from '../models/job';
import log from '../models/log.js';

import snoowrap from 'snoowrap'

export default class RedditProvider {

    static async SetActive(connection, value) {
        const { bot_id, provider } = connection;
        const job = await db.jobs.findOne({ bot_id, type: 'provider', 'job_data.provider': 'reddit' });
        if(job) {
            value ? await jobModel.Restart(job) : await jobModel.Delete(job);
        } else if(value){
            await jobModel.Save({ bot_id, name: `Reddit ${bot_id}`, type: 'provider', job_data: { provider } });
        }
    }

    static async Connect(connection) {
        try {
            const { bot_id, provider_data: { user_agent, client_id, client_secret, username, password }, provider, account_id, active, provider_data } = connection;
            if(typeof username === 'undefined' || typeof password === 'undefined') throw new Error('Username and password are required');
            const resource = await db.connections.findOne({ provider, 'provider_data.client_secret': client_secret, bot_id: { $ne: bot_id }})
            if(resource) throw new Error('This Reddit account already connected to other bot');
            const reddit = new snoowrap({ userAgent: user_agent, clientId: client_id, clientSecret: client_secret, username, password });
            const me = await reddit.getMe();
            await db.connections.findOneAndUpdate(
                { bot_id, provider },
                { $set: { account_id, active, provider_data }},
                { upsert: true }
            );
            if(active) {
                const job = await db.jobs.findOne({ bot_id, type: 'provider', 'job_data.provider': 'reddit' });
                if(!job) {
                    await jobModel.Save({ bot_id, name: `Reddit ${bot_id}`, type: 'provider', job_data: { provider } });
                } else {
                    await jobModel.Restart(job);
                }
            }
            return { status: true, id: me.name };
        } catch(error) {
            throw new Error(`Connection rejected: ${error}`);
        };
    }

    static async Disconnect(connection) {
        const job = await db.jobs.findOne({ bot_id: connection.bot_id, 'job_data.provider': 'reddit' });    
        if(job) jobModel.Delete(job);
    }

    static Receive(request, response) {
        response.json({ status: true });
    }

    static async Run(connection) {
        let { provider_data: { username }, bot_id } = connection;
        const reddit = new snoowrap(connection.provider_data);
        let running = false;
        return setInterval(async () => {
            try {
                if(running) throw new Error('Already running');
                running = true;
                const messages = await reddit.getUnreadMessages();
                if(messages.length) {
                    messages.sort((a, b) => a.created - b.created);
                    for(let message of messages) {
                        await RedditProvider.SaveMessage(connection, message);
                        await message.markAsRead();
                    }
                }
                running = false;
            } catch(error){
                if(error.message !== 'Already running') {
                    running = false;
                }
            }
        }, 10 * 1000);
        
    }

    static async SaveMessage(connection, message) {
        const { bot_id, provider, account_id } = connection;
        try {
            //Check client
            let client = await db.clients.findOne({ bot_id, provider, 'provider_data.name': message.author.name });
            if(!client) {
                client = {
                    client_id: randomstring.generate({length: 15, charset: 'alphanumeric', capitalization: 'uppercase'}),
                    bot_id,
                    account_id,
                    provider,
                    name: message.author.name,
                    provider_data: { name: message.author.name },
                    profile: { name: message.author.name }
                };
                await db.clients.create(client);
            }
            //Save message
            await messageModel.Save(client, 'text', { text: message.body }, 'client');
        } catch(error) {
            log.Alert({ type: 'error', category: 'message', bot_id, message: `Email saving message error: ${error.message}` });
        }
    }

    static Stop(stream) {
        stream.stop();
    }

    static async Send(client, message) {
        const connection = await db.connections.findOne({bot_id: client.bot_id, provider: client.provider});
        if(!connection || !connection.active) throw new Error('No connection avaliable to send message');
        const reddit = new snoowrap(connection.provider_data);
        if(message.type == 'text') {
            await reddit.composeMessage({
                to: client.provider_data.name,
                subject: "Reply",
                text: message.content.text
            });
        }
    }
}