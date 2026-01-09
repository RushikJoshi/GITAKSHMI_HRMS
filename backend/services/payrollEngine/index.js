/**
 * Payroll Engine: Core engine for calculating monthly pay based on snapshots
 */
class PayrollEngine {
  /**
   * Evaluates a single employee's pay for a period
   * @param {Object} params
   * @param {Object} params.salarySnapshot - Immutable Salaries
   * @param {Object} params.attendanceSnapshot - Immutable Attendance
   */
  static calculateEmployeePay({ salarySnapshot, attendanceSnapshot }) {
    if (!salarySnapshot || !attendanceSnapshot) {
      throw new Error('Salary and Attendance snapshots are required');
    }

    const { presentDays, totalDays } = attendanceSnapshot;
    // Payout factor: percentage of month considered "payable"
    // Usually (present + holidays + weeklyOffs) / totalDays
    // For simplicity here: presentDays / totalDays (assuming presentDays includes paid leaves/holidays)
    const payableFactor = presentDays / totalDays;

    const items = {
      earnings: [],
      deductions: [],
      benefits: []
    };

    let totalEarnings = 0;
    let totalDeductions = 0;

    // 1. Prorate Earnings
    salarySnapshot.earnings.forEach(e => {
      const monthlyFull = e.monthlyAmount;
      const amount = Math.round(monthlyFull * payableFactor * 100) / 100;
      items.earnings.push({
        name: e.name,
        code: e.code,
        fullAmount: monthlyFull,
        paidAmount: amount,
        factor: payableFactor
      });
      totalEarnings += amount;
    });

    // 2. Resolve Deductions (usually calculated on Paid Basic, but here we use simple factor)
    salarySnapshot.deductions.forEach(d => {
      const monthlyFull = d.monthlyAmount;
      const amount = Math.round(monthlyFull * payableFactor * 100) / 100;
      items.deductions.push({
        name: d.name,
        code: d.code,
        fullAmount: monthlyFull,
        paidAmount: amount
      });
      totalDeductions += amount;
    });

    // 3. Benefits (Employer cost)
    salarySnapshot.benefits.forEach(b => {
      const monthlyFull = b.monthlyAmount;
      const amount = Math.round(monthlyFull * payableFactor * 100) / 100;
      items.benefits.push({
        name: b.name,
        code: b.code,
        fullAmount: monthlyFull,
        paidAmount: amount
      });
    });

    const netPay = Math.round((totalEarnings - totalDeductions) * 100) / 100;

    return {
      grossEarnings: totalEarnings,
      totalDeductions,
      netPay,
      breakdown: items
    };
  }

  /**
   * Processes a full payroll run for a tenant and period
   */
  static async runPayroll({ tenantDB, tenantId, period, items }) {
    const PayrollRunSnapshot = tenantDB.model('PayrollRunSnapshot');

    const processedItems = items.map(item => {
      const result = this.calculateEmployeePay({
        salarySnapshot: item.salarySnapshot,
        attendanceSnapshot: item.attendanceSnapshot
      });

      return {
        employee: item.employee._id,
        salarySnapshot: item.salarySnapshot._id,
        attendanceSnapshot: item.attendanceSnapshot._id,
        grossEarnings: result.grossEarnings,
        totalDeductions: result.totalDeductions,
        netPay: result.netPay,
        details: {
          ...result.breakdown,
          attendance: {
            presentDays: item.attendanceSnapshot.presentDays,
            totalDays: item.attendanceSnapshot.totalDays,
            absentDays: item.attendanceSnapshot.absentDays,
            leaveDays: item.attendanceSnapshot.leaveDays
          }
        }
      };
    });

    // Create locked snapshot
    const runSnapshot = await PayrollRunSnapshot.findOneAndUpdate(
      { tenant: tenantId, period },
      {
        items: processedItems,
        locked: true,
        version: 1, // Logic for incrementing version could be added
        runDate: new Date()
      },
      { upsert: true, new: true }
    );

    return runSnapshot;
  }
}

module.exports = PayrollEngine;