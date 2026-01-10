const { calculateSalaryBreakup, suggestSalaryBreakup } = require('../services/salaryBreakupCalculator');

// ✅ GLOBAL SalaryStructure model (single collection)
const SalaryStructure = require('../models/SalaryStructure');

// Helper to get tenant models (SalaryStructure excluded)
function getModels(req) {
    if (!req.tenantDB) {
        throw new Error("Tenant database connection not available");
    }
    const db = req.tenantDB;
    return {
        Applicant: db.model("Applicant"),
        SalaryComponent: db.model("SalaryComponent"),
        DeductionMaster: db.model("DeductionMaster"),
        BenefitComponent: db.model("BenefitComponent")
    };
}

/**
 * @route POST /api/salary-structure/suggest
 * @desc Suggest salary structure based on CTC
 */
exports.suggestSalaryStructure = async (req, res) => {
    try {
        const { enteredCTC } = req.body;
        if (!enteredCTC) return res.status(400).json({ message: "Entered CTC is required" });

        const suggestion = suggestSalaryBreakup({ enteredCTC: Number(enteredCTC) });

        res.json({
            success: true,
            data: suggestion
        });
    } catch (error) {
        console.error("Suggest Error:", error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * @route POST /api/salary-structure/create
 * @desc Create or Update Salary Structure (GLOBAL collection, tenant-safe)
 */
exports.createSalaryStructure = async (req, res) => {
    try {
        const {
            candidateId,
            calculationMode,
            enteredCTC,
            earnings,
            deductions,
            employerContributions
        } = req.body;

        if (!candidateId) {
            return res.status(400).json({ message: "Candidate ID is required" });
        }

        if (!enteredCTC || isNaN(Number(enteredCTC))) {
            return res.status(400).json({ message: "Annual CTC is required and must be numeric" });
        }

        const tenantId = req.user?.tenant || req.user?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ message: "Tenant ID missing in user context" });
        }

        const { Applicant } = getModels(req);

        // 🔢 Salary Calculation (single source of truth)
        const result = calculateSalaryBreakup({
            enteredCTC: Number(enteredCTC),
            earnings: Array.isArray(earnings) ? earnings : [],
            deductions: Array.isArray(deductions) ? deductions : [],
            employerContributions: Array.isArray(employerContributions) ? employerContributions : []
        });

        // ❌ Block invalid AUTO calculation
        if (calculationMode === 'AUTO' && !result.isValid) {
            return res.status(400).json({
                error: "CTC_MISMATCH",
                message: `Calculated CTC (₹${result.receivedCTC}) does not match Entered CTC (₹${result.expectedCTC})`,
                mismatchAmount: result.mismatchAmount
            });
        }

        // 🧱 Persist into ONE global collection
        const structureData = {
            tenantId,
            candidateId,
            calculationMode: calculationMode || 'AUTO',

            earnings: result.earnings.map(e => ({
                key: e.componentId || e._id,
                label: e.name,
                monthly: e.amount,
                yearly: e.amount * 12,
                type: 'earning'
            })),

            deductions: result.deductions.map(d => ({
                key: d.componentId || d._id,
                label: d.name,
                monthly: d.amount,
                yearly: d.amount * 12,
                type: 'deduction'
            })),

            employerBenefits: result.employerContributions.map(b => ({
                key: b.componentId || b._id,
                label: b.name,
                monthly: b.amount,
                yearly: b.amount * 12,
                type: 'employer_benefit'
            })),

            totals: {
                grossEarnings: result.monthly.grossEarnings,
                totalDeductions: result.monthly.totalDeductions,
                netSalary: result.monthly.netSalary,
                employerBenefits: result.monthly.employerContributions,
                monthlyCTC: Math.round(result.annual.ctc / 12),
                annualCTC: result.annual.ctc
            },

            validation: {
                isValid: result.isValid,
                mismatchAmount: result.mismatchAmount,
                validatedAt: new Date()
            },

            updatedBy: req.user?.name || 'System',
            updatedAt: new Date()
        };

        const savedStructure = await SalaryStructure.findOneAndUpdate(
            { tenantId, candidateId },
            { $set: structureData },
            { upsert: true, new: true }
        );

        // 🔄 Snapshot into Applicant (NO new collection)
        await Applicant.findByIdAndUpdate(candidateId, {
            $set: {
                ctc: result.receivedCTC,
                salaryStructureId: savedStructure._id,
                salarySnapshot: {
                    earnings: structureData.earnings,
                    deductions: structureData.deductions,
                    employerBenefits: structureData.employerBenefits,
                    totals: structureData.totals,
                    calculatedAt: new Date()
                }
            }
        });

        return res.json({
            success: true,
            message: "Salary structure saved successfully",
            data: savedStructure
        });

    } catch (err) {
        console.error("❌ Salary Structure Error:", err);
        return res.status(500).json({ message: err.message });
    }
};

/**
 * @route GET /api/salary-structure/:candidateId
 * @desc Fetch salary structure for candidate
 */
exports.getSalaryStructure = async (req, res) => {
    try {
        const { candidateId } = req.params;
        const tenantId = req.user?.tenant || req.user?.tenantId;

        if (!tenantId) {
            return res.status(400).json({ message: "Tenant ID required" });
        }

        const structure = await SalaryStructure.findOne({ tenantId, candidateId });

        if (!structure) {
            return res.status(404).json({ message: "Salary structure not found" });
        }

        return res.json(structure);

    } catch (err) {
        console.error("❌ Get Salary Structure Error:", err);
        return res.status(500).json({ message: err.message });
    }
};
    