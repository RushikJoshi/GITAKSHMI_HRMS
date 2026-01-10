// backend/config/dbManager.js
const mongoose = require("mongoose");

/**
 * dbManager: provide per-tenant mongoose DB instance using mongoose.connection.useDb
 * - We rely on the main mongoose connection established in index.js (mongoose.connect)
 * - For tenantId '123' we use DB name: company_123
 * - Use caching to reuse db handles
 * - Limit cached connections to prevent memory/resource exhaustion
 */

const tenantDbs = {};
const MAX_CACHED_CONNECTIONS = 50; // Limit to 50 active tenant connections
const connectionAccessTime = {}; // Track last access time for LRU eviction
const registeredModels = new Set(); // Track which tenant DBs have models registered

/**
 * Registers all tenant-specific models on a given database connection.
 * Uses connection.model() with schemas only (not mongoose.model instances).
 */
function registerModels(db, tenantId) {
  // Check if models are already registered for this connection
  if (db.models.Employee && db.models.Department && db.models.LeaveRequest && db.models.PayrollRun && db.models.Payslip) {
    registeredModels.add(tenantId);
    return;
  }

  try {
    // Import all schemas (not models)
    const EmployeeSchema = require("../models/Employee");
    const DepartmentSchema = require("../models/Department");
    const LeaveRequestSchema = require("../models/LeaveRequest");
    const AttendanceSchema = require("../models/Attendance");
    const ActivitySchema = require("../models/Activity");
    const UserSchema = require("../models/User");
    const RequirementSchema = require("../models/Requirement");
    const ApplicantSchema = require("../models/Applicant");
    const OfferLetterTemplateSchema = require("../models/OfferLetterTemplate");
    const LetterTemplateSchema = require("../models/LetterTemplate");
    const GeneratedLetterSchema = require("../models/GeneratedLetter");
    const LeavePolicySchema = require("../models/LeavePolicy");
    const LeaveBalanceSchema = require("../models/LeaveBalance");
    const NotificationSchema = require("../models/Notification");
    const RegularizationSchema = require("../models/Regularization");
    const AuditLogSchema = require("../models/AuditLog");
    const CommentSchema = require("../models/Comment");
    const AccessControlSchema = require("../models/AccessControl");
    const RoleSchema = require("../models/Role");
    const HolidaySchema = require("../models/Holiday");
    const AttendanceSettingsSchema = require("../models/AttendanceSettings");
    const SalaryComponentSchema = require("../models/SalaryComponent");
    const SalaryTemplateSchema = require("../models/SalaryTemplate");
    const BenefitComponentSchema = require("../models/BenefitComponent");
    const BenefitSchema = require("../models/Benefit.model.js");
    const CompanyProfileSchema = require("../models/CompanyProfile");
    const DeductionMasterSchema = require("../models/DeductionMaster");
    const EmployeeDeductionSchema = require("../models/EmployeeDeduction");
    const PayrollRunSchema = require("../models/PayrollRun");
    const PayslipSchema = require("../models/Payslip");
    const CompanyPayrollRuleSchema = require("../models/CompanyPayrollRule");
    // SalaryStructure is now GLOBAL - removed from here
    const CandidateSchema = require("../models/Candidate");
    const TrackerCandidateSchema = require("../models/TrackerCandidate");
    const CandidateStatusLogSchema = require("../models/CandidateStatusLog");
    const SalaryAssignmentSchema = require("../models/SalaryAssignment");
    const PayrollRunItemSchema = require("../models/PayrollRunItem");
    const EmployeeSalarySnapshotSchema = require("../models/EmployeeSalarySnapshot");
    const AttendanceSnapshotSchema = require("../models/AttendanceSnapshot");
    const PayrollRunSnapshotSchema = require("../models/PayrollRunSnapshot");

    // Register models using connection.model() - only register if not already registered
    if (!db.models.Employee) db.model("Employee", EmployeeSchema);
    if (!db.models.Department) db.model("Department", DepartmentSchema);
    if (!db.models.LeaveRequest) db.model("LeaveRequest", LeaveRequestSchema);
    if (!db.models.Attendance) db.model("Attendance", AttendanceSchema);
    if (!db.models.Activity) db.model("Activity", ActivitySchema);
    if (!db.models.User) db.model("User", UserSchema);
    if (!db.models.Requirement) db.model("Requirement", RequirementSchema);
    if (!db.models.Applicant) db.model("Applicant", ApplicantSchema);
    if (!db.models.OfferLetterTemplate) db.model("OfferLetterTemplate", OfferLetterTemplateSchema);
    if (!db.models.LetterTemplate) db.model("LetterTemplate", LetterTemplateSchema);
    if (!db.models.GeneratedLetter) db.model("GeneratedLetter", GeneratedLetterSchema);
    if (!db.models.LeavePolicy) db.model("LeavePolicy", LeavePolicySchema);
    if (!db.models.LeaveBalance) db.model("LeaveBalance", LeaveBalanceSchema);
    if (!db.models.Notification) db.model("Notification", NotificationSchema);
    if (!db.models.Regularization) db.model("Regularization", RegularizationSchema);
    if (!db.models.AuditLog) db.model("AuditLog", AuditLogSchema);
    if (!db.models.Comment) db.model("Comment", CommentSchema);
    if (!db.models.AccessControl) db.model("AccessControl", AccessControlSchema);
    if (!db.models.Role) db.model("Role", RoleSchema);
    if (!db.models.Holiday) db.model("Holiday", HolidaySchema);
    if (!db.models.AttendanceSettings) db.model("AttendanceSettings", AttendanceSettingsSchema);
    if (!db.models.SalaryComponent) db.model("SalaryComponent", SalaryComponentSchema);
    if (!db.models.SalaryTemplate) db.model("SalaryTemplate", SalaryTemplateSchema);
    if (!db.models.BenefitComponent) db.model("BenefitComponent", BenefitComponentSchema);
    if (!db.models.Benefit) db.model("Benefit", BenefitSchema);
    if (!db.models.CompanyProfile) db.model("CompanyProfile", CompanyProfileSchema);
    if (!db.models.DeductionMaster) db.model("DeductionMaster", DeductionMasterSchema);
    if (!db.models.EmployeeDeduction) db.model("EmployeeDeduction", EmployeeDeductionSchema);
    if (!db.models.PayrollRun) db.model("PayrollRun", PayrollRunSchema);
    if (!db.models.Payslip) db.model("Payslip", PayslipSchema);
    if (!db.models.CompanyPayrollRule) db.model("CompanyPayrollRule", CompanyPayrollRuleSchema);
    // SalaryStructure removed - GLOBAL
    if (!db.models.Candidate) db.model("Candidate", CandidateSchema);
    if (!db.models.TrackerCandidate) db.model("TrackerCandidate", TrackerCandidateSchema);
    if (!db.models.CandidateStatusLog) db.model("CandidateStatusLog", CandidateStatusLogSchema);
    if (!db.models.SalaryAssignment) db.model("SalaryAssignment", SalaryAssignmentSchema);
    if (!db.models.PayrollRunItem) db.model("PayrollRunItem", PayrollRunItemSchema);
    if (!db.models.EmployeeSalarySnapshot) db.model("EmployeeSalarySnapshot", EmployeeSalarySnapshotSchema);
    if (!db.models.AttendanceSnapshot) db.model("AttendanceSnapshot", AttendanceSnapshotSchema);
    if (!db.models.PayrollRunSnapshot) db.model("PayrollRunSnapshot", PayrollRunSnapshotSchema);

    // Dynamic Requirement Forms
    const RequirementTemplateSchema = require("../models/RequirementTemplate");
    if (!db.models.RequirementTemplate) db.model("RequirementTemplate", RequirementTemplateSchema);


    registeredModels.add(tenantId);
    console.log(`✅ [DB_MANAGER] Models registered successfully for tenant: ${tenantId}`);
  } catch (err) {
    console.error(`❌ [DB_MANAGER] Model registration failed for tenant ${tenantId}:`, err.message);
    console.error(`[DB_MANAGER] Error stack:`, err.stack);
    // Don't throw - allow connection to proceed, models will be registered on next access
  }
}

/**
 * Returns a mongoose.Connection-like object for the tenant database.
 * @param {string} tenantId
 * @returns mongoose.Connection (db instance)
 */
function getTenantDB(tenantId) {
  if (!tenantId) throw new Error("tenantId required for getTenantDB");

  // Update last access time
  connectionAccessTime[tenantId] = Date.now();

  // Return cached connection if available
  if (tenantDbs[tenantId]) {
    registerModels(tenantDbs[tenantId], tenantId);
    return tenantDbs[tenantId];
  }

  // LRU eviction if limit reached
  const cachedCount = Object.keys(tenantDbs).length;
  if (cachedCount >= MAX_CACHED_CONNECTIONS) {
    let lruTenantId = null;
    let oldestTime = Date.now();

    for (const tid in connectionAccessTime) {
      if (connectionAccessTime[tid] < oldestTime && tid !== tenantId) {
        oldestTime = connectionAccessTime[tid];
        lruTenantId = tid;
      }
    }

    if (lruTenantId) {
      console.log(`Evicting LRU tenant DB: ${lruTenantId}`);
      delete tenantDbs[lruTenantId];
      delete connectionAccessTime[lruTenantId];
      registeredModels.delete(lruTenantId);
    }
  }

  // Create tenant DB (reuses underlying connection)
  const dbName = `company_${tenantId}`;
  const tenantDb = mongoose.connection.useDb(dbName, { useCache: true });

  registerModels(tenantDb, tenantId);

  tenantDbs[tenantId] = tenantDb;
  console.log(
    `Tenant DB prepared: ${dbName} (${Object.keys(tenantDbs).length}/${MAX_CACHED_CONNECTIONS})`
  );

  return tenantDb;
}

/**
 * Clear all cached tenant DB connections
 */
function clearCache() {
  Object.keys(tenantDbs).forEach(tenantId => {
    delete tenantDbs[tenantId];
    delete connectionAccessTime[tenantId];
    registeredModels.delete(tenantId);
  });
  console.log("All tenant DB caches cleared");
}

module.exports = { getTenantDB, clearCache };
