import mongoose from 'mongoose';
import db from '../db/db';
import InstagramToolkitTool from './instagram-toolkit';
import InstagramFollowerTool from './instagram-follower';

export default class InstagramGrowthTool {

    static async Create(request) {
        const { body, bot: { bot_id: botId } } = request;
        if(body.type == 'commentators' || body.type == 'followers' || body.type == 'photo_tagged' || body.type == 'hash_tags') {
            await db.tools.remove({ bot_id: botId, name: "instagram-follower" });
            return await InstagramToolkitTool.Create(request);
        } else {
            const connection = await InstagramFollowerTool.GetConnection(botId);
            const task = {
                _id: mongoose.Types.ObjectId(),
                bot_id: botId,
                name: "instagram-follower",
                active: true,
                properties: body.properties
            };
            task.properties.username = connection.provider_data.username;
            await db.instagramTasks.remove({ bot_id: botId });
            await db.tools.create(task);
        }
    }

    static async Update(request) {
        const { body, bot: { bot_id: botId } } = request;
        if(body.type == 'commentators' || body.type == 'followers' || body.type == 'photo_tagged' || body.type == 'hash_tags') {
            await db.tools.remove({ bot_id: botId, name: "instagram-follower" });
            return await InstagramToolkitTool.Update(request);
        } else {
            const connection = await InstagramFollowerTool.GetConnection(botId);
            const task = {
                bot_id: botId,
                name: "instagram-follower",
                active: true,
                properties: body.properties
            };
            task.properties.username = connection.provider_data.username;
            await db.instagramTasks.remove({ bot_id: botId });
            await db.tools.update({ _id: body.id }, task);
        }
    }

    static async List(request) {
        const { bot: { bot_id: botId } } = request;
        try {
            return await InstagramToolkitTool.LastTask(request);
        } catch (error) {
            return { tool: await db.tools.findOne({ bot_id: botId, name: "instagram-follower" }) };
        }
    }

    static async Reports(request) {
        const { bot: { bot_id: botId } } = request;
        try {
            const task = await InstagramToolkitTool.LastTask(request);
            return { profiles: task.profiles, type: task.task.type, result: task.task.result, action: task.task.action, bot_id: task.task.bot_id };
        } catch (error) {
            const tool = await db.tools.findOne({ bot_id: botId, name: "instagram-follower" });
            return { type: tool.properties.mode, bot_id: tool.bot_id };
        }
    }

    static async TasksReport(request) {
        const { bot: { bot_id: botId } } = request;
        try {
            const tasks = await db.instagramTasks.find({ bot_id: botId }).sort({ $natural: -1 });
            const data = tasks.map((task) => ({
                type: task.type,
                action: task.action,
                date: task.created_at,
                total: task.result.total,
                sent: task.result.sent
            }));
            return { data };
        } catch (error) {
            throw new Error('Tasks are not found!');
        }
    }

}