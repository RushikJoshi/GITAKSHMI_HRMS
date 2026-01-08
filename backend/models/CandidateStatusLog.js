const mongoose = require('mongoose');

const CandidateStatusLogSchema = new mongoose.Schema({
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrackerCandidate', required: true },
    status: { type: String, required: true },
    stage: { type: String, required: true },
    actionDate: { type: Date, default: Date.now },
    actionBy: { type: String, required: true },
    remarks: { type: String }
});

module.exports = CandidateStatusLogSchema;
