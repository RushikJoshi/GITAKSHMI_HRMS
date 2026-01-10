import React, { useState } from 'react';
import { Tabs, Tag, Button } from 'antd';
import {
    User, Briefcase, FileText, MapPin,
    Calendar, Mail, Phone, Shield,
    GraduationCap, Landmark, Printer,
    CreditCard, Heart, Globe, Users
} from 'lucide-react';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://hrms.gitakshmi.com';

const InfoGroup = ({ title, children, icon: Icon }) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            {Icon && <Icon size={18} className="text-blue-600" />}
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">{title}</h3>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {children}
        </div>
    </div>
);

const DetailItem = ({ label, value, icon: Icon }) => (
    <div className="group">
        <div className="flex items-center gap-1.5 mb-1">
            {Icon && <Icon size={14} className="text-slate-400" />}
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        </div>
        <div className="text-sm font-semibold text-slate-800 break-words pl-0 md:pl-0">
            {value || <span className="text-slate-300 font-normal italic">Not Provided</span>}
        </div>
    </div>
);

const FileDownloadLink = ({ url, label }) => {
    if (!url) return (
        <div className="flex items-center gap-2 text-slate-400 text-xs italic py-2 border border-slate-100 border-dashed rounded-lg px-3">
            <FileText size={14} /> {label}: Not uploaded
        </div>
    );
    return (
        <a
            href={`${BACKEND_URL}${url}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-3 text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-600 px-3 py-2.5 rounded-lg transition-all border border-blue-100 hover:border-blue-600 group"
        >
            <div className="flex items-center gap-2 overflow-hidden">
                <FileText size={16} className="text-blue-600 group-hover:text-white shrink-0" />
                <span className="text-xs font-bold truncate">{label}</span>
            </div>
            <div className="shrink-0 opacity-50 group-hover:opacity-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </div>
        </a>
    );
};

export default function EmployeeProfileView({ employee, profile }) {
    const [activeTab, setActiveTab] = useState('1');
    const emp = employee || profile;

    if (!emp) return (
        <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <User size={48} className="mb-4 opacity-20" />
            <p className="font-bold uppercase tracking-widest text-xs">No employee record found</p>
        </div>
    );

    const items = [
        {
            key: '1',
            label: <span className="flex items-center gap-2 px-2"><User size={16} /> Personal</span>,
            children: (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <InfoGroup title="Identity & Personal" icon={User}>
                        <DetailItem label="Full Name" value={`${emp.firstName} ${emp.middleName ? emp.middleName + ' ' : ''}${emp.lastName}`} icon={User} />
                        <DetailItem label="Date of Birth" value={formatDateDDMMYYYY(emp.dob)} icon={Calendar} />
                        <DetailItem label="Gender" value={emp.gender} icon={Users} />
                        <DetailItem label="Blood Group" value={emp.bloodGroup} icon={Heart} />
                        <DetailItem label="Marital Status" value={emp.maritalStatus} icon={Users} />
                        <DetailItem label="Nationality" value={emp.nationality} icon={Globe} />
                    </InfoGroup>

                    <InfoGroup title="Family Details" icon={Users}>
                        <DetailItem label="Father's Name" value={emp.fatherName} />
                        <DetailItem label="Mother's Name" value={emp.motherName} />
                        <DetailItem label="Emergency Contact" value={emp.emergencyContactName} />
                        <DetailItem label="Emergency No." value={emp.emergencyContactNumber} />
                    </InfoGroup>

                    <InfoGroup title="Address Information" icon={MapPin}>
                        <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Temporary Address
                                </h4>
                                <p className="text-sm text-slate-700 leading-relaxed font-medium">
                                    {emp.tempAddress?.line1}, {emp.tempAddress?.line2 && emp.tempAddress?.line2 + ', '}<br />
                                    {emp.tempAddress?.city}, {emp.tempAddress?.state} - {emp.tempAddress?.pinCode}<br />
                                    {emp.tempAddress?.country}
                                </p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Permanent Address
                                </h4>
                                <p className="text-sm text-slate-700 leading-relaxed font-medium">
                                    {emp.permAddress?.line1}, {emp.permAddress?.line2 && emp.permAddress?.line2 + ', '}<br />
                                    {emp.permAddress?.city}, {emp.permAddress?.state} - {emp.permAddress?.pinCode}<br />
                                    {emp.permAddress?.country}
                                </p>
                            </div>
                        </div>
                    </InfoGroup>
                </div>
            )
        },
        {
            key: '2',
            label: <span className="flex items-center gap-2 px-2"><Briefcase size={16} /> Employment</span>,
            children: (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <InfoGroup title="Organization Details" icon={Shield}>
                        <DetailItem label="Employee ID" value={emp.employeeId} icon={Shield} />
                        <DetailItem label="Joining Date" value={formatDateDDMMYYYY(emp.joiningDate)} icon={Calendar} />
                        <DetailItem label="Designation" value={emp.role} icon={Briefcase} />
                        <DetailItem label="Department" value={emp.department} icon={Globe} />
                        <DetailItem label="Job Type" value={emp.jobType} icon={Briefcase} />
                        <DetailItem label="Reporting Manager" value={
                            emp.manager
                                ? (typeof emp.manager === 'object' ? `${emp.manager.firstName} ${emp.manager.lastName}` : 'Assigned')
                                : 'Top Level'
                        } icon={Users} />
                    </InfoGroup>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                            <Briefcase size={18} className="text-blue-600" />
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Experience History</h3>
                        </div>
                        <div className="p-6">
                            {emp.experience && emp.experience.length > 0 ? (
                                <div className="space-y-6">
                                    {emp.experience.map((exp, idx) => (
                                        <div key={idx} className="relative pl-8 border-l-2 border-slate-100 last:border-0 pb-4">
                                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-blue-600 shadow-sm z-10"></div>
                                            <div className="flex flex-col sm:flex-row sm:justify-between items-start mb-3">
                                                <div>
                                                    <h4 className="text-base font-bold text-slate-900">{exp.companyName}</h4>
                                                    <p className="text-blue-600 text-xs font-bold uppercase tracking-tight">{exp.designation}</p>
                                                </div>
                                                <div className="mt-2 sm:mt-0 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black tracking-widest uppercase">
                                                    {formatDateDDMMYYYY(exp.from)} - {formatDateDDMMYYYY(exp.to)}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100/50">
                                                <DetailItem label="Last Salary" value={exp.lastDrawnSalary} />
                                                <DetailItem label="Mgr Name" value={exp.reportingPersonName} />
                                                <DetailItem label="Mgr Contact" value={exp.reportingPersonContact} />
                                                {/* Payslips if any */}
                                                {exp.payslips && exp.payslips.length > 0 && (
                                                    <div className="col-span-full pt-2 flex flex-wrap gap-2">
                                                        {exp.payslips.map((p, i) => (
                                                            <a key={i} href={`${BACKEND_URL}${p}`} target="_blank" rel="noreferrer" className="text-[10px] bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded-md hover:border-blue-500 hover:text-blue-600 transition flex items-center gap-1.5">
                                                                <FileText size={12} /> Payslip {i + 1}
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center py-6 text-slate-400 text-sm italic">No prior experience records.</p>
                            )}
                        </div>
                    </div>
                </div>
            )
        },
        {
            key: '3',
            label: <span className="flex items-center gap-2 px-2"><GraduationCap size={16} /> Education</span>,
            children: (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <InfoGroup title="Academic Background" icon={GraduationCap}>
                        <div className="col-span-full">
                            <Tag color="blue" className="mb-6 font-bold uppercase tracking-widest text-[10px] px-3 py-1">
                                {emp.education?.type || 'Standard'} Qualification
                            </Tag>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <FileDownloadLink url={emp.education?.class10Marksheet} label="10th Marksheet" />
                                {emp.education?.type === 'Bachelor' ? (
                                    <>
                                        <FileDownloadLink url={emp.education?.class12Marksheet} label="12th Marksheet" />
                                        <FileDownloadLink url={emp.education?.bachelorDegree} label="Bachelor Degree" />
                                        <FileDownloadLink url={emp.education?.masterDegree} label="Master Degree" />
                                    </>
                                ) : (
                                    <>
                                        <FileDownloadLink url={emp.education?.diplomaCertificate} label="Diploma Certificate" />
                                        <FileDownloadLink url={emp.education?.lastSem1Marksheet} label="Sem 1 Marksheet" />
                                        <FileDownloadLink url={emp.education?.lastSem2Marksheet} label="Sem 2 Marksheet" />
                                        <FileDownloadLink url={emp.education?.lastSem3Marksheet} label="Sem 3 Marksheet" />
                                    </>
                                )}
                            </div>
                        </div>
                    </InfoGroup>
                </div>
            )
        },
        {
            key: '4',
            label: <span className="flex items-center gap-2 px-2"><Shield size={16} /> Docs & Bank</span>,
            children: (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <InfoGroup title="Financial Information" icon={Landmark}>
                        <DetailItem label="Bank Name" value={emp.bankDetails?.bankName} icon={Landmark} />
                        <DetailItem label="Account Number" value={emp.bankDetails?.accountNumber} icon={CreditCard} />
                        <DetailItem label="IFSC Code" value={emp.bankDetails?.ifsc} />
                        <DetailItem label="Branch Name" value={emp.bankDetails?.branchName} />
                        <div className="col-span-full mt-2">
                            <FileDownloadLink url={emp.bankDetails?.bankProofUrl} label="Bank Proof (Passbook/Cheque)" />
                        </div>
                    </InfoGroup>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                            <Shield size={18} className="text-blue-600" />
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Identity Documents</h3>
                        </div>
                        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Aadhar Verification</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <FileDownloadLink url={emp.documents?.aadharFront} label="Aadhar Front" />
                                    <FileDownloadLink url={emp.documents?.aadharBack} label="Aadhar Back" />
                                </div>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tax Identification</h4>
                                <FileDownloadLink url={emp.documents?.panCard} label="PAN Card" />
                            </div>
                        </div>
                    </div>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <style>{`
                .ant-tabs-nav-wrap { padding: 0 1rem; }
                .ant-tabs-tab { padding: 12px 0 !important; margin: 0 16px !important; }
                .ant-tabs-tab-active .ant-tabs-tab-btn { color: #2563eb !important; font-weight: 800 !important; }
                .ant-tabs-ink-bar { background: #2563eb !important; height: 3px !important; border-radius: 3px 3px 0 0; }
                
                @media print {
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    body { background: white !important; font-size: 10pt !important; }
                    .bg-white { box-shadow: none !important; border: 1px solid #eee !important; }
                    .bg-slate-50\/50, .bg-slate-50 { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; }
                    .ant-tabs-nav { display: none !important; }
                    .ant-tabs-content-holder { display: block !important; }
                    .print-section { page-break-inside: avoid; margin-bottom: 2rem; }
                }
                .print-only { display: none; }
            `}</style>

            {/* 1. PREMIUM HEADER */}
            <div className="relative overflow-hidden bg-slate-900 rounded-[2rem] shadow-2xl shadow-blue-900/10 p-1 group">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2"></div>

                <div className="relative bg-white dark:bg-slate-900 rounded-[1.8rem] p-6 sm:p-8 flex flex-col md:flex-row gap-8 items-center md:items-start transition-all duration-500">
                    {/* Avatar Section */}
                    <div className="relative shrink-0">
                        <div className="w-36 h-36 rounded-3xl overflow-hidden bg-slate-100 border-4 border-white dark:border-slate-800 shadow-xl relative group">
                            {emp.profilePic ? (
                                <img src={`${BACKEND_URL}${emp.profilePic}`} alt="Profile" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-5xl font-black text-slate-300 bg-slate-50 uppercase tracking-tighter">
                                    {emp.firstName?.[0]}{emp.lastName?.[0]}
                                </div>
                            )}
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-emerald-500 border-4 border-white dark:border-slate-800 w-8 h-8 rounded-full shadow-lg" title="Active Account"></div>
                    </div>

                    {/* Meta Section */}
                    <div className="flex-1 w-full text-center md:text-left">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                            <div>
                                <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tighter mb-2">
                                    {emp.firstName} {emp.lastName}
                                </h1>
                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                    <span className="text-blue-600 font-black uppercase tracking-widest text-[10px] bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                                        {emp.role}
                                    </span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                    <span className="text-slate-500 font-bold text-sm">
                                        {emp.department} Unit
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-2 mx-auto md:mx-0">
                                <Tag color={emp.status === 'Active' ? 'success' : 'warning'} className="font-black uppercase tracking-widest text-[10px] m-0 px-4 py-1.5 rounded-full shadow-sm">
                                    {emp.status}
                                </Tag>
                                <Button
                                    icon={<Printer size={14} />}
                                    onClick={() => window.print()}
                                    className="no-print rounded-full font-black uppercase tracking-widest text-[10px] h-9 border-slate-200"
                                >
                                    Print
                                </Button>
                            </div>
                        </div>

                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 dark:border-slate-800 pt-6">
                            <div className="flex items-center gap-3 px-2">
                                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                                    <Mail size={18} />
                                </div>
                                <div className="text-left overflow-hidden">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</p>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate" title={emp.email}>{emp.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 px-2">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
                                    <Phone size={18} />
                                </div>
                                <div className="text-left">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact No</p>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{emp.contactNo || emp.phone || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 px-2">
                                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600">
                                    <Shield size={18} />
                                </div>
                                <div className="text-left">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Code</p>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{emp.employeeId}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. TABBED CONTENT */}
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden no-print">
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={items}
                    className="p-2 ant-tabs-modern"
                />
            </div>

            {/* 3. PRINT ONLY VIEW (Full dump) */}
            <div className="print-only">
                <h2 className="text-xl font-bold uppercase mb-8 border-b-4 border-slate-900 pb-2">Employee Master Record</h2>
                {items.map(item => (
                    <div key={item.key} className="print-section">
                        {item.children}
                    </div>
                ))}
            </div>
        </div>
    );
}
