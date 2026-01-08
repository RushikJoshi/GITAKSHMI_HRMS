const getTenantDB = require('../utils/tenantDB');

const getModels = async (req) => {
    // Force resolve tenantDB from tenantId if missing
    if (!req.tenantDB && req.tenantId) {
        req.tenantDB = await getTenantDB(req.tenantId);
    }
    if (!req.tenantDB) throw new Error("Tenant database connection not available");

    return {
        TrackerCandidate: req.tenantDB.model("TrackerCandidate"),
        CandidateStatusLog: req.tenantDB.model("CandidateStatusLog"),
        Applicant: req.tenantDB.model("Applicant")
    };
};

/**
 * @desc    Get all candidates (Merged from Applicants and TrackerCandidates)
 * @route   GET /api/hr/candidate-status
 */
exports.getCandidates = async (req, res) => {
    try {
        const { TrackerCandidate, Applicant } = await getModels(req);
        const tenantId = req.tenantId;

        // 1. Fetch from Tracker (Seeded or previously tracked)
        const trackerCandidates = await TrackerCandidate.find({ tenant: tenantId }).lean();

        // 2. Fetch from main Applicants collection
        const applicants = await Applicant.find({ tenant: tenantId }).populate('requirementId').lean();

        // 3. Map Applicants to Tracker format
        const mappedApplicants = applicants.map(app => {
            // Check if this applicant is already in tracker candidates to avoid duplicates
            const alreadyTracked = trackerCandidates.find(tc => tc.email === app.email);
            if (alreadyTracked) return null;

            return {
                _id: app._id,
                name: app.name,
                email: app.email,
                phone: app.mobile || app.phone || 'N/A',
                requirementTitle: app.requirementId?.title || 'Unknown Role',
                currentStatus: app.status || 'Applied',
                currentStage: 'Application',
                tenant: tenantId,
                createdAt: app.createdAt,
                source: 'Applicant'
            };
        }).filter(Boolean);

        // 4. Combine and Sort
        const finalResults = [...trackerCandidates, ...mappedApplicants].sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        res.json(finalResults);
    } catch (error) {
        console.error('[TRACKER_ERROR]', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get candidate timeline
 */
exports.getTimeline = async (req, res) => {
    try {
        const { CandidateStatusLog, TrackerCandidate, Applicant } = await getModels(req);
        const { id } = req.params;

        let logs = await CandidateStatusLog.find({ candidateId: id }).sort({ actionDate: -1 }).lean();

        // If no logs, return a default "Applied" log for visual consistency
        if (logs.length === 0) {
            let candidate = await TrackerCandidate.findById(id).lean();
            if (!candidate) {
                candidate = await Applicant.findById(id).lean();
            }

            if (candidate) {
                logs = [{
                    _id: 'default-log',
                    candidateId: id,
                    status: candidate.status || candidate.currentStatus || 'Applied',
                    stage: 'Application',
                    actionBy: 'System',
                    remarks: 'Application received and automatically tracked.',
                    actionDate: candidate.createdAt || new Date()
                }];
            }
        }

        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Update candidate status
 */
exports.updateStatus = async (req, res) => {
    const { status, stage, actionBy, remarks } = req.body;
    try {
        const { TrackerCandidate, CandidateStatusLog, Applicant } = await getModels(req);

        // Try finding in TrackerCandidate first
        let candidate = await TrackerCandidate.findById(req.params.id);

        // If not found, it might be an 'Applicant' that needs promoting to 'TrackerCandidate'
        if (!candidate) {
            const applicant = await Applicant.findById(req.params.id).populate('requirementId');
            if (applicant) {
                candidate = new TrackerCandidate({
                    name: applicant.name,
                    email: applicant.email,
                    phone: applicant.mobile || 'N/A',
                    requirementTitle: applicant.requirementId?.title || 'Unknown Role',
                    currentStatus: status,
                    currentStage: stage,
                    tenant: req.tenantId
                });
                await candidate.save();
            }
        } else {
            candidate.currentStatus = status;
            candidate.currentStage = stage;
            await candidate.save();
        }

        if (!candidate) return res.status(404).json({ message: 'Candidate not found' });

        const log = new CandidateStatusLog({
            candidateId: candidate._id,
            status,
            stage,
            actionBy,
            remarks,
            actionDate: new Date()
        });
        await log.save();

        res.json({ candidate, log });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Seed sample data (Cleaned)
 */
exports.seedData = async (req, res) => {
    try {
        const { TrackerCandidate, CandidateStatusLog } = await getModels(req);
        const tenantId = req.tenantId;

        // Clean only dummy data
        await TrackerCandidate.deleteMany({ tenant: tenantId, email: /@example.com$/ });

        const sample = [
            { name: 'John Doe', email: 'john@example.com', phone: '1234567890', requirementTitle: 'Senior Dev', currentStatus: 'Selected', currentStage: 'Final', tenant: tenantId },
            { name: 'Jane Smith', email: 'jane@example.com', phone: '9876543210', requirementTitle: 'Lead Designer', currentStatus: 'Interview Scheduled', currentStage: 'Technical', tenant: tenantId }
        ];

        const created = await TrackerCandidate.insertMany(sample);
        const logs = created.map(c => ({
            candidateId: c._id,
            status: 'Applied',
            stage: 'Application',
            actionBy: 'System',
            remarks: 'Seeded sample data.',
            actionDate: new Date()
        }));
        await CandidateStatusLog.insertMany(logs);

        res.json({ message: 'Seeded', count: created.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
