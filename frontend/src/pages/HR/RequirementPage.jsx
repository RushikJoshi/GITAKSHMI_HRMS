import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function RequirementPage() {
    const [requirements, setRequirements] = useState([]);
    const [loading, setLoading] = useState(false);
    const [openForm, setOpenForm] = useState(false);
    const [currentReq, setCurrentReq] = useState(null);
    const [openView, setOpenView] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    // Load List of Requirements
    async function loadRequirements() {
        setLoading(true);
        try {
            const res = await api.get('/requirements');
            setRequirements(res.data || []);
        } catch (err) {
            console.error(err);
            alert('Failed to load requirements');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadRequirements();
    }, []);

    async function toggleStatus(id, currentStatus) {
        const newStatus = currentStatus === 'Open' ? 'Closed' : 'Open';
        try {
            await api.patch(`/requirements/${id}/status`, { status: newStatus });
            loadRequirements();
        } catch (err) {
            console.error(err);
            alert('Failed to update status');
        }
    }

    function openNew() {
        setCurrentReq(null);
        setIsEditMode(false);
        setOpenForm(true);
    }

    function handleEdit(req) {
        setCurrentReq(req);
        setIsEditMode(true);
        setOpenForm(true);
    }

    function handleView(req) {
        setCurrentReq(req);
        setOpenView(true);
    }

    async function handleDelete(id) {
        if (!window.confirm('Are you sure you want to delete this job requirement?')) return;
        try {
            await api.delete(`/requirements/${id}`);
            setRequirements(prev => prev.filter(r => r._id !== id));
        } catch (err) {
            console.error(err);
            alert('Failed to delete requirement');
        }
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-slate-900">Requirement Management</h1>
                <div className="flex gap-3">
                    <button onClick={openNew} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md">
                        + Add Requirement
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Loading requirements...</div>
                ) : requirements.length === 0 ? (
                    <div className="p-12 text-center">
                        <h3 className="text-lg font-semibold text-slate-700">No Requirements Found</h3>
                        <p className="text-slate-500 mt-2">Get started by creating a new job requirement.</p>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Job Title</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Department</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Vacancy</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {requirements.map(req => (
                                <tr key={req._id} className="hover:bg-slate-50">
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{req.jobTitle || req.title || 'Untitled'}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{req.department || '-'}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{req.vacancy}</td>
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${req.status === 'Open' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {req.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => handleView(req)} className="text-slate-400 hover:text-blue-600" title="View">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                            </button>
                                            <button onClick={() => toggleStatus(req._id, req.status)} className="text-slate-400 hover:text-green-600" title="Toggle Status">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            </button>
                                            <button onClick={() => handleEdit(req)} className="text-blue-600 hover:text-blue-800" title="Edit">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            </button>
                                            <button onClick={() => handleDelete(req._id)} className="text-red-600 hover:text-red-900" title="Delete">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {openForm && (
                <RequirementForm
                    initialData={currentReq}
                    isEdit={isEditMode}
                    onClose={() => setOpenForm(false)}
                    onSuccess={loadRequirements}
                />
            )}

            {openView && currentReq && (
                <ViewRequirementModal
                    req={currentReq}
                    onClose={() => { setOpenView(false); setCurrentReq(null); }}
                />
            )}
        </div>
    );
}

function RequirementForm({ onClose, onSuccess, initialData, isEdit }) {
    const [formData, setFormData] = useState({
        jobTitle: '',
        department: '',
        vacancy: 1,
        description: '',
        priority: 'Medium',
        workMode: 'On-site',
        jobType: 'Full Time',
        minExperienceMonths: 0,
        maxExperienceMonths: 0,
        salaryMin: '',
        salaryMax: ''
    });

    const [customFields, setCustomFields] = useState([]);

    // Track which fields are visible to the public
    const [publicFields, setPublicFields] = useState(new Set([
        'jobTitle', 'department', 'vacancy', 'description',
        'workMode', 'jobType', 'experience', 'salary'
    ]));

    // Default Workflow
    const [workflow, setWorkflow] = useState(['Shortlisted', 'Interview']);

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                jobTitle: initialData.jobTitle || '',
                department: initialData.department || '',
                vacancy: initialData.vacancy || 1,
                description: initialData.description || '',
                priority: initialData.priority || 'Medium',
                workMode: initialData.workMode || 'On-site',
                jobType: initialData.jobType || 'Full Time',
                minExperienceMonths: initialData.minExperienceMonths || 0,
                maxExperienceMonths: initialData.maxExperienceMonths || 0,
                salaryMin: initialData.salaryMin || '',
                salaryMax: initialData.salaryMax || ''
            });
            if (initialData.customFields && Array.isArray(initialData.customFields)) {
                setCustomFields(initialData.customFields);
            }
            if (initialData.publicFields && Array.isArray(initialData.publicFields)) {
                setPublicFields(new Set(initialData.publicFields));
            }
            if (initialData.workflow && Array.isArray(initialData.workflow)) {
                // Filter out 'Applied' and 'Finalized' as they are fixed start/end points
                const editable = initialData.workflow.filter(s => s !== 'Applied' && s !== 'Finalized' && s !== 'Rejected' && s !== 'Selected');
                if (editable.length > 0) setWorkflow(editable);
            }
        }
    }, [initialData]);

    const addCustomField = () => {
        setCustomFields([...customFields, { label: '', value: '', isPublic: true }]);
    };

    const removeCustomField = (index) => {
        const newFields = [...customFields];
        newFields.splice(index, 1);
        setCustomFields(newFields);
    };

    const updateCustomField = (index, field, val) => {
        const newFields = [...customFields];
        newFields[index][field] = val;
        setCustomFields(newFields);
    };

    const togglePublic = (key) => {
        const newSet = new Set(publicFields);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        setPublicFields(newSet);
    };

    // Workflow Handlers
    const addStage = () => {
        setWorkflow([...workflow, 'New Round']);
    };

    const updateStage = (index, val) => {
        const newWorkflow = [...workflow];
        newWorkflow[index] = val;
        setWorkflow(newWorkflow);
    };

    const removeStage = (index) => {
        const newWorkflow = [...workflow];
        newWorkflow.splice(index, 1);
        setWorkflow(newWorkflow);
    };

    async function submit(e) {
        e.preventDefault();
        setSaving(true);

        // Filter out empty custom fields
        const validCustomFields = customFields.filter(f => f.label.trim() !== '' && f.value.trim() !== '');

        // Construct simplified workflow to save
        const fullWorkflow = ['Applied', ...workflow.filter(w => w.trim() !== ''), 'Finalized'];

        // Convert Set to Array for storage
        const payload = {
            ...formData,
            customFields: validCustomFields,
            publicFields: Array.from(publicFields),
            workflow: fullWorkflow
        };

        try {
            if (isEdit) {
                await api.put(`/requirements/${initialData._id}`, payload);
            } else {
                await api.post('/requirements/create', payload);
            }
            onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            alert('Failed to save');
        } finally {
            setSaving(false);
        }
    }

    // Helper for label with visibility toggle
    const LabelWithToggle = ({ label, fieldKey, required }) => (
        <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-slate-700">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <button
                type="button"
                onClick={() => togglePublic(fieldKey)}
                className={`text-xs flex items-center gap-1 px-2 py-0.5 rounded border transition ${publicFields.has(fieldKey) ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                title={publicFields.has(fieldKey) ? "Visible on Public Page" : "Hidden from Public Page"}
            >
                {publicFields.has(fieldKey) ? (
                    <>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        Public
                    </>
                ) : (
                    <>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        Hidden
                    </>
                )}
            </button>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">{isEdit ? 'Edit Requirement' : 'New Job Requirement'}</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Configure job details and hiring process steps.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>

                <form onSubmit={submit} className="p-6 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <LabelWithToggle label="Job Title" fieldKey="jobTitle" required />
                            <input
                                required
                                value={formData.jobTitle}
                                onChange={e => setFormData({ ...formData, jobTitle: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="e.g. Senior Developer"
                            />
                        </div>

                        <div>
                            <LabelWithToggle label="Department" fieldKey="department" required />
                            <select
                                required
                                value={formData.department}
                                onChange={e => setFormData({ ...formData, department: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            >
                                <option value="">Select Department</option>
                                <option value="HR">HR</option>
                                <option value="IT">IT</option>
                                <option value="Sales">Sales</option>
                                <option value="Marketing">Marketing</option>
                                <option value="Finance">Finance</option>
                                <option value="Operations">Operations</option>
                            </select>
                        </div>

                        <div>
                            <LabelWithToggle label="Vacancy" fieldKey="vacancy" required />
                            <input
                                required
                                type="number"
                                min="1"
                                value={formData.vacancy}
                                onChange={e => setFormData({ ...formData, vacancy: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div>
                            <LabelWithToggle label="Job Type" fieldKey="jobType" />
                            <select
                                value={formData.jobType}
                                onChange={e => setFormData({ ...formData, jobType: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            >
                                <option value="Full Time">Full Time</option>
                                <option value="Part Time">Part Time</option>
                                <option value="Contract">Contract</option>
                                <option value="Internship">Internship</option>
                            </select>
                        </div>

                        <div>
                            <LabelWithToggle label="Work Mode" fieldKey="workMode" />
                            <select
                                value={formData.workMode}
                                onChange={e => setFormData({ ...formData, workMode: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            >
                                <option value="On-site">On-site</option>
                                <option value="Remote">Remote</option>
                                <option value="Hybrid">Hybrid</option>
                            </select>
                        </div>

                        <div>
                            <LabelWithToggle label="Experience (Months)" fieldKey="experience" />
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    placeholder="Min"
                                    value={formData.minExperienceMonths}
                                    onChange={e => setFormData({ ...formData, minExperienceMonths: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <span className="self-center text-slate-400">-</span>
                                <input
                                    type="number"
                                    placeholder="Max"
                                    value={formData.maxExperienceMonths}
                                    onChange={e => setFormData({ ...formData, maxExperienceMonths: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="">
                            <LabelWithToggle label="Priority" fieldKey="priority" />
                            <select
                                value={formData.priority}
                                onChange={e => setFormData({ ...formData, priority: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            >
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                            </select>
                        </div>

                        <div className="col-span-2">
                            <LabelWithToggle label="Salary Range (Annual)" fieldKey="salary" />
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    placeholder="Min Salary"
                                    value={formData.salaryMin}
                                    onChange={e => setFormData({ ...formData, salaryMin: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <span className="self-center text-slate-400">-</span>
                                <input
                                    type="number"
                                    placeholder="Max Salary"
                                    value={formData.salaryMax}
                                    onChange={e => setFormData({ ...formData, salaryMax: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="col-span-2">
                            <LabelWithToggle label="Description" fieldKey="description" />
                            <textarea
                                rows="3"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Job details, key responsibilities, etc..."
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mt-6 pt-4 border-t border-slate-100">
                        {/* Custom Fields Section */}
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <label className="block text-sm font-bold text-slate-700">Ad-hoc Details</label>
                                <button type="button" onClick={addCustomField} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                                    + Add Detail
                                </button>
                            </div>

                            <div className="space-y-2">
                                {customFields.map((field, index) => (
                                    <div key={index} className="flex gap-1 items-center bg-slate-50 p-1.5 rounded border border-slate-100">
                                        {/* Public Toggle for Custom Field */}
                                        <button
                                            type="button"
                                            onClick={() => updateCustomField(index, 'isPublic', !field.isPublic)}
                                            className={`p-1.5 rounded border transition ${field.isPublic ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-slate-400 border-slate-200'}`}
                                            title={field.isPublic ? "Visible Publicly" : "Hidden Publicly"}
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                {field.isPublic ? (
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                ) : (
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                )}
                                            </svg>
                                        </button>
                                        <input
                                            type="text"
                                            placeholder="Label"
                                            value={field.label}
                                            onChange={(e) => updateCustomField(index, 'label', e.target.value)}
                                            className="w-24 px-2 py-1.5 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Value"
                                            value={field.value}
                                            onChange={(e) => updateCustomField(index, 'value', e.target.value)}
                                            className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <button type="button" onClick={() => removeCustomField(index)} className="text-red-400 hover:text-red-600 p-1">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                ))}
                                {customFields.length === 0 && (
                                    <div className="text-xs text-slate-400 italic text-center py-2 bg-slate-50 rounded border border-dashed border-slate-200">
                                        No custom fields.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Hiring Process Configurator */}
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <label className="block text-sm font-bold text-slate-700">Hiring Stages</label>
                                <button type="button" onClick={addStage} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                                    + Add Stage
                                </button>
                            </div>
                            <div className="space-y-2">
                                {/* Fixed Start */}
                                <div className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-100 opacity-70">
                                    <span className="text-xs font-bold text-green-700 w-6">Start</span>
                                    <div className="flex-1 text-sm text-green-900 font-medium">Applied</div>
                                </div>

                                {/* Dynamic Middle Stages */}
                                {workflow.map((stage, index) => (
                                    <div key={index} className="flex gap-2 items-center p-1 rounded hover:bg-slate-50 group border border-transparent hover:border-slate-200">
                                        <span className="text-xs text-slate-400 w-6 text-center">{index + 1}</span>
                                        <input
                                            type="text"
                                            value={stage}
                                            onChange={(e) => updateStage(index, e.target.value)}
                                            className="flex-1 px-3 py-1.5 border border-slate-300 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="Stage Name (e.g. Technical Round)"
                                        />
                                        <button type="button" onClick={() => removeStage(index)} className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                ))}

                                {/* Fixed End */}
                                <div className="flex items-center gap-2 p-2 bg-slate-100 rounded border border-slate-200 opacity-70">
                                    <span className="text-xs font-bold text-slate-500 w-6">End</span>
                                    <div className="flex-1 text-sm text-slate-700 font-medium">Finalized (Selected / Rejected)</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-slate-100">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Cancel</button>
                        <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md">
                            {saving ? 'Saving...' : 'Save & Configure'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ViewRequirementModal({ req, onClose }) {
    const customFields = req.customFields || [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start p-6 border-b">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">{req.jobTitle || 'Untitled'}</h2>
                        <div className="flex gap-2 text-sm mt-1">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">{req.department}</span>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">{req.jobType}</span>
                            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-100">{req.workMode}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>

                <div className="p-6 grid grid-cols-2 gap-6 bg-slate-50 border-b">
                    <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Experience</div>
                        <div className="text-slate-800 font-medium">{req.minExperienceMonths || 0} - {req.maxExperienceMonths || 'Any'} Months</div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Salary Range</div>
                        <div className="text-slate-800 font-medium">{req.salaryMin ? `₹${req.salaryMin} - ₹${req.salaryMax}` : 'Not Disclosed'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Vacancy</div>
                        <div className="text-slate-800 font-medium">{req.vacancy} Position(s)</div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Priority</div>
                        <div className="text-slate-800 font-medium">{req.priority || 'Medium'}</div>
                    </div>
                </div>

                <div className="p-6">
                    <h3 className="font-semibold text-slate-800 mb-2">Job Description</h3>
                    <p className="text-slate-600 whitespace-pre-wrap">{req.description || 'No description provided.'}</p>
                </div>

                {customFields.length > 0 && (
                    <div className="p-6 border-t border-slate-100">
                        <h3 className="font-semibold text-slate-800 mb-3">Additional Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {customFields.map((field, idx) => (
                                <div key={idx} className="bg-slate-50 p-3 rounded border border-slate-100">
                                    <span className="block text-xs text-slate-500 mb-1">{field.label}</span>
                                    <span className="block text-sm font-medium text-slate-800">{field.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="bg-slate-50 px-6 py-4 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50">Close</button>
                </div>
            </div>
        </div>
    )
}
