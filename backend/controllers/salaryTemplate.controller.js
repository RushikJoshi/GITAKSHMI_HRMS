const mongoose = require('mongoose');
const multer = require('multer');
const XLSX = require('xlsx');

const SalaryEngine = require('../services/salaryEngine');
// local helper
const round2 = (v) => Math.round((v || 0) * 100) / 100;

// Multer memory storage for small uploads
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const getModels = (req) => {
    if (req.tenantDB) {
        try {
            return {
                SalaryTemplate: req.tenantDB.model('SalaryTemplate'),
                SalaryComponent: req.tenantDB.model('SalaryComponent')
            };
        } catch (error) {
            // Models not registered, register them
            console.log(`[SALARY_TEMPLATE_CONTROLLER] Registering models in tenant DB`);
            const SalaryTemplateSchema = require('../models/SalaryTemplate');
            const SalaryComponentSchema = require('../models/SalaryComponent');
            return {
                SalaryTemplate: req.tenantDB.model('SalaryTemplate', SalaryTemplateSchema),
                SalaryComponent: req.tenantDB.model('SalaryComponent', SalaryComponentSchema)
            };
        }
    } else {
        // For super admin or testing, use main connection
        return {
            SalaryTemplate: mongoose.model('SalaryTemplate'),
            SalaryComponent: mongoose.model('SalaryComponent')
        };
    }
};

// DEPRECATED: Use SalaryEngine.calculate directly in services
// module.exports.calculateSalaryStructure = salaryCalculationService.calculateSalaryStructure;



/**
 * Unified Salary Breakup Calculator API
 * POST /api/payroll/calculate-breakup
 * 
 * Body: {
 *   targetCTC: number (yearly),
 *   earnings: Array,
 *   deductions: Array,
 *   benefits: Array (optional, will be fetched if not provided),
 *   settings: Object (optional)
 * }
 */
exports.calculateBreakup = async (req, res) => {
    try {
        console.log('[CALCULATE_BREAKUP] POST /api/payroll/calculate-breakup');

        const { targetCTC, earnings = [], deductions = [], benefits = [], suggested = false } = req.body;

        if (!targetCTC || isNaN(Number(targetCTC)) || Number(targetCTC) <= 0) {
            return res.status(400).json({
                success: false,
                error: 'targetCTC must be a positive number'
            });
        }

        // Prepare objects for the engine
        const template = {
            earnings: earnings.map(e => ({ name: e.name, code: e.code, formula: e.formula })),
            employeeDeductions: deductions.map(d => ({ name: d.name, code: d.code, formula: d.formula })),
            employerDeductions: benefits.map(b => ({ name: b.name, code: b.code, formula: b.formula }))
        };

        const result = await SalaryEngine.calculate({
            annualCTC: Number(targetCTC),
            template
        });

        return res.json({
            success: true,
            data: result,
            message: 'CTC calculation successful'
        });

    } catch (error) {
        console.error('[CALCULATE_BREAKUP] Error:', error);
        return res.status(400).json({
            success: false,
            error: error.message || 'Failed to calculate salary breakup'
        });
    }
};

/**
 * Handle Excel upload (CTC breakup)
 * Accepts multipart/form-data with fields: file, annualCTC, candidateId (optional), templateId (optional)
 */
exports.uploadCtcExcel = [
    // multer middleware
    upload.single('file'),
    async (req, res) => {
        try {
            console.log('[UPLOAD_CTC] req.file:', !!req.file, 'req.body keys:', Object.keys(req.body));

            // 1. Validate file presence and type
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Excel file is required' });
            }
            if (!req.file.originalname.match(/\.xlsx$/i)) {
                return res.status(400).json({ success: false, message: 'Only .xlsx files are supported' });
            }

            // 2. Validate required fields
            const rawCtc = req.body.ctc || req.body.annualCTC;
            const salaryStructureId = req.body.salaryStructureId;
            if (!rawCtc || isNaN(Number(rawCtc))) {
                return res.status(400).json({ success: false, message: 'ctc (number) is required' });
            }
            if (salaryStructureId && typeof salaryStructureId !== 'string') {
                return res.status(400).json({ success: false, message: 'salaryStructureId must be a string' });
            }
            const annualCTC = Number(rawCtc);

            // 3. Parse Excel - Flexible format (Salary Head, Monthly, Yearly columns)
            let excelRows = [];
            let errors = [];

            try {
                const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

                if (!rows || rows.length < 2) {
                    throw new Error('Excel must have at least one data row');
                }

                // Normalize headers: lowercase, trim, remove all spaces and special chars for comparison
                const normalizeHeader = (header) => {
                    return (header || '').toString()
                        .trim()
                        .toLowerCase()
                        .replace(/\s+/g, '') // Remove all spaces
                        .replace(/[^a-z0-9]/g, ''); // Remove special characters, keep only alphanumeric
                };

                const headers = rows[0].map(h => normalizeHeader(h));

                // Find column indices (flexible - support multiple column name variations)
                // Accepts partial matches and handles various formats
                const findColIndex = (patterns) => {
                    for (let i = 0; i < headers.length; i++) {
                        const h = headers[i];
                        // Check if header matches any pattern (exact or contains)
                        for (const pattern of patterns) {
                            const normalizedPattern = normalizeHeader(pattern);
                            if (h === normalizedPattern || h.includes(normalizedPattern) || normalizedPattern.includes(h)) {
                                return i;
                            }
                        }
                    }
                    return -1;
                };

                // Accept multiple variations for component name column
                const nameColIdx = findColIndex([
                    'componentname', 'component name', 'component',
                    'salaryhead', 'salary head', 'salary',
                    'name', 'head', 'salarycomponent', 'salary component',
                    'componentname', 'component_name', 'salary_head'
                ]);

                // Accept multiple variations for monthly column
                const monthlyColIdx = findColIndex([
                    'monthly', 'month', 'permonth', 'per month',
                    'monthlyamount', 'monthly amount', 'monthlyamt'
                ]);

                // Accept multiple variations for yearly column
                const yearlyColIdx = findColIndex([
                    'yearly', 'annual', 'year', 'annually',
                    'yearlyamount', 'yearly amount', 'annualamount', 'annual amount',
                    'yearlyamt', 'annualamt', 'ctc'
                ]);

                // Validate required columns with clear error message
                if (nameColIdx === -1) {
                    const availableHeaders = rows[0].map((h, i) => `"${h || `Column ${i + 1}`}"`).join(', ');
                    return res.status(400).json({
                        success: false,
                        message: `Excel must have a "Component Name" or "Salary Head" column. Found columns: ${availableHeaders}. Please ensure your Excel has a column with one of these names: Component Name, Salary Head, Component, Name, or Head.`
                    });
                }
                if (monthlyColIdx === -1 && yearlyColIdx === -1) {
                    const availableHeaders = rows[0].map((h, i) => `"${h || `Column ${i + 1}`}"`).join(', ');
                    return res.status(400).json({
                        success: false,
                        message: `Excel must have "Monthly" or "Yearly" amount columns. Found columns: ${availableHeaders}. Please ensure your Excel has a column with one of these names: Monthly, Yearly, Annual, Month, or Year.`
                    });
                }

                // Parse rows (skip header row, start from index 1)
                // Handle merged cells and formatted headers safely
                for (let r = 1; r < rows.length; r++) {
                    const rowArr = rows[r];
                    if (!rowArr || rowArr.length === 0) continue;

                    // Handle merged cells: if cell is empty, try to get value from previous row or skip
                    // Extract name from the name column (safely handle out-of-bounds)
                    let name = '';
                    if (nameColIdx < rowArr.length) {
                        const nameCell = rowArr[nameColIdx];
                        // Handle various cell formats (string, number, object)
                        if (nameCell !== null && nameCell !== undefined) {
                            name = nameCell.toString().trim();
                        }
                    }

                    // Skip empty rows or rows where name is missing
                    if (!name || name === '') continue;

                    // Skip header rows, totals, and section labels (normalize for comparison)
                    const nameLower = name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (nameLower.includes('total') || nameLower.includes('gross') ||
                        nameLower.includes('net') || (nameLower.includes('ctc') && nameLower.length < 10) ||
                        nameLower === 'a' || nameLower === 'b' || nameLower === 'c' || nameLower === 'd' ||
                        nameLower.includes('section') || nameLower.includes('annexure') ||
                        nameLower.includes('header') || nameLower.includes('column')) {
                        continue;
                    }

                    // Extract monthly and yearly values (handle merged cells, empty values, and formatting)
                    let monthly = 0;
                    let yearly = 0;

                    if (monthlyColIdx >= 0 && monthlyColIdx < rowArr.length) {
                        const monthlyVal = rowArr[monthlyColIdx];
                        if (monthlyVal !== null && monthlyVal !== undefined && monthlyVal !== '') {
                            // Handle string numbers with currency symbols or commas
                            const monthlyStr = monthlyVal.toString().replace(/[₹,\s]/g, '');
                            monthly = Number(monthlyStr) || 0;
                        }
                    }

                    if (yearlyColIdx >= 0 && yearlyColIdx < rowArr.length) {
                        const yearlyVal = rowArr[yearlyColIdx];
                        if (yearlyVal !== null && yearlyVal !== undefined && yearlyVal !== '') {
                            // Handle string numbers with currency symbols or commas
                            const yearlyStr = yearlyVal.toString().replace(/[₹,\s]/g, '');
                            yearly = Number(yearlyStr) || 0;
                        }
                    }

                    // Calculate missing value (if one is provided, calculate the other)
                    const finalMonthly = monthly > 0 ? monthly : (yearly > 0 ? round2(yearly / 12) : 0);
                    const finalYearly = yearly > 0 ? yearly : (monthly > 0 ? round2(monthly * 12) : 0);

                    // Skip zero values (but allow if it's a valid component that might be calculated later)
                    if (finalYearly === 0 && finalMonthly === 0) continue;

                    excelRows.push({
                        name: name,
                        monthly: round2(finalMonthly),
                        yearly: round2(finalYearly)
                    });
                }

                if (!excelRows.length) {
                    throw new Error('No valid salary components found in Excel');
                }
            } catch (parseErr) {
                console.error('[UPLOAD_CTC] Excel parse error:', parseErr);
                return res.status(400).json({ success: false, message: 'Could not parse Excel file. Please check the format and try again.' });
            }

            // 4. Detect component type from salary head name
            const detectComponentType = (name) => {
                const nameLower = name.toLowerCase().replace(/[^a-z0-9]/g, '');

                // BENEFIT detection
                if (nameLower.includes('employerpf') || nameLower.includes('employerpf') ||
                    nameLower.includes('gratuity') || nameLower.includes('insurance') ||
                    nameLower.includes('medicalinsurance') || nameLower.includes('employercontribution')) {
                    return 'BENEFIT';
                }

                // DEDUCTION detection
                if (nameLower.includes('professionaltax') || nameLower.includes('pt') ||
                    nameLower.includes('employeepf') || nameLower.includes('pfemployee') ||
                    nameLower.includes('esi') || nameLower.includes('esic') ||
                    nameLower.includes('deduction') || nameLower.includes('tax')) {
                    return 'DEDUCTION';
                }

                // Default to EARNING
                return 'EARNING';
            };

            // 5. Normalize component names and detect types
            const components = excelRows.map(row => {
                const normalizedName = row.name.trim();
                const detectedType = detectComponentType(normalizedName);

                return {
                    name: normalizedName,
                    type: detectedType,
                    monthly: row.monthly,
                    yearly: row.yearly,
                    calculationType: 'FLAT', // Default to flat amount from Excel
                    value: row.yearly // Store yearly value
                };
            });

            // 6. Auto-create components in database if they don't exist
            const tenantId = req.user?.tenantId || req.tenantId;
            if (!tenantId) {
                return res.status(401).json({ success: false, message: 'Unauthorized: Tenant context required' });
            }

            if (!req.tenantDB) {
                return res.status(500).json({ success: false, message: 'Tenant database connection not available' });
            }

            // Get or register models
            const { SalaryComponent } = getModels(req);

            // Register BenefitComponent if not already registered
            let BenefitComponent;
            try {
                BenefitComponent = req.tenantDB.model('BenefitComponent');
            } catch (err) {
                const BenefitComponentSchema = require('../models/BenefitComponent');
                BenefitComponent = req.tenantDB.model('BenefitComponent', BenefitComponentSchema);
            }

            // Register DeductionMaster if not already registered
            let DeductionMaster;
            try {
                DeductionMaster = req.tenantDB.model('DeductionMaster');
            } catch (err) {
                const DeductionMasterSchema = require('../models/DeductionMaster');
                DeductionMaster = req.tenantDB.model('DeductionMaster', DeductionMasterSchema);
            }

            const createdComponents = {
                earnings: [],
                deductions: [],
                benefits: []
            };

            // Helper: Normalize name for comparison
            const normalizeName = (name) => (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

            // Helper: Generate code from name
            const generateCode = (name) => name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');

            // Process each component from Excel
            for (const comp of components) {
                const normalizedName = normalizeName(comp.name);

                try {
                    if (comp.type === 'EARNING') {
                        // Check if earning component exists
                        let existing = await SalaryComponent.findOne({
                            tenantId,
                            name: { $regex: new RegExp(`^${comp.name}$`, 'i') },
                            type: 'EARNING'
                        });

                        if (!existing) {
                            // Auto-create EARNING component
                            existing = new SalaryComponent({
                                tenantId,
                                type: 'EARNING',
                                earningType: 'ALLOWANCE', // Default
                                name: comp.name,
                                payslipName: comp.name,
                                payType: 'FIXED',
                                calculationType: 'FLAT_AMOUNT',
                                amount: comp.yearly, // Store yearly value
                                isActive: true,
                                isTaxable: true,
                                includeInSalaryStructure: true,
                                showInPayslip: true,
                                epf: { enabled: false },
                                esi: { enabled: false }
                            });
                            await existing.save();
                            console.log(`[UPLOAD_CTC] Created EARNING component: ${comp.name}`);
                        }
                        createdComponents.earnings.push(existing);
                    }
                    else if (comp.type === 'BENEFIT') {
                        // Check if benefit component exists
                        let existing = await BenefitComponent.findOne({
                            tenantId,
                            name: { $regex: new RegExp(`^${comp.name}$`, 'i') }
                        });

                        if (!existing) {
                            // Detect benefit type
                            let benefitType = 'CUSTOM';
                            const nameLower = comp.name.toLowerCase();
                            if (nameLower.includes('pf') || nameLower.includes('provident')) benefitType = 'EMPLOYER_PF';
                            else if (nameLower.includes('gratuity')) benefitType = 'GRATUITY';
                            else if (nameLower.includes('insurance')) benefitType = 'INSURANCE';

                            // Auto-create BENEFIT component
                            existing = new BenefitComponent({
                                tenantId,
                                name: comp.name,
                                code: generateCode(comp.name),
                                benefitType,
                                payType: 'FIXED',
                                calculationType: 'FLAT',
                                value: comp.yearly, // Store yearly value
                                partOfSalaryStructure: true,
                                isTaxable: false,
                                showInPayslip: false,
                                isActive: true
                            });
                            await existing.save();
                            console.log(`[UPLOAD_CTC] ✅ Created BENEFIT component: ${comp.name} (${existing._id})`);
                        }
                        createdComponents.benefits.push(existing);
                    }
                    else if (comp.type === 'DEDUCTION') {
                        // Check if deduction component exists
                        let existing = await DeductionMaster.findOne({
                            tenantId,
                            name: { $regex: new RegExp(`^${comp.name}$`, 'i') }
                        });

                        if (!existing) {
                            // Detect category
                            let category = 'POST_TAX';
                            const nameLower = comp.name.toLowerCase();
                            if (nameLower.includes('pf') || nameLower.includes('esi') || nameLower.includes('provident')) {
                                category = 'PRE_TAX';
                            }

                            // Auto-create DEDUCTION component
                            existing = new DeductionMaster({
                                tenantId,
                                name: comp.name,
                                category,
                                amountType: 'FIXED',
                                amountValue: comp.yearly, // Store yearly value
                                calculationBase: 'BASIC', // Default
                                recurring: true,
                                isActive: true
                            });
                            await existing.save();
                            console.log(`[UPLOAD_CTC] ✅ Created DEDUCTION component: ${comp.name} (${existing._id})`);
                        }
                        createdComponents.deductions.push(existing);
                    }
                } catch (createErr) {
                    console.error(`[UPLOAD_CTC] Error creating component ${comp.name}:`, createErr);
                    // Continue with other components even if one fails
                }
            }

            // 7. Build salary structure from Excel data
            const earningsData = {};
            const deductionsData = {};
            const benefitsData = [];

            // Map Excel rows to salary structure format
            components.forEach(comp => {
                if (comp.type === 'EARNING') {
                    const nameLower = normalizeName(comp.name);
                    if (nameLower.includes('basic')) {
                        earningsData.basic = { monthly: comp.monthly, yearly: comp.yearly };
                    } else if (nameLower.includes('hra')) {
                        earningsData.hra = { monthly: comp.monthly, yearly: comp.yearly };
                    } else if (nameLower.includes('conveyance')) {
                        earningsData.conveyance = { monthly: comp.monthly, yearly: comp.yearly };
                    } else if (nameLower.includes('special')) {
                        earningsData.specialAllowance = { monthly: comp.monthly, yearly: comp.yearly };
                    } else {
                        if (!earningsData.other) earningsData.other = [];
                        earningsData.other.push({ name: comp.name, monthly: comp.monthly, yearly: comp.yearly });
                    }
                } else if (comp.type === 'DEDUCTION') {
                    const nameLower = normalizeName(comp.name);
                    if (nameLower.includes('pfemployee') || (nameLower.includes('pf') && !nameLower.includes('employer'))) {
                        deductionsData.pfEmployee = { monthly: comp.monthly, yearly: comp.yearly };
                    } else if (nameLower.includes('professional') || nameLower.includes('tax')) {
                        deductionsData.professionalTax = { monthly: comp.monthly, yearly: comp.yearly };
                    } else if (nameLower.includes('esic') || nameLower.includes('esi')) {
                        deductionsData.esic = { monthly: comp.monthly, yearly: comp.yearly };
                    } else {
                        if (!deductionsData.other) deductionsData.other = [];
                        deductionsData.other.push({ name: comp.name, monthly: comp.monthly, yearly: comp.yearly });
                    }
                } else if (comp.type === 'BENEFIT') {
                    benefitsData.push({
                        name: comp.name,
                        monthly: comp.monthly,
                        yearly: comp.yearly,
                        monthlyAmount: comp.monthly,
                        yearlyAmount: comp.yearly,
                        annualAmount: comp.yearly
                    });
                }
            });

            // 8. Calculate totals
            const calculateTotal = (obj) => {
                let monthly = 0, yearly = 0;
                for (const key in obj) {
                    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                        monthly += Number(obj[key].monthly) || 0;
                        yearly += Number(obj[key].yearly) || 0;
                    } else if (Array.isArray(obj[key])) {
                        obj[key].forEach(item => {
                            monthly += Number(item.monthly) || 0;
                            yearly += Number(item.yearly) || 0;
                        });
                    }
                }
                return { monthly, yearly };
            };

            const totalEarnings = calculateTotal(earningsData);
            const totalDeductions = calculateTotal(deductionsData);
            const totalBenefits = benefitsData.reduce((sum, b) => ({
                monthly: sum.monthly + (Number(b.monthly) || 0),
                yearly: sum.yearly + (Number(b.yearly) || 0)
            }), { monthly: 0, yearly: 0 });

            const netSalary = {
                monthly: totalEarnings.monthly - totalDeductions.monthly,
                yearly: totalEarnings.yearly - totalDeductions.yearly
            };

            const calculatedCTC = {
                monthly: totalEarnings.monthly + totalBenefits.monthly,
                yearly: totalEarnings.yearly + totalBenefits.yearly
            };

            // 9. Success response with created components info
            return res.json({
                success: true,
                message: `Excel uploaded successfully. ${createdComponents.earnings.length} earnings, ${createdComponents.deductions.length} deductions, ${createdComponents.benefits.length} benefits auto-created.`,
                data: {
                    earnings: earningsData,
                    deductions: deductionsData,
                    benefits: benefitsData,
                    employerContributions: benefitsData,
                    totals: {
                        grossEarnings: totalEarnings,
                        totalDeductions: totalDeductions,
                        totalBenefits: totalBenefits,
                        netSalary: netSalary,
                        totalCTC: calculatedCTC
                    },
                    projection: {
                        grossYearly: totalEarnings.yearly,
                        netMonthly: netSalary.monthly,
                        ctcYearly: calculatedCTC.yearly
                    },
                    createdComponents: {
                        earnings: createdComponents.earnings.map(c => ({ _id: c._id, name: c.name })),
                        deductions: createdComponents.deductions.map(c => ({ _id: c._id, name: c.name })),
                        benefits: createdComponents.benefits.map(c => ({ _id: c._id, name: c.name }))
                    }
                }
            });
        } catch (error) {
            console.error('[UPLOAD_CTC] Fatal error:', error && error.stack ? error.stack : error);
            return res.status(400).json({ success: false, message: 'Failed to process Excel upload. Please check your file and try again.' });
        }
    }
];

// Create Template
exports.createTemplate = async (req, res) => {
    try {
        const { SalaryTemplate } = getModels(req);
        const { templateName, description, annualCTC, earnings: earningsInput, employeeDeductions: deductionsInput, settings } = req.body;

        if (!templateName || !annualCTC) {
            return res.status(400).json({ success: false, error: 'Template name and Annual CTC are required' });
        }

        const tenantId = req.user?.tenantId || req.tenantId;

        const calculated = await salaryCalculationService.calculateSalaryStructure(
            annualCTC,
            earningsInput,
            settings || {},
            deductionsInput,
            null, // benefitsInput - will be fetched
            req.tenantDB,
            tenantId
        );
        if (!tenantId) {
            return res.status(401).json({ success: false, error: 'Unauthorized: Tenant context required' });
        }

        const template = new SalaryTemplate({
            tenantId: tenantId,
            templateName,
            description,
            annualCTC: calculated.annualCTC,
            monthlyCTC: calculated.monthlyCTC,
            earnings: calculated.earnings,
            employerDeductions: calculated.employerContributions,
            employeeDeductions: calculated.employeeDeductions,
            settings: settings || {}
        });

        await template.save();
        res.status(201).json({ success: true, data: template });
    } catch (error) {
        console.error('Create template error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// List Templates
exports.getTemplates = async (req, res) => {
    try {
        // Validate tenant context
        const tenantId = req.user?.tenantId || req.tenantId;
        if (!tenantId) {
            console.error('[GET_TEMPLATES] Missing tenant context:', {
                hasUser: !!req.user,
                hasTenantId: !!req.tenantId,
                tenantId: req.tenantId
            });
            return res.status(401).json({
                success: false,
                error: 'Unauthorized: Tenant context required'
            });
        }

        // Validate tenantDB exists
        if (!req.tenantDB) {
            console.error('[GET_TEMPLATES] Missing tenantDB connection');
            return res.status(500).json({
                success: false,
                error: 'Database connection not available'
            });
        }

        // Get model from tenantDB (ensure correct model registration)
        const { SalaryTemplate } = getModels(req);

        // Query with tenant isolation - fetch all templates (not filtering by isActive since schema may not have it)
        const templates = await SalaryTemplate.find({ tenantId })
            .sort({ createdAt: -1 })
            .lean(); // Use lean() for better performance

        console.log(`[GET_TEMPLATES] Found ${templates.length} templates for tenant ${tenantId}`);

        // Return response in correct format
        return res.status(200).json({
            success: true,
            data: templates
        });
    } catch (error) {
        console.error('[GET_TEMPLATES] Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get Template by ID
exports.getTemplateById = async (req, res) => {
    try {
        // Validate tenant context
        const tenantId = req.user?.tenantId || req.tenantId;
        if (!tenantId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized: Tenant context required'
            });
        }

        if (!req.tenantDB) {
            return res.status(500).json({
                success: false,
                error: 'Database connection not available'
            });
        }

        const { SalaryTemplate } = getModels(req);

        // Query with tenant isolation
        const template = await SalaryTemplate.findOne({
            _id: req.params.id,
            tenantId
        });

        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

        res.json({ success: true, data: template });
    } catch (error) {
        console.error('[GET_TEMPLATE_BY_ID] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Preview Salary Template (calculate breakdown without saving)
exports.previewTemplate = async (req, res) => {
    try {
        // Validate tenant context
        const tenantId = req.user?.tenantId || req.tenantId;
        if (!tenantId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized: Tenant context required'
            });
        }

        if (!req.tenantDB) {
            return res.status(500).json({
                success: false,
                error: 'Database connection not available'
            });
        }

        const { SalaryTemplate } = getModels(req);
        const template = await SalaryTemplate.findOne({
            _id: req.params.id,
            tenantId
        });

        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

        // Use SalaryEngine to get complete breakdown
        const overrideAnnualCTC = req.query?.annualCTC ? Number(req.query.annualCTC) : null;
        const targetCTC = overrideAnnualCTC || template.annualCTC || 0;

        if (!targetCTC) {
            return res.status(400).json({ success: false, error: "Initial annualCTC not set in template and no override provided." });
        }

        const calculated = await SalaryEngine.calculate({
            annualCTC: targetCTC,
            template
        });

        const salarySnapshot = {
            salaryTemplateId: template._id,
            earnings: calculated.earnings || [],
            employerContributions: calculated.benefits || [],
            employeeDeductions: calculated.deductions || [],
            grossA: { monthly: calculated.totals.grossMonthly, yearly: calculated.totals.annualCTC }, // Adjusting to match existing expected format if needed
            takeHome: { monthly: calculated.totals.netMonthly, yearly: calculated.totals.netMonthly * 12 },
            netSalary: { monthly: calculated.totals.netMonthly, yearly: calculated.totals.netMonthly * 12 },
            ctc: { monthly: calculated.monthlyCTC, yearly: calculated.annualCTC },
            calculatedAt: new Date()
        };

        res.json({ success: true, data: salarySnapshot });
    } catch (error) {
        console.error('[PREVIEW_TEMPLATE] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Update Template
exports.updateTemplate = async (req, res) => {
    try {
        // Validate tenant context
        const tenantId = req.user?.tenantId || req.tenantId;
        if (!tenantId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized: Tenant context required'
            });
        }

        const { SalaryTemplate } = getModels(req);
        const template = await SalaryTemplate.findOne({
            _id: req.params.id,
            tenantId
        });

        if (!template) return res.status(404).json({ success: false, error: 'Template not found' });

        if (template.isAssigned) {
            // Only description allowed to edit
            template.description = req.body.description;
            await template.save();
            return res.json({ success: true, data: template, message: 'Template is locked, only description updated' });
        }

        const { templateName, description, annualCTC, earnings: earningsInput, employeeDeductions: deductionsInput, settings } = req.body;
        const calculated = await salaryCalculationService.calculateSalaryStructure(
            annualCTC || template.annualCTC,
            earningsInput || template.earnings,
            settings || template.settings,
            deductionsInput || template.employeeDeductions,
            null, // benefitsInput - will be fetched
            req.tenantDB,
            tenantId
        );

        template.templateName = templateName || template.templateName;
        template.description = description || template.description;
        template.annualCTC = calculated.annualCTC;
        template.monthlyCTC = calculated.monthlyCTC;
        template.earnings = calculated.earnings;
        template.employerDeductions = calculated.employerContributions;
        template.employeeDeductions = calculated.employeeDeductions;
        template.settings = settings || template.settings;

        await template.save();
        res.json({ success: true, data: template });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// (UI helper removed - frontend components belong in the frontend project)
