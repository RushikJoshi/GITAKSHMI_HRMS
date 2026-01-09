const mongoose = require('mongoose');
const payrollService = require('../services/payroll.service');

// Helper to get models
const getModels = (req) => {
    return {
        Employee: req.tenantDB.model('Employee'),
        SalaryTemplate: req.tenantDB.model('SalaryTemplate'),
        Attendance: req.tenantDB.model('Attendance'),
        PayrollRun: req.tenantDB.model('PayrollRun'),
        PayrollRunItem: req.tenantDB.model('PayrollRunItem'),
        SalaryAssignment: req.tenantDB.model('SalaryAssignment')
    };
};

/**
 * GET /api/payroll/process/employees?month=YYYY-MM
 * Fetch employees with their status for the payroll month
 */
exports.getProcessEmployees = async (req, res) => {
    try {
        const { month } = req.query; // YYYY-MM
        if (!month) return res.status(400).json({ success: false, message: "Month is required" });

        const [year, monthNum] = month.split('-');
        const startDate = new Date(year, monthNum - 1, 1);
        const endDate = new Date(year, monthNum, 0);

        const { Employee, SalaryAssignment, Attendance, SalaryTemplate } = getModels(req);

        // Fetch Active Employees
        const employees = await Employee.find({
            status: 'Active',
            joiningDate: { $lte: endDate }
        }).select('firstName lastName employeeId department designations email joiningDate');

        // Fetch Assignments for all employees to determine current template
        // We use the same logic as service: latest assignment <= endDate
        const employeeData = await Promise.all(employees.map(async (emp) => {
            const assignment = await SalaryAssignment.findOne({
                employeeId: emp._id,
                effectiveFrom: { $lte: endDate }
            }).sort({ effectiveFrom: -1 });

            let templateId = null;
            if (assignment && (!assignment.effectiveTo || new Date(assignment.effectiveTo) >= startDate)) {
                templateId = assignment.salaryTemplateId;
            }

            // Simple Attendance Count (Optimization: could use aggregate for bulk)
            const attendanceCount = await Attendance.countDocuments({
                employee: emp._id,
                date: { $gte: startDate, $lte: endDate },
                status: { $in: ['present', 'half_day'] } // Matching the schema enum
            });

            return {
                _id: emp._id,
                name: `${emp.firstName} ${emp.lastName}`,
                department: emp.department,
                salaryTemplateId: templateId,
                attendanceParams: {
                    presentDays: attendanceCount, // Simplified for UI preview
                    totalDays: endDate.getDate()
                }
            };
        }));

        res.json({ success: true, data: employeeData });

    } catch (error) {
        console.error("Get Process Employees Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/payroll/process/preview
 * Calculate partial payroll for selected employees
 * Body: { month: "YYYY-MM", items: [{ employeeId, salaryTemplateId }] }
 */
exports.previewPreview = async (req, res) => {
    try {
        const { month, items } = req.body;
        const [year, monthNum] = month.split('-');
        const startDate = new Date(year, monthNum - 1, 1);
        const endDate = new Date(year, monthNum, 0);

        const { Employee, SalaryTemplate, PayrollRun } = getModels(req);

        const results = [];

        for (const item of items) {
            const emp = await Employee.findById(item.employeeId);
            if (!emp) continue;

            try {
                // Call Service with DRY RUN
                const result = await payrollService.calculateEmployeePayroll(
                    req.tenantDB,
                    req.user.tenantId,
                    emp,
                    parseInt(monthNum),
                    parseInt(year),
                    startDate,
                    endDate,
                    endDate.getDate(),
                    new Set(), // Empty holidays for preview
                    null, // No payrollRunId
                    item.salaryTemplateId,
                    true // dryRun = true
                );

                results.push({
                    employeeId: emp._id,
                    gross: result.grossEarnings,
                    net: result.netPay,
                    breakdown: result
                });

            } catch (err) {
                results.push({
                    employeeId: emp._id,
                    error: err.message
                });
            }
        }

        res.json({ success: true, data: results });

    } catch (error) {
        console.error("Preview Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/payroll/process/run
 * Execute Payroll Run with Strict Validation and Skipping Disabled Items
 * Body: { month: "YYYY-MM", items: [{ employeeId, salaryTemplateId }] }
 */
exports.runPayroll = async (req, res) => {
    try {
        const { month, items } = req.body;
        const [year, monthNum] = month.split('-');

        const { PayrollRun, Employee, PayrollRunItem, SalaryAssignment } = getModels(req);

        // 1. Check duplicate run
        const existingRun = await PayrollRun.findOne({ month: parseInt(monthNum), year: parseInt(year) });
        if (existingRun && existingRun.status !== 'Cancelled') {
            return res.status(400).json({ success: false, message: "Payroll for this month already exists" });
        }

        // 2. Create Payroll Run Holder
        const payrollRun = new PayrollRun({
            tenantId: req.user.tenantId,
            tenant: req.user.tenantId, // Ensure consistency
            month: parseInt(monthNum),
            year: parseInt(year),
            status: 'PROCESSING',
            runDate: new Date(),
            totalEmployees: items.length,
            processedEmployees: 0
        });
        await payrollRun.save();

        const startDate = new Date(year, monthNum - 1, 1);
        const endDate = new Date(year, monthNum, 0);

        let successCount = 0;
        let failCount = 0;
        let totalGross = 0;
        let totalNet = 0;

        const skippedList = [];
        const processedList = [];

        // 3. Process Items
        for (const item of items) {
            // Basic Validation
            if (!item.employeeId) continue;

            // Validation 1: Missing Template
            if (!item.salaryTemplateId) {
                skippedList.push({
                    employeeId: item.employeeId,
                    reason: "SALARY_TEMPLATE_MISSING"
                });
                continue; // Skip this employee
            }

            try {
                const emp = await Employee.findById(item.employeeId);
                if (!emp) {
                    skippedList.push({ employeeId: item.employeeId, reason: "EMPLOYEE_NOT_FOUND" });
                    continue;
                }

                // Call Service with DRY RUN to validate calculations first
                const payslip = await payrollService.calculateEmployeePayroll(
                    req.tenantDB,
                    req.user.tenantId,
                    emp,
                    parseInt(monthNum),
                    parseInt(year),
                    startDate,
                    endDate,
                    endDate.getDate(),
                    new Set(),
                    payrollRun._id, // Pass ID for potential generation
                    item.salaryTemplateId,
                    true // dryRun = true (Don't save yet)
                );

                // Validation 2: Zero Payable Days
                // Payable = presentDays + holidayDays + (leaveDays if paid)
                // Service logic suggests leaveDays are paid
                const { presentDays, holidayDays, leaveDays } = payslip.attendanceSummary;
                const payableDays = (presentDays || 0) + (holidayDays || 0) + (leaveDays || 0);

                if (payableDays <= 0) {
                    skippedList.push({
                        employeeId: item.employeeId,
                        reason: "NO_PAYABLE_ATTENDANCE"
                    });
                    continue; // Skip this employee
                }

                // If Valid: Save Payslip and Run Item
                await payslip.save();

                await PayrollRunItem.create({
                    tenantId: req.user.tenantId,
                    payrollRunId: payrollRun._id,
                    employeeId: emp._id,
                    salaryTemplateId: item.salaryTemplateId,
                    attendanceSummary: payslip.attendanceSummary,
                    calculatedGross: payslip.grossEarnings,
                    calculatedNet: payslip.netPay,
                    status: 'Processed'
                });

                successCount++;
                processedList.push(emp._id);
                totalGross += payslip.grossEarnings;
                totalNet += payslip.netPay;

            } catch (err) {
                // Handle specific service errors gracefully
                if (err.message && err.message.includes('no active salary template')) {
                    skippedList.push({
                        employeeId: item.employeeId,
                        reason: "SALARY_TEMPLATE_MISSING"
                    });
                } else {
                    console.error(`Failed to process ${item.employeeId}`, err);
                    failCount++;
                    // Log fail but don't crash whole run
                    await PayrollRunItem.create({
                        tenantId: req.user.tenantId,
                        payrollRunId: payrollRun._id,
                        employeeId: item.employeeId,
                        salaryTemplateId: item.salaryTemplateId,
                        attendanceSummary: {},
                        calculatedGross: 0,
                        calculatedNet: 0,
                        status: 'Failed'
                    });
                }
            }
        }

        // Update Run Status
        payrollRun.status = 'CALCULATED';
        payrollRun.processedEmployees = successCount;
        payrollRun.failedEmployees = failCount;
        payrollRun.totalGross = totalGross;
        payrollRun.totalNetPay = totalNet;
        await payrollRun.save();

        // Respond with Summary (200 OK)
        res.json({
            status: "SUCCESS",
            processed: successCount,
            skipped: skippedList,
            runId: payrollRun._id
        });

    } catch (error) {
        console.error("Run Payroll Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
