/**
 * Payslip Controller (Refactored to read from PayrollRunSnapshots)
 */
const PayslipController = {
    /**
     * Get payslip for a specific employee and period
     * GET /api/payslip/:employeeId/:period
     */
    getPayslip: async (req, res) => {
        try {
            const { employeeId, period } = req.params;
            const tenantDB = req.tenantDB;
            const tenantId = req.tenantId;

            const PayrollRunSnapshot = tenantDB.model('PayrollRunSnapshot');

            // Find the run for the period
            const run = await PayrollRunSnapshot.findOne({ tenant: tenantId, period });

            if (!run) {
                return res.status(404).json({ success: false, message: "Payroll not processed for this period" });
            }

            // Find the item for the employee
            const item = run.items.find(i => i.employee.toString() === employeeId);

            if (!item) {
                return res.status(404).json({ success: false, message: "Payslip not found for this employee in this period" });
            }

            // Populate employee details for display
            const Employee = tenantDB.model('Employee');
            const employee = await Employee.findById(employeeId).select('firstName lastName employeeId department designation bankDetails');

            res.json({
                success: true,
                data: {
                    employee,
                    period,
                    earnings: item.details.earnings,
                    deductions: item.details.deductions,
                    benefits: item.details.benefits,
                    attendance: item.details.attendance,
                    totals: {
                        grossEarnings: item.grossEarnings,
                        totalDeductions: item.totalDeductions,
                        netPay: item.netPay
                    },
                    runDate: run.runDate
                }
            });

        } catch (error) {
            console.error("[GET_PAYSLIP] Error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * Get all payslips for the logged-in employee
     * GET /api/payslip/my
     */
    getMyPayslips: async (req, res) => {
        try {
            const employeeId = req.user.id || req.user._id;
            const tenantDB = req.tenantDB;
            const tenantId = req.tenantId;

            const PayrollRunSnapshot = tenantDB.model('PayrollRunSnapshot');

            // Find all runs containing this employee
            const runs = await PayrollRunSnapshot.find({
                tenant: tenantId,
                'items.employee': employeeId
            }).sort({ period: -1 });

            const payslips = runs.map(run => {
                const item = run.items.find(i => i.employee.toString() === employeeId.toString());
                return {
                    period: run.period,
                    netPay: item.netPay,
                    runDate: run.runDate,
                    locked: run.locked
                };
            });

            res.json({ success: true, data: payslips });

        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
};

module.exports = PayslipController;
