import React from 'react';

export default function DynamicFormRenderer({ fields, formData, onChange, errors = {} }) {
    // Group fields by section
    const PREDEFINED_SECTIONS = ['Basic Details', 'Job Description', 'Experience & Skills', 'Salary & Perks', 'Additional Info'];

    // Grouping logic
    const sections = {};
    PREDEFINED_SECTIONS.forEach(s => sections[s] = []);

    // Also catch any custom sections if added later
    fields.forEach(field => {
        const sectionName = field.section || 'Basic Details';
        if (!sections[sectionName]) sections[sectionName] = [];
        sections[sectionName].push(field);
    });

    // Sort sections based on predefined order
    const sortedSectionNames = Object.keys(sections).filter(s => sections[s].length > 0);

    return (
        <div className="space-y-8">
            {sortedSectionNames.map(sectionName => (
                <div key={sectionName} className="animate-fadeIn">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">
                        {sectionName}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {sections[sectionName]
                            .sort((a, b) => (a.order || 0) - (b.order || 0))
                            .map(field => {
                                const isFullWidth = field.type === 'textarea' || field.type === 'editor';

                                return (
                                    <div key={field.key} className={isFullWidth ? "col-span-1 md:col-span-2" : "col-span-1"}>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                            {field.label} {field.required && <span className="text-red-500">*</span>}
                                        </label>

                                        {/* RENDER INPUT BASED ON TYPE */}
                                        {field.type === 'textarea' ? (
                                            <textarea
                                                value={formData[field.key] || ''}
                                                onChange={e => onChange(field.key, e.target.value)}
                                                placeholder={field.placeholder}
                                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${errors[field.key] ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
                                                rows={4}
                                            />
                                        ) : field.type === 'dropdown' ? (
                                            <select
                                                value={formData[field.key] || ''}
                                                onChange={e => onChange(field.key, e.target.value)}
                                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition bg-white ${errors[field.key] ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
                                            >
                                                <option value="">Select {field.label}</option>
                                                {field.options && field.options.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        ) : field.type === 'checkbox' ? (
                                            <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                                                <input
                                                    type="checkbox"
                                                    checked={!!formData[field.key]}
                                                    onChange={e => onChange(field.key, e.target.checked)}
                                                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                                />
                                                <span className="text-slate-700">{field.placeholder || field.label}</span>
                                            </label>
                                        ) : (
                                            <input
                                                type={field.type}
                                                value={formData[field.key] || ''}
                                                onChange={e => onChange(field.key, e.target.value)}
                                                placeholder={field.placeholder}
                                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${errors[field.key] ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
                                            />
                                        )}

                                        {errors[field.key] && (
                                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                {errors[field.key]}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                </div>
            ))}
        </div>
    );
}
