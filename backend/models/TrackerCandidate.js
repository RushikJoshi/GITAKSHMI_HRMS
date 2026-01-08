const mongoose = require('mongoose');

const TrackerCandidateSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    requirementTitle: { type: String, required: true },
    currentStatus: {
        type: String,
        enum: ['Applied', 'Shortlisted', 'Interview Scheduled', 'Selected', 'Rejected'],
        default: 'Applied'
    },
    currentStage: {
        type: String,
        enum: ['HR', 'Technical', 'Final'],
        default: 'HR'
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = TrackerCandidateSchema;
