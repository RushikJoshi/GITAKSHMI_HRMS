import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getToken, isValidToken } from '../utils/token';

// Layouts
import PsaLayout from '../layouts/PsaLayout';
import HRLayout from '../layouts/HRLayout';
import EssLayout from '../layouts/EssLayout';
import ProtectedRoute from '../components/layout/ProtectedRoute';

// PSA Pages
import Dashboard from '../pages/PSA/Dashboard';
import Companies from '../pages/PSA/Companies';
import CompanyForm from '../pages/PSA/CompanyForm';
import ModuleConfig from '../pages/PSA/ModuleConfig';
import Activities from '../pages/PSA/Activities';

// Auth
import Login from '../pages/Auth/Login';
import HRLogin from '../pages/Auth/HRLogin';
import EmployeeLogin from '../pages/Auth/EmployeeLogin';

// HR Pages
import HRDashboard from '../pages/HR/HRDashboard';
import Employees from '../pages/HR/Employees';
import Departments from '../pages/HR/Departments';
import Leaves from '../pages/HR/Leaves'; // Keep for safety or remove if unused, but we are overwriting route.
import LeavePolicies from '../pages/HR/LeavePolicies';
import LeaveApprovals from '../pages/HR/LeaveApprovals';
import RegularizationApprovals from '../pages/HR/RegularizationApprovals';
import OrgStructure from '../pages/HR/OrgStructure';
import UserManagement from '../pages/HR/UserManagement';
import CeoOrg from '../pages/HR/CeoOrg';
import AccessControl from '../pages/HR/AccessControl';
import OfferTemplates from '../pages/HR/OfferTemplates';
import RequirementPage from '../pages/HR/RequirementPage';
import Applicants from '../pages/HR/Applicants';
import AttendanceAdmin from '../pages/HR/AttendanceAdmin';
import CalendarManagement from '../pages/HR/CalendarManagement';
import CandidateStatusTracker from '../pages/HR/CandidateStatusTracker';
import CandidateTimeline from '../pages/HR/CandidateStatusTracker/CandidateTimeline';

// 🆕 Letter modules (from RIGHT)
import LetterTemplates from '../pages/HR/LetterTemplates';
import LetterSettings from '../pages/HR/LetterSettings';
import TemplatePreview from '../pages/HR/TemplatePreview';
import SalaryStructure from '../pages/HR/SalaryStructure';

// Payroll
import SalaryComponents from '../pages/HR/Payroll/SalaryComponents';
import NewEarning from '../pages/HR/Payroll/NewEarning';
import NewBenefit from '../pages/HR/Payroll/NewBenefit';
import NewSalaryTemplate from '../pages/HR/Payroll/NewSalaryTemplate';
import NewDeduction from '../pages/HR/Payroll/Deductions/NewDeduction';
import PayrollRules from '../pages/Admin/PayrollRules';

// Employee
import EmployeeDashboard from '../pages/Employee/EmployeeDashboard';

// Global
import EntityDetail from '../pages/Global/EntityDetail';
import MyRequests from '../pages/Global/MyRequests';
import NotFound from '../pages/NotFound';
import VerifyCompany from '../pages/VerifyCompany';
import JobApplication from '../pages/JobApplication/JobApplication';
import JobsList from '../pages/JobApplication/JobsList';

// Candidate Pages
import CandidateLogin from '../pages/Candidate/CandidateLogin';
import CandidateRegister from '../pages/Candidate/CandidateRegister';
import CandidateDashboard from '../pages/Candidate/CandidateDashboard';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AutoHome />} />

      {/* Candidate Portal */}
      <Route path="/candidate/login" element={<CandidateLogin />} />
      <Route path="/candidate/register" element={<CandidateRegister />} />
      <Route path="/candidate/dashboard" element={<CandidateDashboard />} />

      {/* PSA */}
      <Route
        path="/psa"
        element={
          <ProtectedRoute allowedRoles={['psa']}>
            <PsaLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="companies" element={<Companies />} />
        <Route path="companies/new" element={<CompanyForm />} />
        <Route path="companies/:id" element={<CompanyForm />} />
        <Route path="modules" element={<ModuleConfig />} />
        <Route path="modules/:id" element={<ModuleConfig />} />
        <Route path="activities" element={<Activities />} />
      </Route>

      {/* Auth */}
      <Route path="/login" element={<Login />} />
      <Route path="/hr-login" element={<HRLogin />} />
      <Route path="/employee-login" element={<EmployeeLogin />} />

      {/* Public Jobs */}
      <Route path="/jobs" element={<JobsList />} />
      <Route path="/jobs/:companyCode" element={<JobsList />} />
      <Route path="/apply" element={<JobApplication />} />
      <Route path="/apply-job/:requirementId" element={<JobApplication />} />

      {/* HR */}
      <Route path="/hr" element={<HRLayout />}>
        <Route index element={<HRDashboard />} />
        <Route path="employees" element={<Employees />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="departments" element={<Departments />} />
        <Route path="leaves" element={<Navigate to="leave-approvals" replace />} />
        <Route path="leave-approvals" element={<LeaveApprovals />} />
        <Route path="leave-approvals/regularization" element={<RegularizationApprovals category="Leave" />} />
        <Route path="attendance" element={<AttendanceAdmin />} />
        <Route path="attendance/correction" element={<RegularizationApprovals category="Attendance" />} />
        <Route path="attendance-calendar" element={<CalendarManagement />} />
        <Route path="leave-policies" element={<LeavePolicies />} />
        <Route path="requirements" element={<RequirementPage />} />
        <Route path="applicants" element={<Applicants />} />
        <Route path="candidate-status" element={<CandidateStatusTracker />} />
        <Route path="candidate-status/:id" element={<CandidateTimeline />} />
        <Route path="org" element={<OrgStructure />} />
        <Route path="org-tree" element={<CeoOrg />} />
        <Route path="access" element={<AccessControl />} />
        <Route path="offer-templates" element={<OfferTemplates />} />

        {/* 🆕 Letter routes */}
        <Route path="letter-templates" element={<LetterTemplates />} />
        <Route path="letter-templates/:templateId/preview" element={<TemplatePreview />} />
        <Route path="letter-settings" element={<LetterSettings />} />
        <Route path="salary-structure/:candidateId" element={<SalaryStructure />} />

        {/* Payroll */}
        <Route path="payroll/salary-components" element={<SalaryComponents />} />
        <Route path="payroll/earnings/new" element={<NewEarning />} />
        <Route path="payroll/earnings/edit/:id" element={<NewEarning />} />
        <Route path="payroll/deductions/new" element={<NewDeduction />} />
        <Route path="payroll/deductions/edit/:id" element={<NewDeduction />} />
        <Route path="payroll/benefits/new" element={<NewBenefit />} />
        <Route path="payroll/benefits/edit/:id" element={<NewBenefit />} />
        <Route path="payroll/salary-templates/new" element={<NewSalaryTemplate />} />
        <Route path="payroll/rules" element={<PayrollRules />} />

        {/* Global */}
        <Route path="details/:entityType/:entityId" element={<EntityDetail />} />
        <Route path="my-requests" element={<MyRequests />} />
      </Route>

      {/* Employee / Manager */}
      <Route
        path="/employee"
        element={
          <ProtectedRoute allowedRoles={['employee', 'manager']}>
            <EssLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<EmployeeDashboard />} />
        <Route path="details/:entityType/:entityId" element={<EntityDetail />} />
        <Route path="my-requests" element={<MyRequests />} />
      </Route>

      {/* Misc */}
      <Route path="/verify-company/:token" element={<VerifyCompany />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function AutoHome() {
  const { user, isInitialized } = useAuth();

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const token = getToken();
  if (!isValidToken(token)) return <Navigate to="/login" replace />;

  if (user?.role === 'hr') return <Navigate to="/hr" replace />;
  if (user?.role === 'employee' || user?.role === 'manager')
    return <Navigate to="/employee" replace />;
  if (user?.role === 'psa') return <Navigate to="/psa" replace />;

  return <Navigate to="/login" replace />;
}
