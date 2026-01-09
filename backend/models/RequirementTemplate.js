const mongoose = require('mongoose');

const RequirementFieldSchema = new mongoose.Schema({
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, required: true, default: 'text' },
    placeholder: { type: String },
    required: { type: Boolean, default: false },
    defaultValue: { type: mongoose.Schema.Types.Mixed },
    options: [{ type: String }],
    section: { type: String, default: 'Basic Details' },
    isSystem: { type: Boolean, default: false }
});

const RequirementTemplateSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, default: 'Standard Job Requirement' },
    fields: [RequirementFieldSchema],
    sections: [{ type: String }],
    isDefault: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { strict: false });

module.exports = RequirementTemplateSchema;
