const mongoose = require('mongoose');
const SalaryEngine = require('../services/salaryEngine');

// Helper to get models from tenant database
function getModels(req) {
    if (!req.tenantDB) {
        throw new Error("Tenant database connection not available");
    }
    const db = req.tenantDB;
    return {
        // Use db.models if already registered, otherwise fallback to schema
        // CompanyPayrollRule is a NEW model, needs schema
        CompanyPayrollRule: db.models.CompanyPayrollRule || db.model("CompanyPayrollRule", require('../models/CompanyPayrollRule'))
    };
}

/**
 * Get Company Payroll Rules
 */
exports.getRules = async (req, res) => {
    try {
        const { CompanyPayrollRule } = getModels(req);
        let rules = await CompanyPayrollRule.findOne({ tenantId: req.user.tenantId });

        if (!rules) {
            // Return defaults if not found
            rules = new CompanyPayrollRule({ tenantId: req.user.tenantId });
            await rules.save();
        }

        res.json(rules);
    } catch (error) {
        console.error("Get Payroll Rules Error:", error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Update Company Payroll Rules
 */
exports.updateRules = async (req, res) => {
    try {
        const { CompanyPayrollRule } = getModels(req);
        const updates = req.body;

        // Find and update or create
        const rules = await CompanyPayrollRule.findOneAndUpdate(
            { tenantId: req.user.tenantId },
            { $set: updates },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.json(rules);
    } catch (error) {
        console.error("Update Payroll Rules Error:", error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Calculate Salary Breakup (Preview)
 * Use this for the Salary Structure UI to auto-populate
 */
exports.calculateBreakup = async (req, res) => {
    res.status(410).json({ message: "This endpoint is deprecated. Use SalaryController.preview instead." });
};
