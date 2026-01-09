import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useParams, useNavigate } from 'react-router-dom';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import api from '../../utils/api'; // Centralized axios instance
import { useAuth } from '../../context/AuthContext';

export default function JobsList() {
    const [searchParams] = useSearchParams();
    const { companyCode } = useParams();
    const tenantIdQuery = searchParams.get('tenantId');
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const navigate = useNavigate();
    const { user, isInitialized, logout } = useAuth();

    // We need to resolve tenant ID first if only companyCode is present
    const [resolvedTenantId, setResolvedTenantId] = useState(tenantIdQuery || null);
    const [myApplications, setMyApplications] = useState(new Set());
    const [companyName, setCompanyName] = useState('');

    useEffect(() => {
        async function init() {
            // 1. Resolve Tenant ID if needed
            let tid = resolvedTenantId;
            if (!tid && companyCode) {
                try {
                    const res = await api.get(`/public/resolve-code/${companyCode}`);
                    tid = res.data.tenantId;
                    setResolvedTenantId(tid);
                    setCompanyName(res.data.companyName);
                } catch (e) {
                    setError('Invalid Company Link');
                    return;
                }
            }

            if (!tid) {
                setError('Missing Company Information');
                return;
            }

            // 2. Auth Check (Optional now, just to set user context/logout if mismatch)
            if (isInitialized) {
                if (user && user.role !== 'candidate') {
                    // If HR/Employee is viewing public page, that's fine, but they can't apply easily
                } else if (user && user.tenantId && user.tenantId !== tid) {
                    // Logged in but for different tenant? 
                    // This is a public page, so maybe we just show them logged in as 'Visitor' 
                    // or force logout? For now, let's just allow viewing.
                }
            } else {
                return; // Wait for init
            }

            // 3. Fetch Jobs & Applications
            setLoading(true);
            try {
                // Fetch Jobs
                const jobsRes = await api.get(`/public/jobs?tenantId=${tid}`);
                setJobs(jobsRes.data || []);

                // Fetch My Applications
                if (user && user.role === 'candidate') {
                    const dashRes = await api.get('/candidate/dashboard');
                    if (dashRes.data.applications) {
                        const appSet = new Set(dashRes.data.applications.map(app => app.requirementId?._id || app.requirementId));
                        setMyApplications(appSet);
                    }
                }
            } catch (err) {
                console.error(err);
                setError('Failed to load portal data.');
            } finally {
                setLoading(false);
            }
        }

        init();
    }, [companyCode, tenantIdQuery, isInitialized, user, navigate]);

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
                    <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
                    <p className="text-gray-600">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header / Top Bar */}
            <header className="bg-white shadow-sm sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        {/* Logo / Company Name */}
                        <div className="flex-shrink-0 flex items-center">
                            <span className="text-xl font-bold text-gray-900 tracking-tight">
                                {companyName || 'Careers'}
                            </span>
                        </div>

                        {/* Right Side Auth Actions */}
                        <div className="flex items-center gap-4">
                            {user ? (
                                <div className="flex items-center gap-4">
                                    <span className="hidden md:block text-sm text-gray-600">
                                        Welcome, <span className="font-semibold text-gray-900">{user.name}</span>
                                    </span>
                                    <Link
                                        to={user.role === 'candidate' ? "/candidate/dashboard" : "/"}
                                        className="text-sm font-medium text-blue-600 hover:text-blue-500"
                                    >
                                        Dashboard
                                    </Link>
                                    <button
                                        onClick={logout}
                                        className="text-sm font-medium text-gray-500 hover:text-red-600 transition"
                                    >
                                        Sign Out
                                    </button>
                                    {user.role === 'candidate' && (
                                        <Link to="/candidate/dashboard?tab=profile">
                                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs hover:bg-blue-200 cursor-pointer transition">
                                                {user.name?.charAt(0) || 'U'}
                                            </div>
                                        </Link>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <Link
                                        to={`/candidate/login?tenantId=${resolvedTenantId}&redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                                        className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-2"
                                    >
                                        Login
                                    </Link>
                                    <Link
                                        to={`/candidate/register?tenantId=${resolvedTenantId}&redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                                        className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition"
                                    >
                                        Create Account
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
                            {companyName ? `${companyName} Careers` : 'Open Positions'}
                        </h1>
                        <p className="mt-4 text-lg text-gray-600">
                            Join our team and help us build the future.
                        </p>
                    </div>

                    {loading ? (
                        <div className="text-center py-12">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <p className="mt-2 text-gray-500">Loading jobs...</p>
                        </div>
                    ) : jobs.length === 0 ? (
                        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                            <p className="text-gray-500 text-lg">No open positions at the moment.</p>
                        </div>
                    ) : (
                        <div className="grid gap-6">
                            {jobs.map(job => {
                                const isApplied = myApplications.has(job._id);
                                return (
                                    <div key={job._id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition p-6 border border-gray-100">
                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                                            <div className="mb-4 md:mb-0">
                                                <h2 className="text-xl font-bold text-gray-900">{job.jobTitle}</h2>
                                                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                                    <span className="flex items-center gap-1">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                                        {job.department}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        {formatDateDDMMYYYY(job.createdAt)}
                                                    </span>
                                                    <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                                                        {job.vacancy} Openings
                                                    </span>
                                                </div>
                                            </div>

                                            {isApplied ? (
                                                <Link
                                                    to="/candidate/dashboard"
                                                    className="inline-flex items-center justify-center px-6 py-2 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 transition"
                                                >
                                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                                    Applied - View Status
                                                </Link>
                                            ) : (
                                                <Link
                                                    to={`/apply-job/${job._id}?tenantId=${job.tenant || resolvedTenantId}`}
                                                    className="inline-flex items-center justify-center px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition"
                                                >
                                                    Apply Now
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
