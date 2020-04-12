import db from '../db/db.js';
import randomstring from 'randomstring';
import scenarioModel from '../models/scenario';
import botModel from '../models/bot';
import ResponseError from '../helpers/response-error';

export default class ScenarioController {

    static List(request, response) {
        db.scenarios.find({ bot_id: request.params.bot_id }).sort({ $natural: -1 })
            .then((res) => {
                let scenarios = [];
                for (let index in res) {
                    let scenario = res[index];
                    scenarios.push({
                        scenario_id: scenario.scenario_id,
                        bot_id: scenario.bot_id,
                        portal_id: scenario.portal_id,
                        account_id: scenario.account_id,
                        name: scenario.name,
                        description: scenario.description,
                        keywords: scenario.keywords,
                        intents: scenario.intents,
                        steps: scenario.steps,
                        default: Boolean(scenario.default),
                        roles: scenario.roles || []
                    });
                }
                response.json({
                    status: true,
                    scenarios: scenarios
                });
            }).catch((error) => {
                response.status(400).json({
                    status: false,
                    error: error.message
                });
            });
    }

    static View(request, response) {
        let scenario;
        db.scenarios.findOne({ scenario_id: request.params.scenario_id })
            .then((res) => {
                if (res) {
                    scenario = res;
                    return botModel.CheckAccess(res.bot_id, request.account);
                } else {
                    throw new ResponseError("Scenario not found", 404);
                }
            }).then((res) => {
                response.json({
                    status: true,
                    scenario_id: scenario.scenario_id,
                    bot_id: scenario.bot_id,
                    portal_id: scenario.portal_id,
                    account_id: scenario.account_id,
                    name: scenario.name,
                    description: scenario.description,
                    keywords: scenario.keywords,
                    intents: scenario.intents,
                    steps: request.query.visual ? ScenarioController.Validate(scenario.steps, scenario.template) : scenario.steps,
                    template: scenario.template || null,
                    default: Boolean(scenario.default),
                    roles: scenario.roles || []
                });
            }).catch((error) => {
                response.status(error.status || 400).json({
                    status: false,
                    error: error.message
                });
            });
    }

    static Validate(steps, template) {
        const offset = 175;
        let left = 50;
        let top = 50;
        let names = {};
        steps.forEach((step) => {
            //ID
            if (!step.id) {
                step.id = randomstring.generate({ length: 5, charset: 'alphanumeric', capitalization: 'uppercase' })
            }
            names[step.name] = step.id;
            //Position
            if (!step.position) {
                step.position = {
                    left: left,
                    top: top
                }
            } else if (!step.position.left) {
                step.position.left = left
            }
            left = step.position.left + offset;
        });
        steps.forEach((step, i) => {
            //Action
            if (template != 'visual') {
                if (!step.action || step.action.next) {
                    let next = steps[i + 1];
                    step.action = {
                        next: (next && !step.return) ? next.id : null
                    }
                } else {
                    //Replace action value from step name to id
                    for (let key in step.action) {
                        if (key != 'next') {
                            step.action[key] = names[step.action[key]] || null;
                        }
                    }
                }
            }
        });
        return steps;
    }

    static async Create(request, response) {
        try {
            const { body: data, bot: { bot_id } } = request;
            const res = await db.scenarios.findOne({ name: data.name, bot_id: data.bot_id });
            if (res) throw new Error('Scenario with such name already exists');
            const scenario_id = randomstring.generate({ length: 10, charset: 'alphanumeric', capitalization: 'uppercase' });
            const scenario = {
                scenario_id,
                bot_id: data.bot_id,
                portal_id: request.bot.portal_id,
                account_id: request.bot.account_id,
                name: data.name,
                description: data.description,
                keywords: data.keywords,
                intents: data.intents,
                steps: data.steps,
                default: Boolean(data.default),
                template: data.template || 'visual',
                roles: data.roles || []
            };
            await ScenarioController.SyncButtons(scenario_id, data);
            if (data.default) await db.scenarios.update({ bot_id }, { default: false }, { multi: true });
            await db.scenarios.create(scenario);
            await db.bots.update({ bot_id }, { $set: { updated_at: new Date() } });
            response.json({
                status: true,
                scenario_id: scenario_id
            });
        } catch (error) {
            response.status(400).json({
                status: false,
                error: error.message
            });
        }
    }

    static async Update(request, response) {
        try {
            const { params: { scenario_id }, body: data } = request;
            let res = await db.scenarios.findOne({ name: data.name, bot_id: data.bot_id, scenario_id: { $ne: scenario_id } });
            if (res) throw new Error('Scenario with such name already exists');
            res = await db.scenarios.findOne({ bot_id: data.bot_id, scenario_id });
            const scenario = {
                name: data.name,
                description: data.description,
                keywords: data.keywords,
                intents: data.intents,
                steps: data.steps,
                default: Boolean(data.default),
                template: data.template || null,
                roles: data.roles || res.roles
            };
            await ScenarioController.SyncButtons(scenario_id, data);
            if (data.default) await db.scenarios.update({ bot_id: data.bot_id }, { default: false }, { multi: true });
            res = await db.scenarios.update({ scenario_id, bot_id: data.bot_id }, { $set: scenario });
            if (res.n == 0) throw new Error('Bad request');
            await db.bots.update({ bot_id: request.bot.bot_id }, { $set: { updated_at: new Date() } });
            response.json({
                status: true
            });
        } catch (error) {
            response.status(400).json({
                status: false,
                error: error.message
            });
        }
    }

    static async Delete(request, response) {
        try {
            const result = await db.scenarios.findOne({ scenario_id: request.params.scenario_id });
            if (result) await botModel.CheckAccess(result.bot_id, request.account);
            else throw new ResponseError("Scenario not found", 404);
            await db.scenarios.remove({ scenario_id: request.params.scenario_id });
            await db.buttons.remove({ scenario_id: request.params.scenario_id });
            await db.bots.update({ bot_id: result.bot_id }, { $set: { updated_at: new Date() } });
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

    static async SyncButtons(scenario_id, data) {
        const buttons = [];
        const removeButtonsIDs = [];
        for (let step of data.steps) {
            if (step.properties.buttons) {
                for (let button of step.properties.buttons) {
                    buttons.push({ step_id: step.id, bot_id: data.bot_id, scenario_id, title: button.title, value: button.content.value });
                }
            }
        }
        if (buttons) {
            const scenarioButtons = await db.buttons.find({ scenario_id });
            for (let scenarioButton of scenarioButtons) {
                const button = buttons.find(button => scenarioButton.step_id === button.step_id && scenarioButton.scenario_id === button.scenario_id && scenarioButton.title === button.title && scenarioButton.value === button.value);
                if (!button) removeButtonsIDs.push(scenarioButton._id);
                else buttons.splice(buttons.indexOf(button), 1);
            }
            await db.buttons.remove({ _id: { $in: removeButtonsIDs } });
            await db.buttons.create(buttons);
        }
    }

    static Clone(request, response) {
        let scenario;
        let new_scenario;
        db.scenarios.findOne({ scenario_id: request.params.scenario_id })
            .then((res) => {
                if (res) {
                    scenario = res;
                    return botModel.CheckAccess(res.bot_id, request.account);
                } else {
                    throw new ResponseError("Scenario not found", 404);
                }
            }).then(() => {
                new_scenario = {
                    scenario_id: randomstring.generate({ length: 10, charset: 'alphanumeric', capitalization: 'uppercase' }),
                    bot_id: scenario.bot_id,
                    portal_id: scenario.portal_id,
                    account_id: scenario.account_id,
                    name: scenario.name + ' clone',
                    keywords: [],
                    steps: scenario.steps,
                    default: false,
                    template: scenario.template,
                    roles: scenario.roles || []
                };
                return db.scenarios.create(new_scenario);
            }).then((result) => {
                response.json({
                    status: true,
                    scenario_id: new_scenario.scenario_id
                });
            }).catch((error) => {
                response.status(error.status || 400).json({
                    status: false,
                    error: error.message
                });
            });
    }
}