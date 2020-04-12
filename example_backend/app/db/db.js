import mongoose from 'mongoose';
import config from '../config';

const { Schema } = mongoose;
const options = Object.assign({
    keepAlive: true,
    reconnectTries: Number.MAX_VALUE,
    useMongoClient: true,
}, config.mongo_options);
mongoose.Promise = Promise;
mongoose.connect(`mongodb://${config.mongo_url}`, options);
const db = mongoose.connection;

db.on('error', (error) => {
    if (error.message && error.message.match(/failed to connect to server .* on first connect/)) {
        console.warn('Failed to connect to MongoDB server. Retrying first connect...');
        // Wait for a bit, then try to connect again
        setTimeout(() => {
            db.open(`mongodb://${config.mongo_url}`).catch(() => {
                throw new Error(`Failed to connect to MongoDB server ${config.mongo_url}`);
            });
        }, 5 * 1000);
    }
});

db.once('open', () => {
    console.log(new Date().toUTCString(), 'Connected to MongoDB');
});

module.exports.scenarios = db.model('scenarios', new Schema({
    scenario_id: String,
    bot_id: String,
    portal_id: String,
    account_id: String,
    name: String,
    description: String,
    default: { type: Boolean, default: false },
    keywords: [Schema.Types.Mixed],
    intents: [Schema.Types.Mixed],
    steps: [Schema.Types.Mixed],
    template: String,
    roles: [String],
}));

module.exports.buttons = db.model('buttons', new Schema({
    step_id: String,
    bot_id: String,
    scenario_id: String,
    title: String,
    value: String,
    statistics: [Schema.Types.Mixed],
}));

module.exports.sequences = db.model('sequences', new Schema({
    bot_id: String,
    name: String,
    steps: [Schema.Types.Mixed],
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }));

module.exports.portals = db.model('portals', new Schema({
    portal_id: String,
    name: String,
    service_name: String,
    domain: String,
    url: String,
    title: String,
    environment: String,
    default: Boolean,
    logo: String,
    favicon: String,
    payments: { type: Schema.Types.Mixed, default: {} },
    properties: { type: Schema.Types.Mixed, default: {} },
    contacts: { type: Schema.Types.Mixed, default: {} },
    notifications: { type: Schema.Types.Mixed, default: {} },
    widgets: { type: Schema.Types.Mixed, default: {} },
}));