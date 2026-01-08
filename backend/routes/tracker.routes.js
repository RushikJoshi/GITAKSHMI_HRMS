const express = require('express');
const router = express.Router();
const trackerController = require('../controllers/trackerController');
const auth = require('../middleware/auth.jwt');

// GET /api/hr/candidate-status or /api/tracker/candidates
router.get('/', (req, res, next) => {
    // Basic auth check without blocking for debugging if user prefers
    // auth.authenticate(req, res, next);
    next();
}, trackerController.getCandidates);

router.get('/candidates', auth.authenticate, trackerController.getCandidates);
router.get('/candidates/:id/timeline', auth.authenticate, trackerController.getTimeline);
router.post('/candidates/:id/status', auth.authenticate, trackerController.updateStatus);
router.post('/seed', auth.authenticate, trackerController.seedData);

module.exports = router;
