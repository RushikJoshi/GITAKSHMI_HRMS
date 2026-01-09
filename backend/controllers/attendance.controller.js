const mongoose = require('mongoose');
const XLSX = require('xlsx');
const AttendanceSchema = require('../models/Attendance');
const AttendanceSettingsSchema = require('../models/AttendanceSettings');
const EmployeeSchema = require('../models/Employee');
const HolidaySchema = require('../models/Holiday');
const LeaveRequestSchema = require('../models/LeaveRequest');
const AuditLogSchema = require('../models/AuditLog');

const getModels = (req) => {
    const db = req.tenantDB;
    if (!db) throw new Error("Tenant database connection not available");
    return {
        Attendance: db.model('Attendance', AttendanceSchema),
        AttendanceSettings: db.model('AttendanceSettings', AttendanceSettingsSchema),
        Employee: db.model('Employee', EmployeeSchema),
        Holiday: db.model('Holiday', HolidaySchema),
        LeaveRequest: db.model('LeaveRequest', LeaveRequestSchema),
        AuditLog: db.model('AuditLog', AuditLogSchema)
    };
};

const calculateWorkingHours = (logs = []) => {
    if (logs.length < 2) return 0;

    let totalMinutes = 0;
    let inTime = null;

    for (const log of logs) {
        if (log.type === 'IN') {
            inTime = new Date(log.time);
        } else if (log.type === 'OUT' && inTime) {
            const outTime = new Date(log.time);
            const duration = (outTime - inTime) / (1000 * 60); // Duration in minutes
            totalMinutes += duration;
            inTime = null;
        }
    }

    return parseFloat((totalMinutes / 60).toFixed(2));
};

// Helper: Validate Geo-fencing
const validateGeoFencing = (latitude, longitude, settings) => {
    if (!settings.geoFencingEnabled || !settings.officeLatitude || !settings.officeLongitude) {
        return { valid: true };
    }

    if (!latitude || !longitude) {
        return { valid: false, error: 'Location data required for geo-fencing' };
    }

    // Haversine formula to calculate distance
    const R = 6371e3; // Earth radius in meters
    const φ1 = settings.officeLatitude * Math.PI / 180;
    const φ2 = latitude * Math.PI / 180;
    const Δφ = (latitude - settings.officeLatitude) * Math.PI / 180;
    const Δλ = (longitude - settings.officeLongitude) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in meters

    const allowedRadius = settings.allowedRadiusMeters || 100;

    if (distance > allowedRadius) {
        return {
            valid: false,
            error: `Punch outside allowed radius. Distance: ${Math.round(distance)}m, Allowed: ${allowedRadius}m`
        };
    }

    return { valid: true, distance: Math.round(distance) };
};

// Helper: Validate IP Address
const validateIPAddress = (ipAddress, settings) => {
    if (!settings.ipRestrictionEnabled || !settings.allowedIPs || settings.allowedIPs.length === 0) {
        return { valid: true };
    }

    if (!ipAddress) {
        return { valid: false, error: 'IP address required for IP restriction' };
    }

    // Check if IP is in allowed list
    const isAllowed = settings.allowedIPs.some(allowedIP => {
        // Support CIDR notation (e.g., "192.168.1.0/24")
        if (allowedIP.includes('/')) {
            const [network, prefixLength] = allowedIP.split('/');
            return isIPInCIDR(ipAddress, network, parseInt(prefixLength));
        }
        // Exact match
        return ipAddress === allowedIP;
    });

    // Also check IP ranges if defined
    if (!isAllowed && settings.allowedIPRanges && settings.allowedIPRanges.length > 0) {
        const inRange = settings.allowedIPRanges.some(range => {
            if (range.includes('/')) {
                const [network, prefixLength] = range.split('/');
                return isIPInCIDR(ipAddress, network, parseInt(prefixLength));
            }
            return ipAddress.startsWith(range);
        });

        if (inRange) {
            return { valid: true };
        }
    }

    if (!isAllowed) {
        return { valid: false, error: `IP address ${ipAddress} not in allowed list` };
    }

    return { valid: true };
};

// Helper: Check if IP is in CIDR range
const isIPInCIDR = (ip, network, prefixLength) => {
    const ipNum = ipToNumber(ip);
    const networkNum = ipToNumber(network);
    const mask = (0xFFFFFFFF << (32 - prefixLength)) >>> 0;
    return (ipNum & mask) === (networkNum & mask);
};

// Helper: Convert IP to number
const ipToNumber = (ip) => {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
};

// Helper: Get client IP address
const getClientIP = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] ||
        req.headers['x-real-ip'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        'unknown';
};

// Helper: Calculate Overtime Hours
const calculateOvertimeHours = (workingHours, shiftStartTime, shiftEndTime, overtimeAfterShiftHours = true) => {
    if (!overtimeAfterShiftHours) return Math.max(0, workingHours - 8); // Default 8 hours standard

    // Calculate shift duration
    const [startHour, startMin] = shiftStartTime.split(':').map(Number);
    const [endHour, endMin] = shiftEndTime.split(':').map(Number);
    const shiftDuration = ((endHour * 60 + endMin) - (startHour * 60 + startMin)) / 60;

    return Math.max(0, workingHours - shiftDuration);
};

// 1. PUNCH IN / OUT (DYNAMIC) - With Policy Validation
exports.punch = async (req, res) => {
    try {
        const { Attendance, AttendanceSettings, AuditLog } = getModels(req);
        const employeeId = req.user.id;
        const tenantId = req.tenantId;
        const now = new Date();

        // Prefer client-provided local date to ensure alignment with dashboard
        let today;
        if (req.body.dateStr) {
            const [y, m, d] = req.body.dateStr.split('-').map(Number);
            today = new Date(y, m - 1, d);
            today.setHours(0, 0, 0, 0);
        } else {
            today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            today.setHours(0, 0, 0, 0);
        }

        let settings = await AttendanceSettings.findOne({ tenant: tenantId });
        if (!settings) {
            settings = new AttendanceSettings({ tenant: tenantId });
            await settings.save();
        }

        // ========== LOCATION VALIDATION ==========
        const clientIP = getClientIP(req);
        const { latitude, longitude } = req.body;

        // Geo-fencing validation
        if (settings.locationRestrictionMode === 'geo' || settings.locationRestrictionMode === 'both') {
            const geoValidation = validateGeoFencing(latitude, longitude, settings);
            if (!geoValidation.valid) {
                // Log violation
                const violationLog = new AuditLog({
                    tenant: tenantId,
                    entity: 'Attendance',
                    entityId: employeeId,
                    action: 'PUNCH_GEO_VIOLATION',
                    performedBy: employeeId,
                    changes: { before: null, after: { latitude, longitude, error: geoValidation.error } },
                    meta: { ip: clientIP, employeeId }
                });
                await violationLog.save();

                return res.status(403).json({
                    error: geoValidation.error,
                    code: 'GEO_FENCING_VIOLATION'
                });
            }
        }

        // IP restriction validation
        if (settings.locationRestrictionMode === 'ip' || settings.locationRestrictionMode === 'both') {
            const ipValidation = validateIPAddress(clientIP, settings);
            if (!ipValidation.valid) {
                // Log violation
                const violationLog = new AuditLog({
                    tenant: tenantId,
                    entity: 'Attendance',
                    entityId: employeeId,
                    action: 'PUNCH_IP_VIOLATION',
                    performedBy: employeeId,
                    changes: { before: null, after: { ip: clientIP, error: ipValidation.error } },
                    meta: { employeeId }
                });
                await violationLog.save();

                return res.status(403).json({
                    error: ipValidation.error,
                    code: 'IP_RESTRICTION_VIOLATION'
                });
            }
        }

        let attendance = await Attendance.findOne({
            employee: employeeId,
            tenant: tenantId,
            date: today
        });

        // ========== PUNCH MODE VALIDATION ==========
        if (!attendance) {
            // First punch of the day → Must be IN
            const [h, m] = settings.shiftStartTime.split(':').map(Number);
            const shiftStart = new Date(today);
            shiftStart.setHours(h, m, 0, 0);

            // isLate is true only if they cross the Grace + Late Mark Threshold? 
            // Usually: 
            // - Grace Time: 15 mins (Allowed late without marking 'Late')
            // - Late Mark Threshold: 30 mins (If after THIS, definitely 'Late')
            const lateThreshold = new Date(shiftStart.getTime() + (settings.lateMarkThresholdMinutes || settings.graceTimeMinutes || 0) * 60000);
            const isLate = now > lateThreshold;

            attendance = new Attendance({
                tenant: tenantId,
                employee: employeeId,
                date: today,
                checkIn: now,
                status: 'present', // Placeholder, will be re-evaluated on OUT
                isLate,
                logs: [{
                    time: now,
                    type: 'IN',
                    location: req.body.location || 'Remote',
                    device: req.body.device || 'Unknown',
                    ip: clientIP
                }]
            });
            await attendance.save();
            return res.json({ message: "Punched In", data: attendance });
        }

        // Attendance exists - determine next punch type
        const lastLog = attendance.logs[attendance.logs.length - 1];
        const nextPunchType = (lastLog && lastLog.type === 'IN') ? 'OUT' : 'IN';

        // ========== SINGLE PUNCH MODE VALIDATION ==========
        if (settings.punchMode === 'single') {
            if (nextPunchType === 'IN' && attendance.checkIn) {
                return res.status(400).json({
                    error: 'Single punch mode: Only one punch in allowed per day',
                    code: 'SINGLE_PUNCH_MODE_VIOLATION'
                });
            }
            if (nextPunchType === 'OUT' && attendance.checkOut) {
                return res.status(400).json({
                    error: 'Single punch mode: You have already completed your shift for today.',
                    code: 'SINGLE_PUNCH_MODE_VIOLATION'
                });
            }
        }

        // ========== MAX PUNCH LIMIT VALIDATION ==========
        if (settings.punchMode === 'multiple') {
            const currentPunchCount = attendance.logs.length;
            if (currentPunchCount >= settings.maxPunchesPerDay) {
                if (settings.maxPunchAction === 'block') {
                    return res.status(400).json({
                        error: `Maximum punch limit reached (${settings.maxPunchesPerDay}). Contact HR for manual override.`,
                        code: 'MAX_PUNCH_LIMIT_EXCEEDED'
                    });
                }
            }
        }

        // ========== EARLY OUT VALIDATION (On OUT punch) ==========
        let isEarlyOut = attendance.isEarlyOut;
        if (nextPunchType === 'OUT') {
            const [eH, eM] = settings.shiftEndTime.split(':').map(Number);
            const shiftEnd = new Date(today);
            shiftEnd.setHours(eH, eM, 0, 0);
            isEarlyOut = now < shiftEnd;
        }

        // Add new punch log
        attendance.logs.push({
            time: now,
            type: nextPunchType,
            location: req.body.location || 'Remote',
            device: req.body.device || 'Unknown',
            ip: clientIP
        });

        // Update timestamps
        if (nextPunchType === 'IN') {
            // Keep the first checkIn of the day
            if (!attendance.checkIn) attendance.checkIn = now;
        } else {
            // Always update checkOut with the latest OUT time
            attendance.checkOut = now;
            attendance.isEarlyOut = isEarlyOut;
        }

        // ========== CALCULATE WORKING HOURS ==========
        // Always sum logs to avoid issues with multiple punches
        attendance.workingHours = calculateWorkingHours(attendance.logs);

        // ========== OVERTIME ==========
        if (settings.overtimeAllowed && attendance.workingHours > 0) {
            attendance.overtimeHours = calculateOvertimeHours(
                attendance.workingHours,
                settings.shiftStartTime,
                settings.shiftEndTime,
                settings.overtimeAfterShiftHours
            );
        }

        // ========== RE-EVALUATE STATUS (Policy Thresholds) ==========
        let newStatus = attendance.status;

        // Skip re-evaluation if it's already a special status like leave/holiday manually set
        if (!['leave', 'holiday', 'weekly_off'].includes(attendance.status)) {
            if (attendance.workingHours >= settings.fullDayThresholdHours) {
                newStatus = 'present';
            } else if (attendance.workingHours >= settings.halfDayThresholdHours) {
                newStatus = 'half_day';
            } else {
                // If they haven't worked enough yet, they are technically 'absent' or 'present' (until shift end)
                // For better UX, if shift is still ongoing, we can keep it as 'present' label
                newStatus = attendance.workingHours > 0 ? 'half_day' : 'present';
                // Actually, let's follow the threshold strictly for final result
                if (nextPunchType === 'OUT') {
                    if (attendance.workingHours < settings.halfDayThresholdHours) {
                        newStatus = 'absent';
                    }
                }
            }
        }

        attendance.status = newStatus;
        await attendance.save();

        res.json({
            message: `Successfully Punched ${nextPunchType}`,
            data: attendance,
            policy: {
                punchMode: settings.punchMode,
                isLate: attendance.isLate,
                isEarlyOut: attendance.isEarlyOut,
                workingHours: attendance.workingHours
            }
        });

    } catch (error) {
        console.error("Punch error:", error);
        res.status(500).json({ error: error.message });
    }
};

// 2. GET MY ATTENDANCE (Employee View)
exports.getMyAttendance = async (req, res) => {
    try {
        const { Attendance, Employee } = getModels(req);
        const { month, year, employeeId } = req.query;

        // Target Employee: either the self or requested ID (RBAC check)
        let targetId = req.user.id;

        if (employeeId && employeeId !== req.user.id) {
            // If requesting someone else, must be Manager or HR
            if (req.user.role === 'hr') {
                targetId = employeeId;
            } else if (req.user.role === 'manager') {
                // Verify if target reports to this manager
                const isReport = await Employee.findOne({ _id: employeeId, manager: req.user.id, tenant: req.tenantId });
                if (!isReport) return res.status(403).json({ error: "Unauthorized access to employee data" });
                targetId = employeeId;
            } else {
                return res.status(403).json({ error: "Access denied" });
            }
        }

        const filter = {
            employee: targetId,
            tenant: req.tenantId
        };

        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            filter.date = { $gte: startDate, $lte: endDate };
        }

        const data = await Attendance.find(filter).sort({ date: 1 }); // Sorted by date ASC for calendar flow
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 3. GET TEAM ATTENDANCE (Manager View)
exports.getTeamAttendance = async (req, res) => {
    try {
        const { Attendance, Employee } = getModels(req);
        const managerId = req.user.id;

        // Find direct reports
        const reports = await Employee.find({ manager: managerId, tenant: req.tenantId }).select('_id');
        const reportIds = reports.map(r => r._id);

        const { date } = req.query;
        const queryDate = date ? new Date(date) : new Date();
        const start = new Date(queryDate.setHours(0, 0, 0, 0));
        const end = new Date(queryDate.setHours(23, 59, 59, 999));

        const data = await Attendance.find({
            employee: { $in: reportIds },
            tenant: req.tenantId,
            date: { $gte: start, $lte: end }
        }).populate('employee', 'firstName lastName employeeId profilePic');

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 4. GET ALL ATTENDANCE (HR View)
exports.getAllAttendance = async (req, res) => {
    try {
        const { Attendance } = getModels(req);
        const { date, departmentId } = req.query;

        let query = { tenant: req.tenantId };
        if (date) {
            const d = new Date(date);
            query.date = { $gte: new Date(d.setHours(0, 0, 0, 0)), $lte: new Date(d.setHours(23, 59, 59, 999)) };
        }

        const data = await Attendance.find(query)
            .populate('employee', 'firstName lastName employeeId departmentId')
            .sort({ date: -1 });

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 5. ATTENDANCE SETTINGS (HR)
exports.getSettings = async (req, res) => {
    try {
        const { AttendanceSettings } = getModels(req);
        let settings = await AttendanceSettings.findOne({ tenant: req.tenantId });
        if (!settings) {
            settings = new AttendanceSettings({ tenant: req.tenantId });
            await settings.save();
        }
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const { AttendanceSettings, AuditLog } = getModels(req);

        // Get existing settings for audit log
        const existingSettings = await AttendanceSettings.findOne({ tenant: req.tenantId });
        const before = existingSettings ? existingSettings.toObject() : null;

        // Filter out empty IP addresses
        const updateData = { ...req.body, updatedBy: req.user.id };
        if (updateData.allowedIPs) {
            updateData.allowedIPs = updateData.allowedIPs.filter(ip => ip && ip.trim() !== '');
        }
        if (updateData.allowedIPRanges) {
            updateData.allowedIPRanges = updateData.allowedIPRanges.filter(range => range && range.trim() !== '');
        }

        const settings = await AttendanceSettings.findOneAndUpdate(
            { tenant: req.tenantId },
            updateData,
            { new: true, upsert: true }
        );

        // Audit log the settings update
        const auditLog = new AuditLog({
            tenant: req.tenantId,
            entity: 'AttendanceSettings',
            entityId: settings._id,
            action: 'ATTENDANCE_SETTINGS_UPDATED',
            performedBy: req.user.id,
            changes: {
                before,
                after: settings.toObject()
            },
            meta: { settingsType: 'punch_policy' }
        });
        await auditLog.save();

        res.json({ message: "Settings updated", data: settings });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 6. MANUAL OVERRIDE (HR)
exports.override = async (req, res) => {
    try {
        const { Attendance, AuditLog } = getModels(req);
        const { employeeId, date, status, checkIn, checkOut, reason } = req.body;

        if (!reason) return res.status(400).json({ error: "Reason is mandatory for manual override" });

        const targetDate = new Date(new Date(date).setHours(0, 0, 0, 0));

        let attendance = await Attendance.findOne({ employee: employeeId, date: targetDate, tenant: req.tenantId });
        const before = attendance ? attendance.toObject() : null;

        if (!attendance) {
            attendance = new Attendance({ employee: employeeId, date: targetDate, tenant: req.tenantId });
        }

        attendance.status = status;
        if (checkIn) attendance.checkIn = checkIn;
        if (checkOut) attendance.checkOut = checkOut;
        attendance.isManualOverride = true;
        attendance.overrideReason = reason;
        attendance.approvedBy = req.user.id;

        await attendance.save();

        // Log the change
        const log = new AuditLog({
            tenant: req.tenantId,
            entity: 'Attendance',
            entityId: attendance._id,
            action: 'MANUAL_OVERRIDE',
            performedBy: req.user.id,
            changes: { before, after: attendance.toObject() },
            meta: { reason }
        });
        await log.save();

        res.json({ message: "Attendance overridden successfully", data: attendance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 7. GET ATTENDANCE CALENDAR (HR-Managed Calendar View)
// This generates a calendar view with priority: Holiday > Weekly Off > Attendance Status > Not Marked
exports.getCalendar = async (req, res) => {
    try {
        const { Attendance, AttendanceSettings, Holiday } = getModels(req);
        const { year, month, employeeId } = req.query;
        const tenantId = req.tenantId;

        // Get target year/month (default to current)
        const targetYear = year ? parseInt(year) : new Date().getFullYear();
        const targetMonth = month ? parseInt(month) - 1 : new Date().getMonth(); // month is 0-indexed

        // Calculate date range for the month
        const startDate = new Date(targetYear, targetMonth, 1);
        const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

        // Get settings (weekly off days, shifts, etc.)
        let settings = await AttendanceSettings.findOne({ tenant: tenantId });
        if (!settings) {
            settings = { weeklyOffDays: [0] }; // Default to Sunday
        }

        // Get holidays for the month (including past and future for full visibility)
        const holidays = await Holiday.find({
            tenant: tenantId,
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 });

        // Create holiday map for quick lookup
        const holidayMap = {};
        holidays.forEach(h => {
            const dateStr = h.date.toISOString().split('T')[0];
            holidayMap[dateStr] = {
                name: h.name,
                type: h.type,
                description: h.description || ''
            };
        });

        // Get attendance records if employeeId is provided (for employee-specific calendar)
        let attendanceMap = {};
        if (employeeId) {
            const attendance = await Attendance.find({
                tenant: tenantId,
                employee: employeeId,
                date: { $gte: startDate, $lte: endDate }
            }).sort({ date: 1 });

            attendance.forEach(a => {
                const dateStr = a.date.toISOString().split('T')[0];
                attendanceMap[dateStr] = {
                    status: a.status,
                    checkIn: a.checkIn,
                    checkOut: a.checkOut,
                    workingHours: a.workingHours,
                    isLate: a.isLate,
                    isEarlyOut: a.isEarlyOut
                };
            });
        }

        // Generate calendar days with priority rules
        const calendarDays = [];
        const lastDate = endDate.getDate();

        for (let day = 1; day <= lastDate; day++) {
            const date = new Date(targetYear, targetMonth, day);
            const dateStr = date.toISOString().split('T')[0];
            const dayOfWeek = date.getDay();
            const isWeeklyOff = settings.weeklyOffDays?.includes(dayOfWeek) || false;

            // Apply priority: 1. Holiday 2. Weekly Off 3. Attendance 4. Not Marked
            let status = 'not_marked';
            let displayLabel = '';
            let holiday = null;

            if (holidayMap[dateStr]) {
                // Priority 1: Holiday
                status = 'holiday';
                displayLabel = holidayMap[dateStr].name;
                holiday = holidayMap[dateStr];
            } else if (isWeeklyOff) {
                // Priority 2: Weekly Off
                status = 'weekly_off';
                displayLabel = 'Weekly Off';
            } else if (attendanceMap[dateStr]) {
                // Priority 3: Attendance Status
                status = attendanceMap[dateStr].status;
                displayLabel = attendanceMap[dateStr].status;
            }

            calendarDays.push({
                date: dateStr,
                day: day,
                dayOfWeek: dayOfWeek,
                dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
                status: status,
                displayLabel: displayLabel,
                isWeeklyOff: isWeeklyOff,
                isHoliday: !!holidayMap[dateStr],
                holiday: holiday,
                attendance: attendanceMap[dateStr] || null,
                isPast: dateStr < new Date().toISOString().split('T')[0],
                isToday: dateStr === new Date().toISOString().split('T')[0],
                isFuture: dateStr > new Date().toISOString().split('T')[0]
            });
        }

        res.json({
            year: targetYear,
            month: targetMonth + 1, // Return 1-indexed for frontend
            settings: {
                weeklyOffDays: settings.weeklyOffDays || [0],
                shiftStartTime: settings.shiftStartTime || "09:00",
                shiftEndTime: settings.shiftEndTime || "18:00"
            },
            holidays: holidays,
            calendarDays: calendarDays
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 8. GET TODAY SUMMARY (For Employee Dashboard)
exports.getTodaySummary = async (req, res) => {
    try {
        const { Attendance } = getModels(req);
        const employeeId = req.user.id;
        const tenantId = req.tenantId;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const attendance = await Attendance.findOne({
            tenant: tenantId,
            employee: employeeId,
            date: today
        });

        if (!attendance) {
            return res.json({
                totalPunches: 0,
                totalIn: 0,
                totalOut: 0,
                workingHours: 0,
                status: 'Not Marked',
                firstPunch: null,
                lastPunch: null,
                logs: []
            });
        }

        let totalIn = 0;
        let totalOut = 0;
        attendance.logs.forEach(log => {
            if (log.type === 'IN') totalIn++;
            if (log.type === 'OUT') totalOut++;
        });

        res.json({
            totalPunches: attendance.logs.length,
            totalIn,
            totalOut,
            workingHours: attendance.workingHours || 0,
            status: attendance.status || 'Not Marked',
            firstPunch: attendance.checkIn || null,
            lastPunch: attendance.checkOut || null,
            logs: attendance.logs
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 9. GET HR DASHBOARD STATS (For HR/Admin Dashboard)
exports.getHRStats = async (req, res) => {
    try {
        const { Attendance, Employee } = getModels(req);
        const tenantId = req.tenantId;
        const { date } = req.query;

        // Determine target date (default today)
        const targetDateStr = date || new Date().toISOString().split('T')[0];
        const [y, m, d] = targetDateStr.split('-').map(Number);
        const targetDate = new Date(y, m - 1, d); // Local midnight

        // Fetch all attendance for today
        const attendances = await Attendance.find({
            tenant: tenantId,
            date: targetDate
        });

        const totalPunchedIn = attendances.length;

        let multiplePunches = 0;
        let missingPunchOut = 0;
        let totalWorkingHours = 0;

        attendances.forEach(att => {
            // Multiple punches: if logs > 2 (meaning more than just IN-OUT pair)
            if (att.logs && att.logs.length > 2) {
                multiplePunches++;
            }

            // Missing Punch Out: user checked in roughly (logs not empty) but no checkOut yet
            // (Only counts if they are not currently working late? Simple logic: !checkOut)
            if (att.checkIn && !att.checkOut) {
                missingPunchOut++;
            }

            totalWorkingHours += (att.workingHours || 0);
        });

        const avgWorkingHours = totalPunchedIn > 0 ? (totalWorkingHours / totalPunchedIn).toFixed(2) : 0;

        res.json({
            date: targetDateStr,
            totalPunchedIn,
            multiplePunches,
            missingPunchOut,
            avgWorkingHours
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/attendance/upload-excel
 * Upload attendance from Excel
 */
exports.uploadExcel = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Excel file is required" });

        const { Attendance, Employee, AuditLog, AttendanceSettings } = getModels(req);
        const tenantId = req.tenantId;

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

        if (rows.length === 0) return res.status(400).json({ error: "Excel sheet is empty" });

        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        // Cache settings
        let settings = await AttendanceSettings.findOne({ tenant: tenantId });
        if (!settings) settings = new AttendanceSettings({ tenant: tenantId });

        // Normalize header names
        const normalize = (s) => s ? s.toString().toLowerCase().replace(/\s/g, '').replace(/[^a-z0-9]/g, '') : '';

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowIdx = i + 2; // 1-indexed + header row

            try {
                // Find column names
                let empIdVal = "";
                let dateVal = null;
                let statusVal = "";
                let checkInVal = null;
                let checkOutVal = null;

                for (const key of Object.keys(row)) {
                    const normKey = normalize(key);
                    const val = row[key];

                    if (normKey.includes('employeeid') || normKey.includes('empid') || normKey === 'id' || normKey === 'code') {
                        empIdVal = val.toString().trim();
                    } else if (normKey === 'date' || normKey.includes('attendancedate') || normKey.includes('punchdate')) {
                        dateVal = val;
                    } else if (normKey === 'status') {
                        statusVal = val.toString().trim().toLowerCase();
                    } else if (normKey.includes('checkin') || normKey.includes('punchin') || normKey === 'in') {
                        checkInVal = val;
                    } else if (normKey.includes('checkout') || normKey.includes('punchout') || normKey === 'out') {
                        checkOutVal = val;
                    }
                }

                if (!empIdVal) throw new Error("Employee ID is missing");
                if (!dateVal) throw new Error("Date is missing");

                // Find Employee
                const employee = await Employee.findOne({
                    tenant: tenantId,
                    $or: [{ employeeId: empIdVal }, { customId: empIdVal }]
                });
                if (!employee) throw new Error(`Employee not found with ID: ${empIdVal}`);

                // Process Date
                let attendanceDate = new Date(dateVal);
                if (isNaN(attendanceDate.getTime())) throw new Error(`Invalid date format: ${dateVal}`);
                attendanceDate.setHours(0, 0, 0, 0);

                // Default status if missing
                if (!statusVal) statusVal = 'present';

                // Find or Create Attendance
                let attendance = await Attendance.findOne({
                    tenant: tenantId,
                    employee: employee._id,
                    date: attendanceDate
                });

                if (!attendance) {
                    attendance = new Attendance({
                        tenant: tenantId,
                        employee: employee._id,
                        date: attendanceDate
                    });
                }

                attendance.status = statusVal;

                // Process Punch Times if they are Date objects or strings
                const parseTime = (val, baseDate) => {
                    if (!val) return null;
                    if (val instanceof Date) return val;
                    // Try to parse string time like "09:00"
                    if (typeof val === 'string' && val.includes(':')) {
                        const [h, m] = val.split(':').map(Number);
                        const d = new Date(baseDate);
                        d.setHours(h, m || 0, 0, 0);
                        return d;
                    }
                    return null;
                };

                const checkIn = parseTime(checkInVal, attendanceDate);
                const checkOut = parseTime(checkOutVal, attendanceDate);

                if (checkIn) {
                    attendance.checkIn = checkIn;
                    // Also check late mark
                    const [h, m] = settings.shiftStartTime.split(':').map(Number);
                    const shiftStart = new Date(attendanceDate);
                    shiftStart.setHours(h, m, 0, 0);
                    const grace = settings.graceTimeMinutes || 0;
                    if (checkIn > new Date(shiftStart.getTime() + grace * 60000)) {
                        attendance.isLate = true;
                    }
                }

                if (checkOut) {
                    attendance.checkOut = checkOut;
                    // Also check early out
                    const [h, m] = settings.shiftEndTime.split(':').map(Number);
                    const shiftEnd = new Date(attendanceDate);
                    shiftEnd.setHours(h, m, 0, 0);
                    if (checkOut < shiftEnd) {
                        attendance.isEarlyOut = true;
                    }
                }

                // Sync Logs for consistency if we have punch times
                if (checkIn || checkOut) {
                    attendance.logs = [];
                    if (checkIn) attendance.logs.push({ time: checkIn, type: 'IN', location: 'Excel Upload', device: 'System' });
                    if (checkOut) attendance.logs.push({ time: checkOut, type: 'OUT', location: 'Excel Upload', device: 'System' });

                    attendance.workingHours = calculateWorkingHours(attendance.logs);
                }

                attendance.isManualOverride = true;
                attendance.overrideReason = "Bulk Excel Upload";
                attendance.approvedBy = req.user.id;

                await attendance.save();
                results.success++;

            } catch (err) {
                results.failed++;
                results.errors.push({ row: rowIdx, error: err.message });
            }
        }

        // Log the bulk action
        const bulkLog = new AuditLog({
            tenant: tenantId,
            entity: 'AttendanceBatch',
            entityId: req.user.id,
            action: 'BULK_UPLOAD_EXCEL',
            performedBy: req.user.id,
            meta: {
                file: req.file.originalname,
                successCount: results.success,
                failCount: results.failed
            }
        });
        await bulkLog.save();

        res.json({
            message: `Bulk upload completed: ${results.success} succeeded, ${results.failed} failed.`,
            data: results
        });

    } catch (error) {
        console.error("Bulk upload error:", error);
        res.status(500).json({ error: error.message });
    }
};