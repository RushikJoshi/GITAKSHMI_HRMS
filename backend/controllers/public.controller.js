const ApplicantSchema = require('../models/Applicant');
const multer = require('multer');
const path = require('path');
const Tenant = require('../models/Tenant');
const getTenantDB = require('../utils/tenantDB');
const EmailService = require('../services/email.service');

/* ----------------------------------------------------
   MULTER CONFIG (RESUME UPLOAD)
---------------------------------------------------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'resume-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed =
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/msword' ||
      file.mimetype ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    allowed ? cb(null, true) : cb(new Error('Only PDF and Word files allowed'));
  }
});

/* ----------------------------------------------------
   GET PUBLIC JOBS (BY TENANT ID)
---------------------------------------------------- */
exports.getPublicJobs = async (req, res) => {
  try {
    const { tenantId } = req.query;
    if (!tenantId) return res.status(400).json({ error: "Tenant ID required" });

    // Resolve tenant DB
    const getTenantDB = require('../utils/tenantDB');
    const tenantDB = await getTenantDB(tenantId);
    const Requirement = tenantDB.model("Requirement");

    // Fetch jobs
    const jobs = await Requirement.find({
      tenant: tenantId,
      status: 'Open',
      $or: [
        { visibility: { $in: ['External', 'Both'] } },
        { visibility: { $exists: false } }, // Treat missing field as External
        { visibility: null }
      ]
    })
      .select('jobTitle department vacancy createdAt tenant visibility employmentType location')
      .sort({ createdAt: -1 });

    res.json(jobs);
  } catch (err) {
    console.error("Get public jobs error:", err);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
};

/* ----------------------------------------------------
   GET PUBLIC JOBS (BY COMPANY CODE)
---------------------------------------------------- */
exports.getPublicJobsByCompanyCode = async (req, res) => {
  try {
    const { companyCode } = req.params;
    if (!companyCode)
      return res.status(400).json({ error: "Company code required" });

    // Find tenant by human-readable code
    const tenant = await Tenant.findOne({ code: companyCode });
    if (!tenant)
      return res.status(404).json({ error: "Company not found" });

    const tenantId = tenant._id;

    const tenantDB = await getTenantDB(tenant._id);
    const Requirement = tenantDB.model("Requirement");

    const jobs = await Requirement.find({
      tenant: tenant._id,
      status: 'Open',
      $or: [
        { visibility: { $in: ['External', 'Both'] } },
        { visibility: { $exists: false } },
        { visibility: null }
      ]
    })
      .select('jobTitle department vacancy createdAt tenant visibility employmentType location')
      .sort({ createdAt: -1 });

    res.json(jobs);
  } catch (err) {
    console.error("Get jobs by company code error:", err);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
};

/* ----------------------------------------------------
   RESOLVE COMPANY CODE TO TENANT ID
---------------------------------------------------- */
exports.resolveCompanyCode = async (req, res) => {
  try {
    const { code } = req.params;
    if (!code) return res.status(400).json({ error: "Code required" });

    const tenant = await Tenant.findOne({ code });
    if (!tenant) return res.status(404).json({ error: "Company not found" });

    res.json({ tenantId: tenant._id, companyName: tenant.name });
  } catch (err) {
    console.error("Resolve code error:", err);
    res.status(500).json({ error: "Failed to resolve company" });
  }
};

/* ----------------------------------------------------
   GET SINGLE PUBLIC JOB (BY ID)
---------------------------------------------------- */
exports.getPublicJobById = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.query;

    if (!id || !tenantId || tenantId === 'null' || tenantId === 'undefined') {
      return res.status(400).json({ error: "Valid Job ID and Tenant ID are required" });
    }

    const getTenantDB = require('../utils/tenantDB');
    const tenantDB = await getTenantDB(tenantId);
    const Requirement = tenantDB.model("Requirement");

    const job = await Requirement.findOne({ _id: id, tenant: tenantId })
      .select('jobTitle department vacancy status description jobVisibility minExperienceMonths maxExperienceMonths salaryMin salaryMax jobType workMode publicFields customFields');

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    res.json(job);
  } catch (err) {
    console.error("Get single job error:", err);
    res.status(500).json({ error: "Failed to fetch job details" });
  }
};

/* ----------------------------------------------------
   APPLY FOR JOB (PUBLIC)
---------------------------------------------------- */
exports.applyJob = [
  upload.single('resume'),
  async (req, res) => {
    try {
      let {
        tenantId,
        requirementId,
        name,
        fatherName,
        email,
        mobile,
        experience,
        address,
        location,
        currentCompany,
        currentDesignation,
        expectedCTC,
        linkedin,
        dob // Added Date of Birth
      } = req.body;

      // Robustly resolve tenantId (Frontend sends it in headers mostly)
      if (!tenantId) {
        tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
      }

      if (!tenantId || tenantId === 'null' || tenantId === 'undefined' || !requirementId || !name || !email) {
        console.warn(`[APPLY_JOB] Validation failed. tenantId: ${tenantId}, requirementId: ${requirementId}, name: ${name}, email: ${email}`);
        return res.status(400).json({
          error: "Valid tenantId, requirementId, name, and email are required"
        });
      }

      const tenantDB = await getTenantDB(tenantId);
      const Applicant = tenantDB.model("Applicant", ApplicantSchema);
      const Requirement = tenantDB.model("Requirement");

      const requirement = await Requirement.findById(requirementId);
      if (!requirement)
        return res.status(404).json({ error: "Requirement not found" });

      const exists = await Applicant.findOne({
        requirementId,
        email: email.toLowerCase()
      });

      if (exists)
        return res.status(409).json({
          error: "You have already applied for this job"
        });

      // Create new applicant
      const applicant = new Applicant({
        tenant: tenantId,
        candidateId: req.user?.id || null, // Link to candidate account
        requirementId,
        name: name.trim(),
        fatherName: fatherName?.trim(),
        email: email.toLowerCase().trim(),
        mobile: mobile?.trim(),
        experience: experience?.trim(),
        address: address?.trim(),
        location: location?.trim(),
        currentCompany: currentCompany?.trim(),
        currentDesignation: currentDesignation?.trim(),
        expectedCTC: expectedCTC?.trim(),
        linkedin: linkedin?.trim(),
        dob: dob || null, // Allow DOB to be saved
        resume: req.file?.filename || null,
        status: 'Applied'
      });

      await applicant.save();

      // --- SEND EMAIL NOTIFICATION (DYNAMIC) ---
      try {
        console.log(`📧 [APPLY_JOB] Initiating email to: ${email}`);

        // Use standard status template for initial "Applied" status
        await EmailService.sendStatusEmail(
          applicant.email,
          applicant.name,
          requirement.jobTitle,
          applicant._id,
          'Applied'
        );

        console.log(`✅ [APPLY_JOB] Notification sent successfully to ${applicant.email}`);

      } catch (emailError) {
        console.error("⚠️ [APPLY_JOB] Failed to send email:", emailError.message);
        // Don't fail the request, just log it. The application is already saved.
      }

      res.status(201).json({
        message: "Application submitted successfully",
        applicantId: applicant._id
      });
    } catch (err) {
      console.error("Apply job error:", err);
      res.status(500).json({ error: "Failed to submit application" });
    }
  }
];
