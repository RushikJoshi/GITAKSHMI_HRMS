/**
 * SALARY STRUCTURE CONTROLLER
 * Atlas Free Tier Safe - NO dynamic collections
 * Uses SINGLE global SalaryStructure model
 */

const SalaryStructure = require('../models/SalaryStructure'); // GLOBAL model
const { calculateSalaryBreakup, suggestSalaryBreakup } = require('../services/salaryBreakupCalculator');

/**
 * Helper to get models from tenant database
 * ONLY for tenant-specific data (Applicant, Components)
 * SalaryStructure is ALWAYS global
 */
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
 * SUGGEST SALARY STRUCTURE
 * GET /api/salary-structure/suggest
 */
exports.suggestSalaryStructure = async (req, res) => {
    try {
        const { enteredCTC } = req.body;

        if (!enteredCTC) {
            return res.status(400).json({
                success: false,
                message: "Annual CTC is required for suggestion.",
                field: 'enteredCTC'
            });
        }

        const models = getModels(req);

        // Fetch ALL available components in parallel
        const [earnings, deductions, benefits] = await Promise.all([
            models.SalaryComponent.find({ isActive: true }).lean(),
            models.DeductionMaster.find({ isActive: true }).lean(),
            models.BenefitComponent.find({ isActive: true }).lean()
        ]);

        const suggestion = suggestSalaryBreakup({
            enteredCTC: Number(enteredCTC),
            availableEarnings: earnings,
            availableDeductions: deductions,
            availableEmployerContributions: benefits
        });

        res.json({
            success: true,
            data: suggestion
        });

    } catch (error) {
        console.error("❌ Suggest Salary Structure Error:", error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate salary suggestion',
            error: error.message
        });
    }
};

/**
 * CREATE/UPDATE SALARY STRUCTURE
 * POST /api/salary-structure/create
 * 
 * CRITICAL: Uses GLOBAL SalaryStructure model
 * NO dynamic collections created
 */
exports.createSalaryStructure = async (req, res) => {
    try {
        const { candidateId, calculationMode, enteredCTC, earnings, deductions, employerContributions } = req.body;

        // ===== VALIDATION =====
        if (!candidateId) {
            return res.status(400).json({
                success: false,
                message: 'Candidate ID is required',
                field: 'candidateId'
            });
        }

        if (!enteredCTC || isNaN(Number(enteredCTC)) || Number(enteredCTC) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid Annual CTC is required and must be greater than 0',
                field: 'enteredCTC',
                received: enteredCTC
            });
        }

        if (!req.tenantId) {
            return res.status(400).json({
                success: false,
                message: 'Tenant ID is required',
                field: 'tenantId'
            });
        }

        const { Applicant } = getModels(req);

        // ===== CHECK CANDIDATE EXISTS =====
        const applicant = await Applicant.findById(candidateId);
        if (!applicant) {
            return res.status(404).json({
                success: false,
                message: 'Candidate not found',
                candidateId
            });
        }

        // ===== CALCULATE & VALIDATE =====
        const result = calculateSalaryBreakup({
            enteredCTC: Number(enteredCTC),
            earnings: Array.isArray(earnings) ? earnings : [],
            deductions: Array.isArray(deductions) ? deductions : [],
            employerContributions: Array.isArray(employerContributions) ? employerContributions : []
        });

        // ===== STRICT VALIDATION (AUTO MODE) =====
        if (calculationMode === 'AUTO' && !result.isValid) {
            return res.status(400).json({
                success: false,
                error: 'CTC_MISMATCH',
                message: `CTC Calculation Mismatch Detected`,
                details: {
                    enteredCTC: result.expectedCTC,
                    calculatedCTC: result.receivedCTC,
                    difference: result.mismatchAmount,
                    formula: 'CTC = Gross Earnings + Employer Contributions',
                    breakdown: {
                        grossEarnings: result.monthly.grossEarnings * 12,
                        employerContributions: result.monthly.employerContributions * 12,
                        total: (result.monthly.grossEarnings + result.monthly.employerContributions) * 12
                    }
                },
                action: 'Please adjust salary components to match the entered CTC'
            });
        }

        // ===== PERSIST DATA (GLOBAL MODEL) =====
        const structureData = {
            tenantId: req.tenantId, // Multi-tenancy via data
            candidateId,
            calculationMode: calculationMode || 'AUTO',
            earnings: result.earnings.map(e => ({
                key: e.componentId || e._id,
                label: e.name,
                monthly: e.amount,
                yearly: Number(e.amount) * 12,
                type: 'earning',
                isSelected: true
            })),
            deductions: result.deductions.map(d => ({
                key: d.componentId || d._id,
                label: d.name,
                monthly: d.amount,
                yearly: Number(d.amount) * 12,
                type: 'deduction',
                isSelected: true
            })),
            employerBenefits: result.employerContributions.map(b => ({
                key: b.componentId || b._id,
                label: b.name,
                monthly: b.amount,
                yearly: Number(b.amount) * 12,
                type: 'employer_benefit',
                isSelected: true
            })),
            totals: {
                grossEarnings: result.monthly.grossEarnings,
                totalDeductions: result.monthly.totalDeductions,
                netSalary: result.monthly.netSalary,
                employerBenefits: result.monthly.employerContributions,
                monthlyCTC: Math.round((result.annual.ctc / 12) * 100) / 100,
                annualCTC: result.annual.ctc
            },
            validation: {
                isValid: result.isValid,
                mismatchAmount: result.mismatchAmount,
                validatedAt: new Date()
            },
            updatedAt: new Date(),
            updatedBy: req.user?.name || 'System'
        };

        // Use GLOBAL SalaryStructure model (NO tenant-specific collection)
        const updatedStructure = await SalaryStructure.findOneAndUpdate(
            { tenantId: req.tenantId, candidateId }, // Query by tenant + candidate
            { $set: structureData },
            { new: true, upsert: true }
        );

        // ===== UPDATE APPLICANT SNAPSHOT =====
        const snapshot = {
            earnings: structureData.earnings.map(e => ({
                name: e.label,
                monthlyAmount: e.monthly,
                annualAmount: e.yearly
            })),
            employeeDeductions: structureData.deductions.map(d => ({
                name: d.label,
                monthlyAmount: d.monthly,
                annualAmount: d.yearly
            })),
            employerContributions: structureData.employerBenefits.map(b => ({
                name: b.label,
                monthlyAmount: b.monthly,
                annualAmount: b.yearly
            })),
            grossA: {
                monthly: result.monthly.grossEarnings,
                yearly: result.monthly.grossEarnings * 12
            },
            takeHome: {
                monthly: result.monthly.netSalary,
                yearly: result.monthly.netSalary * 12
            },
            ctc: {
                monthly: Math.round(result.annual.ctc / 12),
                yearly: result.annual.ctc
            },
            totals: {
                grossEarnings: result.monthly.grossEarnings,
                totalDeductions: result.monthly.totalDeductions,
                netSalary: result.monthly.netSalary,
                employerBenefits: result.monthly.employerContributions,
                monthlyCTC: Math.round(result.annual.ctc / 12),
                annualCTC: result.annual.ctc
            },
            calculatedAt: new Date()
        };

        await Applicant.findByIdAndUpdate(candidateId, {
            $set: {
                ctc: result.receivedCTC,
                salarySnapshot: snapshot,
                salaryStructureId: updatedStructure._id
            }
        });

        // ===== SUCCESS RESPONSE =====
        res.json({
            success: true,
            message: 'Salary structure saved successfully',
            data: updatedStructure,
            validation: {
                isValid: result.isValid,
                mismatchAmount: result.mismatchAmount
            }
        });

    } catch (error) {
        console.error('❌ Create Salary Structure Error:', error);

        // Distinguish between validation errors and server errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: Object.keys(error.errors).map(key => ({
                    field: key,
                    message: error.errors[key].message
                }))
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to create salary structure',
            error: error.message
        });
    }
};

/**
 * GET SALARY STRUCTURE
 * GET /api/salary-structure/:candidateId
 */
exports.getSalaryStructure = async (req, res) => {
    try {
        const { candidateId } = req.params;

        if (!req.tenantId) {
            return res.status(400).json({
                success: false,
                message: 'Tenant ID is required'
            });
        }

        // Query GLOBAL model with tenant filter
        const structure = await SalaryStructure.findOne({
            tenantId: req.tenantId,
            candidateId
        });

        if (!structure) {
            return res.status(404).json({
                success: false,
                message: "Salary structure not found for this candidate."
            });
        }

        res.json({
            success: true,
            data: structure
        });

    } catch (error) {
        console.error('❌ Get Salary Structure Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch salary structure',
            error: error.message
        });
    }
};

/**
 * DELETE SALARY STRUCTURE
 * DELETE /api/salary-structure/:candidateId
 */
exports.deleteSalaryStructure = async (req, res) => {
    try {
        const { candidateId } = req.params;

        if (!req.tenantId) {
            return res.status(400).json({
                success: false,
                message: 'Tenant ID is required'
            });
        }

        // Delete from GLOBAL model with tenant filter
        const deleted = await SalaryStructure.findOneAndDelete({
            tenantId: req.tenantId,
            candidateId
        });

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "Salary structure not found"
            });
        }

        res.json({
            success: true,
            message: 'Salary structure deleted successfully'
        });

    } catch (error) {
        console.error('❌ Delete Salary Structure Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete salary structure',
            error: error.message
        });
    }
};
