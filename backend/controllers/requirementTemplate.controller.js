const getTenantDB = require('../utils/tenantDB');
const mongoose = require('mongoose');

// --- Helper Functions ---

// Safely resolve Model
const getModel = (db) => {
    if (db.models.RequirementTemplate) {
        return db.model('RequirementTemplate');
    }
    try {
        const schema = require('../models/RequirementTemplate');
        return db.model('RequirementTemplate', schema);
    } catch (error) {
        // Handle race conditions in model registration
        if (error.name === 'OverwriteModelError') {
            return db.model('RequirementTemplate');
        }
        throw error;
    }
};

// Safely resolve Tenant ID
const getTenantId = (req) => {
    // Priority: req.tenantId (middleware) -> req.user (JWT) -> req.body/query (fallback)
    let tid = req.tenantId || req.user?.tenantId || req.user?.tenant || req.body?.companyId || req.query?.companyId;

    // Unpack if object (e.g. populated field)
    if (tid && typeof tid === 'object' && tid._id) {
        tid = tid._id.toString();
    }

    // Validate format
    if (tid && !mongoose.Types.ObjectId.isValid(tid)) {
        return null; // Invalid format
    }

    return tid;
};

// --- Controllers ---

exports.getTemplate = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: "Tenant Context Missing or Invalid ID"
            });
        }

        const db = await getTenantDB(tenantId);
        const RequirementTemplate = getModel(db);

        // Find existing template
        let template = await RequirementTemplate.findOne({
            tenant: tenantId,
            isDefault: true
        }).lean();

        // Default Fallback
        if (!template) {
            template = {
                fields: [
                    { key: 'jobTitle', label: 'Job Title', type: 'text', required: true, section: 'Basic Details', isSystem: true, order: 0 },
                    { key: 'department', label: 'Department', type: 'dropdown', required: true, section: 'Basic Details', options: ['HR', 'Tech', 'Sales'], order: 1 },
                    { key: 'vacancy', label: 'Vacancy', type: 'number', required: true, section: 'Basic Details', defaultValue: 1, order: 2 },
                    { key: 'description', label: 'Job Description', type: 'textarea', section: 'Job Description', order: 3 }
                ],
                sections: ['Basic Details', 'Job Description']
            };
        }

        // Return clean response with uiId mapping
        const mappedFields = (template.fields || []).map(f => {
            const field = { ...f };
            if (field._id) {
                field.uiId = field._id.toString();
                delete field._id; // Hide DB ID from frontend
            } else {
                // Fallback for fields without ID (unlikely in Mongo but safe)
                field.uiId = `temp_${Math.random().toString(36).substr(2, 9)}`;
            }
            return field;
        });

        res.json({
            success: true,
            templateId: template._id,
            fields: mappedFields,
            sections: template.sections || ['Basic Details']
        });

    } catch (err) {
        console.error('getTemplate Critical Error:', err);
        // Fallback to empty to prevent UI crash, but log heavily
        res.status(200).json({ success: false, fields: [], error: "Backend Error" });
    }
};

exports.updateTemplate = async (req, res) => {
    try {
        // 1. Debug Logs
        if (process.env.NODE_ENV !== 'production') {
            console.log('[updateTemplate] User:', JSON.stringify(req.user, null, 2));
            console.log('[updateTemplate] Body Fields Count:', req.body?.fields?.length);
        }

        // 2. Resolve Tenant
        const tenantId = getTenantId(req);
        if (!tenantId) {
            console.warn('[updateTemplate] Missing Tenant ID');
            return res.status(400).json({ success: false, message: "Valid Tenant ID Required" });
        }

        // 3. Validate Payload
        const { fields, sections } = req.body;

        if (!fields || !Array.isArray(fields)) {
            console.warn('[updateTemplate] Invalid payload: fields is not array');
            return res.status(400).json({ success: false, message: "Invalid payload: 'fields' array is required" });
        }

        // 4. Data Sanitization & Preparation
        const cleanFields = fields.map((f, idx) => {
            // Auto-generate key if missing
            let key = f.key;
            if (!key) {
                const label = f.label || `Field ${idx}`;
                key = label.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
            }

            return {
                // Do NOT include _id. Let Mongoose create new SubDocs. 
                // This prevents "CastError" if frontend sends invalid _ids.
                key: key,
                label: f.label || 'Untitled Field',
                type: f.type || 'text',
                placeholder: f.placeholder || '',
                required: !!f.required,
                defaultValue: f.defaultValue,
                options: Array.isArray(f.options) ? f.options : [],
                section: f.section || 'General',
                isSystem: !!f.isSystem,
                order: idx // Enforce order based on array position
            };
        });

        const cleanSections = Array.isArray(sections) ? sections : ['Basic Details'];

        // 5. Database Operation
        const db = await getTenantDB(tenantId);
        const RequirementTemplate = getModel(db);

        // Atomic Upsert (Safer than find-save loop for concurrency)
        const updatedDoc = await RequirementTemplate.findOneAndUpdate(
            { tenant: tenantId, isDefault: true },
            {
                $set: {
                    fields: cleanFields,      // REPLACES the array entirely
                    sections: cleanSections,
                    updatedAt: new Date(),
                    name: 'Standard Job Requirement'
                },
                $setOnInsert: {
                    tenant: tenantId,
                    isDefault: true,
                    createdAt: new Date()
                }
            },
            {
                new: true,   // Return modified doc
                upsert: true, // Create if not exists
                runValidators: false, // Important: avoid strict validation on mixed content
                setDefaultsOnInsert: true // Apply schema defaults
            }
        ).lean();

        console.log(`[updateTemplate] Success. Tenant: ${tenantId}, Fields: ${updatedDoc.fields.length}`);

        const mappedFields = (updatedDoc.fields || []).map(f => {
            const field = f.toObject ? f.toObject() : { ...f };
            if (field._id) {
                field.uiId = field._id.toString();
                delete field._id;
            }
            return field;
        });

        res.json({
            success: true,
            message: "Template saved successfully",
            templateId: updatedDoc._id,
            fields: mappedFields
        });

    } catch (err) {
        console.error('[updateTemplate] Critical Error:', err);

        // Differentiate Client vs Server Errors
        if (err.name === 'ValidationError' || err.name === 'CastError') {
            return res.status(400).json({ success: false, message: "Validation Error: " + err.message });
        }

        res.status(500).json({
            success: false,
            message: "Server Error",
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

exports.resetTemplate = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, message: "Tenant ID missing" });

        const db = await getTenantDB(tenantId);
        const RequirementTemplate = getModel(db);

        await RequirementTemplate.deleteMany({ tenant: tenantId, isDefault: true });

        res.json({ success: true, message: "Template reset to defaults" });
    } catch (err) {
        console.error("resetTemplate Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};
