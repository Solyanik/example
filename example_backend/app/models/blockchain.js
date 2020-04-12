import rp from 'request-promise-native';
import transactionModel from '../models/transaction';
import db from '../db/db';
import config from '../config';

export default class Blockchain {

    static async Create(params) {
        const { bot_id, password } = params;
        const bot = await db.bots.findOne({ bot_id }, { _id: 0, blockchain: 1 });
        if (!bot) throw new ResponseError("Bot not found", 404);
        const { token: { type } } = bot.blockchain;
        const options = {
            method: 'POST',
            uri: `${config.blockchain.host}/account`,
            body: { blockchain: type, password },
            json: true
        };
        const { data: { address } } = await rp(options);
        return address;
    }

    static async View(params) {
        const { bot_id, id } = params;
        const bot = await db.bots.findOne({ bot_id }, { _id: 0, blockchain: 1 });
        if (!bot) throw new ResponseError("Bot not found", 404);
        const { token: { type, id: contractId } } = bot.blockchain;
        const options = {
            uri: `${config.blockchain.host}/account/${type}/${id}?id=${contractId}`,
            json: true
        };
        const { balance } = await rp(options);
        return balance;
    }
}