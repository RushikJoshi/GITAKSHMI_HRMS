/**
 * Salary Breakup Calculator Service
 * Used for validation and suggestion of salary structures
 */

// Calculate and validate salary breakup against CTC
exports.calculateSalaryBreakup = ({ enteredCTC, earnings, deductions, employerContributions }) => {
    // Helper to get annual amount
    const getAnnual = (item) => {
        const val = Number(item.amount) || Number(item.monthly) || 0;
        return val * 12;
    };

    const totalEarnings = (earnings || []).reduce((sum, e) => sum + getAnnual(e), 0);
    const totalBenefits = (employerContributions || []).reduce((sum, b) => sum + getAnnual(b), 0);
    const totalDeductions = (deductions || []).reduce((sum, d) => sum + getAnnual(d), 0);

    const calculatedCTC = totalEarnings + totalBenefits;
    const mismatch = Math.abs(calculatedCTC - enteredCTC);
    const isValid = mismatch < 50; // Allow small rounding differences

    const monthlyGross = Math.round(totalEarnings / 12);
    const monthlyDeductions = Math.round(totalDeductions / 12);
    const monthlyNet = monthlyGross - monthlyDeductions;
    const monthlyBenefits = Math.round(totalBenefits / 12);

    return {
        isValid,
        mismatchAmount: Math.round(mismatch),
        expectedCTC: enteredCTC,
        receivedCTC: Math.round(calculatedCTC),
        monthly: {
            grossEarnings: monthlyGross,
            totalDeductions: monthlyDeductions,
            netSalary: monthlyNet,
            employerContributions: monthlyBenefits
        },
        annual: {
            ctc: Math.round(calculatedCTC)
        },
        earnings: (earnings || []).map(e => ({
            ...e,
            amount: Math.round((Number(e.amount) || Number(e.monthly) || 0) * 100) / 100
        })),
        deductions: (deductions || []).map(d => ({
            ...d,
            amount: Math.round((Number(d.amount) || Number(d.monthly) || 0) * 100) / 100
        })),
        employerContributions: (employerContributions || []).map(b => ({
            ...b,
            amount: Math.round((Number(b.amount) || Number(b.monthly) || 0) * 100) / 100
        }))
    };
};

// Suggest a standard salary structure based on CTC
exports.suggestSalaryBreakup = ({ enteredCTC, availableEarnings, availableDeductions, availableEmployerContributions }) => {
    const monthlyCTC = Math.round(enteredCTC / 12);

    // 1. Basic = 50% of CTC
    let basic = Math.round(monthlyCTC * 0.5);

    // 2. PF (Employer) = 12% of Basic (capped at 15000 basic -> 1800)
    let pfWage = Math.min(basic, 15000);
    let employerPF = Math.round(pfWage * 0.12);

    // 3. HRA = 40% of Basic (Standard)
    let hra = Math.round(basic * 0.4);

    // 4. Special = Remainder
    // CTC = Basic + HRA + Special + EmployerPF
    // Special = CTC - Basic - HRA - EmployerPF
    let special = monthlyCTC - basic - hra - employerPF;

    if (special < 0) {
        // Adjust Basic to fit
        basic = Math.round(monthlyCTC * 0.4);
        hra = Math.round(basic * 0.4);
        pfWage = Math.min(basic, 15000);
        employerPF = Math.round(pfWage * 0.12);
        special = monthlyCTC - basic - hra - employerPF;
    }

    // Construct response
    const suggestedEarnings = [
        { name: 'Basic Salary', label: 'Basic Salary', amount: basic, monthly: basic },
        { name: 'House Rent Allowance', label: 'House Rent Allowance', amount: hra, monthly: hra },
        { name: 'Special Allowance', label: 'Special Allowance', amount: special > 0 ? special : 0, monthly: special > 0 ? special : 0 }
    ];

    const suggestedBenefits = [
        { name: 'Employer PF', label: 'Employer PF', amount: employerPF, monthly: employerPF }
    ];

    const suggestedDeductions = [
        { name: 'Employee PF', label: 'Employee PF', amount: employerPF, monthly: employerPF },
        { name: 'Professional Tax', label: 'Professional Tax', amount: 200, monthly: 200 }
    ];

    return {
        earnings: suggestedEarnings,
        employerContributions: suggestedBenefits,
        deductions: suggestedDeductions,
        totals: {
            monthlyCTC,
            annualCTC: enteredCTC
        }
    };
};
