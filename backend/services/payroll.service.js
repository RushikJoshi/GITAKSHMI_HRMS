/**
 * Payroll Service
 * Core payroll calculation engine
 * 
 * IMPORTANT RULES:
 * 1. All calculations are server-side only (never in frontend)
 * 2. Payslip data is stored as immutable snapshots
 * 3. Past payslips are never recalculated
 * 4. Follows mandatory calculation order
 */

/**
 * Run payroll for a specific month/year
 * @param {Object} db - Tenant database connection
 * @param {ObjectId} tenantId - Tenant ID
 * @param {Number} month - Month (1-12)
 * @param {Number} year - Year
 * @param {ObjectId} initiatedBy - Employee ID who initiated
 * @returns {Object} Payroll run result
 */
async function runPayroll(db, tenantId, month, year, initiatedBy) {
    const PayrollRun = db.model('PayrollRun');
    const Payslip = db.model('Payslip');
    const Employee = db.model('Employee');
    const SalaryTemplate = db.model('SalaryTemplate');
    const Attendance = db.model('Attendance');
    const EmployeeDeduction = db.model('EmployeeDeduction');
    const DeductionMaster = db.model('DeductionMaster');
    const Holiday = db.model('Holiday');

    // Create or get payroll run
    let payrollRun = await PayrollRun.findOne({ tenantId, month, year });
    if (payrollRun && payrollRun.status !== 'INITIATED') {
        throw new Error(`Payroll for ${month}/${year} is already ${payrollRun.status}. Cannot recalculate.`);
    }

    if (!payrollRun) {
        payrollRun = new PayrollRun({
            tenantId,
            month,
            year,
            status: 'INITIATED',
            initiatedBy
        });
        await payrollRun.save();
    }

    // Get all active employees with salary templates
    const employees = await Employee.find({
        tenant: tenantId,
        status: 'Active'
    });

    payrollRun.totalEmployees = employees.length;
    payrollRun.processedEmployees = 0;
    payrollRun.failedEmployees = 0;
    payrollRun.errors = [];
    payrollRun.totalGross = 0;
    payrollRun.totalDeductions = 0;
    payrollRun.totalNetPay = 0;

    // Date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month
    const daysInMonth = endDate.getDate();

    // Get holidays for the month
    const holidays = await Holiday.find({
        tenant: tenantId,
        date: {
            $gte: startDate,
            $lte: endDate
        }
    });
    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

    // Process each employee
    for (const employee of employees) {
        try {
            const payslip = await calculateEmployeePayroll(
                db,
                tenantId,
                employee,
                month,
                year,
                startDate,
                endDate,
                daysInMonth,
                holidayDates,
                payrollRun._id
            );

            payrollRun.processedEmployees++;
            payrollRun.totalGross += payslip.grossEarnings;
            payrollRun.totalDeductions += (payslip.preTaxDeductionsTotal + payslip.postTaxDeductionsTotal + payslip.incomeTax);
            payrollRun.totalNetPay += payslip.netPay;

        } catch (error) {
            console.error(`[PAYROLL] Error processing employee ${employee._id}:`, error);
            payrollRun.failedEmployees++;
            payrollRun.errors.push({
                employeeId: employee._id,
                message: error.message,
                stack: error.stack
            });
        }
    }

    // Update payroll run status
    payrollRun.status = 'CALCULATED';
    payrollRun.calculatedBy = initiatedBy;
    payrollRun.calculatedAt = new Date();
    await payrollRun.save();

    // Lock attendance records for the month
    await Attendance.updateMany(
        {
            tenant: tenantId,
            date: { $gte: startDate, $lte: endDate }
        },
        { $set: { locked: true } }
    );

    return payrollRun;
}

/**
 * Calculate payroll for a single employee
 */
async function calculateEmployeePayroll(
    db,
    tenantId,
    employee,
    month,
    year,
    startDate,
    endDate,
    daysInMonth,
    holidayDates,
    payrollRunId,
    explicitTemplateId = null,
    dryRun = false
) {
    const Payslip = db.model('Payslip');
    const Attendance = db.model('Attendance');
    const EmployeeDeduction = db.model('EmployeeDeduction');
    const DeductionMaster = db.model('DeductionMaster');

    const SalaryAssignment = db.model('SalaryAssignment');
    const SalaryTemplate = db.model('SalaryTemplate');

    let salaryTemplate = null;

    if (explicitTemplateId) {
        salaryTemplate = await SalaryTemplate.findById(explicitTemplateId);
    } else {
        // 1. Check for valid assignment active for this month
        // Find latest assignment effective before or on the month's end date
        const assignment = await SalaryAssignment.findOne({
            tenantId,
            employeeId: employee._id,
            effectiveFrom: { $lte: endDate }
        }).sort({ effectiveFrom: -1 }).populate('salaryTemplateId');

        if (assignment) {
            // Check if the assignment had ended before the start of this payroll month
            if (assignment.effectiveTo && new Date(assignment.effectiveTo) < startDate) {
                salaryTemplate = null; // Expired assignment
            } else {
                salaryTemplate = assignment.salaryTemplateId;
            }
        }
    }
    /* 
    // FALLBACK REMOVED: Strict requirement to use SalaryAssignment
    else if (employee.salaryTemplateId) {
        ...
    } 
    */

    if (!salaryTemplate) {
        // Skip employee without template (not an error, just not payroll-ready)
        throw new Error(`Employee ${employee._id} has no active salary template assigned for this period`);
    }

    // Get attendance for the month
    const attendanceRecords = await Attendance.find({
        tenant: tenantId,
        employee: employee._id,
        date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    // Calculate attendance summary
    const attendanceSummary = calculateAttendanceSummary(
        attendanceRecords,
        daysInMonth,
        holidayDates,
        employee.joiningDate ? new Date(employee.joiningDate) : null,
        startDate
    );

    // STEP 1: Calculate Gross Earnings (with pro-rata)
    const grossCalculation = calculateGrossEarnings(
        salaryTemplate.earnings,
        daysInMonth,
        attendanceSummary.presentDays,
        attendanceSummary.lopDays
    );

    // STEP 2: Calculate Pre-Tax Deductions
    const preTaxDeductions = await calculatePreTaxDeductions(
        db,
        tenantId,
        employee._id,
        grossCalculation.totalGross,
        grossCalculation.basicAmount,
        salaryTemplate.settings
    );

    // STEP 3: Calculate Taxable Income
    const taxableIncome = grossCalculation.totalGross - preTaxDeductions.total;

    // STEP 4: Calculate Income Tax (TDS)
    // TODO: Implement proper TDS calculation based on tax regime
    // For now, using a placeholder
    const incomeTax = calculateTDS(taxableIncome, employee);

    // STEP 5: Calculate Post-Tax Deductions
    const postTaxDeductions = await calculatePostTaxDeductions(
        db,
        tenantId,
        employee._id,
        grossCalculation.totalGross,
        grossCalculation.basicAmount,
        attendanceSummary.lopDays,
        grossCalculation.basicAmount,
        daysInMonth
    );

    // STEP 6: Calculate Net Pay
    const netPay = (taxableIncome - incomeTax) - postTaxDeductions.total;

    // Prepare employer contributions snapshot (from template)
    const employerContributions = salaryTemplate.employerDeductions.map(contrib => ({
        name: contrib.name,
        amount: contrib.monthlyAmount
    }));

    // Create payslip snapshot
    const payslipData = {
        tenantId,
        employeeId: employee._id,
        payrollRunId: payrollRunId || new mongoose.Types.ObjectId(), // Mock ID for preview if null
        month,
        year,
        employeeInfo: {
            employeeId: employee.employeeId || '',
            name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
            department: employee.department || '',
            designation: employee.role || '',
            bankAccountNumber: employee.bankDetails?.accountNumber || '',
            bankIFSC: employee.bankDetails?.ifsc || '',
            bankName: employee.bankDetails?.bankName || '',
            panNumber: employee.documents?.panCard || ''
        },
        earningsSnapshot: grossCalculation.earningsSnapshot,
        preTaxDeductionsSnapshot: preTaxDeductions.snapshot,
        postTaxDeductionsSnapshot: postTaxDeductions.snapshot,
        employerContributionsSnapshot: employerContributions,
        grossEarnings: grossCalculation.totalGross,
        preTaxDeductionsTotal: preTaxDeductions.total,
        taxableIncome,
        incomeTax,
        postTaxDeductionsTotal: postTaxDeductions.total,
        netPay,
        attendanceSummary,
        salaryTemplateId: salaryTemplate._id,
        salaryTemplateSnapshot: {
            templateName: salaryTemplate.templateName,
            annualCTC: salaryTemplate.annualCTC,
            monthlyCTC: salaryTemplate.monthlyCTC
        },
        generatedBy: payrollRunId // Can be updated with actual user ID
    };

    const payslip = new Payslip(payslipData);

    if (!dryRun) {
        await payslip.save();
    }

    return payslip;
}

/**
 * Calculate attendance summary
 */
function calculateAttendanceSummary(attendanceRecords, daysInMonth, holidayDates, joiningDate, monthStartDate) {
    let presentDays = 0;
    let leaveDays = 0;
    let lopDays = 0;
    let holidayDays = 0;

    // Check if employee joined mid-month
    const actualStartDate = joiningDate && joiningDate > monthStartDate ? joiningDate : monthStartDate;
    const actualDaysInMonth = actualStartDate > monthStartDate
        ? daysInMonth - (actualStartDate.getDate() - 1)
        : daysInMonth;

    attendanceRecords.forEach(record => {
        const dateStr = record.date.toISOString().split('T')[0];
        if (holidayDates.has(dateStr)) {
            holidayDays++;
        } else if (record.status === 'present' || record.status === 'half_day') {
            presentDays += record.status === 'half_day' ? 0.5 : 1;
        } else if (record.status === 'leave') {
            // Check if paid leave or unpaid (LOP)
            if (record.leaveType && record.leaveType.toLowerCase().includes('lop')) {
                lopDays++;
            } else {
                leaveDays++;
            }
        } else if (record.status === 'absent') {
            lopDays++;
        }
    });

    return {
        totalDays: actualDaysInMonth,
        presentDays,
        leaveDays,
        lopDays,
        holidayDays
    };
}

/**
 * Calculate Gross Earnings with pro-rata
 */
function calculateGrossEarnings(earnings, daysInMonth, presentDays, lopDays) {
    const earningsSnapshot = [];
    let totalGross = 0;
    let basicAmount = 0;

    earnings.forEach(earning => {
        let amount = earning.monthlyAmount || 0;
        let originalAmount = amount;
        let isProRata = false;
        let daysWorked = presentDays;
        let totalDays = daysInMonth;

        // Apply pro-rata if enabled (typically for Basic and some allowances)
        // Note: In practice, only certain components are pro-rated
        // For now, we'll apply pro-rata based on present days
        // TODO: Add flag to earnings template to indicate which components should be pro-rated

        // Basic salary is typically pro-rated
        if (earning.name.toLowerCase().includes('basic')) {
            basicAmount = amount;
            // Pro-rata calculation: (amount / daysInMonth) * presentDays
            amount = Math.round((amount / daysInMonth) * presentDays * 100) / 100;
            isProRata = true;
        }

        earningsSnapshot.push({
            name: earning.name,
            amount: Math.round(amount * 100) / 100,
            isProRata,
            originalAmount: originalAmount,
            daysWorked: isProRata ? presentDays : null,
            totalDays: isProRata ? daysInMonth : null
        });

        totalGross += amount;
    });

    return {
        earningsSnapshot,
        totalGross: Math.round(totalGross * 100) / 100,
        basicAmount
    };
}

/**
 * Calculate Pre-Tax Deductions (EPF, ESI, Professional Tax, TDS)
 */
async function calculatePreTaxDeductions(db, tenantId, employeeId, grossEarnings, basicAmount, templateSettings) {
    const EmployeeDeduction = db.model('EmployeeDeduction');
    const DeductionMaster = db.model('DeductionMaster');

    const snapshot = [];
    let total = 0;

    // Get active employee deductions
    const employeeDeductions = await EmployeeDeduction.find({
        tenantId,
        employeeId,
        status: 'ACTIVE',
        startDate: { $lte: new Date() },
        $or: [
            { endDate: null },
            { endDate: { $gte: new Date() } }
        ]
    }).populate('deductionId');

    // Filter pre-tax deductions
    const preTaxDeductions = employeeDeductions.filter(ed =>
        ed.deductionId && ed.deductionId.category === 'PRE_TAX'
    );

    // Calculate EPF (Employee Contribution)
    const epfDeduction = preTaxDeductions.find(d =>
        d.deductionId.name.toLowerCase().includes('pf') ||
        d.deductionId.name.toLowerCase().includes('epf')
    );

    if (epfDeduction || templateSettings?.includePensionScheme) {
        const pfWage = templateSettings?.pfWageRestriction
            ? Math.min(basicAmount, templateSettings.pfWageLimit || 15000)
            : basicAmount;
        const epfAmount = Math.round((pfWage * 0.12) * 100) / 100; // 12% of PF wage
        snapshot.push({
            name: 'Employee Provident Fund (EPF)',
            amount: epfAmount,
            category: 'EPF'
        });
        total += epfAmount;
    }

    // Calculate ESI (Employee Contribution) - 0.75% of Gross
    if (grossEarnings <= 21000 && templateSettings?.includeESI) {
        const esiAmount = Math.round((grossEarnings * 0.0075) * 100) / 100;
        snapshot.push({
            name: 'Employee State Insurance (ESI)',
            amount: esiAmount,
            category: 'ESI'
        });
        total += esiAmount;
    }

    // Calculate other pre-tax deductions from EmployeeDeduction
    for (const ed of preTaxDeductions) {
        const master = ed.deductionId;
        if (master.name.toLowerCase().includes('pf') || master.name.toLowerCase().includes('epf')) {
            continue; // Already calculated
        }
        if (master.name.toLowerCase().includes('esi')) {
            continue; // Already calculated
        }

        let amount = 0;
        const baseValue = ed.customValue !== null && ed.customValue !== undefined ? ed.customValue : master.amountValue;

        if (master.amountType === 'FIXED') {
            amount = baseValue;
        } else if (master.amountType === 'PERCENTAGE') {
            const baseAmount = master.calculationBase === 'BASIC' ? basicAmount : grossEarnings;
            amount = Math.round((baseAmount * baseValue / 100) * 100) / 100;
        }

        if (amount > 0) {
            snapshot.push({
                name: master.name,
                amount,
                category: 'OTHER'
            });
            total += amount;
        }
    }

    return {
        snapshot,
        total: Math.round(total * 100) / 100
    };
}

/**
 * Calculate Income Tax (TDS) - Placeholder implementation
 * TODO: Implement proper tax calculation based on:
 * - Tax regime (Old vs New)
 * - Annual income projection
 * - Investments and deductions
 * - Tax slabs
 */
function calculateTDS(taxableIncome, employee) {
    // Placeholder: Simple tax calculation
    // In production, this should use proper tax calculation service
    // For now, returning 0 or a basic calculation

    // Annual taxable income projection
    const annualTaxableIncome = taxableIncome * 12;

    // Basic tax calculation (Old Regime - simplified)
    let tax = 0;
    if (annualTaxableIncome > 500000) {
        tax = ((annualTaxableIncome - 500000) * 0.20) + 12500;
    } else if (annualTaxableIncome > 250000) {
        tax = (annualTaxableIncome - 250000) * 0.05;
    }

    // Monthly TDS
    const monthlyTDS = Math.round((tax / 12) * 100) / 100;

    return monthlyTDS;
}

/**
 * Calculate Post-Tax Deductions (Loans, LOP, Advances, Penalties)
 */
async function calculatePostTaxDeductions(
    db,
    tenantId,
    employeeId,
    grossEarnings,
    basicAmount,
    lopDays,
    monthlyBasic,
    daysInMonth
) {
    const EmployeeDeduction = db.model('EmployeeDeduction');
    const DeductionMaster = db.model('DeductionMaster');

    const snapshot = [];
    let total = 0;

    // Get active employee deductions
    const employeeDeductions = await EmployeeDeduction.find({
        tenantId,
        employeeId,
        status: 'ACTIVE',
        startDate: { $lte: new Date() },
        $or: [
            { endDate: null },
            { endDate: { $gte: new Date() } }
        ]
    }).populate('deductionId');

    // Filter post-tax deductions
    const postTaxDeductions = employeeDeductions.filter(ed =>
        ed.deductionId && ed.deductionId.category === 'POST_TAX'
    );

    // Calculate LOP (Loss of Pay)
    if (lopDays > 0) {
        const lopAmount = Math.round((monthlyBasic / daysInMonth) * lopDays * 100) / 100;
        snapshot.push({
            name: 'Loss of Pay (LOP)',
            amount: lopAmount,
            category: 'LOP'
        });
        total += lopAmount;
    }

    // Calculate other post-tax deductions
    for (const ed of postTaxDeductions) {
        const master = ed.deductionId;

        // Skip LOP if already calculated above
        if (master.name.toLowerCase().includes('lop') || master.name.toLowerCase().includes('loss of pay')) {
            continue;
        }

        let amount = 0;
        const baseValue = ed.customValue !== null && ed.customValue !== undefined ? ed.customValue : master.amountValue;

        if (master.amountType === 'FIXED') {
            amount = baseValue;
        } else if (master.amountType === 'PERCENTAGE') {
            const baseAmount = master.calculationBase === 'BASIC' ? basicAmount : grossEarnings;
            amount = Math.round((baseAmount * baseValue / 100) * 100) / 100;
        }

        if (amount > 0) {
            snapshot.push({
                name: master.name,
                amount,
                category: 'OTHER'
            });
            total += amount;
        }
    }

    return {
        snapshot,
        total: Math.round(total * 100) / 100
    };
}

module.exports = {
    runPayroll,
    calculateEmployeePayroll
};

