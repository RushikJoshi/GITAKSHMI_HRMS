const mongoose = require('mongoose');

/**
 * SINGLE GLOBAL SALARY STRUCTURE COLLECTION
 * Handles ALL tenants - NO dynamic collections
 * Atlas Free Tier Safe
 */
const SalaryStructureSchema = new mongoose.Schema({
  // Multi-tenancy via data, not collections
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true // Critical for query performance
  },

  // Link to candidate/employee
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },

  // Calculation mode
  calculationMode: {
    type: String,
    enum: ['AUTO', 'MANUAL'],
    default: 'AUTO'
  },

  // Earnings (monthly amounts)
  earnings: [{
    key: String,  // Component ID
    label: String,  // Component name
    monthly: Number,
    yearly: Number,
    type: { type: String, default: 'earning' },
    isSelected: { type: Boolean, default: true },
    showInJoiningLetter: { type: Boolean, default: true }
  }],

  // Employee Deductions (monthly amounts)
  deductions: [{
    key: String,
    label: String,
    monthly: Number,
    yearly: Number,
    type: { type: String, default: 'deduction' },
    isSelected: { type: Boolean, default: true },
    showInJoiningLetter: { type: Boolean, default: true }
  }],

  // Employer Contributions (monthly amounts)
  employerBenefits: [{
    key: String,
    label: String,
    monthly: Number,
    yearly: Number,
    type: { type: String, default: 'employer_benefit' },
    isSelected: { type: Boolean, default: true },
    showInJoiningLetter: { type: Boolean, default: true }
  }],

  // Calculated totals (for quick access)
  totals: {
    grossEarnings: Number,  // Monthly
    totalDeductions: Number,  // Monthly
    netSalary: Number,  // Monthly
    employerBenefits: Number,  // Monthly
    monthlyCTC: Number,
    annualCTC: Number
  },

  // Validation metadata
  validation: {
    isValid: { type: Boolean, default: true },
    mismatchAmount: { type: Number, default: 0 },
    validatedAt: Date
  },

  // Audit trail
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: String,
  updatedBy: String
}, {
  timestamps: true
});

// Compound index for efficient queries
SalaryStructureSchema.index({ tenantId: 1, candidateId: 1 }, { unique: true });

// Export as GLOBAL model (not tenant-specific)
module.exports = mongoose.model('SalaryStructure', SalaryStructureSchema);
