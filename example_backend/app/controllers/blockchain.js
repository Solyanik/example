import rp from 'request-promise-native';
import randomstring from 'randomstring';
import ResponseError from '../helpers/response-error';
import blockchainModel from '../models/blockchain';
import db from '../db/db.js';
import config from '../config';
import { Error } from 'mongoose';

export default class BlockchainController {

    static async View(request, response) {
        try {
            const bot = await db.bots.findOne({ bot_id: request.params.bot_id }, { _id: 0, blockchain: 1, name: 1, created_at: 1 });
            if (!bot) throw new ResponseError("Bot not found", 404);
            let blockchain;
            if (bot.blockchain && bot.blockchain.active) {
                const { token, active, activated } = bot.blockchain;
                //TODO Get real stats
                const rand = bot.name.length + (new Date(bot.created_at).getDate() || 15);
                token.summary = {
                    current_supply: rand * 3565122,
                    market_cap: rand * 257356,
                    reserve: rand * 15795,
                    crr: Math.round(rand / 2)
                }
                blockchain = { active, activated, token };
            } else {
                blockchain = { active: false };
            }
            response.json({
                status: true,
                blockchain
            });
        } catch (error) {
            response.status(error.status || 400).json({
                status: false,
                error: error.message
            });
        }
    }

    static async Update(request, response) {
        try {
            const { params: { bot_id }, body: { active, token, traded } } = request;
            const bot = await db.bots.findOne({ bot_id }, { _id: 0, blockchain: 1 });
            if (!bot) throw new ResponseError("Bot not found", 404);
            let blockchain;
            if (active && !(token && token.name && token.symbol)) throw new Error("Please, provide token name and symbol");
            if (token.symbol.length > 7) throw new Error("Token symbol must be less than 7 characters long");
            token.symbol = token.symbol.toUpperCase();
            let currentToken;
            let method;
            let value;
            if (bot.blockchain.token && bot.blockchain.token.id) {
                currentToken = bot.blockchain.token;
                if (currentToken.type !== token.type) throw new Error(`${currentToken.type} blockchain is activated`);
                value = token.value || currentToken.value;
                method = 'PUT';
            } else {
                value = token.value || 0;
                method = 'POST';
            }
            let id = currentToken ? currentToken.id : null;
            if (active) {
                const options = {
                    method,
                    uri: `${config.blockchain.host}/token`,
                    body: {
                        blockchain: token.type,
                        value,
                        currency: token.name,
                        sign: token.symbol,
                        id
                    },
                    json: true
                };
                const { data } = await rp(options);
                id = data.id
            }
            blockchain = {
                active,
                activated: new Date(),
                token: {
                    name: token.name,
                    symbol: token.symbol,
                    type: (['ethereum', 'eos'].indexOf(token.type) !== -1) ? token.type : 'eos',
                    traded: (typeof traded === 'undefined' || traded),
                    price: token.price || 0,
                    id,
                }
            }
            const result = await db.bots.update({ bot_id }, { $set: { blockchain } });
            if (result.n == 0) throw new Error("Unable to update blockchain data");
            response.json({
                status: true
            });
        } catch (error) {
            response.status(error.status || 400).json({
                status: false,
                error: error.message
            });
        }
    }

    static async CreateAccount(request, response) {
        try {
            let { bot_id, password } = request.body;
            if (!password) password = randomstring.generate({ length: 6, charset: 'alphanumeric', capitalization: 'uppercase' });
            const bot = await db.bots.findOne({ bot_id });
            if (!bot) throw new ResponseError("Bot not found", 404);
            const id = await blockchainModel.Create({ bot_id, password });
            response.json({
                status: true,
                id,
                password
            });
        } catch (error) {
            response.status(error.status || 400).json({
                status: false,
                error: error.message
            });
        }
    }

    static async ViewAccount(request, response) {
        try {
            let { bot_id, id } = request.params;
            const bot = await db.bots.findOne({ bot_id });
            if (!bot) throw new ResponseError("Bot not found", 404);
            const balance = await blockchainModel.View({ bot_id, id });
            response.json({
                status: true,
                balance
            });
        } catch (error) {
            response.status(error.status || 400).json({
                status: false,
                error: error.message
            });
        }
    }
}