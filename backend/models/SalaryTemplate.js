const mongoose = require('mongoose');

const SalaryTemplateSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    templateName: { type: String, required: true, trim: true },
    description: { type: String, trim: true, maxlength: 500 },
    annualCTC: { type: Number, required: true, default: 0 },
    monthlyCTC: { type: Number, required: true, default: 0 },

    earnings: [{
        name: { type: String, required: true },
        componentCode: { type: String }, // Link to SalaryComponent if available
        calculationType: {
            type: String,
            enum: ['PERCENT_CTC', 'PERCENT_BASIC', 'FIXED', 'FLAT_AMOUNT', 'FORMULA'],
            default: 'FIXED'
        },
        formula: { type: String }, // e.g. "CTC * 0.4"
        percentage: { type: Number, default: 0 }, // percentage value
        monthlyAmount: { type: Number, required: true },
        annualAmount: { type: Number, required: true },
        isRemovable: { type: Boolean, default: true },
        enabled: { type: Boolean, default: true }
    }],

    employerDeductions: [{
        name: { type: String, required: true },
        componentCode: { type: String },
        calculationType: { type: String, default: 'PERCENT_PF_WAGE' },
        formula: { type: String },
        percentage: { type: Number, default: 0 },
        monthlyAmount: { type: Number, required: true },
        annualAmount: { type: Number, required: true },
        enabled: { type: Boolean, default: true }
    }],

    employeeDeductions: [{
        name: { type: String, required: true },
        componentCode: { type: String }, // Link to DeductionMaster
        category: { type: String, enum: ['PRE_TAX', 'POST_TAX'] },
        amountType: { type: String, enum: ['FIXED', 'PERCENTAGE', 'FORMULA'] },
        formula: { type: String },
        calculationBase: { type: String, enum: ['BASIC', 'GROSS'] },
        amountValue: { type: Number },
        monthlyAmount: { type: Number, default: 0 },
        enabled: { type: Boolean, default: true }
    }],

    settings: {
        includePensionScheme: { type: Boolean, default: true },
        includeESI: { type: Boolean, default: true },
        pfWageRestriction: { type: Boolean, default: true }, // Restricted to 15000
        pfWageLimit: { type: Number, default: 15000 }
    },

    isAssigned: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Ensure unique template names per tenant
SalaryTemplateSchema.index({ tenantId: 1, templateName: 1 }, { unique: true });

module.exports = SalaryTemplateSchema;
