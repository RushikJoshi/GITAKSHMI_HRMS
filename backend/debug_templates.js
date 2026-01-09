const mongoose = require('mongoose');
require('dotenv').config();

async function checkTemplates() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // We need to check all tenants
        const Tenant = mongoose.model('Tenant', new mongoose.Schema({ name: String, code: String }));
        const tenants = await Tenant.find();
        console.log(`Found ${tenants.length} tenants`);

        const SalaryTemplateSchema = require('./models/SalaryTemplate');

        for (const tenant of tenants) {
            console.log(`Checking tenant: ${tenant.name} (${tenant._id})`);
            const tenantDb = mongoose.connection.useDb(`tenant_${tenant._id}`);
            const SalaryTemplate = tenantDb.model('SalaryTemplate', SalaryTemplateSchema);
            const templates = await SalaryTemplate.find();
            console.log(`  Found ${templates.length} templates`);
            templates.forEach(t => {
                console.log(`    - ${t.templateName} (ID: ${t._id}, isActive: ${t.isActive})`);
            });
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkTemplates();
