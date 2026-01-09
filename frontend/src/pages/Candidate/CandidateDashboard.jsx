import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function CandidateDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Get tab from URL or default to 'jobs'
    const initialTab = searchParams.get('tab') || 'jobs';
    const [activeTab, setActiveTab] = useState(initialTab);

    const [profile, setProfile] = useState(null);
    const [applications, setApplications] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tenantId, setTenantId] = useState(user?.tenantId || localStorage.getItem('tenantId'));

    // Update URL when tab changes internally
    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setSearchParams({ tab });
    };

    useEffect(() => {
        // Sync state if URL param changes externally (e.g. back button)
        const tab = searchParams.get('tab');
        if (tab && tab !== activeTab) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    useEffect(() => {
        async function loadData() {
            try {
                setLoading(true);
                // Load Dashboard Data (Profile + Applications)
                const dashboardRes = await api.get('/candidate/dashboard');
                setProfile(dashboardRes.data.profile);
                setApplications(dashboardRes.data.applications);

                // Load Open Jobs
                if (tenantId) {
                    const jobsRes = await api.get(`/public/jobs?tenantId=${tenantId}`);
                    setJobs(jobsRes.data);
                }
            } catch (err) {
                console.error("Failed to load dashboard:", err);
            } finally {
                setLoading(false);
            }
        }

        if (user) {
            loadData();
        }
    }, [user, tenantId]);

    function handleApply(jobId) {
        navigate(`/apply-job/${jobId}?tenantId=${tenantId}`);
    }

    if (!user || user.role !== 'candidate') {
        return <div className="p-10 text-center">Access Denied. Please Login as Candidate.</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
            {/* Sidebar / Profile Section */}
            <aside className="w-full md:w-80 bg-white shadow-md z-10 flex-shrink-0">
                <div className="p-6 border-b border-gray-200">
                    <div
                        className="flex items-center space-x-4 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition"
                        onClick={() => handleTabChange('profile')}
                    >
                        <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold">
                            {profile?.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{profile?.name}</h2>
                            <p className="text-sm text-gray-500">{profile?.email}</p>
                        </div>
                    </div>
                    <div className="mt-6">
                        <button onClick={logout} className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                            Logout
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Menu</h3>
                    <nav className="space-y-2">
                        <button
                            onClick={() => handleTabChange('jobs')}
                            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${activeTab === 'jobs' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Open Positions
                        </button>
                        <button
                            onClick={() => handleTabChange('applications')}
                            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${activeTab === 'applications' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            My Applications
                        </button>
                        <button
                            onClick={() => handleTabChange('profile')}
                            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${activeTab === 'profile' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            My Profile
                        </button>
                    </nav>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-8">
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                ) : (
                    <div className="max-w-5xl mx-auto">
                        {activeTab === 'jobs' && (
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 mb-6">Current Openings</h1>
                                <div className="grid gap-6">
                                    {jobs.length === 0 ? (
                                        <p className="text-gray-500">No open positions at the moment.</p>
                                    ) : (
                                        jobs.map(job => {
                                            const isApplied = applications.some(app => (app.requirementId?._id || app.requirementId) === job._id);
                                            return (
                                                <div key={job._id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex justify-between items-center hover:shadow-md transition-shadow">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-gray-900">{job.jobTitle}</h3>
                                                        <div className="mt-2 flex items-center text-sm text-gray-500 space-x-4">
                                                            <span className="flex items-center">
                                                                <svg className="mr-1.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                                </svg>
                                                                {job.department}
                                                            </span>
                                                            <span className="flex items-center">
                                                                <svg className="mr-1.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" />
                                                                </svg>
                                                                {job.vacancy} Vacancy
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {isApplied ? (
                                                        <button
                                                            onClick={() => handleTabChange('applications')}
                                                            className="px-4 py-2 bg-green-100 text-green-700 text-sm font-medium rounded-md hover:bg-green-200 focus:outline-none transition"
                                                        >
                                                            ✓ View Status
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleApply(job._id)}
                                                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                                        >
                                                            Apply Now
                                                        </button>
                                                    )}
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'applications' && (
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 mb-6">My Applications</h1>
                                <div className="grid gap-6">
                                    {applications.length === 0 ? (
                                        <div className="text-center py-10 bg-white rounded-lg border border-gray-200">
                                            <p className="text-gray-500">You haven't applied to any jobs yet.</p>
                                            <button onClick={() => handleTabChange('jobs')} className="mt-4 text-blue-600 font-medium hover:text-blue-500">
                                                Browse Jobs
                                            </button>
                                        </div>
                                    ) : (
                                        applications.map(app => (
                                            <div key={app._id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-gray-900">{app.requirementId?.jobTitle || 'Unknown Job'}</h3>
                                                        <p className="text-sm text-gray-500 mt-1">{app.requirementId?.department} • Applied on {new Date(app.createdAt).toLocaleDateString()}</p>
                                                    </div>
                                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${app.status === 'Selected' ? 'bg-green-100 text-green-800' :
                                                        app.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                                            app.status === 'Shortlisted' ? 'bg-yellow-100 text-yellow-800' :
                                                                'bg-blue-100 text-blue-800'
                                                        }`}>
                                                        {app.status}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'profile' && (
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>
                                <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                                    <div className="flex items-start">
                                        <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-4xl font-bold flex-shrink-0">
                                            {profile?.name?.charAt(0) || 'U'}
                                        </div>
                                        <div className="ml-6 flex-1">
                                            <h2 className="text-2xl font-bold text-gray-900">{profile?.name}</h2>
                                            <p className="text-gray-500">{profile?.email}</p>
                                            <p className="text-gray-500">{profile?.mobile}</p>

                                            <div className="mt-6 border-t border-gray-100 pt-6">
                                                <h3 className="text-lg font-medium text-gray-900 mb-4">Account Information</h3>
                                                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
                                                    <div>
                                                        <dt className="text-sm font-medium text-gray-500">Email</dt>
                                                        <dd className="mt-1 text-sm text-gray-900">{profile?.email}</dd>
                                                    </div>
                                                    <div>
                                                        <dt className="text-sm font-medium text-gray-500">Member Since</dt>
                                                        <dd className="mt-1 text-sm text-gray-900">{new Date(profile?.createdAt || Date.now()).toLocaleDateString()}</dd>
                                                    </div>
                                                </dl>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
