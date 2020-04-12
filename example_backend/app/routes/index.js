import express from 'express';
import auth from '../helpers/auth';
import route from '../helpers/route';
import config from '../config';

const router = express.Router();

router.use(express.static(config.static_path));

router.get('/', (request, response) => {
    response.json({
        status: true,
    });
});

// Scenario CRUD
router.get('/scenarios/:bot_id', auth.Account, auth.BotAccess, route.Run(['scenario', 'List']));
router.get('/scenario/:scenario_id', auth.Account, route.Run(['scenario', 'View']));
router.post('/scenario', auth.Account, auth.BotAccess, route.Run(['scenario', 'Create']));
router.post('/scenario/:scenario_id/clone', auth.Account, route.Run(['scenario', 'Clone']));
router.put('/scenario/:scenario_id', auth.Account, auth.BotAccess, route.Run(['scenario', 'Update']));
router.delete('/scenario/:scenario_id', auth.Account, route.Run(['scenario', 'Delete']));

// Buttons CRUD
router.get('/buttons/:bot_id', auth.Account, auth.BotAccess, route.Run(['buttons', 'List']));

// Sequences CRUD
router.get('/sequences/:bot_id/:id', auth.Account, auth.BotAccess, route.Run(['sequences', 'View']));
router.post('/sequences', auth.Account, auth.BotAccess, route.Run(['sequences', 'Create']));
router.get('/sequences/:bot_id', auth.Account, auth.BotAccess, route.Run(['sequences', 'List']));
router.put('/sequences/:bot_id/:id', auth.Account, auth.BotAccess, route.Run(['sequences', 'Update']));
router.delete('/sequences/:bot_id/:id', auth.Account, auth.BotAccess, route.Run(['sequences', 'Delete']));
router.post('/sequences/:id/clone', auth.Account, auth.BotAccess, route.Run(['sequences', 'Clone']));
router.post('/sequences/:id/step/', auth.Account, route.Run(['sequences', 'CreateStep']));
router.put('/sequences/:id/step/:step_id', auth.Account, route.Run(['sequences', 'UpdateStep']));
router.delete('/sequences/:id/step/:step_id', auth.Account, route.Run(['sequences', 'DeleteStep']));

module.exports = router;