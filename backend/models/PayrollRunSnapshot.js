// Immutable snapshot of a payroll run for a period
const mongoose = require('mongoose');

const PayrollRunSnapshotSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  period: { type: String, required: true }, // e.g., '2026-01'
  runDate: { type: Date, default: Date.now, immutable: true },
  items: [{
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    salarySnapshot: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeSalarySnapshot', required: true },
    attendanceSnapshot: { type: mongoose.Schema.Types.ObjectId, ref: 'AttendanceSnapshot', required: true },
    grossEarnings: Number,
    totalDeductions: Number,
    netPay: Number,
    details: mongoose.Schema.Types.Mixed // breakdown for payslip
  }],
  locked: { type: Boolean, default: true, immutable: true },
  version: { type: Number, default: 1, immutable: true }
}, { versionKey: false, timestamps: false });

PayrollRunSnapshotSchema.index({ tenant: 1, period: 1 }, { unique: true });

module.exports = PayrollRunSnapshotSchema;