// Immutable snapshot of attendance for a payroll period
const mongoose = require('mongoose');

const AttendanceSnapshotSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  period: { type: String, required: true }, // e.g., '2026-01'
  totalDays: { type: Number, required: true }, // Total days in month
  presentDays: { type: Number, required: true },
  absentDays: { type: Number, required: true },
  leaveDays: { type: Number, required: true },
  holidays: { type: Number, default: 0 },
  weeklyOffs: { type: Number, default: 0 },
  lateMarks: { type: Number, default: 0 },
  halfDays: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, immutable: true },
  snapshotVersion: { type: Number, default: 1, immutable: true }
}, { versionKey: false, timestamps: false });

AttendanceSnapshotSchema.index({ employee: 1, period: 1 }, { unique: true });

module.exports = AttendanceSnapshotSchema;