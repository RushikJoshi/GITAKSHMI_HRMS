import React, { useState, useEffect } from 'react';
import { Table, message, Select, Checkbox, Button, DatePicker, Tag, Tooltip } from 'antd';
import { PlayCircle, Calculator, FileText, AlertCircle, IndianRupee, Calendar } from 'lucide-react';
import api from '../../../utils/api';
import dayjs from 'dayjs';

const { Option } = Select;

const ProcessPayroll = () => {
    const [month, setMonth] = useState(dayjs());
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [calculating, setCalculating] = useState(false);
    const [previews, setPreviews] = useState({}); // { empId: { gross, net, error } }

    // Fetch Templates on Mount
    useEffect(() => {
        api.get('/payroll/salary-templates')
            .then(res => setTemplates(res.data?.data || []))
            .catch(err => console.error("Failed templates", err));
    }, []);

    // Fetch Employees when month changes
    useEffect(() => {
        if (!month) return;
        fetchEmployees();
        setPreviews({});
        setSelectedRowKeys([]);
    }, [month]);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const mStr = month.format('YYYY-MM');
            const res = await api.get(`/payroll/process/employees?month=${mStr}`);
            setEmployees(res.data.data.map(e => ({
                ...e,
                key: e._id,
                // Default to assigned template, or none
                selectedTemplateId: e.salaryTemplateId
            })));
        } catch (err) {
            message.error(err.response?.data?.message || "Failed to fetch employees");
        } finally {
            setLoading(false);
        }
    };

    const handleTemplateChange = (empId, val) => {
        setEmployees(prev => prev.map(e => e._id === empId ? { ...e, selectedTemplateId: val } : e));
        // Trigger preview recalculation for this employee? 
        // We can do it in bulk or single. Let's do single immediately or user clicks "Preview"
        // Let's clear preview for this employee to indicate stale data
        setPreviews(prev => {
            const next = { ...prev };
            delete next[empId];
            return next;
        });
    };

    const calculatePreview = async () => {
        const itemsToPreview = employees
            .filter(e => selectedRowKeys.includes(e._id))
            .filter(e => e.selectedTemplateId) // Only those with templates
            .map(e => ({ employeeId: e._id, salaryTemplateId: e.selectedTemplateId }));

        if (itemsToPreview.length === 0) {
            message.warning("Select employees with templates assigned to preview");
            return;
        }

        setCalculating(true);
        try {
            const res = await api.post('/payroll/process/preview', {
                month: month.format('YYYY-MM'),
                items: itemsToPreview
            });

            const newPreviews = {};
            res.data.data.forEach(p => {
                newPreviews[p.employeeId] = p;
            });
            setPreviews(newPreviews);
            message.success("Calculated successfully");
        } catch (err) {
            message.error("Calculation failed");
        } finally {
            setCalculating(false);
        }
    };

    const runPayroll = async () => {
        const itemsToProcess = employees
            .filter(e => selectedRowKeys.includes(e._id))
            .filter(e => e.selectedTemplateId)
            .map(e => ({ employeeId: e._id, salaryTemplateId: e.selectedTemplateId }));

        if (itemsToProcess.length === 0) {
            message.error("No valid employees selected");
            return;
        }

        if (!window.confirm(`Are you sure you want to run payroll for ${itemsToProcess.length} employees?`)) return;

        setLoading(true);
        try {
            const res = await api.post('/payroll/process/run', {
                month: month.format('YYYY-MM'),
                items: itemsToProcess
            });
            message.success("Payroll processed successfully!");
            // Maybe redirect to dashboard or results?
            fetchEmployees(); // Refresh status
        } catch (err) {
            message.error(err.response?.data?.message || "Run failed");
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: 'Employee',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => (
                <div>
                    <div className="font-medium text-slate-800">{text}</div>
                    <div className="text-xs text-slate-500">{record.department}</div>
                </div>
            )
        },
        {
            title: 'Attendance',
            key: 'attendance',
            render: (_, record) => (
                <div className="text-xs">
                    <div>Present: <span className="font-bold text-green-600">{record.attendanceParams?.presentDays}</span> / {record.attendanceParams?.totalDays}</div>
                    {record.attendanceParams?.presentDays === 0 && <Tag color="red" className="mt-1">High Absenteeism</Tag>}
                </div>
            )
        },
        {
            title: 'Salary Template',
            key: 'template',
            render: (_, record) => (
                <Select
                    className="w-48"
                    placeholder="Select Template"
                    value={record.selectedTemplateId}
                    onChange={(val) => handleTemplateChange(record._id, val)}
                    status={!record.selectedTemplateId ? 'error' : ''}
                >
                    {templates.map(t => (
                        <Option key={t._id} value={t._id}>{t.name} ({t.annualCTC})</Option>
                    ))}
                </Select>
            )
        },
        {
            title: 'Preview (Net Pay)',
            key: 'preview',
            render: (_, record) => {
                const prev = previews[record._id];
                if (!prev) return <span className="text-slate-400 italic">--</span>;
                if (prev.error) return <Tooltip title={prev.error}><AlertCircle className="w-4 h-4 text-red-500" /></Tooltip>;
                return <span className="font-mono font-bold text-emerald-700">₹{prev.net?.toLocaleString()}</span>;
            }
        },
        {
            title: 'Status',
            key: 'status',
            render: (_, record) => {
                if (!record.selectedTemplateId) return <Tag color="warning">Missing Template</Tag>;
                // Could add more status logic here
                return <Tag color="blue">Ready</Tag>;
            }
        }
    ];

    const rowSelection = {
        selectedRowKeys,
        onChange: (keys) => setSelectedRowKeys(keys),
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Calculator className="w-6 h-6 text-blue-600" />
                        Process Payroll
                    </h1>
                    <p className="text-sm text-slate-500">Calculate and generate payslips for a specific month.</p>
                </div>
                <div className="flex items-center gap-4">
                    <DatePicker
                        picker="month"
                        value={month}
                        onChange={setMonth}
                        format="MMMM YYYY"
                        allowClear={false}
                        className="w-48"
                    />
                </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-700">Employee List ({employees.length})</h3>
                    <div className="flex gap-2">
                        <Button
                            icon={<IndianRupee size={16} />}
                            onClick={calculatePreview}
                            loading={calculating}
                            disabled={selectedRowKeys.length === 0}
                        >
                            Calculate Preview
                        </Button>
                        <Button
                            type="primary"
                            icon={<PlayCircle size={16} />}
                            onClick={runPayroll}
                            loading={loading}
                            disabled={selectedRowKeys.length === 0}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            Run Payroll
                        </Button>
                    </div>
                </div>

                <Table
                    rowSelection={rowSelection}
                    columns={columns}
                    dataSource={employees}
                    loading={loading}
                    pagination={{ pageSize: 50 }}
                    size="middle"
                />
            </div>
        </div>
    );
};

export default ProcessPayroll;
