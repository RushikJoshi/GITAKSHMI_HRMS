const mongoose = require('mongoose');

const RequirementSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true, required: true },
  jobTitle: { type: String, trim: true, required: true },
  department: { type: String, trim: true, required: true },
  vacancy: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['Open', 'Closed'], default: 'Open' },
  updatedAt: { type: Date, default: Date.now },
  publicFields: { type: [String], default: [] },
  workflow: { type: [String], default: ['Applied', 'Shortlisted', 'Interview', 'Finalized'] }
}, { strict: false });

module.exports = RequirementSchema;