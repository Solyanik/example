import db from '../db/db.js';
import ResponseError from '../helpers/response-error';
import unique from '../helpers/unique';
import Controller from '../helpers/controller';
import proxyModel from "../models/proxy";
import config from '../config';
import string from 'string';

export default class ProxyController extends Controller {

    async Search() {
        try {
            const { account, query } = this.request;
            if (account.role != 'admin') throw new Error("Admin rights required");
            let limit = parseInt(query.limit) || 30;
            const offset = parseInt(query.offset) || 0;
            const match = (query.username) ? { 'target.username': { $regex: query.username, $options: 'i' } } : {};
            ['active', 'in_use'].forEach(property => {
                if (property in query) {
                    match[property] = ['true', '1'].includes(query[property]);
                }
            });
            if ('provider' in query) {
                match['provider'] = query.provider;
            }
            if (query.portal_id) {
                match.portal_id = query.portal_id;
            }
            const total = await db.proxies.count(match);
            const proxies = await db.proxies.find(match, {_id: 0, __v: 0}).skip(offset).limit(limit).sort({ rating: 1 });
            this.Response({
                proxies,
                total,
                coefficients: config.proxy.coefficients
            });
        } catch (error) {
            this.ErrorResponse(error);
        }
    }

    async Filters() {
        try {
            const filters = {};
            const account = this.request.account;
            const filterFields = ['provider', 'active', 'in_use'];
            if (account.role == 'admin') {
                filterFields.push('portal_id');
            }
            const promises = filterFields.map(field => db.proxies.aggregate(
                {$group: {_id: '$' + field, count: {$sum: 1}}})
            );
            const [providersData, activeData, useData, portalsData] = await Promise.all(promises);
            const active = { data: activeData, positive: "Active", negative: "Inactive", name: 'active' }; 
            const use = { data: useData, positive: "In Use", negative: "Free", name: 'in_use' }; 
            [active, use].forEach(object => {
                filters[object.name] = [];
                object.data.forEach(current => {
                    const item = {
                        title: (current._id) ? object.positive : object.negative,
                        value: Boolean(current._id),
                        count: current.count
                    };
                    filters[object.name].push(item);
                });
            });
            filters.providers = providersData.map(item => ({
                title: (item._id) ? string(item._id).capitalize().s : 'Unknown provider',
                value: item._id,
                count: item.count,
            }));
            if (account.role === 'admin') {
                const portalIds = portalsData.map(item => item._id);
                const portals = await db.portals.find({ portal_id: { $in: portalIds } });
                filters.portals = portalsData.map((item) => {
                    const portal = (item._id) ? portals.find(portal => item._id === portal.portal_id) : null;
                    return {
                        title: (portal) ? portal.name : 'Common',
                        value: item._id,
                        count: item.count,
                    };
                });
            }
            this.Response({ filters });
        } catch (error) {
            this.ErrorResponse(error);
        }
    }

    async Check() {
        try {
            const {params: { proxy_id: proxyId } } = this.request;
            const proxy = await db.proxies.findOne({ proxy_id: proxyId });
            if (!proxy) throw new ResponseError("Proxy not found", 404);
            const speed = await proxyModel.Check(proxy);
            if(speed)
                this.Response({ status: true, time: speed });
            else throw new ResponseError("Failed to connect using this proxy", 404);
        } catch (error) {
            this.ErrorResponse(error);
        }
    }

    async Create() {
        try {
            if (this.request.account.role != 'admin') throw new Error("Admin rights required");
            const { host, port, user, password, country, portal_id, provider, active, type } = this.request.body;
            if (!host || !port || !user || !password || ! country) throw new Error("Data is incorrect");
            const existing = await db.proxies.findOne({ host, user, password, port });
            if (existing) throw new Error('Proxy with such host, port, login and password already exists');
            const proxyId = await unique.Get('proxies', 'proxy_id');
            await db.proxies.create({
                proxy_id: proxyId,
                active: ('active' in this.request.body) ? active : true,
                in_use: false,
                target: null,
                type: type || 'http',
                host,
                port,
                user,
                password,
                country,
                portal_id: portal_id || null,
                provider,
                logs: []
            });
            this.Response({ proxy_id: proxyId });
        } catch (error) {
            this.ErrorResponse(error);
        }
    }

    async Reset() {
        try {
            if (this.request.account.role !== 'admin') throw new Error('Admin rights required');
            await db.proxies.update(
                {},
                { 
                    $set: {
                        logs: [],
                        rating: 0,
                        statistics: {
                            instagram_challenges: 0,
                            instagram_blocks: 0,
                            timeouts: 0,
                            instagram_bans: 0,
                            instagram_authentication_errors: 0,
                        },
                    }, 
                    $currentDate: {
                        created_at: true
                    },
                },
                { multi: true }
            );
            this.Response({ status: true });
        } catch (error) {
            this.ErrorResponse(error);
        }
    }

    async Rating() {
        try {
            let offset = 0;
            const limit = 1000;
            let proxies = [];
            do {
                proxies = await db.proxies.find().skip(offset).limit(limit);
                for (const proxy of proxies) {
                    await proxyModel.UpdateRating(proxy);
                }
                offset += limit;
            } while (proxies && proxies.length);
            this.Response({ status: true });
        } catch (error) {
            this.ErrorResponse(error);
        }
    }

    async Patch() {
        try {
            const { body: data, account: { role }, params: { proxy_id: proxyId } } = this.request;
            if (role != 'admin') throw new Error("Admin rights required");
            const existing = await db.proxies.findOne({ host: data.host, user: data.user, password: data.password, proxy_id: { $ne: proxyId } });
            if (existing) throw new Error("Proxy with such host, login and password already exists");
            const current = await db.proxies.findOne({ proxy_id: proxyId });
            if (!current) throw new ResponseError("Proxy not found", 404);
            const update = {};
            for (let property in data) {
                if (['active', 'type', 'host', 'port', 'user', 'password', 'country', 'portal_id'].includes(property)) {
                    update[property] = data[property];
                }
            }
            await db.proxies.update({ proxy_id: proxyId }, { $set: update });
            this.Response();
        } catch (error) {
            this.ErrorResponse(error);
        }
    }

    async Delete() {
        try {
            const {account: { role }, params: { proxy_id: proxyId } } = this.request;
            if (role != 'admin') throw new Error("Admin rights required");
            await db.proxies.deleteOne({ proxy_id: proxyId });
            this.Response();
        } catch (error) {
            this.ErrorResponse(error);
        }
    }
}