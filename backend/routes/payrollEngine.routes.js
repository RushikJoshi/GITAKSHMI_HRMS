const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.jwt');
const SalaryController = require('../controllers/salary.controller');
const PayrollEngineController = require('../controllers/payrollEngine.controller');
const PayslipController = require('../controllers/payslip.controller');

// SALARY ROUTES (Phase 8: GET /salary/preview, POST /salary/assign)
router.get('/salary/preview', authenticate, SalaryController.preview);
router.post('/salary/assign', authenticate, SalaryController.assign);

// PAYROLL ROUTES (Phase 8: POST /payroll/run, GET /payroll/:period)
router.post('/payroll/freeze-attendance', authenticate, PayrollEngineController.freezeAttendance);
router.post('/payroll/run', authenticate, PayrollEngineController.runPayroll);
router.get('/payroll/:period', authenticate, PayrollEngineController.getPayrollRun);

// PAYSLIP ROUTES (Phase 8: GET /payslip/:employeeId/:period)
router.get('/payslip/my', authenticate, PayslipController.getMyPayslips);
router.get('/payslip/:employeeId/:period', authenticate, PayslipController.getPayslip);

module.exports = router;
