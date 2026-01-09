const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.jwt');
const attendCtrl = require('../controllers/attendance.controller');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// --- Employee Self Service ---
router.post('/punch', auth.authenticate, attendCtrl.punch);
router.get('/my', auth.authenticate, attendCtrl.getMyAttendance);
router.get('/today-summary', auth.authenticate, attendCtrl.getTodaySummary);

// --- Manager Routes ---
router.get('/team', auth.authenticate, attendCtrl.getTeamAttendance);

// --- HR / Admin Routes ---
router.get('/stats', auth.authenticate, auth.requireHr, attendCtrl.getHRStats);
router.get('/all', auth.authenticate, auth.requireHr, attendCtrl.getAllAttendance);
router.get('/settings', auth.authenticate, attendCtrl.getSettings);
router.put('/settings', auth.authenticate, auth.requireHr, attendCtrl.updateSettings);
router.post('/override', auth.authenticate, auth.requireHr, attendCtrl.override);
router.post('/upload-excel', auth.authenticate, auth.requireHr, upload.single('file'), attendCtrl.uploadExcel);
router.get('/calendar', auth.authenticate, attendCtrl.getCalendar); // All authenticated users can view calendar

module.exports = router;
