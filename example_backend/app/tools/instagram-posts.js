import db from '../db/db';
import instagramProvider from '../providers/instagram';
import instagram from 'instagram-private-api';
import rest from 'request-promise-native';

const Instagram = instagram.V1;

export default class InstagramPostsTool {
    static async SetActive(tool, value) {
        if (tool.active === value) return;
        const { bot_id, name } = tool;
        await db.tools.update({ bot_id, name }, { $set: { active: value } });
    }

    static async Validate(data) {
        await InstagramPostsTool.GetConnection(data.bot_id);
    }

    static async GetConnection(botId) {
        const connection = await db.connections.findOne({
            bot_id: botId,
            provider: 'instagram',
            'provider_data.challenge': null,
            'provider_data.renewal_required': false,
        });
        if (!connection) throw new Error('Bot must have active connection to this Instagram account');
        return connection;
    }

    static async Activate() {
        // No activation actions required
    }

    static async Deactivate() {
        // No deactivation actions required
    }

    static async Add(request) {
        const { params: { bot_id: botId }, body: { post } } = request;
        const connection = await InstagramPostsTool.GetConnection(botId);
        const { session } = await instagramProvider.Config(connection);
        if (post.type !== 'image' || !post.content.url) throw new Error('Invalid parameters passed');
        const stream = rest.get(post.content.url);
        const upload = await Instagram.Upload.photo(session, stream);
        await Instagram.Media.configurePhoto(session, upload.params.uploadId, post.content.caption, Number.parseFloat(post.content.width), Number.parseFloat(post.content.height), { ...post.content.userTags });
    }
}
