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

            // We use a mock ID for preview
            const mockEmployeeId = new mongoose.Types.ObjectId();

            // We use the SalaryEngine but don't save to DB (we just return the resolved components)
            // Actually, SalaryEngine.generateSnapshot saves to DB. 
            // I should refactor SalaryEngine to have a 'resolve' method or just handle it here.

            // Let's call it 'resolveOnly' if I had it, but for now I'll just use the engine logic partially.
            // Better: Update SalaryEngine to have 'resolve' method.

            const resolved = await SalaryEngine.generateSnapshot({
                tenantDB,
                employeeId: mockEmployeeId,
                tenantId: req.tenantId,
                annualCTC: Number(ctcAnnual),
                template,
                effectiveDate: new Date()
            });

            // Cleanup the preview snapshot if we don't want to keep it
            await tenantDB.model('EmployeeSalarySnapshot').findByIdAndDelete(resolved._id);

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
                        salaryTemplateId: templateId,
                        // We could also store a ref to the latest snapshot
                        'meta.latestSalarySnapshot': snapshot._id
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
