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
    stage: { type: String }, // The stage this interview belongs to
    completed: { type: Boolean, default: false }
  },

  // New Snapshot-based Payroll Reference
  salarySnapshotId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeSalarySnapshot', default: null },

  // LEGACY: Embedded Salary Assignment (to be removed once fully migrated)
  salaryTemplateId_legacy: { type: mongoose.Schema.Types.ObjectId, ref: 'SalaryTemplate', default: null },
  salarySnapshot_legacy: { type: mongoose.Schema.Types.Mixed },
  salaryStructureConfig_legacy: { type: mongoose.Schema.Types.Mixed },

  // --- End Legacy ---

  // Custom Documents (ID proof, certificates, etc.)
  customDocuments: [{
    name: { type: String, required: true },  // e.g., "Aadhar Card", "PAN Card"
    fileName: { type: String, required: true },  // Actual file name on server
    filePath: { type: String, required: true },  // Path to file
    fileSize: { type: Number },  // File size in bytes
    fileType: { type: String },  // MIME type
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    verifiedBy: { type: String },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: String }
  }],

  // Review & Feedback System
  reviews: [{
    stage: { type: String },
    rating: { type: Number, min: 0, max: 5 },
    feedback: { type: String, trim: true },
    scorecard: { type: Object }, // Store the full evaluation data
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