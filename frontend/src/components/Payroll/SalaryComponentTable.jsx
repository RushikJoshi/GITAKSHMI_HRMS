import React from 'react';
import { MoreVertical, Edit2, Eye, CheckCircle, XCircle, Trash2 } from 'lucide-react';

export default function SalaryComponentTable({
    data = [],
    onEdit,
    onToggleStatus,
    onDelete
}) {
    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-xs tracking-wider">
                        <tr>
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4">
                                {data[0]?.category === 'Template' ? 'Annual CTC / Monthly' : 'Calculation / Frequency'}
                            </th>
                            {data[0]?.category !== 'Template' && (
                                <>
                                    <th className="px-6 py-4 text-center">PF Consideration</th>
                                    <th className="px-6 py-4 text-center">ESI Consideration</th>
                                </>
                            )}
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <p className="font-medium">No components found</p>
                                        <p className="text-xs">Add a new component to get started.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            data.map((item) => (
                                <tr
                                    key={item.id}
                                    className="hover:bg-slate-50 transition-colors group"
                                >
                                    <td className="px-6 py-4 font-medium text-slate-900">
                                        {item.name}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                            {item.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">
                                        <div className="flex flex-col">
                                            {item.category === 'Template' ? (
                                                <>
                                                    <span className="font-bold text-slate-900">₹{item.annualCTC?.toLocaleString()} PA</span>
                                                    <span className="text-xs text-slate-400">₹{item.monthlyCTC?.toLocaleString()} PM</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>{item.calculationType}</span>
                                                    {item.frequency && (
                                                        <span className="text-xs text-slate-400">{item.frequency}</span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                    {item.category !== 'Template' && (
                                        <>
                                            <td className="px-6 py-4 text-center">
                                                {item.considerForPF ? (
                                                    <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {item.considerForESI ? (
                                                    <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </td>
                                        </>
                                    )}
                                    <td className="px-6 py-4">
                                        <span
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${item.status === 'Active'
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : 'bg-slate-100 text-slate-500'
                                                }`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => onEdit(item)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => onToggleStatus(item)}
                                                className={`p-1.5 rounded transition-colors ${item.status === 'Active'
                                                    ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                                    : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                                    }`}
                                                title={item.status === 'Active' ? 'Mark Inactive' : 'Mark Active'}
                                            >
                                                {item.status === 'Active' ? <XCircle size={16} /> : <CheckCircle size={16} />}
                                            </button>
                                            <button
                                                onClick={() => onDelete(item)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>

                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
