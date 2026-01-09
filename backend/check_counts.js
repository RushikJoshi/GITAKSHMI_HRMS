const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');

        // Find tenant ID first
        const Tenant = mongoose.model('Tenant', require('./models/Tenant'));
        const tenant = await Tenant.findOne();
        if (!tenant) throw new Error('No tenant found');

        const db = mongoose.connection.useDb(tenant._id.toString());

        const Attendance = db.model('Attendance', require('./models/Attendance'));
        const Employee = db.model('Employee', require('./models/Employee'));
        const SalaryTemplate = db.model('SalaryTemplate', require('./models/SalaryTemplate'));
        const SalaryAssignment = db.model('SalaryAssignment', require('./models/SalaryAssignment'));

        const miya = await Employee.findOne({ firstName: /Miya/i });
        if (miya) {
            console.log(`Found Miya: ${miya._id}`);
            const att = await Attendance.find({ employee: miya._id }).limit(5);
            console.log('Miya Attendance Statuses:', att.map(a => a.status));

            const assignment = await SalaryAssignment.findOne({ employeeId: miya._id });
            console.log('Miya Salary Assignment:', assignment ? 'Exists' : 'None');
        }

        const templates = await SalaryTemplate.find().limit(5);
        console.log('Available Templates:', templates.map(t => t.templateName));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
