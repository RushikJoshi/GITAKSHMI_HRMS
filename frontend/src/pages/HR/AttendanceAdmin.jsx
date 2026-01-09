import React, { useState, useEffect } from 'react';
import { Pagination } from 'antd';
import api from '../../utils/api';
import {
    Search, Filter, Download,
    Settings, ShieldAlert,
    User, Clock, MapPin,
    MoreVertical, Edit2, Lock, X, Eye, ChevronLeft, ChevronRight, Upload
} from 'lucide-react';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import AttendanceSettings from './AttendanceSettings';
import AttendanceCalendar from '../../components/AttendanceCalendar';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';

export default function AttendanceAdmin() {
    const [view, setView] = useState('dashboard'); // dashboard, settings
    const [attendance, setAttendance] = useState([]);
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Register View for specific employee
    const [viewingEmployee, setViewingEmployee] = useState(null);
    const [employeeAttendance, setEmployeeAttendance] = useState([]);
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [holidays, setHolidays] = useState([]);
    const [settings, setSettings] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    // Edit Attendance Modal
    const [editingAttendance, setEditingAttendance] = useState(null);
    const [editForm, setEditForm] = useState({
        status: 'present',
        checkIn: '',
        checkOut: '',
        reason: ''
    });
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = React.useRef(null);

    useEffect(() => {
        if (view === 'dashboard') {
            fetchStats();
        }
    }, [view, date]);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/attendance/all?date=${date}`);
            setAttendance(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (viewingEmployee) fetchEmployeeRegister();
    }, [viewingEmployee, currentMonth, currentYear]);

    const fetchEmployeeRegister = async () => {
        try {
            const [attRes, holidayRes, settingsRes] = await Promise.all([
                api.get(`/attendance/my?employeeId=${viewingEmployee._id}&month=${currentMonth + 1}&year=${currentYear}`),
                api.get('/holidays'),
                api.get('/attendance/settings')
            ]);
            setEmployeeAttendance(attRes.data);
            setHolidays(holidayRes.data || []);
            setSettings(settingsRes.data || {});
        } catch (err) {
            console.error(err);
        }
    };

    const handleSaveEdit = async () => {
        if (!editForm.reason.trim()) {
            alert('Please provide a reason for the override');
            return;
        }

        try {
            setSaving(true);
            const payload = {
                employeeId: editingAttendance.employee._id || editingAttendance.employee,
                date: editingAttendance.date,
                status: editForm.status,
                reason: editForm.reason
            };

            if (editForm.checkIn) {
                payload.checkIn = new Date(editForm.checkIn).toISOString();
            }
            if (editForm.checkOut) {
                payload.checkOut = new Date(editForm.checkOut).toISOString();
            }

            await api.post('/attendance/override', payload);
            setEditingAttendance(null);
            fetchStats(); // Refresh the attendance list
            alert('Attendance updated successfully');
        } catch (err) {
            console.error('Failed to save attendance edit:', err);
            alert(err.response?.data?.error || 'Failed to save attendance');
        } finally {
            setSaving(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            setUploading(true);
            const res = await api.post('/attendance/upload-excel', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert(res.data.message);
            fetchStats();
        } catch (err) {
            console.error('Upload failed:', err);
            alert(err.response?.data?.error || 'Failed to upload attendance');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-8 p-6 md:p-8 animate-in fade-in duration-500">
            {/* Header / Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter uppercase">Attendance Control</h1>
                    <div className="flex gap-4 mt-4">
                        <TabButton active={view === 'dashboard'} onClick={() => setView('dashboard')} label="Live Dashboard" />
                        <TabButton active={view === 'settings'} onClick={() => setView('settings')} label="Policy Settings" />
                    </div>
                </div>

                {view === 'dashboard' && (
                    <div className="flex items-center gap-3">
                        <DatePicker
                            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-2xl text-sm font-bold uppercase outline-none shadow-sm h-[46px] w-[180px]"
                            format="DD-MM-YYYY"
                            placeholder="DD-MM-YYYY"
                            allowClear={false}
                            value={date ? dayjs(date) : null}
                            onChange={(d) => setDate(d ? d.format('YYYY-MM-DD') : '')}
                        />
                        <button
                            onClick={fetchStats}
                            disabled={loading}
                            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Syncing...
                                </>
                            ) : (
                                'Sync Logs'
                            )}
                        </button>

                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept=".xlsx, .xls"
                            onChange={handleFileUpload}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <Upload size={16} />
                            {uploading ? 'Uploading...' : 'Upload Excel'}
                        </button>
                    </div>
                )}
            </div>

            {view === 'dashboard' ? (
                <div className="space-y-8">
                    {/* Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <StatItem label="Active Count" value={attendance.length} color="text-slate-800" />
                        <StatItem label="Present" value={attendance.filter(a => a.status === 'present').length} color="text-emerald-500" />
                        <StatItem label="Absent" value={attendance.filter(a => a.status === 'absent').length} color="text-rose-500" />
                        <StatItem label="Late Comers" value={attendance.filter(a => a.isLate).length} color="text-amber-500" />
                    </div>

                    {/* Table */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">In/Out</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Hours</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Override</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                {attendance.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((item) => (
                                    <tr key={item._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 overflow-hidden shadow-inner font-black text-xs">
                                                    {item.employee?.firstName?.[0]}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tighter">{item.employee?.firstName} {item.employee?.lastName}</div>
                                                    <div className="text-[10px] font-bold text-slate-400">{item.employee?.employeeId}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusChip status={item.status} />
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-slate-400">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock size={12} className="text-emerald-500" />
                                                    {item.checkIn ? new Date(item.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Clock size={12} className="text-rose-500" />
                                                    {item.checkOut ? new Date(item.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-black text-slate-800 dark:text-white tracking-widest">
                                                {item.workingHours?.toFixed(1) || '0.0'} <span className="text-[10px] opacity-30">HRS</span>
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {item.isManualOverride ? (
                                                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-lg border border-amber-100 w-fit">
                                                    <ShieldAlert size={12} />
                                                    <span className="text-[9px] font-black uppercase">Modified</span>
                                                </div>
                                            ) : <span className="text-[10px] font-bold text-slate-300">-</span>}
                                        </td>
                                        <td className="px-6 py-4 text-right flex gap-1 justify-end">
                                            <button
                                                onClick={() => setViewingEmployee(item.employee)}
                                                className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-400 hover:text-blue-500 rounded-xl transition"
                                                title="View Register"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const dateStr = new Date(item.date).toISOString().split('T')[0];
                                                    setEditingAttendance(item);
                                                    setEditForm({
                                                        status: item.status || 'present',
                                                        checkIn: item.checkIn ? new Date(item.checkIn).toISOString().slice(0, 16) : '',
                                                        checkOut: item.checkOut ? new Date(item.checkOut).toISOString().slice(0, 16) : '',
                                                        reason: item.overrideReason || ''
                                                    });
                                                }}
                                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 group-hover:text-blue-500 transition-colors"
                                                title="Edit Attendance"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                            <Pagination
                                current={currentPage}
                                pageSize={pageSize}
                                total={attendance.length}
                                onChange={(page) => setCurrentPage(page)}
                                showSizeChanger={false}
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <AttendanceSettings />
            )}

            {/* Employee Register Modal (Reuse the same logic) */}
            {viewingEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setViewingEmployee(null)}></div>
                    <div className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-slate-50 dark:bg-slate-950 rounded-[40px] shadow-2xl border border-white/20 p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-300 font-black text-xl shadow-lg">
                                    {viewingEmployee.firstName[0]}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                                        {viewingEmployee.firstName} {viewingEmployee.lastName}'s Register
                                    </h3>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{viewingEmployee.employeeId}</p>
                                </div>
                            </div>
                            <button onClick={() => setViewingEmployee(null)} className="p-3 bg-white dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-rose-500 shadow-lg transition">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-3 rounded-2xl w-fit border border-slate-100 dark:border-slate-800 shadow-sm">
                                <button onClick={() => setCurrentMonth(m => m === 0 ? 11 : m - 1)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition"><ChevronLeft size={20} /></button>
                                <span className="text-sm font-black uppercase tracking-widest min-w-[120px] text-center">
                                    {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                                </span>
                                <button onClick={() => setCurrentMonth(m => m === 11 ? 0 : m + 1)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition"><ChevronRight size={20} /></button>
                            </div>

                            <AttendanceCalendar
                                data={employeeAttendance}
                                holidays={holidays}
                                settings={settings}
                                currentMonth={currentMonth}
                                currentYear={currentYear}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Attendance Modal */}
            {editingAttendance && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditingAttendance(null)}></div>
                    <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                                    Edit Attendance
                                </h3>
                                <p className="text-xs font-bold text-slate-400 mt-1">
                                    {editingAttendance.employee?.firstName} {editingAttendance.employee?.lastName} - {formatDateDDMMYYYY(editingAttendance.date)}
                                </p>
                            </div>
                            <button
                                onClick={() => setEditingAttendance(null)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-rose-500 transition"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Status *
                                </label>
                                <select
                                    value={editForm.status}
                                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition"
                                >
                                    <option value="present">Present</option>
                                    <option value="absent">Absent</option>
                                    <option value="half_day">Half Day</option>
                                    <option value="leave">Leave</option>
                                    <option value="missed_punch">Missed Punch</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Check In Time
                                </label>
                                <input
                                    type="datetime-local"
                                    value={editForm.checkIn}
                                    onChange={(e) => setEditForm({ ...editForm, checkIn: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Check Out Time
                                </label>
                                <input
                                    type="datetime-local"
                                    value={editForm.checkOut}
                                    onChange={(e) => setEditForm({ ...editForm, checkOut: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Reason for Override *
                                </label>
                                <textarea
                                    value={editForm.reason}
                                    onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition resize-none"
                                    rows="3"
                                    placeholder="Enter reason for manual override..."
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setEditingAttendance(null)}
                                disabled={saving}
                                className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={saving || !editForm.reason.trim()}
                                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Saving...
                                    </>
                                ) : (
                                    'Save Changes'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatItem({ label, value, color }) {
    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/30 dark:shadow-none">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
            <div className={`text-4xl font-black ${color} tracking-tighter`}>{value}</div>
        </div>
    );
}

function StatusChip({ status }) {
    const config = {
        present: 'text-emerald-500 bg-emerald-50 border-emerald-100',
        absent: 'text-rose-500 bg-rose-50 border-rose-100',
        leave: 'text-blue-500 bg-blue-50 border-blue-100',
        holiday: 'text-amber-500 bg-amber-50 border-amber-100',
        weekly_off: 'text-slate-400 bg-slate-50 border-slate-200',
    };
    return (
        <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${config[status.toLowerCase()] || 'bg-slate-50 text-slate-300'}`}>
            {status}
        </span>
    );
}

function TabButton({ active, label, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300
                ${active
                    ? 'bg-slate-800 text-white shadow-lg'
                    : 'bg-white dark:bg-slate-900 text-slate-400 border border-slate-100 dark:border-slate-800 hover:bg-slate-50'}
            `}
        >
            {label}
        </button>
    );
}
