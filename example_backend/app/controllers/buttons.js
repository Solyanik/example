import db from '../db/db.js';

export default class ButtonsController {

    static async List(request, response) {
        try {
            const buttons = await db.buttons.find({ bot_id: request.params.bot_id }).sort({ $natural: -1 });
            response.json({
                status: true,
                buttons: buttons.map(button => ({
                    "id": button._id,
                    "step_id": button.step_id,
                    "bot_id": button.bot_id,
                    "scenario_id": button.scenario_id,
                    "title": button.title,
                    "value": button.value,
                    "statistics": button.statistics
                }))
            });
        } catch (error) {
            response.status(400).json({
                status: false,
                error: error.message
            });
        }
    }

}