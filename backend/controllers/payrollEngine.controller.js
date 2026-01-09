const PayrollEngine = require('../services/payrollEngine');

/**
 * Controller for Payroll Engine (Immutability Focused)
 */
const PayrollEngineController = {
    /**
     * Freeze attendance for a period
     * POST /api/payroll/freeze-attendance
     */
    freezeAttendance: async (req, res) => {
        try {
            const { period } = req.body; // e.g. "2026-01"
            const tenantDB = req.tenantDB;
            const tenantId = req.tenantId;

            if (!period || !/^\d{4}-\d{2}$/.test(period)) {
                return res.status(400).json({ success: false, message: "Valid period (YYYY-MM) is required" });
            }

            const AttendanceEngine = require('../services/attendanceEngine');
            const Employee = tenantDB.model('Employee');

            const employees = await Employee.find({ tenant: tenantId, status: 'Active' });

            const snapshots = [];
            for (const employee of employees) {
                const snapshot = await AttendanceEngine.generateSnapshot({
                    tenantDB,
                    employeeId: employee._id,
                    period
                });
                snapshots.push(snapshot);
            }

            res.json({
                success: true,
                message: `Attendance frozen for ${snapshots.length} employees for period ${period}`,
                count: snapshots.length
            });
        } catch (error) {
            console.error("[FREEZE_ATTENDANCE] Error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * Run payroll for a period
     * POST /api/payroll/run
     */
    runPayroll: async (req, res) => {
        try {
            const { period } = req.body;
            const tenantDB = req.tenantDB;
            const tenantId = req.tenantId;

            if (!period) return res.status(400).json({ success: false, message: "Period is required" });

            const EmployeeSalarySnapshot = tenantDB.model('EmployeeSalarySnapshot');
            const AttendanceSnapshot = tenantDB.model('AttendanceSnapshot');
            const Employee = tenantDB.model('Employee');

            const employees = await Employee.find({ tenant: tenantId, status: 'Active' });
            const items = [];

            const [year, month] = period.split('-').map(Number);
            const periodEnd = new Date(year, month, 0);

            for (const employee of employees) {
                // Get the most recent salary snapshot effective before or on the period end
                const salarySnapshot = await EmployeeSalarySnapshot.findOne({
                    employee: employee._id,
                    effectiveDate: { $lte: periodEnd }
                }).sort({ effectiveDate: -1 });

                const attendanceSnapshot = await AttendanceSnapshot.findOne({
                    employee: employee._id,
                    period
                });

                if (salarySnapshot && attendanceSnapshot) {
                    items.push({
                        employee,
                        salarySnapshot,
                        attendanceSnapshot
                    });
                }
            }

            if (items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "No valid snapshot pairs found. Ensure both Salary Assignment and Attendance freezing are complete."
                });
            }

            const result = await PayrollEngine.runPayroll({
                tenantDB,
                tenantId,
                period,
                items
            });

            res.json({
                success: true,
                message: `Payroll run snapshot created for ${items.length} employees`,
                data: result
            });
        } catch (error) {
            console.error("[RUN_PAYROLL] Error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * Get payroll run for a period
     * GET /api/payroll/:period
     */
    getPayrollRun: async (req, res) => {
        try {
            const { period } = req.params;
            const tenantDB = req.tenantDB;

            const PayrollRunSnapshot = tenantDB.model('PayrollRunSnapshot');
            const run = await PayrollRunSnapshot.findOne({ tenant: req.tenantId, period })
                .populate('items.employee', 'firstName lastName employeeId');

            if (!run) {
                return res.status(404).json({ success: false, message: "Payroll run not found for this period" });
            }

            res.json({ success: true, data: run });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
};

module.exports = PayrollEngineController;
