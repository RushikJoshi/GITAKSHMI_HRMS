# HRMS FIXES: Joining Letter & Salary Structure
## Production-Ready Implementation

---

## PART A: JOINING LETTER GENERATION FIX

### Problem Analysis:
- `generateJoiningLetter` function doesn't exist in letter.controller.js
- No validation for candidate status
- No salary structure verification
- Missing error handling

### Solution: Complete Implementation

```javascript
/**
 * GENERATE JOINING LETTER
 * POST /api/letters/generate-joining
 * 
 * Business Rules:
 * 1. Candidate must be SELECTED
 * 2. Salary structure must exist
 * 3. Joining letter template must exist
 * 4. Generate only once per candidate
 * 5. Return 400 for business rule violations
 */
exports.generateJoiningLetter = async (req, res) => {
    try {
        const { applicantId, templateId } = req.body;

        // ===== VALIDATION =====
        if (!applicantId) {
            return res.status(400).json({ 
                success: false,
                message: 'Applicant ID is required' 
            });
        }

        if (!templateId) {
            return res.status(400).json({ 
                success: false,
                message: 'Template ID is required' 
            });
        }

        const { Applicant, LetterTemplate, SalaryStructure, CompanyProfile } = getModels(req);

        // ===== FETCH APPLICANT =====
        const applicant = await Applicant.findById(applicantId)
            .populate('requirementId', 'title department')
            .lean();

        if (!applicant) {
            return res.status(404).json({ 
                success: false,
                message: 'Applicant not found' 
            });
        }

        // ===== BUSINESS RULE 1: Must be SELECTED =====
        if (applicant.status !== 'Selected') {
            return res.status(400).json({ 
                success: false,
                message: `Cannot generate joining letter. Candidate status is "${applicant.status}". Only SELECTED candidates can receive joining letters.`,
                currentStatus: applicant.status,
                requiredStatus: 'Selected'
            });
        }

        // ===== BUSINESS RULE 2: Salary structure must exist =====
        const salaryStructure = await SalaryStructure.findOne({ candidateId: applicantId }).lean();
        
        if (!salaryStructure) {
            return res.status(400).json({ 
                success: false,
                message: 'Salary structure not assigned. Please assign salary before generating joining letter.',
                action: 'ASSIGN_SALARY_FIRST'
            });
        }

        // ===== BUSINESS RULE 3: Joining letter template must exist =====
        const template = await LetterTemplate.findById(templateId).lean();
        
        if (!template) {
            return res.status(404).json({ 
                success: false,
                message: 'Joining letter template not found' 
            });
        }

        if (template.type !== 'joining') {
            return res.status(400).json({ 
                success: false,
                message: `Invalid template type. Expected "joining", got "${template.type}"` 
            });
        }

        // ===== BUSINESS RULE 4: Generate only once =====
        if (applicant.joiningLetterPath) {
            return res.status(400).json({ 
                success: false,
                message: 'Joining letter already generated for this candidate',
                existingPath: applicant.joiningLetterPath,
                action: 'USE_EXISTING_OR_REGENERATE'
            });
        }

        // ===== FETCH COMPANY PROFILE =====
        const companyProfile = await CompanyProfile.findOne().lean();

        // ===== PREPARE DATA FOR TEMPLATE =====
        const letterData = {
            // Candidate Info
            candidateName: applicant.name || '',
            fatherName: applicant.fatherName || '',
            email: applicant.email || '',
            mobile: applicant.mobile || '',
            address: applicant.address || '',
            
            // Job Info
            position: applicant.requirementId?.title || 'Not Specified',
            department: applicant.requirementId?.department || applicant.department || '',
            joiningDate: applicant.joiningDate ? new Date(applicant.joiningDate).toLocaleDateString('en-IN') : '',
            location: applicant.location || applicant.workLocation || '',
            
            // Salary Info (from salary structure)
            ctcYearly: salaryStructure.totals?.annualCTC || 0,
            ctcMonthly: salaryStructure.totals?.monthlyCTC || 0,
            grossSalary: salaryStructure.totals?.grossEarnings || 0,
            netSalary: salaryStructure.totals?.netSalary || 0,
            
            // Salary Components
            earnings: salaryStructure.earnings || [],
            deductions: salaryStructure.deductions || [],
            employerBenefits: salaryStructure.employerBenefits || [],
            
            // Company Info
            companyName: companyProfile?.companyName || 'Company Name',
            companyAddress: companyProfile?.address || '',
            companyPhone: companyProfile?.phone || '',
            companyEmail: companyProfile?.email || '',
            companyWebsite: companyProfile?.website || '',
            
            // Letter Meta
            letterDate: new Date().toLocaleDateString('en-IN'),
            refNo: `JL/${new Date().getFullYear()}/${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
        };

        // ===== GENERATE PDF =====
        const templatePath = normalizeFilePath(template.filePath);
        
        if (!fs.existsSync(templatePath)) {
            return res.status(404).json({ 
                success: false,
                message: 'Template file not found on server',
                templatePath 
            });
        }

        // Read template
        const templateBuffer = await fsPromises.readFile(templatePath);
        const zip = new PizZip(templateBuffer);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });

        // Replace placeholders
        doc.render(letterData);

        // Generate output
        const outputBuffer = doc.getZip().generate({
            type: 'nodebuffer',
            compression: 'DEFLATE',
        });

        // Save to uploads
        const outputDir = path.join(__dirname, '../uploads/joining_letters');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const fileName = `joining_letter_${applicantId}_${Date.now()}.docx`;
        const outputPath = path.join(outputDir, fileName);
        
        await fsPromises.writeFile(outputPath, outputBuffer);

        // Update applicant record
        await Applicant.findByIdAndUpdate(applicantId, {
            joiningLetterPath: `/uploads/joining_letters/${fileName}`,
            joiningLetterGeneratedAt: new Date()
        });

        // ===== SUCCESS RESPONSE =====
        res.json({
            success: true,
            message: 'Joining letter generated successfully',
            data: {
                downloadUrl: `/uploads/joining_letters/${fileName}`,
                fileName,
                generatedAt: new Date()
            }
        });

    } catch (error) {
        console.error('❌ Generate Joining Letter Error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to generate joining letter',
            error: error.message 
        });
    }
};

/**
 * PREVIEW JOINING LETTER
 * POST /api/letters/preview-joining
 */
exports.previewJoiningLetter = async (req, res) => {
    try {
        const { applicantId, templateId } = req.body;

        if (!applicantId || !templateId) {
            return res.status(400).json({ 
                success: false,
                message: 'Applicant ID and Template ID are required' 
            });
        }

        const { Applicant, LetterTemplate, SalaryStructure, CompanyProfile } = getModels(req);

        const applicant = await Applicant.findById(applicantId)
            .populate('requirementId', 'title department')
            .lean();

        if (!applicant) {
            return res.status(404).json({ 
                success: false,
                message: 'Applicant not found' 
            });
        }

        const template = await LetterTemplate.findById(templateId).lean();
        if (!template) {
            return res.status(404).json({ 
                success: false,
                message: 'Template not found' 
            });
        }

        const salaryStructure = await SalaryStructure.findOne({ candidateId: applicantId }).lean();
        const companyProfile = await CompanyProfile.findOne().lean();

        // Prepare preview data (same as generate)
        const letterData = {
            candidateName: applicant.name || '',
            fatherName: applicant.fatherName || '',
            email: applicant.email || '',
            mobile: applicant.mobile || '',
            address: applicant.address || '',
            position: applicant.requirementId?.title || 'Not Specified',
            department: applicant.requirementId?.department || applicant.department || '',
            joiningDate: applicant.joiningDate ? new Date(applicant.joiningDate).toLocaleDateString('en-IN') : '',
            location: applicant.location || applicant.workLocation || '',
            ctcYearly: salaryStructure?.totals?.annualCTC || 0,
            ctcMonthly: salaryStructure?.totals?.monthlyCTC || 0,
            grossSalary: salaryStructure?.totals?.grossEarnings || 0,
            netSalary: salaryStructure?.totals?.netSalary || 0,
            earnings: salaryStructure?.earnings || [],
            deductions: salaryStructure?.deductions || [],
            employerBenefits: salaryStructure?.employerBenefits || [],
            companyName: companyProfile?.companyName || 'Company Name',
            companyAddress: companyProfile?.address || '',
            companyPhone: companyProfile?.phone || '',
            companyEmail: companyProfile?.email || '',
            companyWebsite: companyProfile?.website || '',
            letterDate: new Date().toLocaleDateString('en-IN'),
            refNo: `PREVIEW-JL/${new Date().getFullYear()}/XXXX`
        };

        // Generate preview (temporary file)
        const templatePath = normalizeFilePath(template.filePath);
        const templateBuffer = await fsPromises.readFile(templatePath);
        const zip = new PizZip(templateBuffer);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });

        doc.render(letterData);

        const outputBuffer = doc.getZip().generate({
            type: 'nodebuffer',
            compression: 'DEFLATE',
        });

        const previewDir = path.join(__dirname, '../uploads/previews');
        if (!fs.existsSync(previewDir)) {
            fs.mkdirSync(previewDir, { recursive: true });
        }

        const fileName = `preview_joining_${applicantId}_${Date.now()}.docx`;
        const outputPath = path.join(previewDir, fileName);
        
        await fsPromises.writeFile(outputPath, outputBuffer);

        res.json({
            success: true,
            message: 'Preview generated successfully',
            data: {
                previewUrl: `/uploads/previews/${fileName}`,
                fileName
            }
        });

    } catch (error) {
        console.error('❌ Preview Joining Letter Error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to generate preview',
            error: error.message 
        });
    }
};
```

---

## PART B: SALARY STRUCTURE FIX

### Current Issues:
1. ✅ Already has CTC validation
2. ✅ Already has strict formula checking
3. ❌ Needs better error messages
4. ❌ Needs to handle edge cases

### Enhanced Implementation:

```javascript
/**
 * CREATE SALARY STRUCTURE (ENHANCED)
 * POST /api/salary-structure/create
 */
exports.createSalaryStructure = async (req, res) => {
    try {
        const { candidateId, calculationMode, enteredCTC, earnings, deductions, employerContributions } = req.body;

        // ===== VALIDATION =====
        if (!candidateId) {
            return res.status(400).json({ 
                success: false,
                message: 'Candidate ID is required',
                field: 'candidateId'
            });
        }

        if (!enteredCTC || isNaN(Number(enteredCTC)) || Number(enteredCTC) <= 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Valid Annual CTC is required and must be greater than 0',
                field: 'enteredCTC',
                received: enteredCTC
            });
        }

        const { Applicant, SalaryStructure } = getModels(req);

        // ===== CHECK CANDIDATE EXISTS =====
        const applicant = await Applicant.findById(candidateId);
        if (!applicant) {
            return res.status(404).json({ 
                success: false,
                message: 'Candidate not found',
                candidateId 
            });
        }

        // ===== CALCULATE & VALIDATE =====
        const result = calculateSalaryBreakup({
            enteredCTC: Number(enteredCTC),
            earnings: Array.isArray(earnings) ? earnings : [],
            deductions: Array.isArray(deductions) ? deductions : [],
            employerContributions: Array.isArray(employerContributions) ? employerContributions : []
        });

        // ===== STRICT VALIDATION (AUTO MODE) =====
        if (calculationMode === 'AUTO' && !result.isValid) {
            return res.status(400).json({
                success: false,
                error: 'CTC_MISMATCH',
                message: `CTC Calculation Mismatch Detected`,
                details: {
                    enteredCTC: result.expectedCTC,
                    calculatedCTC: result.receivedCTC,
                    difference: result.mismatchAmount,
                    formula: 'CTC = Gross Earnings + Employer Contributions',
                    breakdown: {
                        grossEarnings: result.monthly.grossEarnings * 12,
                        employerContributions: result.monthly.employerContributions * 12,
                        total: (result.monthly.grossEarnings + result.monthly.employerContributions) * 12
                    }
                },
                action: 'Please adjust salary components to match the entered CTC'
            });
        }

        // ===== MANUAL MODE WARNING =====
        if (calculationMode === 'MANUAL' && !result.isValid) {
            console.warn(`⚠️ Manual mode CTC mismatch for candidate ${candidateId}: ₹${result.mismatchAmount}`);
        }

        // ===== PERSIST DATA =====
        const structureData = {
            candidateId,
            tenantId: req.tenantId,
            calculationMode: calculationMode || 'AUTO',
            earnings: result.earnings.map(e => ({
                key: e.componentId || e._id,
                label: e.name,
                monthly: e.amount,
                yearly: Number(e.amount) * 12,
                type: 'earning'
            })),
            deductions: result.deductions.map(d => ({
                key: d.componentId || d._id,
                label: d.name,
                monthly: d.amount,
                yearly: Number(d.amount) * 12,
                type: 'deduction'
            })),
            employerBenefits: result.employerContributions.map(b => ({
                key: b.componentId || b._id,
                label: b.name,
                monthly: b.amount,
                yearly: Number(b.amount) * 12,
                type: 'employer_benefit'
            })),
            totals: {
                grossEarnings: result.monthly.grossEarnings,
                totalDeductions: result.monthly.totalDeductions,
                netSalary: result.monthly.netSalary,
                employerBenefits: result.monthly.employerContributions,
                monthlyCTC: Math.round((result.annual.ctc / 12) * 100) / 100,
                annualCTC: result.annual.ctc
            },
            validation: {
                isValid: result.isValid,
                mismatchAmount: result.mismatchAmount,
                validatedAt: new Date()
            },
            updatedAt: new Date()
        };

        const updatedStructure = await SalaryStructure.findOneAndUpdate(
            { candidateId },
            { $set: structureData },
            { new: true, upsert: true }
        );

        // ===== UPDATE APPLICANT SNAPSHOT =====
        const snapshot = {
            earnings: structureData.earnings.map(e => ({
                name: e.label,
                monthlyAmount: e.monthly,
                annualAmount: e.yearly
            })),
            employeeDeductions: structureData.deductions.map(d => ({
                name: d.label,
                monthlyAmount: d.monthly,
                annualAmount: d.yearly
            })),
            employerContributions: structureData.employerBenefits.map(b => ({
                name: b.label,
                monthlyAmount: b.monthly,
                annualAmount: b.yearly
            })),
            grossA: {
                monthly: result.monthly.grossEarnings,
                yearly: result.monthly.grossEarnings * 12
            },
            takeHome: {
                monthly: result.monthly.netSalary,
                yearly: result.monthly.netSalary * 12
            },
            ctc: {
                monthly: Math.round(result.annual.ctc / 12),
                yearly: result.annual.ctc
            },
            totals: {
                grossEarnings: result.monthly.grossEarnings,
                totalDeductions: result.monthly.totalDeductions,
                netSalary: result.monthly.netSalary,
                employerBenefits: result.monthly.employerContributions,
                monthlyCTC: Math.round(result.annual.ctc / 12),
                annualCTC: result.annual.ctc
            },
            calculatedAt: new Date()
        };

        await Applicant.findByIdAndUpdate(candidateId, {
            $set: {
                ctc: result.receivedCTC,
                salarySnapshot: snapshot,
                salaryStructureId: updatedStructure._id
            }
        });

        // ===== SUCCESS RESPONSE =====
        res.json({
            success: true,
            message: 'Salary structure saved successfully',
            data: updatedStructure,
            validation: {
                isValid: result.isValid,
                mismatchAmount: result.mismatchAmount
            }
        });

    } catch (error) {
        console.error('❌ Create Salary Structure Error:', error);
        
        // Distinguish between validation errors and server errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({ 
                success: false,
                message: 'Validation failed',
                errors: Object.keys(error.errors).map(key => ({
                    field: key,
                    message: error.errors[key].message
                }))
            });
        }

        res.status(500).json({ 
            success: false,
            message: 'Failed to create salary structure',
            error: error.message 
        });
    }
};
```

---

## SAMPLE REQUEST/RESPONSE

### Joining Letter Generation

**Request:**
```json
POST /api/letters/generate-joining
{
  "applicantId": "507f1f77bcf86cd799439011",
  "templateId": "507f1f77bcf86cd799439012"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Joining letter generated successfully",
  "data": {
    "downloadUrl": "/uploads/joining_letters/joining_letter_507f1f77bcf86cd799439011_1704800000000.docx",
    "fileName": "joining_letter_507f1f77bcf86cd799439011_1704800000000.docx",
    "generatedAt": "2026-01-09T11:30:00.000Z"
  }
}
```

**Error Response (400 - Not Selected):**
```json
{
  "success": false,
  "message": "Cannot generate joining letter. Candidate status is \"Interview Scheduled\". Only SELECTED candidates can receive joining letters.",
  "currentStatus": "Interview Scheduled",
  "requiredStatus": "Selected"
}
```

**Error Response (400 - No Salary):**
```json
{
  "success": false,
  "message": "Salary structure not assigned. Please assign salary before generating joining letter.",
  "action": "ASSIGN_SALARY_FIRST"
}
```

### Salary Structure Creation

**Request:**
```json
POST /api/salary-structure/create
{
  "candidateId": "507f1f77bcf86cd799439011",
  "calculationMode": "AUTO",
  "enteredCTC": 600000,
  "earnings": [
    { "name": "Basic", "amount": 25000 },
    { "name": "HRA", "amount": 10000 },
    { "name": "Transport", "amount": 2000 }
  ],
  "deductions": [
    { "name": "PF Employee", "amount": 1800 }
  ],
  "employerContributions": [
    { "name": "PF Employer", "amount": 1800 },
    { "name": "ESIC", "amount": 500 }
  ]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Salary structure saved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "candidateId": "507f1f77bcf86cd799439011",
    "totals": {
      "grossEarnings": 37000,
      "totalDeductions": 1800,
      "netSalary": 35200,
      "employerBenefits": 2300,
      "monthlyCTC": 50000,
      "annualCTC": 600000
    }
  },
  "validation": {
    "isValid": true,
    "mismatchAmount": 0
  }
}
```

**Error Response (400 - CTC Mismatch):**
```json
{
  "success": false,
  "error": "CTC_MISMATCH",
  "message": "CTC Calculation Mismatch Detected",
  "details": {
    "enteredCTC": 600000,
    "calculatedCTC": 590000,
    "difference": 10000,
    "formula": "CTC = Gross Earnings + Employer Contributions",
    "breakdown": {
      "grossEarnings": 444000,
      "employerContributions": 27600,
      "total": 471600
    }
  },
  "action": "Please adjust salary components to match the entered CTC"
}
```

---

## ERROR HANDLING BEST PRACTICES

1. **Always use try/catch**
2. **Return appropriate HTTP status codes:**
   - 400: Bad Request (user error)
   - 404: Not Found
   - 500: Server Error (our fault)
3. **Provide actionable error messages**
4. **Include context in errors**
5. **Log errors for debugging**
6. **Never expose sensitive data in errors**

---

## DEPLOYMENT CHECKLIST

- [ ] Add functions to letter.controller.js
- [ ] Update salary structure controller
- [ ] Test all error scenarios
- [ ] Verify document upload still works
- [ ] Restart backend server
- [ ] Test end-to-end flow

---

**Status: READY FOR IMPLEMENTATION** ✅
