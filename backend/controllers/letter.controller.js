const mongoose = require('mongoose');
const SalaryStructure = require('../models/SalaryStructure'); // Global Model
const letterPDFGenerator = require('../services/letterPDFGenerator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const joiningLetterUtils = require('../utils/joiningLetterUtils');

// Try to load docx2pdf, fallback if not available
let docx2pdf;
try {
    docx2pdf = require('docx2pdf');
    console.log('✅ docx2pdf module loaded successfully');
} catch (error) {
    console.warn('⚠️ docx2pdf module not available, PDF conversion will be disabled:', error.message);
    docx2pdf = null;
}

async function extractPlaceholders(filePath) {
    try {
        const buffer = await fsPromises.readFile(filePath);
        const zip = new PizZip(buffer);
        const docXml = zip.file("word/document.xml");
        if (!docXml) return [];

        const text = docXml.asText();
        const placeholderRegex = /\{\{([^}]+)\}\}/g;
        const placeholders = new Set();
        let match;
        while ((match = placeholderRegex.exec(text)) !== null) {
            placeholders.add(match[1].trim());
        }

        return Array.from(placeholders);
    } catch (error) {
        console.warn('⚠️ Error extracting placeholders (non-critical):', error.message);
        return [];
    }
}

// Helper to get models from tenant database
function getModels(req) {
    if (!req.tenantDB) {
        throw new Error("Tenant database connection not available");
    }
    const db = req.tenantDB;
    try {
        // Models are already registered by dbManager, just retrieve them
        // Do NOT pass schema - use connection.model(name) only
        return {
            CompanyProfile: db.model("CompanyProfile"),
            LetterTemplate: db.model("LetterTemplate"),
            GeneratedLetter: db.model("GeneratedLetter"),
            Applicant: db.model("Applicant"),
            // SalaryStructure is GLOBAL, not tenant-specific
        };
    } catch (err) {
        console.error("[letter.controller] Error retrieving models:", err.message);
        throw new Error(`Failed to retrieve models from tenant database: ${err.message}`);
    }
}

// Helper to get correct Applicant model (for backward compatibility)
function getApplicantModel(req) {
    if (req.tenantDB) {
        return req.tenantDB.model("Applicant");
    } else {
        return mongoose.model("Applicant");
    }
}

// Helper function to normalize file paths (always absolute)
// Helper function to normalize file paths (always absolute)
function normalizeFilePath(filePath) {
    if (!filePath) return null;

    // 1. Try treating as absolute
    let candidates = [];
    if (path.isAbsolute(filePath)) {
        candidates.push(path.normalize(filePath));
    }

    // 2. Try resolving relative to backend/uploads
    candidates.push(path.resolve(__dirname, '../uploads', filePath));

    // 3. Try resolving just the basename in backend/uploads/templates (Smart Fallback)
    const fileName = path.basename(filePath);
    const fallbackPath = path.resolve(__dirname, '../uploads/templates', fileName);
    candidates.push(fallbackPath);

    // Check availability
    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }

    // Default to first candidate if none exist (let caller handle 404)
    return candidates[0];
}

// Configure multer for Word template upload (supports both offer and joining)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Use consistent templates directory for both offer and joining templates
        const dest = path.join(__dirname, '../uploads/templates');
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
            console.log(`✅ [MULTER] Created templates directory: ${dest}`);
        }
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.docx';
        // Get type from body (offer or joining) - default to 'template' if not specified
        const letterType = (req.body && req.body.type) ? req.body.type : 'template';
        const timestamp = Date.now();
        const name = `${letterType}-template-${timestamp}${ext}`;
        console.log(`📁 [MULTER] Generated filename: ${name} for type: ${letterType}`);
        cb(null, name);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (ext === '.docx') {
            cb(null, true);
        } else {
            cb(new Error('Only .docx files are allowed'));
        }
    }
});

/** 
 * COMPANY PROFILE 
 */
exports.getCompanyProfile = async (req, res) => {
    try {
        const { CompanyProfile } = getModels(req);
        const profile = await CompanyProfile.findOne({ tenantId: req.user.tenantId });
        res.json(profile || { _isNew: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateCompanyProfile = async (req, res) => {
    try {
        const { CompanyProfile } = getModels(req);
        const { companyName, address, contactEmail, signatory, branding } = req.body;
        let profile = await CompanyProfile.findOne({ tenantId: req.user.tenantId });

        if (!profile) {
            profile = new CompanyProfile({ tenantId: req.user.tenantId });
        }

        if (companyName) profile.companyName = companyName;
        if (address) profile.address = address;
        if (contactEmail) profile.contactEmail = contactEmail;
        if (signatory) profile.signatory = signatory;
        if (branding) profile.branding = branding;

        await profile.save();
        res.json(profile);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/** 
 * TEMPLATES MANAGEMENT
 */

exports.getTemplates = async (req, res) => {
    try {
        const { type } = req.query;
        const query = { isActive: true };
        if (req.user?.tenantId) {
            query.tenantId = req.user.tenantId;
        }

        // Strict Type Filtering
        if (type) {
            query.type = type; // 'offer' or 'joining'
        }

        const { LetterTemplate } = getModels(req);
        const templates = await LetterTemplate.find(query).sort('-createdAt');

        // Transform response based on type
        const responseData = templates.map(template => {
            const base = {
                _id: template._id,
                name: template.name,
                type: template.type,
                isDefault: template.isDefault,
                createdAt: template.createdAt
            };

            if (template.templateType === 'WORD') {
                // Word templates (both offer and joining)
                return {
                    ...base,
                    filePath: template.filePath,
                    placeholders: template.placeholders || [],
                    status: template.status,
                    version: template.version,
                    templateType: 'WORD'
                };
            } else if (template.type === 'offer') {
                // HTML-based offer templates
                return {
                    ...base,
                    bodyContent: template.bodyContent,
                    headerContent: template.headerContent,
                    footerContent: template.footerContent,
                    headerHeight: template.headerHeight,
                    footerHeight: template.footerHeight,
                    hasHeader: template.hasHeader,
                    hasFooter: template.hasFooter,
                    templateType: template.templateType // 'BLANK' or 'LETTER_PAD'
                };
            } else if (template.type === 'joining') {
                // Legacy joining templates (should be Word, but keeping for compatibility)
                return {
                    ...base,
                    filePath: template.filePath,
                    placeholders: template.placeholders || [],
                    status: template.status,
                    version: template.version,
                    templateType: 'WORD'
                };
            }
            return base;
        });

        res.json(responseData);
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
};

exports.createTemplate = async (req, res) => {
    // Mostly for Offer Letters (HTML based)
    try {
        // Get tenant-specific model
        const { LetterTemplate } = getModels(req);

        const { name, type, bodyContent, headerContent, footerContent, headerHeight, footerHeight, hasHeader, hasFooter, templateType, isDefault } = req.body;

        if (isDefault) {
            await LetterTemplate.updateMany(
                { tenantId: req.user.tenantId, type, isDefault: true },
                { isDefault: false }
            );
        }

        const template = new LetterTemplate({
            tenantId: req.user.tenantId,
            name,
            type: type || 'offer',
            bodyContent, headerContent, footerContent,
            headerHeight, footerHeight, hasHeader, hasFooter,
            templateType: templateType || 'BLANK',
            isDefault,
            createdBy: req.user.userId
        });

        await template.save();
        res.status(201).json(template);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateTemplate = async (req, res) => {
    try {
        // Get tenant-specific model
        const { LetterTemplate } = getModels(req);

        const template = await LetterTemplate.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
        if (!template) return res.status(404).json({ message: 'Template not found' });

        // basic update logic...
        Object.assign(template, req.body);

        if (req.body.isDefault) {
            await LetterTemplate.updateMany(
                { tenantId: req.user.tenantId, type: template.type, isDefault: true, _id: { $ne: template._id } },
                { isDefault: false }
            );
        }

        await template.save();
        res.json(template);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};;

exports.getTemplateById = async (req, res) => {
    try {
        const { id } = req.params;

        // Log request for debugging
        console.log(`🔍 [GET TEMPLATE BY ID] Request for ID: ${id}`);
        console.log(`🔍 [GET TEMPLATE BY ID] User:`, req.user ? { userId: req.user.userId, role: req.user.role, tenantId: req.user.tenantId } : 'null');
        console.log(`🔍 [GET TEMPLATE BY ID] TenantDB:`, req.tenantDB ? 'available' : 'not available');

        // Validate ID format
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            console.error(`🔍 [GET TEMPLATE BY ID] Invalid ID format: ${id}`);
            return res.status(400).json({ message: 'Invalid template ID format' });
        }

        // Get tenant-specific model
        const { LetterTemplate } = getModels(req);

        // Build query - handle missing req.user gracefully
        const query = { _id: id };
        if (req.user?.tenantId) {
            query.tenantId = req.user.tenantId;
            console.log(`🔍 [GET TEMPLATE BY ID] Filtering by tenantId: ${req.user.tenantId}`);
        } else {
            console.warn(`🔍 [GET TEMPLATE BY ID] No tenantId in request, searching without tenant filter`);
        }

        // Find template
        const template = await LetterTemplate.findOne(query);

        if (!template) {
            console.error(`🔍 [GET TEMPLATE BY ID] Template not found for ID: ${id}`);
            return res.status(404).json({ message: 'Template not found' });
        }

        console.log(`🔍 [GET TEMPLATE BY ID] Template found:`, {
            id: template._id,
            name: template.name,
            type: template.type,
            templateType: template.templateType,
            hasFilePath: !!template.filePath
        });

        // Transform response for safety and proper handling
        const responseData = {
            _id: template._id,
            name: template.name,
            type: template.type,
            templateType: template.templateType,
            isDefault: template.isDefault,
            isActive: template.isActive,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt
        };

        // Handle WORD templates - validate filePath exists
        if (template.templateType === 'WORD') {
            responseData.templateType = 'WORD';
            responseData.placeholders = template.placeholders || [];
            responseData.version = template.version;
            responseData.status = template.status;

            // Check if filePath exists and file is accessible
            if (template.filePath) {
                try {
                    // Normalize file path before checking
                    const normalizedPath = normalizeFilePath(template.filePath);
                    const fileExists = fs.existsSync(normalizedPath);
                    if (fileExists) {
                        // Return normalized filePath for WORD templates (needed for preview)
                        responseData.filePath = normalizedPath;
                        responseData.hasFile = true;
                        console.log(`✅ [GET TEMPLATE BY ID] File exists at: ${normalizedPath}`);
                    } else {
                        console.error(`❌ [GET TEMPLATE BY ID] File NOT FOUND at path: ${normalizedPath}`);
                        console.error(`❌ [GET TEMPLATE BY ID] Original path from DB: ${template.filePath}`);
                        responseData.hasFile = false;
                        responseData.filePath = null;
                        responseData.fileError = 'Template file not found on server. Please re-upload the template.';
                        responseData.code = 'FILE_NOT_FOUND';
                    }
                } catch (fsError) {
                    console.error(`❌ [GET TEMPLATE BY ID] Error checking file: ${fsError.message}`);
                    console.error(`❌ [GET TEMPLATE BY ID] Stack:`, fsError.stack);
                    responseData.hasFile = false;
                    responseData.filePath = null;
                    responseData.fileError = 'Error accessing template file: ' + fsError.message;
                    responseData.code = 'FILE_ACCESS_ERROR';
                }
            } else {
                console.warn(`⚠️ [GET TEMPLATE BY ID] WORD template missing filePath in database`);
                responseData.hasFile = false;
                responseData.filePath = null;
                responseData.fileError = 'Template file path not set in database. Please re-upload the template.';
                responseData.code = 'FILE_PATH_MISSING';
            }
        } else {
            // HTML-based templates (BLANK, LETTER_PAD)
            responseData.bodyContent = template.bodyContent;
            responseData.headerContent = template.headerContent;
            responseData.footerContent = template.footerContent;
            responseData.headerHeight = template.headerHeight;
            responseData.footerHeight = template.footerHeight;
            responseData.hasHeader = template.hasHeader;
            responseData.hasFooter = template.hasFooter;
        }

        res.json(responseData);
    } catch (error) {
        console.error(`❌ [GET TEMPLATE BY ID] Error:`, error);
        console.error(`❌ [GET TEMPLATE BY ID] Stack:`, error.stack);

        // Ensure we always return a response
        if (!res.headersSent) {
            res.status(500).json({
                message: 'Failed to fetch template',
                error: error.message
            });
        }
    }
};

/**
 * DELETE TEMPLATE
 * - Remove file from disk
 * - Remove from DB
 */
exports.deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const userTenantId = req.user.tenantId;

        console.log(`🔥 [DELETE TEMPLATE] Request for ID: ${id}`);
        console.log(`🔥 [DELETE TEMPLATE] User:`, { userId: req.user.userId, role: req.user.role, tenantId: userTenantId });

        // Get tenant-specific model
        const { LetterTemplate } = getModels(req);

        // 1. Find by ID only first
        const template = await LetterTemplate.findById(id);

        if (!template) {
            console.log("🔥 [DELETE TEMPLATE] Template not found by ID.");
            return res.status(404).json({ message: "Template not found (Invalid ID)" });
        }

        console.log(`🔥 [DELETE TEMPLATE] Template found:`, { templateId: template._id, templateTenantId: template.tenantId, templateName: template.name });

        // 2. Security Check
        // Allow delete if:
        // - Tenant IDs match
        // - OR Template has NO tenantId (Corrupt record cleanup)
        // - OR User has admin role (can delete any template)

        const isOwner = template.tenantId && template.tenantId.toString() === userTenantId.toString();
        const isCorrupt = !template.tenantId; // If tenantId is missing, allow cleanup
        const isAdmin = req.user.role === 'admin'; // Admin can delete any template

        console.log(`🔥 [DELETE TEMPLATE] Ownership check:`, { isOwner, isCorrupt, isAdmin, templateTenant: template.tenantId, userTenant: userTenantId, userRole: req.user.role });

        if (!isOwner && !isCorrupt && !isAdmin) {
            console.log(`🔥 [DELETE TEMPLATE] Security Block. Template Tenant: ${template.tenantId}, User Tenant: ${userTenantId}, User Role: ${req.user.role}`);
            return res.status(403).json({
                message: "You do not have permission to delete this template.",
                reason: "Template belongs to a different tenant. Only admins can delete templates from other tenants."
            });
        }

        // 3. Delete File if exists (use normalized path)
        if (template.filePath) {
            try {
                const normalizedPath = normalizeFilePath(template.filePath);
                if (fs.existsSync(normalizedPath)) {
                    fs.unlinkSync(normalizedPath);
                    console.log(`✅ [DELETE TEMPLATE] Deleted template file: ${normalizedPath}`);
                } else {
                    console.warn(`⚠️ [DELETE TEMPLATE] File not found at path: ${normalizedPath} (continuing with DB deletion)`);
                }
            } catch (err) {
                console.error("❌ [DELETE TEMPLATE] Error deleting template file:", err);
                // Continue to delete DB record even if file delete fails
            }
        }

        // 4. Delete DB Record
        await LetterTemplate.findByIdAndDelete(id);

        res.status(200).json({ success: true, message: "Template deleted successfully" });
    } catch (error) {
        console.error("Delete template error:", error);
        res.status(500).json({ message: "Failed to delete template", error: error.message });
    }
};

/**
 * UPLOAD WORD TEMPLATE (Offer & Joining Letters)
 * - Uses Multer
 * - Extracts Placeholders
 * - Saves Metadata
 * - NO PDF GENERATION HERE
 */
exports.uploadWordTemplate = [
    upload.single('wordFile'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'No Word file uploaded' });
            }

            // Get tenant-specific model
            const { LetterTemplate } = getModels(req);

            // Normalize file path to ensure it's absolute and consistent
            const normalizedPath = normalizeFilePath(req.file.path);
            console.log(`📁 [UPLOAD TEMPLATE] Original path: ${req.file.path}`);
            console.log(`📁 [UPLOAD TEMPLATE] Normalized path: ${normalizedPath}`);

            // Verify file exists after normalization
            if (!fs.existsSync(normalizedPath)) {
                console.error(`❌ [UPLOAD TEMPLATE] File not found at normalized path: ${normalizedPath}`);
                return res.status(500).json({ success: false, message: 'Uploaded file not found on server' });
            }

            // Extract placeholders
            const placeholders = await extractPlaceholders(normalizedPath);

            // Validate tenantId is present
            if (!req.user?.tenantId) {
                console.error('❌ [UPLOAD TEMPLATE] Missing tenantId in request');
                return res.status(400).json({
                    success: false,
                    message: 'User authentication or tenant information missing. Please log in again.'
                });
            }

            // Support both offer and joining letter types
            const letterType = req.body.type || 'joining'; // Default to joining for backward compatibility
            const templateName = req.body.name || `${letterType === 'offer' ? 'Offer' : 'Joining'} Template ${Date.now()}`;

            const template = new LetterTemplate({
                tenantId: req.user.tenantId, // Ensure tenantId is set (not optional)
                name: templateName,
                type: letterType, // 'offer' or 'joining'
                templateType: 'WORD',
                filePath: normalizedPath, // Store normalized absolute path
                version: req.body.version || 'v1.0',
                status: req.body.status || 'Active',
                placeholders,
                isDefault: req.body.isDefault === 'true' || false,
                isActive: true
            });

            try {
                await template.save();
                console.log(`✅ [UPLOAD TEMPLATE] Template saved: ${template._id}, filePath: ${normalizedPath}`);
            } catch (saveError) {
                // Handle duplicate key error from old MongoDB index - AUTO FIX
                if (saveError.code === 11000 && (saveError.message.includes('tenant_1_letterType_1_templateName_1') || saveError.message.includes('tenant') && saveError.message.includes('letterType'))) {
                    console.warn('⚠️ [UPLOAD TEMPLATE] Old MongoDB index detected. Attempting to auto-fix...');

                    try {
                        // Get the collection and drop the old index
                        const collection = req.tenantDB.collection('lettertemplates');
                        const indexes = await collection.indexes();

                        // Find and drop the problematic index
                        for (const idx of indexes) {
                            if (idx.name === 'tenant_1_letterType_1_templateName_1' ||
                                (idx.key && idx.key.tenant && idx.key.letterType && idx.key.templateName)) {
                                console.log(`🗑️ [UPLOAD TEMPLATE] Dropping old index: ${idx.name}`);
                                await collection.dropIndex(idx.name);
                                console.log(`✅ [UPLOAD TEMPLATE] Old index dropped successfully`);

                                // Retry saving the template
                                await template.save();
                                console.log(`✅ [UPLOAD TEMPLATE] Template saved after index fix: ${template._id}`);

                                // Return success response
                                return res.status(200).json({
                                    success: true,
                                    message: `${letterType === 'offer' ? 'Offer' : 'Joining'} letter template uploaded successfully`,
                                    templateId: template._id,
                                    placeholders,
                                    note: 'Old database index was automatically removed'
                                });
                            }
                        }

                        // If index not found but error persists, throw original error
                        throw saveError;
                    } catch (fixError) {
                        console.error('❌ [UPLOAD TEMPLATE] Failed to auto-fix index:', fixError.message);
                        // If auto-fix fails, return helpful error
                        return res.status(500).json({
                            success: false,
                            message: 'Database index error. Please contact administrator.',
                            code: 'INDEX_ERROR',
                            error: fixError.message
                        });
                    }
                }
                throw saveError; // Re-throw if not the expected error
            }

            res.status(200).json({
                success: true,
                message: `${letterType === 'offer' ? 'Offer' : 'Joining'} letter template uploaded successfully`,
                templateId: template._id,
                placeholders
            });
        } catch (error) {
            console.error('❌ [UPLOAD TEMPLATE] Error:', error);
            console.error('❌ [UPLOAD TEMPLATE] Stack:', error.stack);
            // Cleanup on error
            if (req.file && fs.existsSync(req.file.path)) {
                try {
                    fs.unlinkSync(req.file.path);
                    console.log(`🧹 [UPLOAD TEMPLATE] Cleaned up file: ${req.file.path}`);
                } catch (e) {
                    console.error('⚠️ [UPLOAD TEMPLATE] Failed to cleanup file:', e.message);
                }
            }
            res.status(500).json({ success: false, message: error.message });
        }
    }
];

/**
 * PREVIEW WORD TEMPLATE AS PDF (Synchronous via LibreOffice)
 */
exports.previewWordTemplatePDF = async (req, res) => {
    try {
        const { templateId } = req.params;

        console.log(`🔍 [PREVIEW WORD TEMPLATE PDF] Request for templateId: ${templateId}`);

        // Validate ID format
        if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
            console.error(`🔍 [PREVIEW WORD TEMPLATE PDF] Invalid templateId format: ${templateId}`);
            return res.status(400).json({ message: "Invalid template ID format" });
        }

        // Get tenant-specific model
        const { LetterTemplate } = getModels(req);

        // Build query with tenant filtering if available
        const query = { _id: templateId };
        if (req.user?.tenantId) {
            query.tenantId = req.user.tenantId;
        }

        const template = await LetterTemplate.findOne(query);

        if (!template) {
            console.error(`🔍 [PREVIEW WORD TEMPLATE PDF] Template not found for ID: ${templateId}`);
            return res.status(404).json({ message: "Template not found" });
        }

        // Validate template type
        if (template.templateType !== 'WORD') {
            console.error(`🔍 [PREVIEW WORD TEMPLATE PDF] Template is not a WORD template: ${template.templateType}`);
            return res.status(400).json({ message: "Template is not a WORD template. Preview is only available for WORD templates." });
        }

        // Validate filePath exists
        if (!template.filePath) {
            console.error(`🔍 [PREVIEW WORD TEMPLATE PDF] Template filePath is missing`);
            return res.status(400).json({ message: "Template file path not set. Please re-upload the template." });
        }

        // Normalize and validate file path
        const normalizedFilePath = normalizeFilePath(template.filePath);
        console.log(`🔍 [PREVIEW WORD TEMPLATE PDF] Original path: ${template.filePath}`);
        console.log(`🔍 [PREVIEW WORD TEMPLATE PDF] Normalized path: ${normalizedFilePath}`);

        // Check if file exists
        if (!fs.existsSync(normalizedFilePath)) {
            console.error(`❌ [PREVIEW WORD TEMPLATE PDF] Template file NOT FOUND at path: ${normalizedFilePath}`);
            console.error(`❌ [PREVIEW WORD TEMPLATE PDF] Original path from DB: ${template.filePath}`);
            return res.status(404).json({
                message: "Template file not found on server. Please re-upload the template.",
                code: "FILE_NOT_FOUND"
            });
        }

        const templateDir = path.dirname(normalizedFilePath);
        const templateBaseName = path.basename(normalizedFilePath, '.docx');
        let pdfPath = path.join(templateDir, `${templateBaseName}.pdf`);

        // For joining letters, create a preview with sample data
        if (template.type === 'joining') {
            // Create a temporary DOCX with sample data replaced
            const content = await fsPromises.readFile(normalizedFilePath);
            let zip, doc;
            try {
                zip = new PizZip(content);
                doc = new Docxtemplater(zip, {
                    paragraphLoop: true,
                    linebreaks: true,
                    nullGetter: function (tag) { return ''; },
                    delimiters: { start: '{{', end: '}}' }
                });
            } catch (error) {
                console.error('Template load failed:', error);
                return res.status(400).json({ message: "Template load failed", error: error.message });
            }

            // Sample data for preview
            const sampleData = {
                employee_name: 'John Doe',
                father_name: 'Mr. Doe Sr.',
                designation: 'Software Engineer',
                department: 'IT Department',
                joining_date: new Date().toLocaleDateString('en-IN'),
                location: 'Mumbai, India',
                candidate_address: '123 Sample Street, Mumbai - 400001',
                offer_ref_code: 'OFFER/2024/001',
                current_date: new Date().toLocaleDateString('en-IN')
            };

            try {
                doc.render(sampleData);
            } catch (renderError) {
                console.error('Preview render failed:', renderError);
                // Continue with original template if render fails
            }

            // Generate temporary DOCX
            const buf = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
            const tempDocxPath = path.join(templateDir, `${templateBaseName}_preview.docx`);
            await fsPromises.writeFile(tempDocxPath, buf);

            // Update pdfPath to use the preview version
            pdfPath = path.join(templateDir, `${templateBaseName}_preview.pdf`);

            // Convert the preview DOCX to PDF
            try {
                console.log('🔄 [PREVIEW] Converting preview template to PDF (LibreOffice)...');
                const libreOfficeService = require('../services/LibreOfficeService');
                libreOfficeService.convertToPdfSync(tempDocxPath, templateDir);
            } catch (err) {
                console.error('⚠️ [PREVIEW] Preview conversion failed:', err.message);
                // Fallback to original PDF if it exists
                pdfPath = path.join(templateDir, `${templateBaseName}.pdf`);
                if (!fs.existsSync(pdfPath)) {
                    return res.status(500).json({ message: "PDF preview generation failed", error: err.message });
                }
            }
        } else {
            // For non-joining templates, use original logic
            // Check/Convert
            try {
                // Check if PDF exists and is newer than DOCX
                let needsConversion = true;
                if (fs.existsSync(pdfPath)) {
                    const docxStats = fs.statSync(normalizedFilePath);
                    const pdfStats = fs.statSync(pdfPath);
                    if (pdfStats.mtime >= docxStats.mtime) {
                        needsConversion = false;
                    }
                }

                if (needsConversion) {
                    console.log('🔄 [PREVIEW] Converting template to PDF (LibreOffice)...');
                    const libreOfficeService = require('../services/LibreOfficeService');
                    libreOfficeService.convertToPdfSync(normalizedFilePath, templateDir);
                }
            } catch (err) {
                console.error('⚠️ [PREVIEW] Conversion failed:', err.message);
                // If PDF exists (even if old), try to serve it, otherwise error
                if (!fs.existsSync(pdfPath)) {
                    return res.status(500).json({ message: "PDF preview generation failed", error: err.message });
                }
            }
        }

        // Verify PDF exists before serving
        if (!fs.existsSync(pdfPath)) {
            console.error(`🔍 [PREVIEW WORD TEMPLATE PDF] Generated PDF not found at: ${pdfPath}`);
            return res.status(500).json({ message: "PDF preview generation failed. The PDF file was not created." });
        }

        // Serve PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${templateBaseName}.pdf"`);
        const pdfStream = fs.createReadStream(pdfPath);

        // Handle stream errors
        pdfStream.on('error', (streamError) => {
            console.error(`❌ [PREVIEW WORD TEMPLATE PDF] Stream error:`, streamError);
            if (!res.headersSent) {
                res.status(500).json({ message: "Error reading PDF file", error: streamError.message });
            }
        });

        pdfStream.pipe(res);

    } catch (error) {
        console.error('❌ [PREVIEW WORD TEMPLATE PDF] Error:', error);
        console.error('❌ [PREVIEW WORD TEMPLATE PDF] Stack:', error.stack);
        if (!res.headersSent) {
            res.status(500).json({ message: "Failed to generate PDF preview", error: error.message });
        }
    }
};

/**
 * DOWNLOAD ORIGINAL WORD TEMPLATE FILE (.docx)
 */
exports.downloadWordTemplate = async (req, res) => {
    try {
        const { templateId } = req.params;

        // Validate ID
        if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
            return res.status(400).json({ message: "Invalid template ID format" });
        }

        // Get tenant-specific model
        const { LetterTemplate } = getModels(req);

        // Build query with tenant filtering if available
        const query = { _id: templateId };
        if (req.user?.tenantId) {
            query.tenantId = req.user.tenantId;
        }

        const template = await LetterTemplate.findOne(query);

        if (!template) {
            console.error(`❌ [DOWNLOAD WORD] Template not found: ${templateId}`);
            return res.status(404).json({ message: "Template not found" });
        }

        if (template.templateType !== 'WORD') {
            return res.status(400).json({ message: "This endpoint is only for WORD templates" });
        }

        if (!template.filePath) {
            console.error(`❌ [DOWNLOAD WORD] Template filePath missing for template: ${templateId}`);
            return res.status(400).json({ message: "Template file path not set. Please re-upload the template." });
        }

        // Normalize file path
        const normalizedFilePath = normalizeFilePath(template.filePath);

        if (!fs.existsSync(normalizedFilePath)) {
            console.error(`❌ [DOWNLOAD WORD] Template file NOT FOUND at: ${normalizedFilePath}`);
            return res.status(404).json({
                message: "Template file not found on server. Please re-upload the template.",
                code: "FILE_NOT_FOUND"
            });
        }

        // Serve the Word file
        const fileName = path.basename(normalizedFilePath);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${template.name || fileName}"`);
        const fileStream = fs.createReadStream(normalizedFilePath);

        fileStream.on('error', (streamError) => {
            console.error(`❌ [DOWNLOAD WORD] Stream error:`, streamError);
            if (!res.headersSent) {
                res.status(500).json({ message: "Error reading template file", error: streamError.message });
            }
        });

        fileStream.pipe(res);

    } catch (error) {
        console.error('❌ [DOWNLOAD WORD] Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: error.message });
        }
    }
};

/**
 * DOWNLOAD WORD TEMPLATE AS PDF (Synchronous via LibreOffice)
 */
exports.downloadWordTemplatePDF = async (req, res) => {
    try {
        const { templateId } = req.params;

        // Validate ID
        if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
            return res.status(400).json({ message: "Invalid template ID format" });
        }

        // Get tenant-specific model
        const { LetterTemplate } = getModels(req);

        const template = await LetterTemplate.findById(templateId);

        if (!template) {
            console.error(`❌ [DOWNLOAD PDF] Template not found: ${templateId}`);
            return res.status(404).json({ message: "Template not found" });
        }

        if (!template.filePath) {
            console.error(`❌ [DOWNLOAD PDF] Template filePath missing for template: ${templateId}`);
            return res.status(400).json({ message: "Template file path not set. Please re-upload the template." });
        }

        // Normalize file path
        const normalizedFilePath = normalizeFilePath(template.filePath);

        if (!fs.existsSync(normalizedFilePath)) {
            console.error(`❌ [DOWNLOAD PDF] Template file NOT FOUND at: ${normalizedFilePath}`);
            return res.status(404).json({
                message: "Template file not found on server. Please re-upload the template.",
                code: "FILE_NOT_FOUND"
            });
        }

        const templateDir = path.dirname(normalizedFilePath);
        const templateBaseName = path.basename(normalizedFilePath, '.docx');
        const pdfPath = path.join(templateDir, `${templateBaseName}.pdf`);

        // Check/Convert
        try {
            let needsConversion = true;
            if (fs.existsSync(pdfPath)) {
                const docxStats = fs.statSync(normalizedFilePath);
                const pdfStats = fs.statSync(pdfPath);
                if (pdfStats.mtime >= docxStats.mtime) {
                    needsConversion = false;
                }
            }

            if (needsConversion) {
                console.log('🔄 [DOWNLOAD PDF] Converting template to PDF (LibreOffice)...');
                const libreOfficeService = require('../services/LibreOfficeService');
                libreOfficeService.convertToPdfSync(normalizedFilePath, templateDir);
            }
        } catch (err) {
            console.error('⚠️ [DOWNLOAD] Conversion failed:', err.message);
            if (!fs.existsSync(pdfPath)) {
                return res.status(500).json({ message: "PDF generation failed", error: err.message });
            }
        }

        // Serve PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${templateBaseName}.pdf"`);
        const pdfStream = fs.createReadStream(pdfPath);
        pdfStream.pipe(res);

    } catch (error) {
        console.error('Download Error:', error);
        if (!res.headersSent) res.status(500).json({ message: error.message });
    }
};

/**
 * GENERATE JOINING LETTER (Word -> PDF)
 * - Load Word Template
 * - Replace placeholders
 * - Convert to PDF
 */
exports.generateJoiningLetter = async (req, res) => {
    try {
        console.log('🔥 [JOINING LETTER] Request received:', {
            bodyKeys: Object.keys(req.body),
            user: req.user?.userId,
            tenantId: req.user?.tenantId
        });

        const { applicantId, templateId } = req.body; // Only accept applicantId and templateId - no customData
        const Applicant = getApplicantModel(req);

        // Get tenant-specific models
        const { LetterTemplate, GeneratedLetter, SalaryStructure } = getModels(req);

        console.log('🔥 [JOINING LETTER] Extracted data:', { applicantId, templateId });

        const applicant = await Applicant.findById(applicantId).populate('requirementId');
        const template = await LetterTemplate.findOne({ _id: templateId, tenantId: req.user.tenantId });

        if (!applicant || !template) {
            console.error('🔥 [JOINING LETTER] Missing applicant or template');
            return res.status(404).json({ message: "Applicant or Template not found" });
        }

        // STRICT REQUIREMENT: Fail if Offer Letter does not exist
        if (!applicant.offerLetterPath) {
            console.error('🔥 [JOINING LETTER] BLOCKED: Applicant has no Offer Letter generated (offerLetterPath missing).');
            return res.status(400).json({ message: "Offer Letter must be generated before Joining Letter." });
        }

        if (template.type !== 'joining') {
            console.error('🔥 [JOINING LETTER] Invalid template type:', template.type);
            return res.status(400).json({ message: "Invalid template type for joining letter" });
        }

        // 1. Validate and normalize file path
        if (!template.filePath) {
            console.error('🔥 [JOINING LETTER] Template filePath is missing in database');
            return res.status(400).json({
                message: "Template file path is missing. Please re-upload the template.",
                code: "FILE_PATH_MISSING"
            });
        }

        // Normalize file path (handle both absolute and relative paths)
        const normalizedFilePath = normalizeFilePath(template.filePath);
        console.log('🔥 [JOINING LETTER] Original filePath:', template.filePath);
        console.log('🔥 [JOINING LETTER] Normalized filePath:', normalizedFilePath);

        if (!fs.existsSync(normalizedFilePath)) {
            console.error('❌ [JOINING LETTER] Template file NOT FOUND at path:', normalizedFilePath);
            console.error('❌ [JOINING LETTER] Original path from DB:', template.filePath);
            return res.status(404).json({
                message: "Template file not found on server. Please re-upload the template.",
                code: "FILE_NOT_FOUND",
                templateId: template._id.toString()
            });
        }

        console.log('✅ [JOINING LETTER] Template file found, reading...');
        const content = await fsPromises.readFile(normalizedFilePath);

        // 2. Initialize Docxtemplater SAFE MODE
        let doc;
        try {
            const zip = new PizZip(content);
            doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                nullGetter: function (tag) { return ''; }, // Return empty string for ANY missing tag
                delimiters: { start: '{{', end: '}}' }
            });
        } catch (error) {
            console.error('🔥 [JOINING LETTER] Docxtemplater Init Failed:', error);
            return res.status(400).json({ message: "Template load failed", error: error.message });
        }


        // 3. Prepare Data - FETCH FROM EmployeeSalarySnapshot (Single Source of Truth)
        const EmployeeSalarySnapshot = req.tenantDB.model('EmployeeSalarySnapshot');
        const snapshot = await EmployeeSalarySnapshot.findOne({ applicant: applicantId }).sort({ createdAt: -1 }).lean();

        if (!snapshot) {
            console.error(`[JOINING LETTER] EmployeeSalarySnapshot not found for applicant: ${applicantId}.`);
            return res.status(400).json({ message: "Salary snapshot not found. Please complete Salary Assignment first." });
        }

        // Helper to format currency
        const cur = (val) => Math.round(val || 0).toLocaleString('en-IN');
        const annual = (monthly) => monthly * 12;

        const earnings = snapshot.earnings || [];
        const deductions = snapshot.deductions || [];
        const benefits = snapshot.benefits || [];

        const totalEarningsAnnual = earnings.reduce((sum, e) => sum + e.annualAmount, 0);
        const totalBenefitsAnnual = benefits.reduce((sum, b) => sum + b.annualAmount, 0);
        const totalDeductionsAnnual = deductions.reduce((sum, d) => sum + d.annualAmount, 0);

        const grossAAnnual = totalEarningsAnnual;
        const netAnnual = totalEarningsAnnual - totalDeductionsAnnual;
        const totalCTCAnnual = totalEarningsAnnual + totalBenefitsAnnual;

        const totals = {
            grossA: { monthly: Math.round(grossAAnnual / 12), yearly: Math.round(grossAAnnual), formattedM: cur(grossAAnnual / 12), formattedY: cur(grossAAnnual) },
            deductions: { monthly: Math.round(totalDeductionsAnnual / 12), yearly: Math.round(totalDeductionsAnnual), formattedM: cur(totalDeductionsAnnual / 12), formattedY: cur(totalDeductionsAnnual) },
            net: { monthly: Math.round(netAnnual / 12), yearly: Math.round(netAnnual), formattedM: cur(netAnnual / 12), formattedY: cur(netAnnual) },
            computedCTC: { monthly: Math.round(totalCTCAnnual / 12), yearly: Math.round(totalCTCAnnual), formattedM: cur(totalCTCAnnual / 12), formattedY: cur(totalCTCAnnual) }
        };

        const flatData = {};
        earnings.forEach(e => { flatData[e.code] = cur(e.monthlyAmount); flatData[`${e.code}_ANNUAL`] = cur(e.annualAmount); });
        deductions.forEach(d => { flatData[d.code] = cur(d.monthlyAmount); flatData[`${d.code}_ANNUAL`] = cur(d.annualAmount); });
        benefits.forEach(b => { flatData[b.code] = cur(b.monthlyAmount); flatData[`${b.code}_ANNUAL`] = cur(b.annualAmount); });

        req.calculatedSalaryData = {
            earnings: earnings.map(e => ({ name: e.name, monthly: cur(e.monthlyAmount), yearly: cur(e.annualAmount) })),
            deductions: deductions.map(d => ({ name: d.name, monthly: cur(d.monthlyAmount), yearly: cur(d.annualAmount) })),
            benefits: benefits.map(b => ({ name: b.name, monthly: cur(b.monthlyAmount), yearly: cur(b.annualAmount) })),
            totals,
            flatData
        };
        req.flatSalaryData = flatData;

        // --- BUILD TABLE ---
        const salaryComponents = [];
        const earningsList = req.calculatedSalaryData.earnings;
        const deductionsList = req.calculatedSalaryData.deductions;
        const benefitsList = req.calculatedSalaryData.benefits;

        salaryComponents.push({ name: 'A – Monthly Benefits', monthly: '', yearly: '' });
        earningsList.forEach(e => {
            salaryComponents.push({ name: e.name, monthly: e.monthly, yearly: e.yearly });
        });
        salaryComponents.push({
            name: 'GROSS A',
            monthly: totals.grossA.formattedM,
            yearly: totals.grossA.formattedY
        });

        salaryComponents.push({ name: '', monthly: '', yearly: '' }); // Separator
        deductionsList.forEach(d => {
            salaryComponents.push({ name: d.name, monthly: d.monthly, yearly: d.yearly });
        });
        salaryComponents.push({ name: 'Total Deductions (B)', monthly: totals.deductions.formattedM, yearly: totals.deductions.formattedY });
        salaryComponents.push({ name: 'Net Salary Payable (A-B)', monthly: totals.net.formattedM, yearly: totals.net.formattedY });

        salaryComponents.push({ name: '', monthly: '', yearly: '' }); // Separator
        benefitsList.forEach(b => {
            salaryComponents.push({ name: b.name, monthly: b.monthly, yearly: b.yearly });
        });
        salaryComponents.push({ name: 'TOTAL CTC (A+C)', monthly: totals.computedCTC.formattedM, yearly: totals.computedCTC.formattedY });

        console.log("salaryComponents (FINAL STRICT) =>", salaryComponents);

        // A. Basic Placeholders
        const basicData = joiningLetterUtils.mapOfferToJoiningData(applicant, {}, snapshot);

        // Build complete salaryStructure object for template
        const salaryStructure = {
            earnings: req.calculatedSalaryData?.earnings || [],
            deductions: req.calculatedSalaryData?.deductions || [],
            benefits: req.calculatedSalaryData?.benefits || [],
            totals: {
                grossA: req.calculatedSalaryData?.totals?.grossA || { monthly: 0, yearly: 0, formattedM: '0', formattedY: '0' },
                grossB: req.calculatedSalaryData?.totals?.grossB || { monthly: 0, yearly: 0, formattedM: '0', formattedY: '0' },
                grossC: req.calculatedSalaryData?.totals?.grossC || { monthly: 0, yearly: 0, formattedM: '0', formattedY: '0' },
                netSalary: req.calculatedSalaryData?.totals?.netSalary || { monthly: 0, yearly: 0 },
                totalCTC: req.calculatedSalaryData?.totals?.totalCTC || { monthly: 0, yearly: 0 },
                computedCTC: req.calculatedSalaryData?.totals?.computedCTC || { monthly: 0, yearly: 0, formattedM: '0', formattedY: '0' },
                ...(req.calculatedSalaryData?.totals || {})
            }
        };

        const finalData = {
            ...basicData,
            salaryComponents: salaryComponents,
            salaryStructure: salaryStructure,
            earnings: salaryStructure.earnings,
            deductions: salaryStructure.deductions,
            benefits: salaryStructure.benefits,
            totals: salaryStructure.totals,
            ...(req.calculatedSalaryData || {}),
            ...(req.flatSalaryData || {}),
            salary_table_text_block: salaryComponents.map(r => `${r.name}\t${r.monthly}\t${r.yearly}`).join('\n'),
            SALARY_TABLE: salaryComponents.map(r => `${r.name}\t${r.monthly}\t${r.yearly}`).join('\n')
        };

        // (Cleanup: removed redundant legacy validation and duplicate finalData declaration)
        console.log('✅ [JOINING LETTER] Explicit salary table built. Rows:', salaryComponents.length);

        // Log missing placeholders
        console.log('🔥 [JOINING LETTER] Final data prepared:', Object.keys(finalData));

        // 4. Render
        console.log('🔥 [JOINING LETTER] Rendering with data...');
        try {
            doc.render(finalData);
        } catch (renderError) {
            console.error('🔥 [JOINING LETTER] RENDER CRASH:', renderError);
            return res.status(500).json({
                message: "Joining letter generation failed due to template rendering issues.",
                error: renderError.message
            });
        }

        // 5. Generate Output (DOCX)
        const buf = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
        const fileName = `Joining_Letter_${applicantId}_${Date.now()}`;
        const outputDir = path.join(__dirname, '../uploads/offers');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const docxPath = path.join(outputDir, `${fileName}.docx`);
        await fsPromises.writeFile(docxPath, buf);

        // 6. Convert to PDF Synchronously using LibreOffice
        let finalRelativePath;
        let finalPdfUrl;

        try {
            console.log('🔄 [JOINING LETTER] Starting Synchronous PDF Conversion (LibreOffice)...');
            const libreOfficeService = require('../services/LibreOfficeService');

            // Synchronous Call - blocks until done
            const pdfAbsolutePath = libreOfficeService.convertToPdfSync(docxPath, outputDir);
            const pdfFileName = path.basename(pdfAbsolutePath);

            finalRelativePath = `offers/${pdfFileName}`;
            finalPdfUrl = `/uploads/${finalRelativePath}`;

            console.log('✅ [JOINING LETTER] PDF Ready:', finalPdfUrl);

        } catch (pdfError) {
            console.error('⚠️ [JOINING LETTER] PDF Conversion Failed:', pdfError.message);
            return res.status(500).json({
                message: "PDF Generation Failed.",
                error: pdfError.message
            });
        }

        const generated = new GeneratedLetter({
            tenantId: req.user?.tenantId,
            applicantId,
            templateId,
            letterType: 'joining',
            pdfPath: finalRelativePath,
            pdfUrl: finalPdfUrl,
            status: 'generated',
            generatedBy: req.user?.userId
        });
        await generated.save();

        // Update Applicant
        applicant.joiningLetterPath = finalRelativePath;
        await applicant.save();

        // RETURN PDF URL IMMEDIATELY
        res.json({
            success: true,
            downloadUrl: finalPdfUrl, // Frontend looks for this
            pdfUrl: finalPdfUrl,      // Standard naming
            letterId: generated._id
        });

    } catch (error) {
        console.error('🔥 [JOINING LETTER] FATAL ERROR:', error);
        res.status(500).json({ message: "Internal Error", error: error.message });
    }
};

/**
 * GENERATE OFFER LETTER (HTML -> PDF)
 * - Uses Puppeteer/Images
 */
exports.generateOfferLetter = async (req, res) => {
    try {
        // Accept params from the Generate Modal
        const { applicantId, templateId, imageData, refNo, joiningDate, address, department, location, fatherName } = req.body;
        const Applicant = getApplicantModel(req);

        // Get tenant-specific models
        const { LetterTemplate, GeneratedLetter } = getModels(req);

        // Get the template to check its type
        const template = await LetterTemplate.findOne({ _id: templateId, tenantId: req.user.tenantId });
        if (!template) {
            return res.status(404).json({ message: "Template not found" });
        }

        const applicant = await Applicant.findById(applicantId).populate('requirementId');
        if (!applicant) {
            return res.status(404).json({ message: "Applicant not found" });
        }

        let relativePath;
        let downloadUrl;
        let templateType = template.templateType;
        let pdfFileName; // Store filename for database

        if (template.templateType === 'WORD') {
            // Handle Word template processing
            console.log('🔥 [OFFER LETTER] Processing Word template (Sync using LibreOffice)');

            if (!template.filePath) {
                console.error('❌ [OFFER LETTER] Template filePath is missing in database');
                return res.status(400).json({
                    message: "Template file path is missing. Please re-upload the template.",
                    code: "FILE_PATH_MISSING"
                });
            }

            // Normalize file path
            const normalizedFilePath = normalizeFilePath(template.filePath);
            console.log('🔥 [OFFER LETTER] Original filePath:', template.filePath);
            console.log('🔥 [OFFER LETTER] Normalized filePath:', normalizedFilePath);

            if (!fs.existsSync(normalizedFilePath)) {
                console.error('❌ [OFFER LETTER] Template file NOT FOUND at path:', normalizedFilePath);
                return res.status(404).json({
                    message: "Word template file not found on server. Please re-upload the template.",
                    code: "FILE_NOT_FOUND"
                });
            }

            console.log('✅ [OFFER LETTER] Template file found, reading...');
            const content = await fsPromises.readFile(normalizedFilePath);

            // Initialize Docxtemplater
            const zip = new PizZip(content);
            const doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                nullGetter: function (tag) { return ''; },
                delimiters: { start: '{{', end: '}}' }
            });

            // Prepare data using inputs from Modal + Applicant DB
            const safeString = (val) => (val !== undefined && val !== null ? String(val) : '');

            // Get father name with priority: Modal Input -> DB
            const finalFatherName = safeString(fatherName || applicant.fatherName);
            console.log('🔥 [OFFER LETTER] Father name source:', {
                fromModal: fatherName,
                fromDB: applicant.fatherName,
                final: finalFatherName
            });

            // Get issued date - TODAY's date when Generate button is clicked
            // Format: DD/MM/YYYY (e.g., "31/12/2025")
            const issuedDate = new Date().toLocaleDateString('en-IN');
            console.log('📅 [OFFER LETTER] Issued Date set to TODAY:', issuedDate, '- This date will appear when you add {{issued_date}} to your Word template');

            const offerData = {
                employee_name: safeString(applicant.name),
                candidate_name: safeString(applicant.name), // Added for compatibility
                // Father name - support multiple placeholder variations
                father_name: finalFatherName,
                father_names: finalFatherName, // Plural alias
                fatherName: finalFatherName, // CamelCase alias
                fatherNames: finalFatherName, // CamelCase plural alias
                FATHER_NAME: finalFatherName, // Uppercase alias
                FATHER_NAMES: finalFatherName, // Uppercase plural alias
                designation: safeString(applicant.requirementId?.jobTitle || applicant.currentDesignation),
                // Joining Date: HR Input (Modal) -> Applicant DB (Fallback)
                joining_date: safeString(joiningDate ? new Date(joiningDate).toLocaleDateString('en-IN') : (applicant.joiningDate ? new Date(applicant.joiningDate).toLocaleDateString('en-IN') : '')),
                // Location: HR Input (Modal) -> Applicant DB (Fallback)
                location: safeString(location || applicant.location || applicant.workLocation),
                // Address: HR Input (Modal) -> Applicant DB (Fallback)
                address: safeString(address || applicant.address),
                candidate_address: safeString(address || applicant.address), // Alias for some templates
                // Ref No: HR Input (Modal) ONLY
                offer_ref_no: safeString(refNo),
                // Issued Date - support multiple placeholder variations
                issued_date: issuedDate,
                issuedDate: issuedDate, // CamelCase alias
                ISSUED_DATE: issuedDate, // Uppercase alias
                // Current date (legacy support)
                current_date: issuedDate
            };

            console.log('🔥 [OFFER LETTER] Word template data:', offerData);
            console.log('📅 [OFFER LETTER] Issued Date:', issuedDate, '(Use {{issued_date}} in your Word template)');

            // Render the document
            doc.render(offerData);

            // Generate DOCX output
            const buf = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
            const fileName = `Offer_Letter_${applicantId}_${Date.now()}`;
            const outputDir = path.join(__dirname, '../uploads/offers');
            if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

            const docxPath = path.join(outputDir, `${fileName}.docx`);
            await fsPromises.writeFile(docxPath, buf);

            // --- SYNCHRONOUS VIDEO CONVERSION ---
            try {
                console.log('🔄 [OFFER LETTER] Starting Synchronous PDF Conversion...');
                const libreOfficeService = require('../services/LibreOfficeService');

                const pdfAbsolutePath = libreOfficeService.convertToPdfSync(docxPath, outputDir);
                const pdfFileName = path.basename(pdfAbsolutePath);

                relativePath = `offers/${pdfFileName}`;
                downloadUrl = `/uploads/${relativePath}`; // The URL to the PDF

                console.log('✅ [OFFER LETTER] PDF Conversion Successful:', downloadUrl);

            } catch (pdfError) {
                console.error('⚠️ [OFFER LETTER] PDF Conversion Failed:', pdfError.message);
                return res.status(500).json({
                    message: "PDF Generation Failed. Please ensure LibreOffice is installed.",
                    error: pdfError.message
                });
            }

        } else {
            // Handle HTML template processing (Now using LibreOffice)
            console.log('🔥 [OFFER LETTER] Processing HTML template (Sync using LibreOffice)');

            // 1. Prepare Data (Reuse same logic as Word)
            const safeString = (val) => (val !== undefined && val !== null ? String(val) : '');

            // Map keys for HTML replacement (e.g. {{employee_name}})
            // Prioritize Body Input -> Applicant DB
            const finalFatherName = safeString(fatherName || applicant.fatherName);

            // Get issued date (current date when letter is generated)
            const issuedDate = new Date().toLocaleDateString('en-IN');

            const replacements = {
                '{{employee_name}}': safeString(applicant.name),
                '{{candidate_name}}': safeString(applicant.name),
                '{{father_name}}': finalFatherName,
                '{{father_names}}': finalFatherName, // Alias
                '{{designation}}': safeString(applicant.requirementId?.jobTitle || applicant.currentDesignation),
                '{{joining_date}}': safeString(joiningDate ? new Date(joiningDate).toLocaleDateString('en-IN') : (applicant.joiningDate ? new Date(applicant.joiningDate).toLocaleDateString('en-IN') : '')),
                '{{location}}': safeString(location || applicant.location || applicant.workLocation),
                '{{address}}': safeString(applicant.address || address),
                '{{offer_ref_no}}': safeString(refNo),
                // Issued Date - support multiple placeholder variations
                '{{issued_date}}': issuedDate,
                '{{issuedDate}}': issuedDate, // CamelCase alias
                '{{ISSUED_DATE}}': issuedDate, // Uppercase alias
                // Current date (legacy support)
                '{{current_date}}': issuedDate
            };

            // 2. Populate HTML Content
            let htmlContent = template.bodyContent || '';

            // Replace all placeholders
            Object.keys(replacements).forEach(key => {
                const regex = new RegExp(key, 'g');
                htmlContent = htmlContent.replace(regex, replacements[key]);
            });

            // Wrap in basic HTML structure if missing to ensure proper rendering
            if (!htmlContent.includes('<html')) {
                htmlContent = `
                    <html>
                    <head>
                        <style>
                            body { font-family: 'Arial', sans-serif; font-size: 12pt; line-height: 1.5; color: #000; }
                            p { margin-bottom: 1rem; }
                        </style>
                    </head>
                    <body>
                        ${htmlContent}
                    </body>
                    </html>
                `;
            }

            // 3. Save to Temp HTML File
            const fileName = `Offer_Letter_${applicantId}_${Date.now()}`;
            const outputDir = path.join(__dirname, '../uploads/offers');
            if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

            const htmlPath = path.join(outputDir, `${fileName}.html`);
            await fsPromises.writeFile(htmlPath, htmlContent);

            // 4. Convert HTML to PDF Synchronously
            try {
                console.log('🔄 [OFFER LETTER] Converting HTML to PDF (LibreOffice)...');
                const libreOfficeService = require('../services/LibreOfficeService');

                const pdfAbsolutePath = libreOfficeService.convertToPdfSync(htmlPath, outputDir);
                const pdfFileName = path.basename(pdfAbsolutePath);

                relativePath = `offers/${pdfFileName}`;
                downloadUrl = `/uploads/${relativePath}`; // Standard URL

                console.log('✅ [OFFER LETTER] HTML -> PDF Conversion Successful:', downloadUrl);

                // Optional: Clean up HTML file to save space
                // await fsPromises.unlink(htmlPath).catch(err => console.warn('Failed to delete temp html:', err));

            } catch (pdfError) {
                console.error('⚠️ [OFFER LETTER] HTML Conversion Failed:', pdfError.message);
                return res.status(500).json({
                    message: "PDF Generation Failed (HTML). Please ensure LibreOffice is installed.",
                    error: pdfError.message
                });
            }
        }

        // Save generated letter record
        const generated = new GeneratedLetter({
            tenantId: req.user?.tenantId,
            applicantId,
            templateId,
            templateType, // 'WORD' or 'BLANK'/'LETTER_PAD'
            letterType: 'offer',
            pdfPath: relativePath,
            pdfUrl: downloadUrl,
            status: 'generated',
            generatedBy: req.user?.userId
        });
        await generated.save();

        // Prepare update data for applicant (Save the inputs)
        // Store just the filename, not the full path to avoid duplicate /offers/ in URL
        const storedFileName = pdfFileName || (relativePath ? path.basename(relativePath) : '');
        const updateData = {
            offerLetterPath: storedFileName,
            offerRefCode: refNo,
            status: 'Selected'
        };

        if (joiningDate) updateData.joiningDate = new Date(joiningDate);
        if (address) updateData.address = address;
        if (department) updateData.department = department;
        if (location) updateData.location = location;
        if (fatherName) updateData.fatherName = fatherName; // Persist Father Name

        await Applicant.findByIdAndUpdate(applicantId, updateData);

        res.json({
            success: true,
            downloadUrl: downloadUrl,
            pdfPath: relativePath,
            templateType: template.templateType,
            message: "Offer Letter Generated Successfully"
        });

    } catch (error) {
        console.error("Generate Offer Letter Error:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.downloadLetterPDF = async (req, res) => {
    try {
        const { imageData } = req.body;
        const result = await letterPDFGenerator.generatePDF(imageData);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getHistory = async (req, res) => {
    try {
        // Get tenant-specific model
        const { GeneratedLetter } = getModels(req);

        const history = await GeneratedLetter.find({ tenantId: req.user.tenantId })
            .sort('-createdAt')
            .populate('applicantId', 'name');
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * PREVIEW JOINING LETTER WITH APPLICANT DATA (Word -> PDF)
 * - Load Word Template
 * - Replace placeholders with real applicant data
 * - Convert to PDF (temporary)
 * - Return preview URL
 */
exports.previewJoiningLetter = async (req, res) => {
    try {
        const { applicantId, templateId } = req.body;
        const Applicant = getApplicantModel(req);

        console.log('🔥 [PREVIEW JOINING LETTER] Request received:', { applicantId, templateId });
        console.log('🔥 [PREVIEW JOINING LETTER] User context:', req.user ? { userId: req.user.userId, tenantId: req.user.tenantId } : 'null');

        // Validate input
        if (!applicantId || !templateId) {
            console.error('🔥 [PREVIEW JOINING LETTER] Missing required parameters');
            return res.status(400).json({ message: "applicantId and templateId are required" });
        }

        // Validate IDs
        if (!mongoose.Types.ObjectId.isValid(applicantId) || !mongoose.Types.ObjectId.isValid(templateId)) {
            console.error('🔥 [PREVIEW JOINING LETTER] Invalid ID format');
            return res.status(400).json({ message: "Invalid ID format" });
        }

        // Find applicant
        const applicant = await Applicant.findById(applicantId).populate('requirementId');
        if (!applicant) {
            console.error('🔥 [PREVIEW JOINING LETTER] Applicant not found:', applicantId);
            return res.status(404).json({ message: "Applicant not found" });
        }

        // Get tenant-specific model
        const { LetterTemplate, SalaryStructure } = getModels(req);

        // Build query - handle missing req.user gracefully
        const templateQuery = { _id: templateId };
        if (req.user?.tenantId) {
            templateQuery.tenantId = req.user.tenantId;
        }

        const template = await LetterTemplate.findOne(templateQuery);

        if (!template) {
            console.error('🔥 [PREVIEW JOINING LETTER] Template not found:', templateId);
            return res.status(404).json({ message: "Template not found" });
        }

        console.log('🔥 [PREVIEW JOINING LETTER] Template found:', {
            id: template._id,
            name: template.name,
            type: template.type,
            templateType: template.templateType,
            filePath: template.filePath ? 'present' : 'missing'
        });

        // Validate template type
        if (template.type !== 'joining') {
            console.error('🔥 [PREVIEW JOINING LETTER] Invalid template type:', template.type);
            return res.status(400).json({ message: "Invalid template type for joining letter. Expected 'joining' type." });
        }

        // Validate template templateType (must be WORD)
        if (template.templateType !== 'WORD') {
            console.error('🔥 [PREVIEW JOINING LETTER] Invalid template templateType:', template.templateType);
            return res.status(400).json({ message: "This template is not a WORD template. Only WORD templates are supported for joining letters." });
        }

        // 1. Validate and normalize file path
        if (!template.filePath) {
            console.error('🔥 [PREVIEW JOINING LETTER] Template filePath is missing in database');
            return res.status(400).json({
                message: "Template file path is missing. Please re-upload the template.",
                code: "FILE_PATH_MISSING"
            });
        }

        // Normalize file path (handle both absolute and relative paths)
        const normalizedFilePath = normalizeFilePath(template.filePath);
        console.log('🔥 [PREVIEW JOINING LETTER] Original filePath:', template.filePath);
        console.log('🔥 [PREVIEW JOINING LETTER] Normalized filePath:', normalizedFilePath);

        // Check if file exists
        if (!fs.existsSync(normalizedFilePath)) {
            console.error('❌ [PREVIEW JOINING LETTER] Template file NOT FOUND at path:', normalizedFilePath);
            console.error('❌ [PREVIEW JOINING LETTER] Original path from DB:', template.filePath);
            console.error('❌ [PREVIEW JOINING LETTER] Template ID:', template._id);
            console.error('❌ [PREVIEW JOINING LETTER] Template name:', template.name);

            // Return 404 with clear message and actionable error code
            return res.status(404).json({
                message: "Template file not found on server. The file may have been deleted or moved. Please re-upload the template.",
                code: "FILE_NOT_FOUND",
                templateId: template._id.toString(),
                filePath: normalizedFilePath
            });
        }

        console.log('✅ [PREVIEW JOINING LETTER] Template file found, reading...');
        const content = await fsPromises.readFile(normalizedFilePath);

        // 2. Initialize Docxtemplater SAFE MODE
        let doc;
        try {
            const zip = new PizZip(content);
            doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                nullGetter: function (tag) { return ''; }, // Return empty string for ANY missing tag
                delimiters: { start: '{{', end: '}}' }
            });
        } catch (error) {
            console.error('🔥 [PREVIEW JOINING LETTER] Docxtemplater Init Failed:', error);
            return res.status(400).json({ message: "Template load failed", error: error.message });
        }

        // 3. Prepare Data - FETCH FROM EmployeeSalarySnapshot (Single Source of Truth)
        const EmployeeSalarySnapshot = req.tenantDB.model('EmployeeSalarySnapshot');
        const snapshot = await EmployeeSalarySnapshot.findOne({ applicant: applicantId }).sort({ createdAt: -1 }).lean();

        if (!snapshot) {
            console.error(`[PREVIEW JOINING LETTER] EmployeeSalarySnapshot not found for applicant: ${applicantId}.`);
            return res.status(400).json({ message: "Salary snapshot not found. Please complete Salary Assignment first." });
        }

        // Helper to format currency
        const cur = (val) => Math.round(val || 0).toLocaleString('en-IN');

        const earnings = snapshot.earnings || [];
        const deductions = snapshot.deductions || [];
        const benefits = snapshot.benefits || [];

        const totalEarningsAnnual = earnings.reduce((sum, e) => sum + e.annualAmount, 0);
        const totalBenefitsAnnual = benefits.reduce((sum, b) => sum + b.annualAmount, 0);
        const totalDeductionsAnnual = deductions.reduce((sum, d) => sum + d.annualAmount, 0);

        const grossAAnnual = totalEarningsAnnual;
        const netAnnual = totalEarningsAnnual - totalDeductionsAnnual;
        const totalCTCAnnual = totalEarningsAnnual + totalBenefitsAnnual;

        const totals = {
            grossA: { monthly: Math.round(grossAAnnual / 12), yearly: Math.round(grossAAnnual), formattedM: cur(grossAAnnual / 12), formattedY: cur(grossAAnnual) },
            deductions: { monthly: Math.round(totalDeductionsAnnual / 12), yearly: Math.round(totalDeductionsAnnual), formattedM: cur(totalDeductionsAnnual / 12), formattedY: cur(totalDeductionsAnnual) },
            net: { monthly: Math.round(netAnnual / 12), yearly: Math.round(netAnnual), formattedM: cur(netAnnual / 12), formattedY: cur(netAnnual) },
            computedCTC: { monthly: Math.round(totalCTCAnnual / 12), yearly: Math.round(totalCTCAnnual), formattedM: cur(totalCTCAnnual / 12), formattedY: cur(totalCTCAnnual) }
        };

        const flatData = {};
        earnings.forEach(e => { flatData[e.code] = cur(e.monthlyAmount); flatData[`${e.code}_ANNUAL`] = cur(e.annualAmount); });
        deductions.forEach(d => { flatData[d.code] = cur(d.monthlyAmount); flatData[`${d.code}_ANNUAL`] = cur(d.annualAmount); });
        benefits.forEach(b => { flatData[b.code] = cur(b.monthlyAmount); flatData[`${b.code}_ANNUAL`] = cur(b.annualAmount); });

        req.calculatedSalaryData = {
            earnings: earnings.map(e => ({ name: e.name, monthly: cur(e.monthlyAmount), yearly: cur(e.annualAmount) })),
            deductions: deductions.map(d => ({ name: d.name, monthly: cur(d.monthlyAmount), yearly: cur(d.annualAmount) })),
            benefits: benefits.map(b => ({ name: b.name, monthly: cur(b.monthlyAmount), yearly: cur(b.annualAmount) })),
            totals,
            flatData
        };
        req.flatSalaryData = flatData;

        // --- BUILD TABLE ---
        const salaryComponents = [];
        const earningsList = req.calculatedSalaryData.earnings;
        const deductionsList = req.calculatedSalaryData.deductions;
        const benefitsList = req.calculatedSalaryData.benefits;

        salaryComponents.push({ name: 'A – Monthly Benefits', monthly: '', yearly: '' });
        earningsList.forEach(e => {
            salaryComponents.push({ name: e.name, monthly: e.monthly, yearly: e.yearly });
        });
        salaryComponents.push({
            name: 'GROSS A',
            monthly: totals.grossA.formattedM,
            yearly: totals.grossA.formattedY
        });

        salaryComponents.push({ name: '', monthly: '', yearly: '' }); // Separator
        deductionsList.forEach(d => {
            salaryComponents.push({ name: d.name, monthly: d.monthly, yearly: d.yearly });
        });
        salaryComponents.push({ name: 'Total Deductions (B)', monthly: totals.deductions.formattedM, yearly: totals.deductions.formattedY });
        salaryComponents.push({ name: 'Net Salary Payable (A-B)', monthly: totals.net.formattedM, yearly: totals.net.formattedY });

        salaryComponents.push({ name: '', monthly: '', yearly: '' }); // Separator
        salaryComponents.push({ name: 'B – Annual Benefits', monthly: '', yearly: '' });
        salaryComponents.push({ name: 'GROSS B', monthly: '0', yearly: '0' });

        salaryComponents.push({ name: '', monthly: '', yearly: '' }); // Separator
        salaryComponents.push({ name: 'Retirals Company\'s Benefits', monthly: '', yearly: '' });
        benefitsList.forEach(b => {
            salaryComponents.push({ name: b.name, monthly: b.monthly, yearly: b.yearly });
        });
        salaryComponents.push({ name: 'GROSS C', monthly: totals.computedCTC.formattedM, yearly: totals.computedCTC.formattedY });

        salaryComponents.push({ name: '', monthly: '', yearly: '' }); // Separator
        salaryComponents.push({ name: 'Computed CTC (A+B+C)', monthly: totals.computedCTC.formattedM, yearly: totals.computedCTC.formattedY });

        console.log("preview salaryComponents (FINAL STRICT) =>", salaryComponents);

        // Remove Annexure Tables entirely for preview as well
        // const annexureTables = SalaryViewService.generateView(...) <-- REMOVED

        // Build complete salaryStructure object for template (same as generateJoiningLetter)
        const salaryStructure = {
            earnings: req.calculatedSalaryData?.earnings || [],
            deductions: req.calculatedSalaryData?.deductions || [],
            benefits: req.calculatedSalaryData?.benefits || [],
            totals: {
                grossA: req.calculatedSalaryData?.totals?.grossA || { monthly: 0, yearly: 0, formattedM: '0', formattedY: '0' },
                grossB: req.calculatedSalaryData?.totals?.grossB || { monthly: 0, yearly: 0, formattedM: '0', formattedY: '0' },
                grossC: req.calculatedSalaryData?.totals?.grossC || { monthly: 0, yearly: 0, formattedM: '0', formattedY: '0' },
                netSalary: req.calculatedSalaryData?.totals?.netSalary || { monthly: 0, yearly: 0 },
                totalCTC: req.calculatedSalaryData?.totals?.totalCTC || { monthly: 0, yearly: 0 },
                computedCTC: req.calculatedSalaryData?.totals?.computedCTC || { monthly: 0, yearly: 0, formattedM: '0', formattedY: '0' },
                // Legacy totals
                ...(req.calculatedSalaryData?.totals || {})
            }
        };

        const finalData = {
            ...basicData,
            // Main salary components array (for table rendering)
            salaryComponents: salaryComponents,
            // COMPLETE salaryStructure object (single source of truth)
            salaryStructure: salaryStructure,
            // NEW FORMAT: Separate arrays for dynamic loops in Word template
            earnings: salaryStructure.earnings,
            deductions: salaryStructure.deductions,
            benefits: salaryStructure.benefits,
            // Totals object (with Gross A, B, C)
            totals: salaryStructure.totals,
            // Pass separate lists and totals (legacy format for backward compatibility)
            ...(req.calculatedSalaryData || {}),
            // Pass flat keys for direct access
            ...(req.flatSalaryData || {}),

            salary_table_text_block: salaryComponents.map(r => `${r.name}\t${r.monthly}\t${r.yearly}`).join('\n'), // Fallback
            SALARY_TABLE: salaryComponents.map(r => `${r.name}\t${r.monthly}\t${r.yearly}`).join('\n')     // Fallback
        };

        // Log missing placeholders but don't crash
        console.log('🔥 [JOINING LETTER] Final data prepared:', Object.keys(finalData));
        console.log('🔥 [PREVIEW JOINING LETTER] Data values:', finalData);

        // 4. Render
        console.log('🔥 [PREVIEW JOINING LETTER] Rendering with data...');
        try {
            doc.render(finalData);
        } catch (renderError) {
            // Log the error but return 500 as per requirement
            console.error('🔥 [PREVIEW JOINING LETTER] RENDER CRASH:', renderError);
            return res.status(500).json({ message: "Joining letter preview generation failed", error: renderError.message });
        }

        // 5. Generate Output (DOCX) - Temporary
        const buf = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
        const fileName = `Preview_Joining_Letter_${applicantId}_${Date.now()}`;
        const outputDir = path.join(__dirname, '../uploads/previews');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const docxPath = path.join(outputDir, `${fileName}.docx`);
        await fsPromises.writeFile(docxPath, buf);

        // 6. Convert to PDF Synchronously using LibreOffice
        let finalRelativePath;
        let finalPdfUrl;

        try {
            console.log('🔄 [PREVIEW JOINING LETTER] Starting Synchronous PDF Conversion (LibreOffice)...');
            const libreOfficeService = require('../services/LibreOfficeService');

            // Synchronous Call - blocks until done
            const pdfAbsolutePath = libreOfficeService.convertToPdfSync(docxPath, outputDir);
            const pdfFileName = path.basename(pdfAbsolutePath);

            finalRelativePath = `previews/${pdfFileName}`;
            finalPdfUrl = `/uploads/${finalRelativePath}`;

            console.log('✅ [PREVIEW JOINING LETTER] PDF Preview Ready:', finalPdfUrl);

        } catch (pdfError) {
            console.error('⚠️ [PREVIEW JOINING LETTER] PDF Conversion Failed:', pdfError.message);
            return res.status(500).json({
                message: "PDF Preview Generation Failed. Please ensure LibreOffice is installed.",
                error: pdfError.message
            });
        }

        // RETURN PREVIEW PDF URL (Temporary - will be cleaned up later)
        res.json({
            success: true,
            previewUrl: finalPdfUrl, // Frontend looks for this
            pdfUrl: finalPdfUrl,      // Standard naming
            message: 'Preview generated successfully. This is temporary and will be cleaned up.'
        });

    } catch (error) {
        console.error('🔥 [PREVIEW JOINING LETTER] FATAL 500 ERROR:', error);
        res.status(500).json({ message: "Internal Error", error: error.message });
    }
};

/**
 * VIEW EXISTING JOINING LETTER PDF
 */
exports.viewJoiningLetter = async (req, res) => {
    try {
        const { applicantId } = req.params;
        const Applicant = getApplicantModel(req);

        const applicant = await Applicant.findById(applicantId);
        if (!applicant) {
            return res.status(404).json({ message: "Applicant not found" });
        }

        if (!applicant.joiningLetterPath) {
            return res.status(404).json({ message: "Joining letter not generated yet" });
        }

        const pdfPath = path.join(__dirname, '../uploads', applicant.joiningLetterPath);
        if (!fs.existsSync(pdfPath)) {
            return res.status(404).json({ message: "Joining letter file not found" });
        }

        // Return the download URL
        const downloadUrl = `/uploads/${applicant.joiningLetterPath}`;
        res.json({ downloadUrl });

    } catch (error) {
        console.error('View joining letter error:', error);
        res.status(500).json({ message: "Internal Error", error: error.message });
    }
};

/**
 * DOWNLOAD EXISTING JOINING LETTER PDF
 */
exports.downloadJoiningLetter = async (req, res) => {
    try {
        const { applicantId } = req.params;
        const Applicant = getApplicantModel(req);

        const applicant = await Applicant.findById(applicantId);
        if (!applicant) {
            return res.status(404).json({ message: "Applicant not found" });
        }

        if (!applicant.joiningLetterPath) {
            return res.status(404).json({ message: "Joining letter not generated yet" });
        }

        const pdfPath = path.join(__dirname, '../uploads', applicant.joiningLetterPath);
        if (!fs.existsSync(pdfPath)) {
            return res.status(404).json({ message: "Joining letter file not found" });
        }

        // Set headers for download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Joining_Letter_${applicant.name || applicantId}.pdf"`);

        // Stream the file
        const fileStream = fs.createReadStream(pdfPath);
        fileStream.pipe(res);

    } catch (error) {
        console.error('Download joining letter error:', error);
        res.status(500).json({ message: "Internal Error", error: error.message });
    }
};

// --- HELPER: Centralized Salary Processing Logic ---
/**
 * Process candidate salary structure for joining letter
 * Returns FULL breakup with earnings, deductions, and benefits
 * All components include showInJoiningLetter flag
 * Zero values for auto-calculated components show "As per Rule"
 */
/**
 * Process candidate salary structure for joining letter
 * Read ONLY from selected lists in structure
 */
function processCandidateSalary(structure) {
    const formatCurrency = (val) => {
        if (val === undefined || val === null) return '-';
        const num = Number(val);
        if (isNaN(num)) return '-';
        return Math.round(num).toLocaleString('en-IN', { maximumFractionDigits: 0 });
    };

    const earnings = Array.isArray(structure.earnings) ? structure.earnings : [];
    const deductions = Array.isArray(structure.deductions) ? structure.deductions : [];
    const benefits = Array.isArray(structure.employerBenefits) ? structure.employerBenefits : [];

    const flatData = {};
    const normalizeKey = (val) => (val || '').toLowerCase().replace(/[^a-z0-9]/g, '_');

    const processedEarnings = earnings.map(comp => {
        const k = normalizeKey(comp.label);
        flatData[`${k}_monthly`] = formatCurrency(comp.monthly);
        flatData[`${k}_yearly`] = formatCurrency(comp.yearly);
        return {
            name: comp.label,
            monthly: formatCurrency(comp.monthly),
            yearly: formatCurrency(comp.yearly),
            amount: comp.monthly
        };
    });

    const processedDeductions = deductions.map(comp => {
        const k = normalizeKey(comp.label);
        flatData[`${k}_monthly`] = formatCurrency(comp.monthly);
        flatData[`${k}_yearly`] = formatCurrency(comp.yearly);
        return {
            name: comp.label,
            monthly: formatCurrency(comp.monthly),
            yearly: formatCurrency(comp.yearly),
            amount: comp.monthly
        };
    });

    const processedBenefits = benefits.map(comp => {
        const k = normalizeKey(comp.label);
        flatData[`${k}_monthly`] = formatCurrency(comp.monthly);
        flatData[`${k}_yearly`] = formatCurrency(comp.yearly);
        return {
            name: comp.label,
            monthly: formatCurrency(comp.monthly),
            yearly: formatCurrency(comp.yearly),
            amount: comp.monthly
        };
    });

    const totals = structure.totals || {};

    flatData['gross_a_monthly'] = formatCurrency(totals.grossEarnings);
    flatData['gross_a_yearly'] = formatCurrency(totals.grossEarnings * 12);
    flatData['total_deductions_monthly'] = formatCurrency(totals.totalDeductions);
    flatData['total_deductions_yearly'] = formatCurrency(totals.totalDeductions * 12);
    flatData['net_salary_monthly'] = formatCurrency(totals.netSalary);
    flatData['net_salary_yearly'] = formatCurrency(totals.netSalary * 12);
    flatData['ctc_monthly'] = formatCurrency(totals.monthlyCTC);
    flatData['ctc_yearly'] = formatCurrency(totals.annualCTC);
    flatData['annual_ctc'] = formatCurrency(totals.annualCTC);

    return {
        earnings: processedEarnings,
        deductions: processedDeductions,
        benefits: processedBenefits,
        totals: {
            grossA: {
                monthly: totals.grossEarnings,
                yearly: totals.grossEarnings * 12,
                formattedM: formatCurrency(totals.grossEarnings),
                formattedY: formatCurrency(totals.grossEarnings * 12)
            },
            grossB: { monthly: 0, yearly: 0, formattedM: '0', formattedY: '0' },
            grossC: {
                monthly: totals.employerBenefits,
                yearly: totals.employerBenefits * 12,
                formattedM: formatCurrency(totals.employerBenefits),
                formattedY: formatCurrency(totals.employerBenefits * 12)
            },
            earnings: {
                monthly: totals.grossEarnings,
                yearly: totals.grossEarnings * 12,
                formattedM: formatCurrency(totals.grossEarnings),
                formattedY: formatCurrency(totals.grossEarnings * 12)
            },
            deductions: {
                monthly: totals.totalDeductions,
                yearly: totals.totalDeductions * 12,
                formattedM: formatCurrency(totals.totalDeductions),
                formattedY: formatCurrency(totals.totalDeductions * 12)
            },
            employer: {
                monthly: totals.employerBenefits,
                yearly: totals.employerBenefits * 12,
                formattedM: formatCurrency(totals.employerBenefits),
                formattedY: formatCurrency(totals.employerBenefits * 12)
            },
            computedCTC: {
                monthly: totals.monthlyCTC,
                yearly: totals.annualCTC,
                formattedM: formatCurrency(totals.monthlyCTC),
                formattedY: formatCurrency(totals.annualCTC)
            },
            ctc: {
                monthly: totals.monthlyCTC,
                yearly: totals.annualCTC,
                formattedM: formatCurrency(totals.monthlyCTC),
                formattedY: formatCurrency(totals.annualCTC)
            },
            net: {
                monthly: totals.netSalary,
                yearly: totals.netSalary * 12,
                formattedM: formatCurrency(totals.netSalary),
                formattedY: formatCurrency(totals.netSalary * 12)
            },
            netSalary: {
                monthly: totals.netSalary,
                yearly: totals.netSalary * 12,
                formattedM: formatCurrency(totals.netSalary),
                formattedY: formatCurrency(totals.netSalary * 12)
            },
            totalCTC: {
                monthly: totals.monthlyCTC,
                yearly: totals.annualCTC,
                formattedM: formatCurrency(totals.monthlyCTC),
                formattedY: formatCurrency(totals.annualCTC)
            }
        },
        flatData
    };
}

// Helper to round to 2 decimals
const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

// ==================== JOINING LETTER GENERATION FUNCTIONS ====================

/**
 * GENERATE JOINING LETTER
 * POST /api/letters/generate-joining
 */
exports.generateJoiningLetter = async (req, res) => {
    try {
        const { applicantId, templateId } = req.body;

        if (!applicantId || !templateId) {
            return res.status(400).json({ success: false, message: 'Applicant ID and Template ID are required' });
        }

        const { Applicant, LetterTemplate, CompanyProfile } = getModels(req);

        // Fetch applicant
        const applicant = await Applicant.findById(applicantId).populate('requirementId', 'title department').lean();
        if (!applicant) {
            return res.status(404).json({ success: false, message: 'Applicant not found' });
        }

        // Validate status
        if (applicant.status !== 'Selected') {
            return res.status(400).json({
                success: false,
                message: `Cannot generate joining letter. Candidate status is "${applicant.status}". Only SELECTED candidates can receive joining letters.`,
                currentStatus: applicant.status,
                requiredStatus: 'Selected'
            });
        }

        // Check salary structure - GLOBAL with TENANT FILTER
        const tenantId = req.user.tenant || req.user.tenantId;
        const salaryStructure = await SalaryStructure.findOne({ tenantId, candidateId: applicantId }).lean();

        if (!salaryStructure) {
            return res.status(400).json({
                success: false,
                message: 'Salary structure not assigned. Please assign salary before generating joining letter.',
                action: 'ASSIGN_SALARY_FIRST'
            });
        }

        // Check template
        const template = await LetterTemplate.findById(templateId).lean();
        if (!template) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }

        if (template.type !== 'joining') {
            return res.status(400).json({
                success: false,
                message: `Invalid template type. Expected "joining", got "${template.type}"`
            });
        }

        // Check if already generated
        if (applicant.joiningLetterPath) {
            return res.status(400).json({
                success: false,
                message: 'Joining letter already generated for this candidate',
                existingPath: applicant.joiningLetterPath
            });
        }

        const companyProfile = await CompanyProfile.findOne().lean();

        // Prepare data
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
            ctcYearly: salaryStructure.totals?.annualCTC || 0,
            ctcMonthly: salaryStructure.totals?.monthlyCTC || 0,
            grossSalary: salaryStructure.totals?.grossEarnings || 0,
            netSalary: salaryStructure.totals?.netSalary || 0,
            earnings: salaryStructure.earnings || [],
            deductions: salaryStructure.deductions || [],
            employerBenefits: salaryStructure.employerBenefits || [],
            companyName: companyProfile?.companyName || 'Company Name',
            companyAddress: companyProfile?.address || '',
            companyPhone: companyProfile?.phone || '',
            companyEmail: companyProfile?.email || '',
            companyWebsite: companyProfile?.website || '',
            letterDate: new Date().toLocaleDateString('en-IN'),
            refNo: `JL/${new Date().getFullYear()}/${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
        };

        // Generate document
        const templatePath = normalizeFilePath(template.filePath);
        if (!fs.existsSync(templatePath)) {
            return res.status(404).json({ success: false, message: 'Template file not found on server' });
        }

        const templateBuffer = await fsPromises.readFile(templatePath);
        const zip = new PizZip(templateBuffer);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
        doc.render(letterData);

        const outputBuffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });

        const outputDir = path.join(__dirname, '../uploads/joining_letters');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const fileName = `joining_letter_${applicantId}_${Date.now()}.docx`;
        const outputPath = path.join(outputDir, fileName);
        await fsPromises.writeFile(outputPath, outputBuffer);

        await Applicant.findByIdAndUpdate(applicantId, {
            joiningLetterPath: `/uploads/joining_letters/${fileName}`,
            joiningLetterGeneratedAt: new Date()
        });

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
        res.status(500).json({ success: false, message: 'Failed to generate joining letter', error: error.message });
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
            return res.status(400).json({ success: false, message: 'Applicant ID and Template ID are required' });
        }

        const { Applicant, LetterTemplate, CompanyProfile } = getModels(req);

        const applicant = await Applicant.findById(applicantId).populate('requirementId', 'title department').lean();
        if (!applicant) {
            return res.status(404).json({ success: false, message: 'Applicant not found' });
        }

        const template = await LetterTemplate.findById(templateId).lean();
        if (!template) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }

        const tenantId = req.user.tenant || req.user.tenantId;
        const salaryStructure = await SalaryStructure.findOne({ tenantId, candidateId: applicantId }).lean();
        const companyProfile = await CompanyProfile.findOne().lean();

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
            refNo: `PREVIEW-JL/${new Date().getFullYear()}/${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
        };

        const templatePath = normalizeFilePath(template.filePath);
        const templateBuffer = await fsPromises.readFile(templatePath);
        const zip = new PizZip(templateBuffer);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
        doc.render(letterData);

        const outputBuffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });

        const previewDir = path.join(__dirname, '../uploads/previews');
        if (!fs.existsSync(previewDir)) fs.mkdirSync(previewDir, { recursive: true });

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
        res.status(500).json({ success: false, message: 'Failed to generate preview', error: error.message });
    }
};
