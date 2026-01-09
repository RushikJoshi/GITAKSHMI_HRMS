import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api'; // Centralized axios instance
import { useAuth } from '../../context/AuthContext';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';

export default function JobApplication() {
  const [searchParams] = useSearchParams();
  const { requirementId: paramReqId } = useParams();

  // Support both /apply-job/:id and /apply?requirementId=...
  const requirementId = paramReqId || searchParams.get('requirementId');
  const tenantId = searchParams.get('tenantId');

  const [formData, setFormData] = useState({
    // Personal
    name: '',
    fatherName: '', // NEW: For Offer Letter
    email: '',
    mobile: '',
    dob: '',
    address: '', // NEW: For Offer Letter
    workLocation: '',

    // File
    resume: null,

    // Consent
    consent: false
  });

  const [requirement, setRequirement] = useState(null); // To store job details (Role)
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const { user, isInitialized } = useAuth();
  const navigate = useNavigate();

  const [alreadyApplied, setAlreadyApplied] = useState(null); // null, or object with details

  // Check application status on mount
  useEffect(() => {
    if (user && user.role === 'candidate' && requirementId) {
      async function checkStatus() {
        try {
          const res = await api.get(`/candidate/check-status/${requirementId}`);
          if (res.data.applied) {
            setAlreadyApplied(res.data);
          }
        } catch (err) {
          console.error("Failed to check status", err);
        }
      }
      checkStatus();
    }
  }, [user, requirementId]);

  // Removed useEffect that forced redirect to login
  // Now we utilize conditional rendering in the returned JSX

  useEffect(() => {
    if (!requirementId || !tenantId) {
      if (isInitialized && (!user || user.role !== 'candidate')) return; // handled above
      // Only show error if we are logged in but missing params
      if (user) setError('Invalid application link. Missing requirement or tenant information.');
    } else {
      // Fetch requirement to get Job Title (Role)
      fetchRequirementDetails();
    }
  }, [requirementId, tenantId, user, isInitialized]);

  // Pre-fill form from User Profile
  useEffect(() => {
    if (user && !formData.email) {
      setFormData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
        mobile: user.mobile || '',
        // We can't set file input value, but we can potentially indicate existing resume
      }));
    }
  }, [user]);

  const fetchRequirementDetails = async () => {
    try {
      const res = await api.get(`/public/job/${requirementId}?tenantId=${tenantId}`);
      setRequirement(res.data);
    } catch (err) {
      console.log("Could not fetch requirement details", err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        setError('Please upload a PDF document only.');
        return;
      }
      // Validate file size (4MB)
      if (file.size > 4 * 1024 * 1024) {
        setError('File size must be less than 4MB.');
        return;
      }
      setFormData(prev => ({
        ...prev,
        resume: file
      }));
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.consent) {
      setError('You must consent to background verification.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const submitData = new FormData();
      submitData.append('requirementId', requirementId);

      // Append all fields
      Object.keys(formData).forEach(key => {
        if (key === 'resume') {
          if (formData.resume) submitData.append('resume', formData.resume);
        } else {
          submitData.append(key, formData[key]);
        }
      });

      await api.post('/public/apply-job', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-Tenant-ID': tenantId
        }
      });

      setSubmitted(true);
    } catch (err) {
      console.error('Application submission error:', err);
      setError(err.response?.data?.error || 'Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="bg-white py-8 px-4 shadow-lg rounded-lg sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mt-6 text-2xl font-bold text-gray-900">Application Submitted!</h2>
              <p className="mt-2 text-sm text-gray-600">
                Thank you for your application. We will review your submission and get back to you soon.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }



  // UI for Already Applied
  if (alreadyApplied) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white shadow-xl rounded-2xl overflow-hidden text-center p-10 border border-gray-100">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-blue-100 mb-6">
              <svg className="h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Application Already Status</h2>
            <p className="text-lg text-gray-600 mb-8 max-w-xl mx-auto">
              You have already applied for this position on <span className="font-semibold">{new Date(alreadyApplied.appliedAt).toLocaleDateString()}</span>.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 max-w-lg mx-auto mb-8">
              <h3 className="text-amber-800 font-semibold mb-2">Re-Application Policy</h3>
              <p className="text-amber-700 text-sm">
                Candidates can re-apply for the same position <strong>after 1 month</strong> (30 days) from the date of previous application.
              </p>
            </div>

            <div className="flex justify-center gap-4">
              <button onClick={() => navigate('/candidate/dashboard')} className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition">
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Helper check for Internal jobs
  if (requirement && requirement.jobVisibility === 'Internal') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="bg-white py-8 px-4 shadow-lg rounded-lg sm:px-10 border-l-4 border-amber-500">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-amber-100">
                <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="mt-6 text-2xl font-bold text-gray-900">Internal Position</h2>
              <p className="mt-4 text-gray-600">
                This position is available to internal employees only.
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Please log in to your employee portal to view and apply for this job.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto relative">
        <button
          onClick={() => navigate(-1)}
          className="absolute top-0 left-0 -mt-2 p-2 text-gray-500 hover:text-gray-900 flex items-center gap-1 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back
        </button>

        <div className="text-center mb-12 pt-8">
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">Join Our Team</h2>
          <p className="mt-4 max-w-2xl text-lg text-gray-500 mx-auto">
            Review the role description and submit your application to be part of our journey.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Sticky Job Description */}
          <div className="lg:col-span-5 lg:sticky lg:top-8 order-2 lg:order-1">
            {requirement ? (
              <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
                <div className="bg-blue-600 px-6 py-4">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Job Description
                  </h3>
                </div>
                <div className="p-6">
                  <div className="mb-6">
                    {/* Job Title */}
                    {(!requirement.publicFields || requirement.publicFields.includes('jobTitle')) && (
                      <h4 className="text-2xl font-bold text-gray-900 mb-2">{requirement.jobTitle}</h4>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {/* Department */}
                      {(!requirement.publicFields || requirement.publicFields.includes('department')) && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                          {requirement.department}
                        </span>
                      )}

                      {/* Job Type */}
                      {requirement.jobType && (!requirement.publicFields || requirement.publicFields.includes('jobType')) && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-700 border border-gray-100">
                          {requirement.jobType}
                        </span>
                      )}

                      {/* Work Mode */}
                      {requirement.workMode && (!requirement.publicFields || requirement.publicFields.includes('workMode')) && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {requirement.workMode}
                        </span>
                      )}

                      {/* Experience */}
                      {(requirement.minExperienceMonths || requirement.maxExperienceMonths) && (!requirement.publicFields || requirement.publicFields.includes('experience')) && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                          Exp: {requirement.minExperienceMonths || 0} - {requirement.maxExperienceMonths || 'Any'} Months
                        </span>
                      )}

                      {/* Vacancy */}
                      {requirement.vacancy && (!requirement.publicFields || requirement.publicFields.includes('vacancy')) && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                          {requirement.vacancy} Openings
                        </span>
                      )}

                      {/* Salary */}
                      {(!requirement.publicFields || requirement.publicFields.includes('salary')) && (requirement.salaryMin || requirement.salaryMax) && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-100">
                          ₹{requirement.salaryMin || 0} - {requirement.salaryMax || 'negotiable'}
                        </span>
                      )}
                    </div>

                    {/* Custom Public Fields */}
                    {requirement.customFields && requirement.customFields.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {requirement.customFields
                          .filter(f => f.isPublic)
                          .map((f, i) => (
                            <span key={i} className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              <span className="font-semibold mr-1">{f.label}:</span> {f.value}
                            </span>
                          ))
                        }
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {(!requirement.publicFields || requirement.publicFields.includes('description')) && requirement.description ? (
                    <div className="prose prose-blue text-gray-600 whitespace-pre-line text-sm leading-relaxed max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                      {requirement.description}
                    </div>
                  ) : (
                    (!requirement.publicFields || requirement.publicFields.includes('description')) && <p className="text-gray-400 italic">No detailed description provided.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="animate-pulse bg-white p-6 rounded-2xl shadow-sm">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-40 bg-gray-200 rounded mb-4"></div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Application Form or Login Prompt */}
          <div className="lg:col-span-7 order-1 lg:order-2">
            {!user ? (
              // Case 1: Not Logged In -> Show Login/Register Prompt
              <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100 p-8 text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-6">
                  <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Ready to Apply?</h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  Please login or create a candidate account to submit your application. This allows you to track your application status later.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={() => {
                      const redirectUrl = `/apply-job/${requirementId}?tenantId=${tenantId}`;
                      navigate(`/candidate/login?tenantId=${tenantId}&redirect=${encodeURIComponent(redirectUrl)}`);
                    }}
                    className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition shadow-md"
                  >
                    Login to Apply
                  </button>
                  <button
                    onClick={() => {
                      const redirectUrl = `/apply-job/${requirementId}?tenantId=${tenantId}`;
                      navigate(`/candidate/register?tenantId=${tenantId}&redirect=${encodeURIComponent(redirectUrl)}`);
                    }}
                    className="px-6 py-3 bg-white text-blue-600 border border-blue-200 font-medium rounded-lg hover:bg-blue-50 transition shadow-sm"
                  >
                    Create Account
                  </button>
                </div>
              </div>
            ) : user.role !== 'candidate' ? (
              // Case 2: Logged in but NOT as Candidate
              <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100 p-8 text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-amber-100 mb-6">
                  <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Candidate Account Required</h3>
                <p className="text-gray-600 mb-8">
                  You are currently logged in as <strong>{user.role}</strong> ({user.email}). <br />
                  To apply for jobs, you must be logged in with a <strong>Candidate</strong> account.
                </p>
                <button
                  onClick={() => {
                    // Assuming a logout function exists or just pushing to logout 
                    // But best is to tell them to use incognito or logout manually? 
                    // Typically, we might trigger logout here.
                    window.location.href = `/candidate/login?tenantId=${tenantId}`; // Simple redirect might suffice for now
                  }}
                  className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition"
                >
                  Go to Candidate Login
                </button>
              </div>
            ) : (
              // Case 3: Logged in as Candidate -> Show Form
              <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
                <div className="bg-gray-900 px-6 py-4">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Application Form
                  </h3>
                </div>

                <form onSubmit={handleSubmit} className="p-8">
                  {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-md">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-red-700">{error}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-8">
                    {/* Personal Details */}
                    <section>
                      <h4 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-6 uppercase tracking-wider text-xs">Personal Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Role Applied For</label>
                          <div className="relative">
                            <input type="text" value={requirement?.jobTitle || 'Loading...'} disabled className="block w-full bg-gray-50 border border-gray-300 rounded-lg py-2.5 px-4 text-gray-500 cursor-not-allowed text-sm font-medium" />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            </div>
                          </div>
                        </div>

                        <div className="col-span-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                          <input type="text" name="name" required value={formData.name} onChange={handleInputChange} className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2.5 px-3 border transition-colors" placeholder="John Doe" />
                        </div>

                        <div className="col-span-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Father's Full Name *</label>
                          <input type="text" name="fatherName" required value={formData.fatherName} onChange={handleInputChange} className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2.5 px-3 border transition-colors" placeholder="Required for Offer Letter" />
                        </div>

                        <div className="col-span-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                          <input type="email" name="email" required value={formData.email} onChange={handleInputChange} className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2.5 px-3 border transition-colors" placeholder="john@example.com" />
                        </div>

                        <div className="col-span-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number (+91) *</label>
                          <input type="tel" name="mobile" required value={formData.mobile} onChange={handleInputChange} className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2.5 px-3 border transition-colors" placeholder="9876543210" />
                        </div>

                        <div className="col-span-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                          <DatePicker
                            className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-[7px] border transition-colors relative"
                            format="DD-MM-YYYY"
                            placeholder="Select Date"
                            value={formData.dob ? dayjs(formData.dob) : null}
                            onChange={(date) => setFormData(prev => ({ ...prev, dob: date ? date.format('YYYY-MM-DD') : '' }))}
                          />
                        </div>

                        <div className="col-span-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Current Work Location</label>
                          <input type="text" name="workLocation" value={formData.workLocation} onChange={handleInputChange} className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2.5 px-3 border transition-colors" placeholder="City, Country" />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Permanent Address *</label>
                          <textarea name="address" required rows={3} value={formData.address} onChange={handleInputChange} className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2.5 px-3 border transition-colors resize-none" placeholder="Enter your full permanent address (Required for documentation)" />
                        </div>
                      </div>
                    </section>

                    {/* Documents */}
                    <section>
                      <h4 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-6 uppercase tracking-wider text-xs">Documents</h4>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Upload Resume (PDF only, max 4MB) *</label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="space-y-1 text-center">
                            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <div className="flex text-sm text-gray-600 justify-center">
                              <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                                <span>Upload a file</span>
                                <input id="file-upload" name="file-upload" type="file" accept=".pdf" className="sr-only" onChange={handleFileChange} />
                              </label>
                              <p className="pl-1">or drag and drop</p>
                            </div>
                            <p className="text-xs text-gray-500">{formData.resume ? formData.resume.name : 'PDF up to 4MB'}</p>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Consent */}
                    <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <input id="consent" name="consent" type="checkbox" required checked={formData.consent} onChange={handleInputChange} className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded cursor-pointer" />
                        </div>
                        <div className="ml-3 text-sm">
                          <label htmlFor="consent" className="font-medium text-gray-700 cursor-pointer select-none">I acknowledge and consent to background verification checks as part of the hiring process.</label>
                        </div>
                      </div>
                    </section>

                    <div className="pt-4">
                      <button type="submit" disabled={loading || !requirementId || !tenantId} className="w-full flex justify-center py-4 px-4 border border-transparent rounded-lg shadow-md text-base font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5">
                        {loading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Submitting Application...
                          </>
                        ) : (
                          'Submit Application'
                        )}
                      </button>
                      <p className="text-xs text-center text-gray-400 mt-4">Protected by HRMS SaaS Security</p>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}