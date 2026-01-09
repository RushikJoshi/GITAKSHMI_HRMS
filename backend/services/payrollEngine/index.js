// Payroll Engine: Uses salary and attendance snapshots, produces payroll_run_snapshot
class PayrollEngine {
  /**
   * Processes payroll for a set of employees based on their immutable snapshots.
   * 
   * @param {Object} params
   * @param {Object} params.tenantDB - Tenant database connection
   * @param {ObjectId} params.tenantId - Tenant ID
   * @param {String} params.period - Period code (YYYY-MM)
   * @param {Array} params.items - [{ employee, salarySnapshot, attendanceSnapshot }]
   * @returns {Object} PayrollRunSnapshot document
   */
  static async runPayroll({ tenantDB, tenantId, period, items }) {
    if (!tenantDB) throw new Error('tenantDB is required');
    if (!items || items.length === 0) throw new Error('No items to process');

    const PayrollRunSnapshotModel = tenantDB.model('PayrollRunSnapshot');

    const runItems = items.map(item => {
      const { salarySnapshot, attendanceSnapshot, employee } = item;

      const totalDays = attendanceSnapshot.totalDays || 30;
      const paidDays = (attendanceSnapshot.presentDays || 0) +
        (attendanceSnapshot.leaveDays || 0) +
        (attendanceSnapshot.holidays || 0) +
        (attendanceSnapshot.weeklyOffs || 0);

      // Safety check: Paid days cannot exceed total days
      const effectivePaidDays = Math.min(paidDays, totalDays);
      const prorationFactor = effectivePaidDays / totalDays;

      // RESOLVE MONTHLY VALUES FROM ANNUAL SNAPSHOT
      const resolveMonthly = (annualAmount) => Math.round((annualAmount / 12) * prorationFactor * 100) / 100;

      // Prorate earnings
      const proratedEarnings = salarySnapshot.earnings.map(e => ({
        name: e.name,
        code: e.code,
        formula: e.formula,
        baseAnnual: e.amount,
        amount: resolveMonthly(e.amount)
      }));

      // Prorate benefits (Employer cost)
      const proratedBenefits = (salarySnapshot.benefits || []).map(b => ({
        name: b.name,
        code: b.code,
        formula: b.formula,
        baseAnnual: b.amount,
        amount: resolveMonthly(b.amount)
      }));

      // Prorate deductions (Employee)
      const proratedDeductions = (salarySnapshot.deductions || []).map(d => ({
        name: d.name,
        code: d.code,
        formula: d.formula,
        baseAnnual: d.amount,
        amount: resolveMonthly(d.amount)
      }));

      const grossEarnings = Math.round(proratedEarnings.reduce((sum, e) => sum + e.amount, 0) * 100) / 100;
      const totalDeductions = Math.round(proratedDeductions.reduce((sum, d) => sum + d.amount, 0) * 100) / 100;
      const netPay = Math.round((grossEarnings - totalDeductions) * 100) / 100;

      return {
        employee: employee._id || employee,
        salarySnapshot: salarySnapshot._id,
        attendanceSnapshot: attendanceSnapshot._id,
        grossEarnings,
        totalDeductions,
        netPay,
        details: {
          earnings: proratedEarnings,
          deductions: proratedDeductions,
          benefits: proratedBenefits,
          attendance: {
            totalDays,
            paidDays: effectivePaidDays,
            prorationFactor
          }
        }
      };
    });

    const snapshot = await PayrollRunSnapshotModel.create({
      tenant: tenantId,
      period,
      items: runItems,
      locked: true,
      version: 1
    });

    return snapshot;
  }
}

module.exports = PayrollEngine;