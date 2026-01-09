import React, { useState } from 'react';

export default function DynamicFormBuilder({ template, onSave, onCancel }) {
    const [fields, setFields] = useState(template.fields || []);
    const [activeSection, setActiveSection] = useState('Basic Details');

    // Default sections
    const SECTIONS = ['Basic Details', 'Job Description', 'Experience & Skills', 'Salary & Perks', 'Additional Info'];

    // Field Types
    const FIELD_TYPES = ['text', 'number', 'dropdown', 'textarea', 'date', 'checkbox', 'file'];

    const [editingField, setEditingField] = useState(null);
    const [isNewField, setIsNewField] = useState(false);

    const handleAddField = () => {
        setEditingField({
            uiId: `new_${Date.now()}`,
            key: '',
            label: '',
            type: 'text',
            section: activeSection,
            required: false,
            options: [] // for dropdowns
        });
        setIsNewField(true);
    };

    const handleEditField = (field) => {
        setEditingField({ ...field });
        setIsNewField(false);
    };

    const handleDeleteField = (uiId) => {
        if (window.confirm("Delete this field?")) {
            setFields(prev => prev.filter(f => f.uiId !== uiId));
        }
    };

    const saveField = (e) => {
        e.preventDefault();

        // Manual validation
        if (!editingField.label.trim()) {
            alert("Label is required");
            return;
        }

        const fieldToSave = { ...editingField };

        // Auto-generate key if empty
        if (!fieldToSave.key) {
            fieldToSave.key = fieldToSave.label.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
        }

        // Check key uniqueness manually (ignoring self)
        const duplicate = fields.find(f => f.key === fieldToSave.key && f.uiId !== fieldToSave.uiId);
        if (duplicate) {
            alert("Field key must be unique. Change label or key.");
            return;
        }

        if (isNewField) {
            setFields([...fields, fieldToSave]);
        } else {
            setFields(fields.map(f => f.uiId === editingField.uiId ? fieldToSave : f));
        }
        setEditingField(null);
    };

    const handleSaveTemplate = () => {
        // Strip uiId before sending to parent/backend
        const cleanFields = fields.map(({ uiId, ...rest }) => rest);
        onSave({ ...template, fields: cleanFields, sections: SECTIONS });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex overflow-hidden">

                {/* Left: Field List */}
                <div className="w-1/3 bg-slate-50 border-r border-slate-200 flex flex-col">
                    <div className="p-4 border-b border-slate-200 bg-white">
                        <h2 className="font-bold text-lg text-slate-800">Form Fields</h2>
                        <p className="text-xs text-slate-500">Drag to reorder (coming soon)</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {fields.map((field) => (
                            <div key={field.uiId} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center group hover:border-blue-400 transition cursor-pointer" onClick={() => handleEditField(field)}>
                                <div>
                                    <div className="font-semibold text-slate-700">{field.label}</div>
                                    <div className="text-xs text-slate-500 flex gap-2">
                                        <span className="capitalize bg-slate-100 px-1 rounded">{field.type}</span>
                                        {field.required && <span className="text-red-500">Required</span>}
                                    </div>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition">
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteField(field.uiId); }} className="text-red-500 hover:bg-red-50 p-1 rounded">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                        <button onClick={handleAddField} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-blue-500 hover:text-blue-500 transition font-medium">
                            + Add Custom Field
                        </button>
                    </div>
                </div>

                {/* Right: Editor Panel */}
                <div className="flex-1 bg-white p-8 flex flex-col">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Configure Template</h2>
                            <p className="text-slate-500">Define the customized structure for your job posts.</p>
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={onCancel} className="px-4 py-2 border border-slate-300 rounded-lg">Cancel</button>
                            <button type="button" onClick={handleSaveTemplate} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-md">Save Changes</button>
                        </div>
                    </div>

                    {editingField ? (
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 animate-fadeIn">
                            <h3 className="font-bold text-lg mb-4 text-slate-800">{isNewField ? 'Add New Field' : 'Edit Field'}</h3>
                            <form className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Label <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            value={editingField.label}
                                            onChange={e => setEditingField({ ...editingField, label: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="e.g. Budget Code"
                                            autoFocus
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Field Type</label>
                                        <select
                                            value={editingField.type}
                                            onChange={e => setEditingField({ ...editingField, type: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                        >
                                            {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Section</label>
                                        <select
                                            value={editingField.section}
                                            onChange={e => setEditingField({ ...editingField, section: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                        >
                                            {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center pt-6">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={editingField.required}
                                                onChange={e => setEditingField({ ...editingField, required: e.target.checked })}
                                                className="w-5 h-5 text-blue-600 rounded"
                                            />
                                            <span className="text-sm font-medium text-slate-700">Required Field?</span>
                                        </label>
                                    </div>
                                </div>

                                {editingField.type === 'dropdown' && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Options (Comma separated)</label>
                                        <input
                                            value={Array.isArray(editingField.options) ? editingField.options.join(', ') : ''}
                                            onChange={e => setEditingField({ ...editingField, options: e.target.value.split(',').map(s => s.trim()) })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                            placeholder="Option A, Option B"
                                        />
                                    </div>
                                )}

                                <div className="flex justify-end gap-3 pt-4">
                                    <button type="button" onClick={() => setEditingField(null)} className="px-4 py-2 text-slate-500 hover:text-slate-700">Cancel</button>
                                    <button type="button" onClick={saveField} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Apply Field</button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                            <p>Select a field to edit or click "+ Add Custom Field"</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
