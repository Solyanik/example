import rp from 'request-promise-native';
import db from '../db/db';
import config from '../config';

export default class Proxy {
    static async Check(proxy) {
        let timeout = 8000;
        const proxyUrl = (typeof proxy === 'object') ? `${proxy.type}://${proxy.user}:${proxy.password}@${proxy.host}:${proxy.port}` : proxy;
        const options = {
            method: 'GET',
            uri: config.proxy.check_url,
            proxy: proxyUrl,
            timeout,
            json: true,
        };
        const time = Date.now();
        await rp(options).catch((error) => {
            console.warn(`${new Date().toUTCString()} proxy ${proxyUrl} checking error ${error.message}`);
            timeout = -1;
        });
        const speed = Date.now() - time;
        if (typeof proxy === 'object') {
            await Proxy.UpdateRating(proxy);
        }
        return speed < timeout ? speed : 0;
    }

    static async UpdateRating(proxy) {
        let rating = 0;
        const days = parseInt((Date.now() - proxy.created_at) / (1000 * 60 * 60 * 24)) || 1;
        const coefficients = {};
        ['timeouts', 'instagram_bans', 'instagram_authentication_errors', 'instagram_blocks', 'instagram_challenges', 'days'].forEach((param) => {
            coefficients[param] = (config.proxy.coefficients && config.proxy.coefficients[param]) || 1;
            if (param !== 'days') rating += coefficients[param] * proxy.statistics[param] || 0;
        });
        rating /= (days * coefficients.days);
        await db.proxies.update({ _id: proxy._id }, { $set: { statistics: proxy.statistics, rating } });
    }

    static async Release(target, reason) {
        const match = {};
        for (const key in target) {
            match[`target.${key}`] = target[key];
        }
        const proxy = await db.proxies.findOneAndUpdate(
            match,
            { $set: { target: null, in_use: false, released_at: new Date() } },
            { returnNewDocument: true },
        );
        const reasons = { challenge: 'instagram_challenges', block: 'instagram_blocks', timeout: 'timeouts', ban: 'instagram_bans', authentication_error: 'instagram_authentication_errors' };
        if (proxy && proxy.statistics && reasons[reason]) {
            proxy.statistics[`${reasons[reason]}`] += 1;
            await Proxy.UpdateRating(proxy);
        }
    }

    static async GetFree(bot_id, target, attempts = 5) {
        if (!attempts) return null;
        const timeout = 1000 * 60 * 5;
        const bot = await db.bots.findOne({ bot_id });
        const query = {
            in_use: false,
            active: true,
            $or: [{ released_at: null }, { released_at: { $lte: new Date(Date.now() - timeout) } }],
            portal_id: null,
        };
        if (bot && bot.portal_id) {
            query.portal_id = bot.portal_id;
            const proxiesCount = await db.proxies.count(query);
            if (proxiesCount <= 3) query.portal_id = null;
        }
        const proxy = await db.proxies.findOneAndUpdate(
            query,
            { $set: { in_use: true, target, released_at: null } },
            { sort: { rating: 1 } },
        );
        if (!proxy) return null;
        if (await Proxy.Check(proxy)) {
            const { user, password, host, port } = proxy;
            return `${proxy.type}://${user}:${password}@${host}:${port}`;
        } else {
            await Proxy.Release(target, 'timeout');
            return await Proxy.GetFree(bot_id, target, --attempts);
        }
    }
}
