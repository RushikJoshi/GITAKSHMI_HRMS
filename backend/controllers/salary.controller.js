const mongoose = require('mongoose');
const SalaryEngine = require('../services/salaryEngine');

/**
 * Controller for Salary Operations (Immutability Focused)
 */
const SalaryController = {
    /**
     * Preview a salary breakup without saving anything
     * GET /api/salary/preview
     */
    preview: async (req, res) => {
        try {
            const { templateId, ctcAnnual } = req.query;
            const tenantDB = req.tenantDB;

            if (!templateId || !ctcAnnual) {
                return res.status(400).json({ success: false, message: "templateId and ctcAnnual are required" });
            }

            const SalaryTemplate = tenantDB.model('SalaryTemplate');
            const template = await SalaryTemplate.findById(templateId);

            if (!template) {
                return res.status(404).json({ success: false, message: "Template not found" });
            }

            // Calculation only - no DB write
            const resolved = await SalaryEngine.calculate({
                annualCTC: Number(ctcAnnual),
                template
            });

            res.json({
                success: true,
                data: resolved
            });

        } catch (error) {
            console.error("[SALARY_PREVIEW] Error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * Assign salary to an employee (Creates Immutable Snapshot)
     * POST /api/salary/assign
     */
    assign: async (req, res) => {
        try {
            const { employeeId, applicantId, templateId, ctcAnnual, effectiveDate } = req.body;
            const tenantDB = req.tenantDB;

            if (!templateId || !ctcAnnual) {
                return res.status(400).json({ success: false, message: "templateId and ctcAnnual are required" });
            }

            const SalaryTemplate = tenantDB.model('SalaryTemplate');
            const template = await SalaryTemplate.findById(templateId);

            if (!template) {
                return res.status(404).json({ success: false, message: "Template not found" });
            }

            const snapshot = await SalaryEngine.generateSnapshot({
                tenantDB,
                employeeId,
                applicantId,
                tenantId: req.tenantId,
                annualCTC: Number(ctcAnnual),
                template,
                effectiveDate: effectiveDate || new Date()
            });

            // Update Employee record if employeeId is present
            if (employeeId) {
                const Employee = tenantDB.model('Employee');
                await Employee.findByIdAndUpdate(employeeId, {
                    $set: {
                        salaryTemplateId: templateId, // Legacy ref for UI
                        salarySnapshotId: snapshot._id // New single source of truth
                    }
                });
            }

            // Update Applicant record if applicantId is present
            if (applicantId) {
                const Applicant = tenantDB.model('Applicant');
                await Applicant.findByIdAndUpdate(applicantId, {
                    $set: {
                        ctc: Number(ctcAnnual),
                        salarySnapshotId: snapshot._id // New field for immutable snapshot
                    }
                });
            }

            res.status(201).json({
                success: true,
                message: "Salary assigned and snapshot created successfully",
                data: snapshot
            });

        } catch (error) {
            console.error("[SALARY_ASSIGN] Error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
};

module.exports = SalaryController;
