import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

/* ================= ICONS ================= */
const ICONS = {
  dashboard: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
    </svg>
  ),
  employees: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87M16 11a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  departments: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21V7a2 2 0 012-2h14a2 2 0 012 2v14M16 3v4M8 3v4" />
    </svg>
  ),
  org: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7h6M3 12h6M3 17h6M11 7h10M11 12h10M11 17h10" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  leaveRequests: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  leavePolicies: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  requirements: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  applicants: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  templates: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  access: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  payroll: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 10v-1m9-4a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  tracker: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  )
};

/* ================= NAV GROUPS ================= */
const NAV_GROUPS = [
  {
    title: 'Overview',
    items: [{ to: '/hr', label: 'Dashboard', icon: ICONS.dashboard, end: true }]
  },
  {
    title: 'People',
    items: [
      { to: '/hr/employees', label: 'Employees', icon: ICONS.employees },
      { to: '/hr/departments', label: 'Departments', icon: ICONS.departments },
      { to: '/hr/org', label: 'Org Structure', icon: ICONS.org },
      { to: '/hr/users', label: 'User Management', icon: ICONS.users }
    ]
  },
  {
    title: 'Attendance',
    items: [
      { to: '/hr/attendance', label: 'Attendance Dashboard', icon: ICONS.dashboard },
      { to: '/hr/attendance-calendar', label: 'Calendar Management', icon: ICONS.calendar }
    ]
  },
  {
    title: 'Leave',
    items: [
      { to: '/hr/leave-approvals', label: 'Leave Requests', icon: ICONS.leaveRequests },
      { to: '/hr/leave-policies', label: 'Leave Policies', icon: ICONS.leavePolicies }
    ]
  },
  {
    title: 'Payroll',
    items: [
      { to: '/hr/payroll/salary-components', label: 'Salary Components', icon: ICONS.payroll },
      { to: '/hr/payroll/salary-templates/new', label: 'Salary Templates', icon: ICONS.payroll }
    ]
  },
  {
    title: 'Hiring',
    items: [
      { to: '/hr/requirements', label: 'Requirements', icon: ICONS.requirements },
      { to: '/hr/applicants', label: 'Applicants', icon: ICONS.applicants },
      { to: '/hr/candidate-status', label: 'Candidate Status Tracker', icon: ICONS.tracker }
    ]
  },
  {
    title: 'Configuration',
    items: [
      {
        label: 'Templates',
        icon: ICONS.templates,
        children: [
          { to: '/hr/letter-templates', label: 'Letter Editor' },
          { to: '/hr/letter-settings', label: 'Letter Settings' }
        ]
      },
      { to: '/hr/access', label: 'Access Control', icon: ICONS.access }
    ]
  }
];

/* ================= COMPONENT ================= */
export default function HRSidebar({ collapsed = false, toggleCollapse, onNavigate }) {
  const { user, isInitialized } = useAuth();
  const location = useLocation();
  const [expanded, setExpanded] = useState({});
  const [tenant, setTenant] = useState(null);

  useEffect(() => {
    if (!isInitialized) return;
    if (!user) return;
    // Prevent fetching HR data if the user is a Candidate
    if (user.role === 'candidate') return;

    api.get('/tenants/me').then(res => setTenant(res.data)).catch(() => { });
  }, [user, isInitialized]);

  const toggleGroup = (title) =>
    setExpanded(prev => ({ ...prev, [title]: !prev[title] }));

  return (
    <aside className={`h-full bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col ${collapsed ? 'w-20' : 'w-72'}`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex justify-between items-center">
        {!collapsed && (
          <div>
            <div className="font-bold text-lg text-blue-400">Company Admin</div>
            <div className="text-xs text-slate-500">Human Resources</div>
          </div>
        )}
        {toggleCollapse && (
          <button onClick={toggleCollapse} className="text-slate-400 hover:text-white">
            ☰
          </button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {NAV_GROUPS.map(group => (
          <div key={group.title}>
            {!collapsed && (
              <button
                onClick={() => toggleGroup(group.title)}
                className="w-full text-left text-xs uppercase text-slate-500 font-bold mb-2"
              >
                {group.title}
              </button>
            )}
            {group.items.map(item => {
              if (item.children) {
                const isExpanded = expanded[item.label];
                const hasActiveChild = item.children.some(child => location.pathname === child.to);
                return (
                  <div key={item.label}>
                    <button
                      onClick={() => toggleGroup(item.label)}
                      className={`w-full flex items-center gap-3 py-2 px-3 rounded-md text-sm transition
                        ${hasActiveChild ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50'}`}
                    >
                      {item.icon}
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left">{item.label}</span>
                          <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                            ▼
                          </span>
                        </>
                      )}
                    </button>
                    {!collapsed && isExpanded && (
                      <div className="ml-8 mt-1 space-y-1">
                        {item.children.map(child => (
                          <NavLink
                            key={child.label}
                            to={child.to}
                            onClick={() => onNavigate && onNavigate()}
                            className={({ isActive }) =>
                              `block py-1.5 px-3 rounded-md text-sm transition
                               ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`
                            }
                          >
                            {child.label}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  end={item.end}
                  onClick={() => onNavigate && onNavigate()}
                  className={({ isActive }) =>
                    `flex items-center gap-3 py-2 px-3 rounded-md text-sm transition
                     ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50'}`
                  }
                >
                  {item.icon}
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      {/* Company block */}
      <div className="p-4 border-t border-slate-800">
        {tenant && !collapsed && (
          <div className="text-xs text-slate-400">
            <div className="font-semibold">{tenant.name}</div>
            <div>{tenant.code}</div>
          </div>
        )}
      </div>
    </aside>
  );
}

function SidebarCompanyBlock({ collapsed }) {
  const [tenant, setTenant] = useState(null);

  useEffect(() => {
    let mounted = true;
    api.get('/tenants/me').then(res => { if (mounted) setTenant(res.data); }).catch(() => { });
    return () => { mounted = false; };
  }, []);

  const name = tenant?.name || 'Company';
  const code = tenant?.code || '';
  const initials = name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className={`flex items-center gap-3 mt-4 ${collapsed ? 'justify-center' : ''}`}>
      <div className="h-10 w-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 font-semibold flex-shrink-0">{initials || 'HR'}</div>
      {!collapsed && (
        <div className="overflow-hidden">
          <div className="font-semibold truncate">{name}</div>
          {code && <div className="text-sm text-slate-500 truncate">{code}</div>}
        </div>
      )}
    </div>
  );
}
