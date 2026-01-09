const mongoose = require('mongoose');
require('dotenv').config();
const SalaryEngine = require('./services/salaryEngine');
const PayrollEngine = require('./services/payrollEngine');

async function test() {
    try {
        console.log('--- Testing Salary Engine (Resolution Only) ---');
        const mockTemplate = {
            earnings: [
                { name: 'Basic', code: 'BASIC', formula: 'CTC * 0.5' },
                { name: 'HRA', code: 'HRA', formula: 'BASIC * 0.4' },
                { name: 'Special Allowance', code: 'SPECIAL', formula: 'CTC - BASIC - HRA - PF_EMPLOYER' }
            ],
            employerDeductions: [
                { name: 'PF Employer', code: 'PF_EMPLOYER', formula: 'Math.min(BASIC, 15000) * 0.12' }
            ],
            employeeDeductions: [
                { name: 'PF Employee', code: 'PF_EMPLOYEE', formula: 'Math.min(BASIC, 15000) * 0.12' }
            ]
        };

        const annualCTC = 600000;

        // Mock tenantDB to avoid actual DB calls for this test
        const mockSnapshotModel = {
            create: async (data) => {
                console.log('✅ Mock Snapshot Model Created Data');
                return { ...data, _id: 'mock_snapshot_id' };
            }
        };
        const mockTenantDB = {
            model: () => mockSnapshotModel
        };

        const salarySnapshot = await SalaryEngine.generateSnapshot({
            tenantDB: mockTenantDB,
            employeeId: 'mock_emp_id',
            tenantId: 'mock_tenant_id',
            annualCTC,
            template: mockTemplate,
            effectiveDate: new Date('2026-01-01')
        });

        console.log('Salary Snapshot Resolved:');
        console.log('Earnings:', salarySnapshot.earnings.map(e => `${e.code}: ${e.amount}`));
        console.log('Benefits:', salarySnapshot.benefits.map(e => `${e.code}: ${e.amount}`));

        const earningsSum = salarySnapshot.earnings.reduce((s, e) => s + e.amount, 0);
        const benefitsSum = salarySnapshot.benefits.reduce((s, b) => s + b.amount, 0);
        console.log('Total Resolved CTC:', earningsSum + benefitsSum);

        console.log('--- Testing Payroll Engine (Calculation Only) ---');

        const mockPayrollRunModel = {
            create: async (data) => {
                console.log('✅ Mock Payroll Run Model Created Data');
                return { ...data, _id: 'mock_run_id' };
            }
        };
        const mockTenantDB2 = {
            model: () => mockPayrollRunModel
        };

        const mockAttendanceSnapshot = {
            totalDays: 31,
            presentDays: 20,
            absentDays: 5,
            leaveDays: 2,
            holidays: 2,
            weeklyOffs: 2
        };

        const payrollRun = await PayrollEngine.runPayroll({
            tenantDB: mockTenantDB2,
            tenantId: 'mock_tenant_id',
            period: '2026-01',
            items: [{
                employee: { _id: 'mock_emp_id' },
                salarySnapshot,
                attendanceSnapshot: mockAttendanceSnapshot
            }]
        });

        const item = payrollRun.items[0];
        console.log('Payroll Result for 26 days paid (20 present + 2 leave + 2 holiday + 2 weekly off):');
        console.log('Gross:', item.grossEarnings, 'Net:', item.netPay);
        console.log('Proration Factor:', item.details.attendance.prorationFactor);
        console.log('Monthly Basic:', item.details.earnings.find(e => e.code === 'BASIC').amount);

        // Expected Basic: (600000 * 0.5 / 12) * (26 / 31) = 25000 * 0.8387 = 20967.74
        console.log('Expected Basic Monthly: ~20967.74');

        process.exit(0);
    } catch (err) {
        console.error('Test Failed:', err);
        process.exit(1);
    }
}

test();
