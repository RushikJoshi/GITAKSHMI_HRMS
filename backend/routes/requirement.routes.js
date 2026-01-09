const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.jwt');
const reqCtrl = require('../controllers/requirement.controller');
const applicantCtrl = require('../controllers/applicant.controller');
// const offerCtrl = require('../controllers/offer.controller');

// Protect all routes with authentication and HR role
// Protect all routes with authentication and HR role
router.use(auth.authenticate);
router.use(auth.requireHr);

const reqTmplCtrl = require('../controllers/requirementTemplate.controller');

// Template Management Routes
router.get('/template', reqTmplCtrl.getTemplate);
router.put('/template', reqTmplCtrl.updateTemplate);
router.post('/template/reset', reqTmplCtrl.resetTemplate);

// Routes
router.post('/create', reqCtrl.createRequirement);
router.patch('/:id/status', reqCtrl.updateStatus);
router.put('/:id', reqCtrl.updateRequirement);
router.delete('/:id', reqCtrl.deleteRequirement);
router.get('/internal-jobs', reqCtrl.getInternalJobs);
router.post('/internal-apply/:id', reqCtrl.applyInternal);
router.get('/my-applications', reqCtrl.getMyApplications);
router.get('/list', reqCtrl.getRequirements);
router.get('/', reqCtrl.getRequirements); // Added to support GET /api/requirements
router.get('/applicants', reqCtrl.getApplicants);
// router.post('/offer-letter/:applicantId', offerCtrl.generateOfferLetter);

// Applicant Salary Assignment Routes (HR Only)
router.post('/applicants/:id/assign-salary', auth.authenticate, auth.requireHr, applicantCtrl.assignSalary);
router.patch('/applicants/:id/status', auth.authenticate, auth.requireHr, applicantCtrl.updateApplicantStatus);
router.get('/applicants/:id', auth.authenticate, auth.requireHr, applicantCtrl.getApplicantById);
router.get('/applicants/:id/salary', auth.authenticate, auth.requireHr, applicantCtrl.getSalary);

// Interview Management Routes
router.post('/applicants/:id/interview/schedule', auth.authenticate, auth.requireHr, applicantCtrl.scheduleInterview);
router.put('/applicants/:id/interview/reschedule', auth.authenticate, auth.requireHr, applicantCtrl.rescheduleInterview);
router.put('/applicants/:id/interview/complete', auth.authenticate, auth.requireHr, applicantCtrl.markInterviewCompleted);

// Joining Letter Routes
const letterCtrl = require('../controllers/letter.controller');
router.get('/joining-letter/:applicantId/preview', letterCtrl.viewJoiningLetter);
router.get('/joining-letter/:applicantId/download', letterCtrl.downloadJoiningLetter);

// --- EXCEL UPLOAD CONFIG ---
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `salary_excel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowed = ['.xlsx', '.xls', '.csv'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel/CSV files are allowed'));
        }
    }
});

router.post('/applicants/:id/upload-salary-excel', auth.authenticate, auth.requireHr, upload.single('file'), applicantCtrl.uploadSalaryExcel);

module.exports = router;