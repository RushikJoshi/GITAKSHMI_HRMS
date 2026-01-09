const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payroll.controller');
const templateController = require('../controllers/salaryTemplate.controller');
const benefitController = require('../controllers/benefit.controller');
const payrollRunController = require('../controllers/payrollRun.controller');
const payslipController = require('../controllers/payslip.controller');
const auth = require('../middleware/auth.jwt');
const tenantMiddleware = require('../middleware/tenant.middleware');
const salaryAssignmentController = require('../controllers/salaryAssignment.controller');
const payrollProcessController = require('../controllers/payrollProcess.controller');

// Apply auth and tenant middleware to all payroll routes
router.use(auth.authenticate);
router.use(tenantMiddleware);

// Admin-only setup: seed default components (safe to run multiple times)
router.post('/setup/default-components', auth.authorize('admin'), (req, res, next) => {
	// delegate to controller
	const payrollController = require('../controllers/payroll.controller');
	return payrollController.seedDefaultComponents(req, res, next);
});

// Earnings Routes (HR Only)
router.use('/earnings', auth.requireHr);
router.post('/earnings', payrollController.createEarning);
router.get('/earnings', payrollController.getEarnings);
router.put('/earnings/:id', payrollController.updateEarning);
router.delete('/earnings/:id', payrollController.deleteEarning);

// Benefits Routes (HR Only)
router.use('/benefits', auth.requireHr);
router.post('/benefits', benefitController.createBenefit);
router.get('/benefits', benefitController.getBenefits);
router.get('/benefits/:id', benefitController.getBenefitById);
router.put('/benefits/:id', benefitController.updateBenefit);
router.delete('/benefits/:id', benefitController.deleteBenefit);
router.patch('/benefits/:id/status', benefitController.toggleStatus);

// Salary Assignment Routes
router.post('/assign-template', auth.requireHr, salaryAssignmentController.assignTemplate);
router.get('/history/:employeeId', auth.requireHr, salaryAssignmentController.getAssignmentHistory);

// Salary Template Routes (HR Only)
router.use('/salary-templates', auth.requireHr);
router.post('/salary-templates', templateController.createTemplate);
router.get('/salary-templates', templateController.getTemplates);
router.get('/salary-templates/:id', templateController.getTemplateById);
router.get('/salary-templates/:id/preview', templateController.previewTemplate); // Preview calculation
router.put('/salary-templates/:id', templateController.updateTemplate);

// Excel CTC Upload (HR Only)
router.post('/ctc/upload-excel', auth.requireHr, templateController.uploadCtcExcel);

// Unified Salary Breakup Calculator (HR Only)
router.post('/calculate-breakup', auth.requireHr, templateController.calculateBreakup);
// Payroll Run Routes (HR Only)
router.use('/runs', auth.requireHr);
router.post('/runs', payrollRunController.initiatePayrollRun);
router.get('/runs', payrollRunController.getPayrollRuns);
router.get('/runs/:id', payrollRunController.getPayrollRunById);
router.post('/runs/:id/calculate', payrollRunController.calculatePayroll);
router.post('/runs/:id/approve', payrollRunController.approvePayroll);
router.post('/runs/:id/mark-paid', payrollRunController.markPayrollPaid);
router.post('/runs/:id/cancel', payrollRunController.cancelPayrollRun);

// Payslip Routes - Employee self-service (no HR requirement)
router.get('/payslips/my', payslipController.getMyPayslips);
// router.get('/payslips/my/:id', payslipController.getPayslipById); // Deprecated: Use /api/payroll-engine/payslip/:employeeId/:period
// router.get('/payslips/my/:id/download', payslipController.downloadPayslipPDF); // Deprecated

// Payslip Routes - HR routes (full access)
// router.get('/payslips', auth.requireHr, payslipController.getPayslips); // Deprecated: Use /api/payroll-engine/payroll/:period
// Note: /payslips/:id and /payslips/:id/download are handled by employee routes above
// HR can access using same endpoints

// Setup for payroll process
router.get('/process/employees', auth.requireHr, payrollProcessController.getProcessEmployees);
router.post('/process/preview', auth.requireHr, payrollProcessController.previewPreview);
router.post('/process/run', auth.requireHr, payrollProcessController.runPayroll);

module.exports = router;
