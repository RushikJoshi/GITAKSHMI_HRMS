const mongoose = require('mongoose');
const salaryCalculationService = require('../services/salaryCalculation.service');
const EmailService = require('../services/email.service');
const path = require('path');
const fs = require('fs');

/**
 * Helper to get models from tenant database
 */
function getModels(req) {
    if (!req.tenantDB) {
        throw new Error("Tenant database connection not available");
    }
    const db = req.tenantDB;
    try {
        return {
            Applicant: db.model("Applicant"),
            SalaryTemplate: db.model("SalaryTemplate"),
            SalaryStructure: db.model("SalaryStructure"),
            CompanyProfile: db.model("CompanyProfile"), // Ensure this is available
        };
    } catch (err) {
        console.error("[applicant.controller] Error retrieving models:", err.message);
        throw new Error(`Failed to retrieve models from tenant database: ${err.message}`);
    }
}

// Reuse logToDebug helper
function logToDebug(message) {
    try {
        const logPath = path.join(__dirname, '../debug_email.log');
        const timestamp = new Date().toISOString();
        if (fs.existsSync(path.dirname(logPath))) {
            fs.appendFileSync(logPath, `[${timestamp}] [APPLICANT] ${message}\n`);
        }
    } catch (e) { console.error("Log failed", e); }
}

/**
 * SCHEDULE INTERVIEW
 * POST /api/applicants/:id/interview/schedule
 */
exports.scheduleInterview = async (req, res) => {
    try {
        const { id } = req.params;
        const { date, time, mode, location, interviewerName, notes } = req.body;

        const { Applicant } = getModels(req);

        // Find Applicant
        const applicant = await Applicant.findById(id).populate('requirementId', 'jobTitle');
        if (!applicant) return res.status(404).json({ message: "Applicant not found" });

        // Update Interview Details
        applicant.interview = { date, time, mode, location, interviewerName, notes, completed: false };
        // applicant.status = 'Interview Scheduled'; // STAIR CASE: Keep in current stage

        await applicant.save();

        // Send Email
        try {
            await EmailService.sendInterviewScheduledEmail(
                applicant.email,
                applicant.name,
                applicant.requirementId?.jobTitle || 'Job Role',
                applicant.interview
            );
            logToDebug(`✅ Interview Scheduled Email sent to ${applicant.email}`);
        } catch (emailErr) {
            console.error("Failed to send interview email", emailErr);
            logToDebug(`❌ Failed to send interview email: ${emailErr.message}`);
        }

        res.json({ success: true, message: "Interview scheduled successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * RESCHEDULE INTERVIEW
 * PUT /api/applicants/:id/interview/reschedule
 */
exports.rescheduleInterview = async (req, res) => {
    try {
        const { id } = req.params;
        const { date, time, mode, location, interviewerName, notes } = req.body;

        const { Applicant } = getModels(req);

        const applicant = await Applicant.findById(id).populate('requirementId', 'jobTitle');
        if (!applicant) return res.status(404).json({ message: "Applicant not found" });

        // Update
        applicant.interview = { date, time, mode, location, interviewerName, notes, completed: false };
        // applicant.status = 'Interview Rescheduled'; // STAIR CASE: Keep in current stage

        await applicant.save();

        // Email
        try {
            await EmailService.sendInterviewRescheduledEmail(
                applicant.email,
                applicant.name,
                applicant.requirementId?.jobTitle || 'Job Role',
                applicant.interview
            );
            logToDebug(`✅ Interview Rescheduled Email sent to ${applicant.email}`);
        } catch (emailErr) {
            logToDebug(`❌ Failed to send reschedule email: ${emailErr.message}`);
        }

        res.json({ success: true, message: "Interview rescheduled successfully" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * MARK INTERVIEW COMPLETED
 * PUT /api/applicants/:id/interview/complete
 */
exports.markInterviewCompleted = async (req, res) => {
    try {
        const { id } = req.params;
        const { Applicant } = getModels(req);

        const applicant = await Applicant.findById(id);
        if (!applicant) return res.status(404).json({ message: "Applicant not found" });

        if (applicant.interview) {
            applicant.interview.completed = true;
            // Mark the model as modified for the nested object
            applicant.markModified('interview');
        }
        // applicant.status = 'Interview Completed'; // STAIR CASE: Keep in current stage
        await applicant.save();

        // NO EMAIL required

        res.json({ success: true, message: "Interview marked as completed" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * ASSIGN SALARY TO APPLICANT
 * POST /api/applicants/:id/assign-salary
 * 
 * Accepts either:
 * - salaryTemplateId: Use existing template
 * - annualCTC + earnings + settings: Calculate on-the-fly
 */
exports.assignSalary = async (req, res) => {
    try {
        console.log('🔥 [ASSIGN SALARY] Request received:', {
            applicantId: req.params.id,
            bodyKeys: Object.keys(req.body),
            tenantId: req.user?.tenantId
        });

        // Validation
        if (!req.user?.tenantId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized - Tenant context required'
            });
        }

        const { Applicant, SalaryTemplate } = getModels(req);
        const applicantId = req.params.id;

        // Validate applicant ID format
        if (!mongoose.Types.ObjectId.isValid(applicantId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid applicant ID format'
            });
        }

        // Find applicant
        const applicant = await Applicant.findById(applicantId);
        if (!applicant) {
            return res.status(404).json({
                success: false,
                error: 'Applicant not found'
            });
        }

        // Validate applicant is in "Selected" status
        if (applicant.status !== 'Selected') {
            return res.status(400).json({
                success: false,
                error: `Cannot assign salary to applicant with status "${applicant.status}". Applicant must be in "Selected" status.`
            });
        }

        // Check if salary already assigned
        if (applicant.salaryTemplateId || applicant.salarySnapshot) {
            return res.status(400).json({
                success: false,
                error: 'Salary already assigned to this applicant. To change salary, please contact administrator.',
                currentSalary: {
                    salaryTemplateId: applicant.salaryTemplateId,
                    calculatedAt: applicant.salarySnapshot?.calculatedAt
                }
            });
        }

        const { salaryTemplateId, annualCTC, earnings, settings } = req.body;

        let salaryTemplate;
        let salarySnapshot;

        // Option 1: Use existing salary template
        if (salaryTemplateId) {
            console.log('🔥 [ASSIGN SALARY] Using existing template:', salaryTemplateId);

            if (!mongoose.Types.ObjectId.isValid(salaryTemplateId)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid salary template ID format'
                });
            }

            salaryTemplate = await SalaryTemplate.findOne({
                _id: salaryTemplateId,
                tenantId: req.user.tenantId
            });

            if (!salaryTemplate) {
                return res.status(404).json({
                    success: false,
                    error: 'Salary template not found'
                });
            }

            // Calculate complete breakdown
            salarySnapshot = salaryCalculationService.calculateCompleteSalaryBreakdown(salaryTemplate);

        } else {
            return res.status(400).json({
                success: false,
                error: 'Either salaryTemplateId or (annualCTC + earnings + settings) must be provided'
            });
        }

        // Store salary assignment on applicant
        applicant.salaryTemplateId = salaryTemplate._id;
        applicant.salarySnapshot = salarySnapshot;

        await applicant.save();

        // --- STRICT FIX: Create Explicit SalaryStructure Document ---
        // This ensures the Joining Letter can fetch a unique, candidate-bound structure.

        const earningsList = salarySnapshot.earnings || [];
        const deductionsList = salarySnapshot.employeeDeductions || [];

        // Helper to find component by name (fuzzy match)
        const findComp = (list, patterns) => {
            const found = list.find(item => {
                const n = (item.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                return patterns.some(p => n.includes(p));
            });
            return {
                monthly: found ? (found.monthlyAmount || 0) : 0,
                yearly: found ? (found.annualAmount || 0) : 0
            };
        };

        const basic = findComp(earningsList, ['basic']);
        const hra = findComp(earningsList, ['hra', 'house']);
        const conveyance = findComp(earningsList, ['conveyance', 'transport']);
        const special = findComp(earningsList, ['special']);

        // Collect 'other' earnings (exclude the ones we just mapped)
        const standardNames = ['basic', 'hra', 'house', 'conveyance', 'transport', 'special'];
        const otherEarnings = earningsList.filter(item => {
            const n = (item.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return !standardNames.some(p => n.includes(p));
        }).map(item => ({
            name: item.name,
            monthly: item.monthlyAmount || 0,
            yearly: item.annualAmount || 0
        }));

        // Map deductions - STRICT DYNAMIC MAPPING / NO FORCED CATEGORIES
        // User Requirement: "Whatever I add should show exactly".
        // Strategy: Store ALL deductions in 'other' to preserve original names and values.

        const otherDeductions = deductionsList.map(item => ({
            name: item.name,
            monthly: item.monthlyAmount || 0,
            yearly: item.annualAmount || 0
        }));

        // Extract employer contributions from snapshot (includes statutory + benefits)
        const employerContributionsList = (salarySnapshot.employerContributions || []).map(contrib => {
            // Determine if it's a benefit or statutory contribution
            const nameLower = (contrib.name || '').toLowerCase();
            let benefitType = 'STATUTORY';
            if (nameLower.includes('employer pf') || nameLower.includes('epf employer')) {
                benefitType = 'EMPLOYER_PF';
            } else if (nameLower.includes('gratuity')) {
                benefitType = 'GRATUITY';
            } else if (nameLower.includes('insurance') || nameLower.includes('medical')) {
                benefitType = 'INSURANCE';
            } else if (!nameLower.includes('epf') && !nameLower.includes('edli') && !nameLower.includes('admin') && !nameLower.includes('esi')) {
                // If it's not a standard statutory contribution, it's likely a custom benefit
                benefitType = 'CUSTOM';
            }

            return {
                name: contrib.name,
                monthly: contrib.monthlyAmount || contrib.monthly || 0,
                yearly: contrib.annualAmount || contrib.yearly || 0,
                benefitType: benefitType
            };
        });

        // Create or Update SalaryStructure
        await SalaryStructure.findOneAndUpdate(
            { candidateId: applicant._id },
            {
                tenantId: req.user.tenantId,
                candidateId: applicant._id,
                earnings: {
                    basic: basic,
                    hra: hra,
                    conveyance: conveyance,
                    specialAllowance: special,
                    other: otherEarnings
                },
                deductions: {
                    // Standard buckets set to 0 to ensure Letter Controller ignores them
                    pfEmployee: { monthly: 0, yearly: 0 },
                    professionalTax: { monthly: 0, yearly: 0 },
                    esic: { monthly: 0, yearly: 0 },
                    // Everything goes here
                    other: otherDeductions
                },
                employerContributions: employerContributionsList, // Store all employer contributions including benefits
                grossSalary: { monthly: salarySnapshot.grossA?.monthly || 0, yearly: salarySnapshot.grossA?.yearly || 0 },
                totalDeductions: { monthly: salarySnapshot.totalDeductions?.monthly || 0, yearly: salarySnapshot.totalDeductions?.yearly || 0 }, // Assuming snapshot has totals, else 0
                netSalary: { monthly: salarySnapshot.takeHome?.monthly || 0, yearly: salarySnapshot.takeHome?.yearly || 0 },
                ctc: { monthly: salarySnapshot.ctc?.monthly || 0, yearly: salarySnapshot.ctc?.yearly || 0 }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log('✅ [ASSIGN SALARY] Explicit SalaryStructure created/updated for candidate:', applicant._id);

        console.log('✅ [ASSIGN SALARY] Salary assigned successfully:', {
            applicantId: applicant._id,
            salaryTemplateId: applicant.salaryTemplateId,
            ctc: salarySnapshot.ctc
        });

        res.json({
            success: true,
            message: 'Salary assigned successfully',
            data: {
                applicant: {
                    _id: applicant._id,
                    name: applicant.name,
                    salaryTemplateId: applicant.salaryTemplateId
                },
                salarySnapshot: salarySnapshot
            }
        });

    } catch (error) {
        console.error('❌ [ASSIGN SALARY] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to assign salary'
        });
    }
};

/**
 * GET APPLICANT SALARY SNAPSHOT
 * GET /api/applicants/:id/salary
 */
exports.getSalary = async (req, res) => {
    try {
        const { Applicant } = getModels(req);
        const applicantId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(applicantId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid applicant ID format'
            });
        }

        const applicant = await Applicant.findById(applicantId).select('salaryTemplateId salarySnapshot name');

        if (!applicant) {
            return res.status(404).json({
                success: false,
                error: 'Applicant not found'
            });
        }

        if (!applicant.salarySnapshot) {
            return res.status(404).json({
                success: false,
                error: 'Salary not assigned to this applicant'
            });
        }

        res.json({
            success: true,
            data: {
                applicantId: applicant._id,
                applicantName: applicant.name,
                salaryTemplateId: applicant.salaryTemplateId,
                salarySnapshot: applicant.salarySnapshot
            }
        });

    } catch (error) {
        console.error('❌ [GET SALARY] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get salary'
        });
    }
};

/**
 * GET SINGLE APPLICANT BY ID
 * GET /api/applicants/:id
 */
exports.getApplicantById = async (req, res) => {
    try {
        const { Applicant } = getModels(req);
        const applicantId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(applicantId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid applicant ID format'
            });
        }

        const applicant = await Applicant.findById(applicantId)
            .populate('requirementId', 'jobTitle department')
            .populate('salaryTemplateId');

        if (!applicant) {
            return res.status(404).json({
                success: false,
                error: 'Applicant not found'
            });
        }

        res.json({
            success: true,
            data: applicant
        });

    } catch (error) {
        console.error('❌ [GET APPLICANT] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch applicant'
        });
    }
};

const xlsx = require('xlsx');

/**
 * UPLOAD SALARY EXCEL
 * POST /api/applicants/:id/upload-salary-excel
 */
exports.uploadSalaryExcel = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded" });

        const { Applicant } = getModels(req);
        const applicantId = req.params.id;
        const filePath = req.file.path;

        // 1. Read Excel (Force String/Formatted Mode for "Same-to-Same")
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

        let flatData = {};

        // 2. Helper: Text Normalizer
        const normalize = (val) => String(val || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        // 3. Independent Column Detection (Scan first 20 rows)
        let headCol = -1, monthCol = -1, yearCol = -1;
        let startRow = -1;

        for (let i = 0; i < Math.min(20, rawRows.length); i++) {
            const row = rawRows[i];
            if (!Array.isArray(row)) continue;

            row.forEach((cell, idx) => {
                const txt = normalize(cell);
                // Header Column: "Particulars", "Salary Head", "Component"
                if ((txt.includes('particular') || txt.includes('head') || txt.includes('component')) && headCol === -1) {
                    headCol = idx;
                }
                // Monthly Column (Relaxed: "monthly", "month", "permonth")
                if (txt.includes('month') && monthCol === -1) {
                    monthCol = idx;
                }
                // Yearly Column (Relaxed: "yearly", "year", "annual")
                if ((txt.includes('year') || txt.includes('annu')) && yearCol === -1) {
                    yearCol = idx;
                }
            });

            if (monthCol !== -1 && startRow === -1) {
                startRow = i;
            }
        }

        // Fallback
        if (monthCol === -1) { monthCol = 1; console.log('⚠️ [EXCEL] Monthly col not found, defaulting to 1'); }
        if (yearCol === -1) { yearCol = 2; console.log('⚠️ [EXCEL] Yearly col not found, defaulting to 2'); }
        if (headCol === -1) { headCol = 0; console.log('⚠️ [EXCEL] Head col not found, defaulting to 0'); }
        if (startRow === -1) startRow = 0;

        console.log(`✅ [EXCEL PARSE] Columns Detected -> Head: ${headCol}, Monthly: ${monthCol}, Yearly: ${yearCol}, StartRow: ${startRow}`);

        // 4. Mapping Logic
        const getKey = (rowName) => {
            const n = normalize(rowName);
            if (n.includes('basic')) return 'basic';
            if (n.includes('hra') || n.includes('house')) return 'hra';
            if (n.includes('medical') && n.includes('reimburse')) return 'medical';
            if (n.includes('transport')) return 'transport';
            if (n.includes('education')) return 'education';
            if (n.includes('book')) return 'books';
            if (n.includes('uniform')) return 'uniform';
            if (n.includes('conveyance')) return 'conveyance';
            if (n.includes('mobile')) return 'mobile';
            if (n.includes('compensat')) return 'compensatory';
            if (n.includes('grossa')) return 'gross_a';
            if (n.includes('tax') || n.includes('esi')) return 'deductions_tax';
            if (n.includes('takehome')) return 'take_home';
            if (n.includes('leave')) return 'leave';
            if (n.includes('grossb')) return 'gross_b';
            if (n.includes('pf') && n.includes('employe')) return 'employer_pf';
            else if (n.includes('provident')) return 'pf';
            if (n.includes('gratuity')) return 'gratuity';
            if (n.includes('grossc')) return 'gross_c';
            if (n.includes('insurance')) return 'insurance';
            if (n.includes('computedctc') || n.includes('costto')) return 'ctc';
            if (n.includes('special')) return 'special';
            return null;
        };

        // 5. Parse Data Rows
        for (let i = startRow + 1; i < rawRows.length; i++) {
            const row = rawRows[i];
            if (!row) continue;

            const label = row[headCol];
            if (!label) continue;

            const key = getKey(label);

            if (key) {
                // DIRECT STRING MAPPING
                const mVal = row[monthCol] || '0';
                const yVal = row[yearCol] || '0';
                flatData[`${key}_monthly`] = mVal;
                flatData[`${key}_yearly`] = yVal;
                if (key === 'ctc') flatData['ctc'] = yVal;
            }
        }

        // 6. Header/Top-Level Fields
        for (let i = 0; i < Math.min(startRow, 15); i++) {
            const row = rawRows[i];
            if (row && row.length >= 2) {
                const k = normalize(row[0]);
                const v = row[1];
                if (k.includes('name')) flatData['employee_name'] = v;
                if (k.includes('designation')) flatData['designation'] = v;
                if (k.includes('location') || k.includes('site')) flatData['location'] = v;
                if (k.includes('doj') || k.includes('dateof')) flatData['joining_date'] = v;
            }
        }

        // Cleanup
        try { fs.unlinkSync(filePath); } catch (e) { }

        // Save
        const applicant = await Applicant.findByIdAndUpdate(
            applicantId,
            {
                $set: {
                    salaryExcelData: flatData,
                    salaryExcelFileName: req.file.originalname
                }
            },
            { new: true }
        );

        if (!applicant) return res.status(404).json({ success: false, error: "Applicant not found" });

        const keysFound = Object.keys(flatData).length;

        res.json({
            success: true,
            message: `Processed ${keysFound} fields.`,
            data: flatData,
            fileName: req.file.originalname
        });

    } catch (error) {
        console.error("Excel Upload Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};



/**
 * UPDATE APPLICANT STATUS
 * PATCH /api/requirements/applicants/:id/status
 */
exports.updateApplicantStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rating, feedback, stageName } = req.body;

        logToDebug(`🔥 [STATUS UPDATE REQUEST] ID: ${id}, Status: ${status}`);

        if (!status) {
            return res.status(400).json({ message: "Status is required" });
        }

        const { Applicant } = getModels(req);

        // Find Applicant
        const applicant = await Applicant.findById(id).populate('requirementId', 'jobTitle');
        if (!applicant) {
            logToDebug(`❌ Applicant ${id} NOT FOUND`);
            return res.status(404).json({ message: "Applicant not found" });
        }

        const oldStatus = applicant.status;
        logToDebug(`ℹ️ Current Status: ${oldStatus}, New Status: ${status}`);

        // Update Status
        applicant.status = status;

        // --- SAVE REVIEW / FEEDBACK ---
        if (rating || feedback) {
            applicant.reviews.push({
                stage: stageName || status,
                rating: rating,
                feedback: feedback,
                interviewerName: req.user?.name || 'HR Team',
                createdAt: new Date()
            });
        }

        await applicant.save();

        logToDebug(`✅ DB Updated. Checking email trigger...`);

        // --- SEND EMAIL NOTIFICATION ---
        if (oldStatus !== status) {
            try {
                logToDebug(`📧 Attempting to send email to ${applicant.email}...`);

                await EmailService.sendApplicationStatusEmail(
                    applicant.email,
                    applicant.name,
                    applicant.requirementId?.jobTitle || 'Job Application',
                    applicant._id,
                    status,
                    feedback,
                    rating
                );

                logToDebug("✅ Email Sent Successfully (Service returned)");

            } catch (emailErr) {
                logToDebug(`❌ EMAIL FAILURE: ${emailErr.message}`);
                console.error(`❌ [EMAIL FAILURE] Failed to send status email: ${emailErr.message}`);
            }
        } else {
            logToDebug("ℹ️ Status unchanged. Skipping email.");
        }

        res.json({
            success: true,
            message: `Applicant status updated to ${status}`,
            data: {
                status: applicant.status,
                oldStatus: oldStatus
            }
        });

    } catch (error) {
        if (typeof logToDebug === 'function') logToDebug(`❌ CRITICAL ERROR: ${error.message}`);
        console.error("❌ [UPDATE ERROR] Update Applicant Status Error:", error);
        res.status(500).json({ message: error.message });
    }
};
