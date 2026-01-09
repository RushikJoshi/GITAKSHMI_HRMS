const mongoose = require('mongoose');

const ApplicantSchema = new mongoose.Schema({
  requirementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement', required: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' }, // Link to registered candidate

  // Personal Details
  name: { type: String, trim: true, required: true },
  fatherName: { type: String, trim: true },
  email: { type: String, trim: true, required: true, lowercase: true },
  mobile: { type: String, trim: true, required: true },
  emergencyContact: { type: String, trim: true },
  dob: { type: Date },
  workLocation: { type: String, trim: true },
  address: { type: String, trim: true }, // Candidate address for joining letter

  // Professional Details
  department: { type: String, trim: true }, // Department from offer letter
  location: { type: String, trim: true }, // Work location from offer letter

  // Professional Details
  intro: { type: String, trim: true },
  experience: { type: String, trim: true }, // Total Experience
  relevantExperience: { type: String, trim: true },
  currentCompany: { type: String, trim: true },
  currentDesignation: { type: String, trim: true },
  currentlyWorking: { type: Boolean, default: false },
  noticePeriod: { type: Boolean, default: false },
  currentCTC: { type: String, trim: true },
  takeHome: { type: String, trim: true },
  expectedCTC: { type: String, trim: true },
  isFlexible: { type: Boolean, default: false },
  hasOtherOffer: { type: Boolean, default: false },
  relocate: { type: Boolean, default: false },
  reasonForChange: { type: String, trim: true },
  linkedin: { type: String, trim: true },

  resume: { type: String, trim: true }, // File path or URL

  // Offer Details
  status: { type: String, default: 'Applied' },
  offerLetterPath: { type: String },
  offerRefCode: { type: String }, // Reference code from offer letter
  joiningLetterPath: { type: String }, // Path to generated joining letter PDF
  joiningDate: { type: Date },

  // Interview Details
  interview: {
    date: { type: Date },
    time: { type: String },
    mode: { type: String, enum: ['Online', 'Offline'] },
    location: { type: String }, // Link/URL (if online) or Address (if offline)
    interviewerName: { type: String },
    notes: { type: String },
    completed: { type: Boolean, default: false }
  },

  // Salary Assignment (before joining letter)
  salaryTemplateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SalaryTemplate',
    default: null
  },
  salaryStructureId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SalaryStructure',
    default: null
  },
  salarySnapshot: {
    // Complete immutable salary breakdown (calculated once, never recalculated)
    salaryTemplateId: mongoose.Schema.Types.ObjectId,
    earnings: [{
      name: { type: String },
      monthlyAmount: { type: Number },
      annualAmount: { type: Number },
      enabled: { type: Boolean, default: true }
    }],
    employerContributions: [{
      name: { type: String },
      monthlyAmount: { type: Number },
      annualAmount: { type: Number },
      enabled: { type: Boolean, default: true }
    }],
    employeeDeductions: [{
      name: { type: String },
      monthlyAmount: { type: Number },
      annualAmount: { type: Number },
      category: { type: String, enum: ['PRE_TAX', 'POST_TAX'] },
      enabled: { type: Boolean, default: true }
    }],
    grossA: {
      monthly: { type: Number },
      yearly: { type: Number }
    },
    grossB: {
      monthly: { type: Number },
      yearly: { type: Number }
    },
    grossC: {
      monthly: { type: Number }, // Same as monthlyCTC
      yearly: { type: Number }   // Same as annualCTC
    },
    takeHome: {
      monthly: { type: Number },
      yearly: { type: Number }
    },
    gratuity: {
      monthly: { type: Number }, // 4.8% of Basic
      yearly: { type: Number }
    },
    ctc: {
      monthly: { type: Number },
      yearly: { type: Number }
    },
    calculatedAt: { type: Date }
  },

  // Full Salary Structure Configuration (Embedded to save collection space)
  salaryStructureConfig: {
    earnings: {
      basic: { monthly: Number, yearly: Number, enabled: { type: Boolean, default: true } },
      hra: { monthly: Number, yearly: Number, enabled: { type: Boolean, default: true } },
      conveyance: { monthly: Number, yearly: Number, enabled: { type: Boolean, default: true } },
      specialAllowance: { monthly: Number, yearly: Number, enabled: { type: Boolean, default: true } },
      other: [{ name: String, monthly: Number, yearly: Number, enabled: { type: Boolean, default: true } }]
    },
    deductions: {
      pfEmployee: { monthly: Number, yearly: Number, enabled: { type: Boolean, default: true } },
      pfEmployer: { monthly: Number, yearly: Number, enabled: { type: Boolean, default: true } },
      professionalTax: { monthly: Number, yearly: Number, enabled: { type: Boolean, default: true } },
      esic: { monthly: Number, yearly: Number, enabled: { type: Boolean, default: true } },
      esicEmployer: { monthly: Number, yearly: Number, enabled: { type: Boolean, default: true } },
      other: [{ name: String, monthly: Number, yearly: Number, enabled: { type: Boolean, default: true } }]
    },
    employerContributions: [{
      name: String,
      monthly: Number,
      yearly: Number,
      enabled: { type: Boolean, default: true }
    }],
    grossSalary: { monthly: Number, yearly: Number },
    totalDeductions: { monthly: Number, yearly: Number },
    netSalary: { monthly: Number, yearly: Number },
    ctc: { monthly: Number, yearly: Number },
    updatedAt: { type: Date, default: Date.now }
  },

  // Review & Feedback System
  reviews: [{
    stage: { type: String },
    rating: { type: Number, min: 1, max: 5 },
    feedback: { type: String, trim: true },
    interviewerName: { type: String },
    createdAt: { type: Date, default: Date.now }
  }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add index for better query performance
ApplicantSchema.index({ requirementId: 1, status: 1 });
ApplicantSchema.index({ email: 1 });

module.exports = ApplicantSchema;