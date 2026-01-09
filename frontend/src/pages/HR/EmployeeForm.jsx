import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../../utils/api';
import { message, DatePicker } from 'antd';
import { IndianRupee } from 'lucide-react';
import dayjs from 'dayjs';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const NATIONALITIES = ['Indian', 'American', 'British', 'Canadian', 'Australian', 'Other'];

export default function EmployeeForm({ employee, onClose, viewOnly = false }) {
  const [step, setStep] = useState((employee?.status === 'Draft' ? employee?.lastStep : 1) || 1);

  const [firstName, setFirstName] = useState(employee?.firstName || '');
  const [middleName, setMiddleName] = useState(employee?.middleName || '');
  const [lastName, setLastName] = useState(employee?.lastName || '');
  const [gender, setGender] = useState(employee?.gender || '');
  const [dob, setDob] = useState(employee?.dob ? new Date(employee.dob).toISOString().slice(0, 10) : '');
  const [contactNo, setContactNo] = useState(employee?.contactNo || '');
  const [email, setEmail] = useState(employee?.email || '');
  const [password, setPassword] = useState('');
  const [profilePic, setProfilePic] = useState(null);
  const [profilePreview, setProfilePreview] = useState(employee?.profilePic || null);
  const [maritalStatus, setMaritalStatus] = useState(employee?.maritalStatus || '');
  const [bloodGroup, setBloodGroup] = useState(employee?.bloodGroup || '');
  const [nationality, setNationality] = useState(employee?.nationality || '');
  const [fatherName, setFatherName] = useState(employee?.fatherName || '');
  const [motherName, setMotherName] = useState(employee?.motherName || '');
  const [emergencyContactName, setEmergencyContactName] = useState(employee?.emergencyContactName || '');
  const [emergencyContactNumber, setEmergencyContactNumber] = useState(employee?.emergencyContactNumber || '');

  const [tempAddress, setTempAddress] = useState(employee?.tempAddress || { line1: '', line2: '', city: '', state: '', pinCode: '', country: '' });
  const [permAddress, setPermAddress] = useState(employee?.permAddress || { line1: '', line2: '', city: '', state: '', pinCode: '', country: '' });
  const [sameAsTemp, setSameAsTemp] = useState(false);

  const [experience, setExperience] = useState(employee?.experience?.length ? employee.experience.map(e => ({
    ...e,
    payslips: e.payslips || (e.payslipUrl ? [e.payslipUrl] : [])
  })) : []);
  const [jobType, setJobType] = useState(employee?.jobType || 'Full-Time');

  const [bankName, setBankName] = useState(employee?.bankDetails?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(employee?.bankDetails?.accountNumber || '');
  const [ifsc, setIfsc] = useState(employee?.bankDetails?.ifsc || '');
  const [branchName, setBranchName] = useState(employee?.bankDetails?.branchName || '');
  const [bankLocation, setBankLocation] = useState(employee?.bankDetails?.location || '');
  const [currentBankProof, setCurrentBankProof] = useState(employee?.bankDetails?.bankProofUrl || null);

  const [role, setRole] = useState(employee?.role || 'Employee');
  const [department, setDepartment] = useState(employee?.department || '');
  const [departmentId, setDepartmentId] = useState(employee?.departmentId?._id || employee?.departmentId || '');
  const [manager, setManager] = useState(employee?.manager?._id || employee?.manager || '');
  const [joiningDate, setJoiningDate] = useState(employee?.joiningDate ? new Date(employee.joiningDate).toISOString().split('T')[0] : '');
  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);
  const [_departmentHead, _setDepartmentHead] = useState(employee?.departmentHead || false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [ifscLoading, setIfscLoading] = useState(false);

  // Payroll / Compensation State (Step 8)
  const [salaryTemplateId, setSalaryTemplateId] = useState(employee?.salaryTemplateId?._id || employee?.salaryTemplateId || '');
  const [salaryEffectiveDate, setSalaryEffectiveDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [salaryStatus, setSalaryStatus] = useState('Active');
  const [salaryTemplates, setSalaryTemplates] = useState([]);
  const [selectedTemplateDetails, setSelectedTemplateDetails] = useState(null);

  const loadSalaryTemplates = useCallback(async () => {
    try {
      const res = await api.get('/payroll/salary-templates');
      setSalaryTemplates(res.data?.data || []);
      // Pre-select if existing
      if (salaryTemplateId && !selectedTemplateDetails) {
        const found = (res.data?.data || []).find(t => t._id === salaryTemplateId);
        if (found) setSelectedTemplateDetails(found);
      }
    } catch (err) { console.error("Failed to load salary templates", err); }
  }, [salaryTemplateId]);

  useEffect(() => {
    if (step === 8) loadSalaryTemplates();
  }, [step, loadSalaryTemplates]);

  const handleTemplateChange = (e) => {
    const tid = e.target.value;
    setSalaryTemplateId(tid);
    const found = salaryTemplates.find(t => t._id === tid);
    setSelectedTemplateDetails(found || null);
  };

  const saveSalaryAssignment = async () => {
    if (!salaryTemplateId) { alert("Please select a Salary Template"); return; }
    if (!employee?._id) { alert("Please save employee draft first"); return; }

    setSaving(true);
    try {
      await api.post(`/hr/employees/${employee._id}/salary-assignment`, {
        salaryTemplateId,
        effectiveFrom: salaryEffectiveDate,
        status: salaryStatus
      });
      message.success("Salary assigned successfully!");
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || "Failed to assign salary");
    } finally {
      setSaving(false);
    }
  };

  // Leave Policy
  const [leavePolicy, setLeavePolicy] = useState(employee?.leavePolicy || '');
  const [policies, setPolicies] = useState([]);

  const loadPolicies = useCallback(async () => {
    try {
      const res = await api.get('/hr/leave-policies');
      setPolicies(res.data || []);
    } catch (err) { console.error("Failed to load policies", err); }
  }, []);


  // Education State
  const [eduType, setEduType] = useState(employee?.education?.type || 'Diploma');
  const [class10Marksheet, setClass10Marksheet] = useState(employee?.education?.class10Marksheet || null);
  const [class12Marksheet, setClass12Marksheet] = useState(employee?.education?.class12Marksheet || null);
  const [diplomaCertificate, setDiplomaCertificate] = useState(employee?.education?.diplomaCertificate || null);
  const [bachelorDegree, setBachelorDegree] = useState(employee?.education?.bachelorDegree || null);
  const [masterDegree, setMasterDegree] = useState(employee?.education?.masterDegree || null);

  // Alternative: Last 3 Sem Marksheets
  const [lastSem1, setLastSem1] = useState(employee?.education?.lastSem1Marksheet || null);
  const [lastSem2, setLastSem2] = useState(employee?.education?.lastSem2Marksheet || null);
  const [lastSem3, setLastSem3] = useState(employee?.education?.lastSem3Marksheet || null);

  // Step 6: Identity Documents
  // Step 6: Identity Documents
  const [aadharFront, setAadharFront] = useState(employee?.documents?.aadharFront || null);
  const [aadharBack, setAadharBack] = useState(employee?.documents?.aadharBack || null);
  const [panCard, setPanCard] = useState(employee?.documents?.panCard || null);

  const bankProofRef = useRef(null);
  const c10Ref = useRef(null);
  const c12Ref = useRef(null);
  const diplomaRef = useRef(null);
  const bachelorRef = useRef(null);
  const masterRef = useRef(null);
  const ls1Ref = useRef(null);
  const ls2Ref = useRef(null);
  const ls3Ref = useRef(null);
  const aadharFrontRef = useRef(null);
  const aadharBackRef = useRef(null);
  const panRef = useRef(null);
  const profilePicRef = useRef(null);
  const ignoreAutoFill = useRef(false);


  // Fetch departments for dropdown
  const loadDepartments = useCallback(async () => {
    try {
      const res = await api.get('/hr/departments');
      const deptList = Array.isArray(res.data) ? res.data : [];
      setDepartments(deptList);
    } catch (err) {
      console.error('Failed to load departments', err);
      setDepartments([]);
    }
  }, []);

  // Fetch employees for manager dropdown
  const loadManagers = useCallback(async () => {
    try {
      const res = await api.get('/hr/employees');
      const empList = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
      setManagers(empList.filter(e => !employee || e._id !== employee._id)); // Exclude self
    } catch (err) {
      console.error('Failed to load managers', err);
      setManagers([]);
    }
  }, [employee]);

  // Step 7: Fetch Employee Code Preview
  const loadEmployeeCodePreview = useCallback(async () => {
    if (step !== 7) return;
    try {
      const payload = {
        firstName: firstName,
        lastName: lastName,
        department: department || 'GEN'
      };
      console.log('Fetching preview with:', payload);
      const res = await api.post('/hr/employees/preview', payload);
      if (res.data && res.data.preview) {
        setEmployeeCode(res.data.preview);
      } else {
        setEmployeeCode('Error: No ID returned');
      }
    } catch (err) {
      console.error('Failed to load employee code preview', err);
      setEmployeeCode('Error: Failed to generate');
    }
  }, [step, firstName, lastName, department]);

  useEffect(() => {
    loadDepartments();
    loadManagers();
    loadPolicies();
    if (step === 7 && !employee) loadEmployeeCodePreview();
  }, [loadDepartments, loadManagers, loadEmployeeCodePreview, step, employee]);

  const [employeeCode, setEmployeeCode] = useState('');

  const phoneRe = /^\d{10,15}$/;
  const pinRe = useMemo(() => /^\d{5,10}$/, []);
  const ifscRe = useMemo(() => /^[A-Z]{4}0[0-9A-Z]{6}$/, []);

  const handlePincodeLookup = useCallback(async (pin, target = 'temp') => {
    try {
      if (!pin || !pinRe.test(pin)) return;
      setPincodeLoading(true);
      const key = 'pincode_cache';
      let cache = {};
      try { cache = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { cache = {}; }
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!isOnline) {
        const c = cache[pin];
        if (c) {
          if (target === 'temp') setTempAddress(p => {
            const next = { ...p, city: c.city || p.city, state: c.stateVal || p.state, country: c.countryVal || p.country };
            return (next.city === p.city && next.state === p.state && next.country === p.country) ? p : next;
          });
          else setPermAddress(p => {
            const next = { ...p, city: c.city || p.city, state: c.stateVal || p.state, country: c.countryVal || p.country };
            return (next.city === p.city && next.state === p.state && next.country === p.country) ? p : next;
          });
        }
        return;
      }
      const res = await fetch(`https://api.postalpincode.in/pincode/${encodeURIComponent(pin)}`);
      let city = '', stateVal = '', countryVal = '';
      if (res.ok) {
        const data = await res.json();
        const entry = Array.isArray(data) ? data[0] : null;
        const po = entry && Array.isArray(entry.PostOffice) ? entry.PostOffice[0] : null;
        city = (po && (po.District || po.Name)) || '';
        stateVal = (po && po.State) || '';
        countryVal = (po && po.Country) || '';
      }
      if (city || stateVal || countryVal) {
        if (ignoreAutoFill.current) return; // Prevent overwriting city if triggered by city lookup

        const v = { city, stateVal, countryVal, ts: Date.now() };
        cache[pin] = v;
        try { localStorage.setItem(key, JSON.stringify(cache)); } catch { /* ignore localStorage errors */ }
        if (target === 'temp') setTempAddress(p => {
          const next = { ...p, city: city || p.city, state: stateVal || p.state, country: countryVal || p.country };
          return (next.city === p.city && next.state === p.state && next.country === p.country) ? p : next;
        });
        else setPermAddress(p => {
          const next = { ...p, city: city || p.city, state: stateVal || p.state, country: countryVal || p.country };
          return (next.city === p.city && next.state === p.state && next.country === p.country) ? p : next;
        });
      }
    } finally {
      setPincodeLoading(false);
    }
  }, [pinRe]);

  const handleIfscLookup = useCallback(async (code) => {
    try {
      if (!code || !ifscRe.test(code)) return;
      setIfscLoading(true);
      const key = 'ifsc_cache';
      let cache = {};
      try { cache = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { cache = {}; }
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!isOnline) {
        const c = cache[code];
        if (c) {
          setBankName(prev => c.BANK || prev);
          setBranchName(prev => c.BRANCH || prev);
        }
        return;
      }
      const res = await fetch(`https://ifsc.razorpay.com/${encodeURIComponent(code)}`);
      if (res.ok) {
        const data = await res.json();
        setBankName(prev => data.BANK || prev);
        setBranchName(prev => data.BRANCH || prev);
        setBankLocation(prev => data.CITY || data.DISTRICT || prev); // Auto-populate location
        const v = { ...data, ts: Date.now() };
        cache[code] = v;
        try { localStorage.setItem(key, JSON.stringify(cache)); } catch { /* ignore localStorage errors */ }
      }
    } finally {
      setIfscLoading(false);
    }
  }, [ifscRe]);

  const handleCityLookup = useCallback(async (city, target = 'temp') => {
    try {
      if (!city || city.length < 3) { setPincodeLoading(false); return; }

      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!isOnline) { setPincodeLoading(false); return; }

      const res = await fetch(`https://api.postalpincode.in/postoffice/${encodeURIComponent(city)}`);
      if (res.ok) {
        const data = await res.json();
        const entry = Array.isArray(data) ? data[0] : null;
        if (entry && entry.Status === 'Success' && Array.isArray(entry.PostOffice) && entry.PostOffice.length > 0) {
          const list = entry.PostOffice;
          const inputCity = city.trim().toLowerCase();

          // Priority 1: Exact Match on District
          let po = list.find(item => item.District && item.District.toLowerCase() === inputCity);

          // Priority 2: Exact Match on Region
          if (!po) po = list.find(item => item.Region && item.Region.toLowerCase() === inputCity);

          // Priority 3: Fuzzy Match on Name (Starts with input + space, or exact)
          // e.g. Input "Dhari" matches "Dhari S.O"
          if (!po) {
            const nameRegex = new RegExp(`^${inputCity}( |$|\\.)`, 'i');
            const nameMatches = list.filter(item => item.Name && nameRegex.test(item.Name));

            if (nameMatches.length > 0) {
              // Sort by State (A-Z) -> Gujarat comes before Uttarakhand
              nameMatches.sort((a, b) => (a.State || '').localeCompare(b.State || ''));
              po = nameMatches[0];
            }
          }

          // Fallback: Just take the first one if we can't find a direct match
          if (!po) po = list[0];

          const stateVal = po.State || '';
          const countryVal = po.Country || 'India';
          const pinVal = po.Pincode || '';

          if (target === 'temp') {
            ignoreAutoFill.current = true;
            setTempAddress(p => ({ ...p, state: stateVal || p.state, country: countryVal || p.country, pinCode: pinVal }));
            setTimeout(() => { ignoreAutoFill.current = false; }, 2000);
          } else {
            ignoreAutoFill.current = true;
            setPermAddress(p => ({ ...p, state: stateVal || p.state, country: countryVal || p.country, pinCode: pinVal }));
            setTimeout(() => { ignoreAutoFill.current = false; }, 2000);
          }
        } else {
          // Fallback to Global Search (Nominatim)
          throw new Error("No Indian match found");
        }

      } else {
        throw new Error("Indian API Failed");
      }
    } catch (e) {
      console.log("Indian API missed, trying global...", e);

      // Clear stale data immediately to prevent wrong info persistence
      if (target === 'temp') setTempAddress(p => ({ ...p, state: '', country: '', pinCode: '' }));
      else setPermAddress(p => ({ ...p, state: '', country: '', pinCode: '' }));

      try {
        const globalRes = await fetch(`https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&format=json&addressdetails=1&limit=1`, {
          headers: { 'Accept-Language': 'en' } // Prefer English results
        });
        if (globalRes.ok) {
          const gData = await globalRes.json();
          const gEntry = Array.isArray(gData) ? gData[0] : null;
          if (gEntry && gEntry.address) {
            const stateVal = gEntry.address.state || gEntry.address.county || '';
            const countryVal = gEntry.address.country || '';
            const pinVal = gEntry.address.postcode || '';

            if (target === 'temp') {
              ignoreAutoFill.current = true;
              setTempAddress(p => ({ ...p, state: stateVal || p.state, country: countryVal || p.country, pinCode: pinVal }));
              setTimeout(() => { ignoreAutoFill.current = false; }, 2000);
            } else {
              ignoreAutoFill.current = true;
              setPermAddress(p => ({ ...p, state: stateVal || p.state, country: countryVal || p.country, pinCode: pinVal }));
              setTimeout(() => { ignoreAutoFill.current = false; }, 2000);
            }
          }
        }
      } catch (err2) {
        console.error("Global lookup failed", err2);
      }
    } finally {
      setPincodeLoading(false);
    }
  }, []);

  // Debounced Effect for City Lookup - Temp Address
  useEffect(() => {
    const timer = setTimeout(() => {
      if (tempAddress.city && tempAddress.city.length > 2) handleCityLookup(tempAddress.city, 'temp');
    }, 800);
    return () => clearTimeout(timer);
  }, [tempAddress.city, handleCityLookup]);

  // Debounced Effect for City Lookup - Perm Address
  useEffect(() => {
    if (sameAsTemp) return;
    const timer = setTimeout(() => {
      if (permAddress.city && permAddress.city.length > 2) handleCityLookup(permAddress.city, 'perm');
    }, 800);
    return () => clearTimeout(timer);
  }, [permAddress.city, sameAsTemp, handleCityLookup]);

  // ... (renderFilePreview and validateStep unchanged)

  // ...

  // Helper to render file preview
  const renderFilePreview = (fileOrUrl, altText) => {
    if (!fileOrUrl) return null;
    const isFile = fileOrUrl instanceof File;
    const isPdf = isFile ? (fileOrUrl.type === 'application/pdf') : fileOrUrl.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      return <div className="text-red-500 font-bold text-xs p-2 text-center border rounded bg-slate-50">PDF Document</div>;
    }

    let src = '';
    if (isFile) {
      src = URL.createObjectURL(fileOrUrl);
    } else {
      if (fileOrUrl.startsWith('http')) {
        src = fileOrUrl;
      } else {
        // Normalize URL: remove /api from end if present (for static files), remove trailing slash
        const backendUrl = BACKEND_URL || '';
        const baseUrl = backendUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
        const cleanPath = (fileOrUrl || '').replace(/\\/g, '/');
        const path = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
        src = `${baseUrl}${path}`;
      }
    }

    return <img src={src} alt={altText} className="w-full h-full object-contain" />;
  };

  const validateStep = (stepNum) => {
    const e = {};
    if (stepNum === 1) {
      if (!firstName || firstName.length < 3 || !/^[A-Za-z]+$/.test(firstName)) e.firstName = 'First name required (min 3 chars, letters only)';
      if (!middleName || middleName.length < 3) e.middleName = 'Middle name is required (min 3 chars)';
      if (!lastName || lastName.length < 3) e.lastName = 'Last name is required (min 3 chars)';
      if (!gender) e.gender = 'Gender is required';
      // Department and Manager are optional now
      if (!joiningDate) e.joiningDate = 'Joining Date is required';
      if (!dob) e.dob = 'Date of birth required';
      else {
        const birth = new Date(dob); const age = Math.floor((Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
        if (age < 18) e.dob = 'Employee must be at least 18 years old';
      }
      if (!contactNo || !phoneRe.test(contactNo)) e.contactNo = 'Phone must be 10-15 digits';
      // Email and Password validation removed

      if (!maritalStatus) e.maritalStatus = 'Marital Status is required';

      const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
      if (!bloodGroup) e.bloodGroup = 'Blood Group is required';
      else if (!validBloodGroups.includes(bloodGroup.toUpperCase())) e.bloodGroup = 'Invalid Blood Group (Allowed: A+, A-, B+, B-, O+, O-, AB+, AB-)';

      if (!nationality) e.nationality = 'Nationality is required';

      // Father/Mother remain optional, but validate if entered
      if (fatherName && fatherName.length < 3) e.fatherName = 'Father name must be at least 3 chars';
      if (motherName && motherName.length < 3) e.motherName = 'Mother name must be at least 3 chars';

      if (!emergencyContactName || emergencyContactName.length < 3) e.emergencyContactName = 'Emergency contact name required (min 3 chars)';
      if (!emergencyContactNumber || !phoneRe.test(emergencyContactNumber)) e.emergencyContactNumber = 'Emergency contact number invalid';
    }

    if (stepNum === 2) {
      if (!tempAddress.line1) e.tempLine1 = 'Temporary address line1 required';
      if (!tempAddress.city) e.tempCity = 'Temporary city required';
      if (!tempAddress.state) e.tempState = 'Temporary state required';
      if (!tempAddress.pinCode || !pinRe.test(tempAddress.pinCode)) e.tempPin = 'Temporary pin code invalid';
      if (!tempAddress.country) e.tempCountry = 'Temporary country required';
      if (!sameAsTemp) {
        if (!permAddress.line1) e.permLine1 = 'Permanent address line1 required';
        if (!permAddress.city) e.permCity = 'Permanent city required';
        if (!permAddress.state) e.permState = 'Permanent state required';
        if (!permAddress.pinCode || !pinRe.test(permAddress.pinCode)) e.permPin = 'Permanent pin code invalid';
        if (!permAddress.country) e.permCountry = 'Permanent country required';
      }
    }

    if (stepNum === 3) {
      experience.forEach((exp, idx) => {
        if (exp.from && exp.to) {
          const f = new Date(exp.from); const t = new Date(exp.to);
          if (f > t) e[`exp_${idx}`] = 'From date must be before To date';
        }
        // Mandatory fields check
        if (!exp.companyName) e[`exp_${idx}`] = 'Company Name is required';
        if (!exp.reportingPersonName) e[`exp_${idx}`] = 'Reporting Person Name is required';
        if (!exp.reportingPersonEmail) e[`exp_${idx}`] = 'Reporting Person Email is required';
        if (!exp.payslips || exp.payslips.filter(Boolean).length !== 3) e[`exp_${idx}`] = 'Exactly 3 payslips are required';
      });
    }

    if (stepNum === 4) {
      if (!employee) {
        if (!bankName) e.bankName = 'Bank name required';
        if (!accountNumber || !/^[0-9]{9,18}$/.test(accountNumber)) e.accountNumber = 'Account Number must be 9-18 digits';
        if (!ifsc || !ifscRe.test(ifsc)) e.ifsc = 'IFSC invalid';
        if (!branchName) e.branchName = 'Branch name required';
        // Bank Proof Mandatory Validation
        if (!currentBankProof) e.bankProof = 'Bank Proof (Cheque/Passbook Photo) is required';
      }
    }

    if (stepNum === 5) {
      if (!eduType) { e.eduType = 'Education Type is required'; return false; }

      // Common Rule: 10th Marksheet is always required
      if (!class10Marksheet) e.class10 = '10th Marksheet is required';

      if (eduType === 'Diploma') {
        // Diploma: Require Diploma Certificate OR (Last 3 Sem Marksheets)
        const hasDegree = !!diplomaCertificate;
        const hasAlt = lastSem1 && lastSem2 && lastSem3;
        if (!hasDegree && !hasAlt) {
          e.diploma = 'Diploma Certificate OR Last 3 Sem Marksheets required';
        }
      } else if (eduType === 'Bachelor') {
        if (!class12Marksheet) e.class12 = '12th Marksheet is required';
        // Bachelor: Require Bachelor Degree OR (Last 3 Sem Marksheets)
        const hasDegree = !!bachelorDegree;
        const hasAlt = lastSem1 && lastSem2 && lastSem3;
        if (!hasDegree && !hasAlt) {
          e.bachelor = 'Bachelor Degree OR Last 3 Sem Marksheets required';
        }
      }
    }

    if (stepNum === 6) {
      // Identity Documents validation
      if (!aadharFront && !employee?.documents?.aadharFront) e.aadharFront = 'Aadhar Front is required';
      if (!aadharBack && !employee?.documents?.aadharBack) e.aadharBack = 'Aadhar Back is required';
      if (!panCard && !employee?.documents?.panCard) e.panCard = 'PAN Card is required';
    }

    if (stepNum === 7) {
      // Step 7: Account Credentials
      // Employee Code is read-only
      if (!email || !/\S+@\S+\.\S+/.test(email)) e.email = 'Valid Email is required';

      // Password is now mandatory for both New/Draft AND Edit modes
      if (!password && !employee?._id) { // Only mandatory if new? Actually old code said "password || employee ? .. : valid"
        // Re-reading logic: new employee needs password. Edit doesn't unless changing.
        if (password && password.length < 6) e.password = 'Password min 6 chars';
        if (!employee && !password) e.password = 'Password is required';
      }
    }

    if (stepNum === 8) {
      if (!salaryTemplateId) e.salaryTemplate = "Salary Template is required";
      if (!salaryEffectiveDate) e.effectiveDate = "Effective Date is required";
      if (joiningDate && salaryEffectiveDate < joiningDate) e.effectiveDate = "Cannot be before Joining Date";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) setStep(step + 1);
  };


  const handlePrev = () => {
    setStep(step - 1);
  };

  useEffect(() => {
    if (sameAsTemp) setPermAddress({ ...tempAddress });
  }, [sameAsTemp, tempAddress]);

  useEffect(() => {
    const t = setTimeout(() => {
      const pin = tempAddress.pinCode;
      if (pin && pinRe.test(pin)) handlePincodeLookup(pin, 'temp');
    }, 500);
    return () => clearTimeout(t);
  }, [tempAddress.pinCode, handlePincodeLookup, pinRe]);

  useEffect(() => {
    const t = setTimeout(() => {
      const pin = permAddress.pinCode;
      if (pin && pinRe.test(pin) && !sameAsTemp) handlePincodeLookup(pin, 'perm');
    }, 500);
    return () => clearTimeout(t);
  }, [permAddress.pinCode, sameAsTemp, handlePincodeLookup, pinRe]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (ifsc && ifscRe.test(ifsc)) handleIfscLookup(ifsc);
    }, 500);
    return () => clearTimeout(t);
  }, [ifsc, handleIfscLookup, ifscRe]);

  async function submit(e) {
    e.preventDefault();
    if (!validateStep(7)) return;
    setSaving(true);
    try {
      // Upload Current Bank Proof if changed
      let currentBankProofUrl = employee?.bankDetails?.bankProofUrl;
      if (currentBankProof && currentBankProof instanceof File) {
        try {
          const fd = new FormData();
          fd.append('file', currentBankProof);
          const up = await api.post('/uploads/doc', fd);
          if (up?.data?.success) currentBankProofUrl = up.data.url;
        } catch (e) { console.warn('Bank proof upload failed', e) }
      } else if (currentBankProof) {
        currentBankProofUrl = currentBankProof; // string
      } else {
        currentBankProofUrl = ''; // removed
      }
      /* Profile Pic removed
      let profilePicUrl = employee?.profilePic || undefined;
      if (profilePic && profilePic instanceof File) { ... } 
      */

      // Process experience file uploads
      let processedExperience = [];
      if (experience && experience.length > 0) {
        processedExperience = await Promise.all(experience.map(async (exp) => {
          let pSlips = [];
          if (exp.payslips && exp.payslips.length > 0) {
            for (const item of exp.payslips) {
              if (item instanceof File) {
                const fd = new FormData();
                fd.append('file', item);
                try {
                  const up = await api.post('/uploads/doc', fd);
                  if (up?.data?.success) pSlips.push(up.data.url);
                } catch (e) { console.warn('Payslip upload failed', e); }
              } else if (typeof item === 'string') { pSlips.push(item); }
            }
          }
          return { ...exp, payslips: pSlips };
        }));
      }

      // Education File Uploads
      let c10Url = employee?.education?.class10Marksheet;
      let c12Url = employee?.education?.class12Marksheet;
      let diplomaUrl = employee?.education?.diplomaCertificate;
      let bachelorUrl = employee?.education?.bachelorDegree;
      let masterUrl = employee?.education?.masterDegree;
      let ls1Url = employee?.education?.lastSem1Marksheet;
      let ls2Url = employee?.education?.lastSem2Marksheet;
      let ls3Url = employee?.education?.lastSem3Marksheet;

      const uploadFile = async (file) => {
        if (!file || !(file instanceof File)) return null;
        const fd = new FormData();
        fd.append('file', file);
        try {
          const res = await api.post('/uploads/doc', fd);
          return res?.data?.success ? res.data.url : null;
        } catch (e) {
          console.warn('File upload failed', e);
          return null;
        }
      };

      if (class10Marksheet instanceof File) { c10Url = await uploadFile(class10Marksheet) || c10Url; }
      if (class12Marksheet instanceof File) { c12Url = await uploadFile(class12Marksheet) || c12Url; }
      if (diplomaCertificate instanceof File) { diplomaUrl = await uploadFile(diplomaCertificate) || diplomaUrl; }
      if (bachelorDegree instanceof File) { bachelorUrl = await uploadFile(bachelorDegree) || bachelorUrl; }
      if (masterDegree instanceof File) { masterUrl = await uploadFile(masterDegree) || masterUrl; }

      if (lastSem1 instanceof File) { ls1Url = await uploadFile(lastSem1) || ls1Url; }
      if (lastSem2 instanceof File) { ls2Url = await uploadFile(lastSem2) || ls2Url; }
      if (lastSem3 instanceof File) { ls3Url = await uploadFile(lastSem3) || ls3Url; }

      // Step 6 Documents

      // Step 6 Documents
      let aadharFrontUrl = employee?.documents?.aadharFront;
      let aadharBackUrl = employee?.documents?.aadharBack;
      let panUrl = employee?.documents?.panCard;
      let profilePicUrl = employee?.profilePic; // Existing URL

      if (profilePic instanceof File) { profilePicUrl = await uploadFile(profilePic) || profilePicUrl; }
      if (aadharFront instanceof File) { aadharFrontUrl = await uploadFile(aadharFront) || aadharFrontUrl; }
      if (aadharBack instanceof File) { aadharBackUrl = await uploadFile(aadharBack) || aadharBackUrl; }
      if (panCard instanceof File) { panUrl = await uploadFile(panCard) || panUrl; }

      const payload = {
        firstName, middleName, lastName, gender, dob: dob || undefined,
        contactNo, email, password: password || undefined,
        maritalStatus, bloodGroup, nationality, fatherName, motherName,
        emergencyContactName, emergencyContactNumber,
        tempAddress, permAddress: sameAsTemp ? tempAddress : permAddress,
        experience: processedExperience,
        jobType,
        bankDetails: { bankName, accountNumber, ifsc, branchName, location: bankLocation, bankProofUrl: currentBankProofUrl },
        education: {
          type: eduType,
          class10Marksheet: c10Url,
          class12Marksheet: c12Url,
          diplomaCertificate: diplomaUrl,
          bachelorDegree: bachelorUrl,
          masterDegree: masterUrl,
          lastSem1Marksheet: ls1Url,
          lastSem2Marksheet: ls2Url,
          lastSem3Marksheet: ls3Url
        },
        documents: {
          aadharFront: aadharFrontUrl,
          aadharBack: aadharBackUrl,
          panCard: panUrl
        },
        role,
        department: department || (departments.find(d => d._id === departmentId)?.name || ''),
        departmentId: departmentId || undefined,
        manager: manager || undefined,
        joiningDate: joiningDate || new Date().toISOString(),
        departmentHead: _departmentHead,
        profilePic: profilePicUrl,
        status: 'Active',
        lastStep: 7,
        leavePolicy: leavePolicy || undefined,
      };

      let empResult;
      if (employee) {
        empResult = await api.put(`/hr/employees/${employee._id}`, payload);
      } else {
        empResult = await api.post('/hr/employees', payload);
      }

      // If employee is marked as "Dep Head", update the department's head field
      if (role === 'Dep Head' && department) {
        const empId = empResult?.data?.data?._id || empResult?.data?._id || employee?._id;
        if (empId) {
          await api.put(`/hr/departments/${department}`, { head: empId })
            .catch(err => console.error('Failed to update department head', err?.response?.data?.message || err.message));
        }
      }

      onClose();
    } catch (err) {
      console.error('Employee save error:', err);
      const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to save employee';
      alert(`Error: ${errorMsg}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft(e) {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const uploadFile = async (file) => {
        if (!file || !(file instanceof File)) return null;
        const fd = new FormData();
        fd.append('file', file);
        try {
          const res = await api.post('/uploads/doc', fd);
          return res?.data?.success ? res.data.url : null;
        } catch (e) { console.warn('File upload failed', e); return null; }
      };

      // Bank Proof
      let currentBankProofUrl = employee?.bankDetails?.bankProofUrl;
      if (currentBankProof && currentBankProof instanceof File) {
        currentBankProofUrl = await uploadFile(currentBankProof) || currentBankProofUrl;
      } else if (currentBankProof) { currentBankProofUrl = currentBankProof; }
      else { currentBankProofUrl = ''; }

      // Profile Pic
      let profilePicUrl = employee?.profilePic;
      if (profilePic && profilePic instanceof File) {
        profilePicUrl = await uploadFile(profilePic) || profilePicUrl;
      } else if (profilePic) { profilePicUrl = profilePic; }

      // Payslips
      let processedExperience = [];
      if (experience && experience.length > 0) {
        processedExperience = await Promise.all(experience.map(async (exp) => {
          let pSlips = [];
          if (exp.payslips && exp.payslips.length > 0) {
            for (const item of exp.payslips) {
              if (item instanceof File) {
                const u = await uploadFile(item);
                if (u) pSlips.push(u);
              } else if (typeof item === 'string') { pSlips.push(item); }
            }
          }
          return { ...exp, payslips: pSlips };
        }));
      }

      // Education
      let c10Url = employee?.education?.class10Marksheet;
      let c12Url = employee?.education?.class12Marksheet;
      let diplomaUrl = employee?.education?.diplomaCertificate;
      let bachelorUrl = employee?.education?.bachelorDegree;
      let masterUrl = employee?.education?.masterDegree;
      let ls1Url = employee?.education?.lastSem1Marksheet;
      let ls2Url = employee?.education?.lastSem2Marksheet;
      let ls3Url = employee?.education?.lastSem3Marksheet;

      if (class10Marksheet instanceof File) { c10Url = await uploadFile(class10Marksheet) || c10Url; }
      if (class12Marksheet instanceof File) { c12Url = await uploadFile(class12Marksheet) || c12Url; }
      if (diplomaCertificate instanceof File) { diplomaUrl = await uploadFile(diplomaCertificate) || diplomaUrl; }
      if (bachelorDegree instanceof File) { bachelorUrl = await uploadFile(bachelorDegree) || bachelorUrl; }
      if (masterDegree instanceof File) { masterUrl = await uploadFile(masterDegree) || masterUrl; }

      if (lastSem1 instanceof File) { ls1Url = await uploadFile(lastSem1) || ls1Url; }
      if (lastSem2 instanceof File) { ls2Url = await uploadFile(lastSem2) || ls2Url; }
      if (lastSem3 instanceof File) { ls3Url = await uploadFile(lastSem3) || ls3Url; }

      let aadharFrontUrl = employee?.documents?.aadharFront;
      let aadharBackUrl = employee?.documents?.aadharBack;
      let panUrl = employee?.documents?.panCard;
      if (aadharFront instanceof File) { aadharFrontUrl = await uploadFile(aadharFront) || aadharFrontUrl; }
      if (aadharBack instanceof File) { aadharBackUrl = await uploadFile(aadharBack) || aadharBackUrl; }
      if (panCard instanceof File) { panUrl = await uploadFile(panCard) || panUrl; }

      const payload = {
        firstName, middleName, lastName,
        gender: gender || undefined,
        dob: dob || undefined,
        contactNo, email,
        password: password || undefined,
        maritalStatus: maritalStatus || undefined,
        bloodGroup,
        nationality: nationality || undefined,
        fatherName, motherName,
        emergencyContactName, emergencyContactNumber,
        tempAddress, permAddress: sameAsTemp ? tempAddress : permAddress,
        experience: processedExperience,
        jobType: jobType || undefined,
        bankDetails: { bankName, accountNumber, ifsc, branchName, location: bankLocation, bankProofUrl: currentBankProofUrl },
        education: {
          type: eduType,
          class10Marksheet: c10Url,
          class12Marksheet: c12Url,
          diplomaCertificate: diplomaUrl,
          bachelorDegree: bachelorUrl,
          masterDegree: masterUrl,
          lastSem1Marksheet: ls1Url,
          lastSem2Marksheet: ls2Url,
          lastSem3Marksheet: ls3Url
        },
        documents: {
          aadharFront: aadharFrontUrl,
          aadharBack: aadharBackUrl,
          panCard: panUrl
        },
        role, department: department || undefined, departmentId: departmentId || undefined,
        manager: manager || undefined, joiningDate: joiningDate || undefined,
        profilePic: profilePicUrl,
        status: 'Draft',
        lastStep: step,
        leavePolicy: leavePolicy || undefined, // Add Leave Policy
      };

      if (employee?._id) {
        await api.put(`/hr/employees/${employee._id}`, payload);
      } else {
        await api.post('/hr/employees', payload);
        // If new employee created, we might want to set it so future saves are updates?
        // But for now just alert.
      }
      alert('Draft saved successfully!');
      // onClose(); // Removed as requested: User wants to stay on form
    } catch (err) {
      console.error("Failed to save draft", err);
      alert("Failed to save draft: " + (err.response?.data?.message || err.message));
    } finally { setSaving(false); }
  }

  const stepTitles = ['General Details', 'Address', 'Experience', 'Bank & Job', 'Education Details', 'Identity Documents', 'Account Credentials', 'Payroll / Compensation'];

  return (
    <div>
      <form onSubmit={submit} className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm w-full">
        {/* Step Indicator */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg">{employee ? 'Edit' : 'Add'} Employee - Step {step} of {stepTitles.length}</h3>
          <div className="text-xs text-slate-500">{stepTitles[step - 1]}</div>
        </div>

        {/* Draft Badge */}
        {employee?.status === 'Draft' && (
          <div className="mb-4 bg-amber-50 text-amber-800 text-sm px-3 py-2 rounded border border-amber-200">
            This is a <strong>Draft</strong>. You are currently on Step {step}.
          </div>
        )}

        {/* Step 1: General Details */}
        {step === 1 && (
          <div className="space-y-6">

            {/* Profile Picture Upload */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col md:flex-row items-center gap-6">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md bg-slate-200 flex items-center justify-center">
                  {profilePreview ? (
                    <img src={profilePreview instanceof File ? URL.createObjectURL(profilePreview) : `${BACKEND_URL}${profilePreview}`} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => profilePicRef.current?.click()}
                  className="absolute bottom-0 right-0 bg-blue-600 text-white p-1.5 rounded-full shadow hover:bg-blue-700 transition"
                  title="Upload Photo"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
                <input
                  ref={profilePicRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setProfilePic(file);
                      setProfilePreview(file);
                    }
                  }}
                />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-1">Profile Photo</h4>
                <p className="text-xs text-slate-500 mb-2">Upload a professional photo. Max 2MB. (Optional)</p>
                {profilePic && (
                  <button
                    type="button"
                    onClick={() => { setProfilePic(null); setProfilePreview(null); if (profilePicRef.current) profilePicRef.current.value = ''; }}
                    className="text-xs text-red-500 hover:text-red-700 border border-red-200 bg-red-50 px-3 py-1 rounded-full transition"
                  >
                    Remove Photo
                  </button>
                )}
              </div>
            </div>

            {/* Section: Identity Details */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 border-b border-slate-200 pb-2">Identity Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700">First Name <span className="text-red-500">*</span></label>
                  <input required value={firstName} onChange={e => { const v = e.target.value; setFirstName(v ? v.charAt(0).toUpperCase() + v.slice(1) : v); }} className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.firstName ? 'border-red-500' : 'border-slate-300'}`} placeholder="John" />
                  {errors.firstName && <div className="text-xs text-red-600 mt-1">{errors.firstName}</div>}
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Middle Name</label>
                  <input value={middleName} onChange={e => { const v = e.target.value; setMiddleName(v ? v.charAt(0).toUpperCase() + v.slice(1) : v); }} className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.middleName ? 'border-red-500' : 'border-slate-300'}`} placeholder="D." />
                  {errors.middleName && <div className="text-xs text-red-600 mt-1">{errors.middleName}</div>}
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Last Name <span className="text-red-500">*</span></label>
                  <input required value={lastName} onChange={e => { const v = e.target.value; setLastName(v ? v.charAt(0).toUpperCase() + v.slice(1) : v); }} className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.lastName ? 'border-red-500' : 'border-slate-300'}`} placeholder="Doe" />
                  {errors.lastName && <div className="text-xs text-red-600 mt-1">{errors.lastName}</div>}
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Gender</label>
                  <select
                    value={gender}
                    onChange={e => setGender(e.target.value)}
                    className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.gender ? 'border-red-500' : 'border-slate-300'}`}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.gender && <div className="text-xs text-red-600 mt-1">{errors.gender}</div>}
                </div>
                <div>
                  <DatePicker
                    className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none h-[40px] ${errors.dob ? 'border-red-500' : 'border-slate-300'}`}
                    format="DD-MM-YYYY"
                    placeholder="DD-MM-YYYY"
                    allowClear={false}
                    value={dob ? dayjs(dob) : null}
                    onChange={(date) => setDob(date ? date.format('YYYY-MM-DD') : '')}
                  />
                  {errors.dob && <div className="text-xs text-red-600 mt-1">{errors.dob}</div>}
                </div>
              </div>
            </div>

            {/* Section: Official Information */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 border-b border-slate-200 pb-2">Official Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Department <span className="text-red-500">*</span></label>
                  <select
                    value={departmentId}
                    onChange={e => {
                      const selectedDept = departments.find(d => d._id === e.target.value);
                      setDepartmentId(e.target.value);
                      setDepartment(selectedDept?.name || '');
                    }}
                    className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.department ? 'border-red-500' : 'border-slate-300'}`}
                    required
                  >
                    <option value="">-- Select Department --</option>
                    {departments.map((d) => (
                      <option key={d._id || d} value={d._id || d}>{typeof d === 'string' ? d : d.name}</option>
                    ))}
                  </select>
                  {errors.department && <div className="text-xs text-red-600 mt-1">{errors.department}</div>}
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Manager (Optional)</label>
                  <select
                    value={manager}
                    onChange={e => setManager(e.target.value)}
                    className="w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none border-slate-300"
                  >
                    <option value="">-- No Manager (Top Level) --</option>
                    {managers
                      .filter(m => !departmentId || m.departmentId === departmentId || m.department === department)
                      .map((m) => (
                        <option key={m._id} value={m._id}>
                          {[m.firstName, m.lastName].filter(Boolean).join(' ')} ({m.employeeId}) - {m.role || 'Employee'}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Leave Policy</label>
                  <select
                    value={leavePolicy}
                    onChange={e => setLeavePolicy(e.target.value)}
                    className="w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none border-slate-300"
                  >
                    <option value="">-- Select Leave Policy --</option>
                    {policies.map(p => (
                      <option key={p._id} value={p._id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <DatePicker
                    className="w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none border-slate-300 h-[40px]"
                    format="DD-MM-YYYY"
                    placeholder="DD-MM-YYYY"
                    allowClear={false}
                    value={joiningDate ? dayjs(joiningDate) : null}
                    onChange={(date) => setJoiningDate(date ? date.format('YYYY-MM-DD') : '')}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Designation / Role</label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none border-slate-300"
                  >
                    <option>Employee</option>
                    <option>Manager</option>
                    <option>Dep Head</option>
                    <option>HR</option>
                    <option>Admin</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Job Type</label>
                  <select
                    value={jobType}
                    onChange={e => setJobType(e.target.value)}
                    className="w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none border-slate-300"
                  >
                    <option>Full-Time</option>
                    <option>Part-Time</option>
                    <option>Internship</option>
                    <option>Contract</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section: Personal & Family */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 border-b border-slate-200 pb-2">Personal & Family</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Marital Status</label>
                  <select value={maritalStatus} onChange={e => setMaritalStatus(e.target.value)} className="w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none border-slate-300">
                    <option value="">Select</option>
                    <option>Single</option>
                    <option>Married</option>
                    <option>Divorced</option>
                    <option>Widowed</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Blood Group</label>
                  <select
                    value={bloodGroup}
                    onChange={e => setBloodGroup(e.target.value)}
                    className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.bloodGroup ? 'border-red-500' : 'border-slate-300'}`}
                  >
                    <option value="">Select</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                  {errors.bloodGroup && <div className="text-xs text-red-600 mt-1">{errors.bloodGroup}</div>}
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Nationality</label>
                  <select
                    value={nationality}
                    onChange={e => setNationality(e.target.value)}
                    className="w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none border-slate-300"
                  >
                    <option value="">Select Country</option>
                    {NATIONALITIES.map((nat) => (
                      <option key={nat} value={nat}>{nat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Father's Name</label>
                  <input value={fatherName} onChange={e => { const v = e.target.value; setFatherName(v ? v.charAt(0).toUpperCase() + v.slice(1) : v); }} className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.fatherName ? 'border-red-500' : 'border-slate-300'}`} />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Mother's Name</label>
                  <input value={motherName} onChange={e => { const v = e.target.value; setMotherName(v ? v.charAt(0).toUpperCase() + v.slice(1) : v); }} className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.motherName ? 'border-red-500' : 'border-slate-300'}`} />
                </div>
              </div>
            </div>

            {/* Section: Contact */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 border-b border-slate-200 pb-2">Contact Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Phone Number</label>
                  <input value={contactNo} onChange={e => setContactNo(e.target.value)} className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.contactNo ? 'border-red-500' : 'border-slate-300'}`} />
                  {errors.contactNo && <div className="text-xs text-red-600 mt-1">{errors.contactNo}</div>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Emergency Contact Name</label>
                    <input value={emergencyContactName} onChange={e => { const v = e.target.value; setEmergencyContactName(v ? v.charAt(0).toUpperCase() + v.slice(1) : v); }} className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.emergencyContactName ? 'border-red-500' : 'border-slate-300'}`} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Emergency Contact #</label>
                    <input value={emergencyContactNumber} onChange={e => setEmergencyContactNumber(e.target.value)} className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.emergencyContactNumber ? 'border-red-500' : 'border-slate-300'}`} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Address */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Temporary Address Section */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Temporary Address</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Address Line 1 <span className="text-red-500">*</span></label>
                  <input value={tempAddress.line1} onChange={e => setTempAddress(p => ({ ...p, line1: e.target.value }))} className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.tempLine1 ? 'border-red-500' : 'border-slate-300'}`} placeholder="Street, Sector, Area" />
                  {errors.tempLine1 && <div className="text-xs text-red-600 mt-1">{errors.tempLine1}</div>}
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Address Line 2 (Optional)</label>
                  <input value={tempAddress.line2} onChange={e => setTempAddress(p => ({ ...p, line2: e.target.value }))} className="w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none border-slate-300" placeholder="Landmark, Building Name" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">City <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      value={tempAddress.city}
                      onChange={e => {
                        setTempAddress(p => ({ ...p, city: e.target.value }));
                        setPincodeLoading(true);
                      }}
                      className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.tempCity ? 'border-red-500' : 'border-slate-300'}`}
                      placeholder="Start typing..."
                    />
                    {pincodeLoading && tempAddress.city.length > 2 && <div className="absolute right-2 top-2 text-xs text-blue-500 animate-pulse">Searching...</div>}
                  </div>
                  {errors.tempCity && <div className="text-xs text-red-600 mt-1">{errors.tempCity}</div>}
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">State</label>
                  <input value={tempAddress.state} onChange={e => setTempAddress(p => ({ ...p, state: e.target.value }))} className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.tempState ? 'border-red-500' : 'border-slate-300'}`} disabled />
                  {errors.tempState && <div className="text-xs text-red-600 mt-1">{errors.tempState}</div>}
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Pin/Zip Code <span className="text-red-500">*</span></label>
                  <input value={tempAddress.pinCode} onChange={e => setTempAddress(p => ({ ...p, pinCode: e.target.value }))} onBlur={() => handlePincodeLookup(tempAddress.pinCode, 'temp')} className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.tempPin ? 'border-red-500' : 'border-slate-300'}`} />
                  {errors.tempPin && <div className="text-xs text-red-600 mt-1">{errors.tempPin}</div>}
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Country</label>
                  <input value={tempAddress.country} onChange={e => setTempAddress(p => ({ ...p, country: e.target.value }))} className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.tempCountry ? 'border-red-500' : 'border-slate-300'}`} disabled />
                  {errors.tempCountry && <div className="text-xs text-red-600 mt-1">{errors.tempCountry}</div>}
                </div>
              </div>
            </div>

            {/* Same As Temp Checkbox */}
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <input
                type="checkbox"
                checked={sameAsTemp}
                onChange={e => {
                  const checked = e.target.checked;
                  setSameAsTemp(checked);
                  if (!checked) {
                    setPermAddress({ line1: '', line2: '', city: '', state: '', pinCode: '', country: '' });
                  }
                }}
                id="sameTemp"
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="sameTemp" className="text-sm font-medium text-blue-800 cursor-pointer">Permanent Address is same as Temporary Address</label>
            </div>

            {/* Permanent Address Section */}
            <div className={`bg-slate-50 p-4 rounded-lg border border-slate-200 transition-opacity ${sameAsTemp ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Permanent Address</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Address Line 1 <span className="text-red-500">*</span></label>
                  <input value={permAddress.line1} onChange={e => setPermAddress(p => ({ ...p, line1: e.target.value }))} className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.permLine1 ? 'border-red-500' : 'border-slate-300'}`} disabled={sameAsTemp} />
                  {errors.permLine1 && <div className="text-xs text-red-600 mt-1">{errors.permLine1}</div>}
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Address Line 2 (Optional)</label>
                  <input value={permAddress.line2} onChange={e => setPermAddress(p => ({ ...p, line2: e.target.value }))} className="w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none border-slate-300" disabled={sameAsTemp} />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">City <span className="text-red-500">*</span></label>
                  <input value={permAddress.city} onChange={e => setPermAddress(p => ({ ...p, city: e.target.value }))} onBlur={() => handleCityLookup(permAddress.city, 'perm')} className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.permCity ? 'border-red-500' : 'border-slate-300'}`} disabled={sameAsTemp} />
                  {errors.permCity && <div className="text-xs text-red-600 mt-1">{errors.permCity}</div>}
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">State</label>
                  <input value={permAddress.state} onChange={e => setPermAddress(p => ({ ...p, state: e.target.value }))} className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.permState ? 'border-red-500' : 'border-slate-300'}`} disabled={sameAsTemp} />
                  {errors.permState && <div className="text-xs text-red-600 mt-1">{errors.permState}</div>}
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Pin/Zip Code <span className="text-red-500">*</span></label>
                  <input value={permAddress.pinCode} onChange={e => setPermAddress(p => ({ ...p, pinCode: e.target.value }))} onBlur={() => handlePincodeLookup(permAddress.pinCode, 'perm')} className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.permPin ? 'border-red-500' : 'border-slate-300'}`} disabled={sameAsTemp} />
                  {errors.permPin && <div className="text-xs text-red-600 mt-1">{errors.permPin}</div>}
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Country</label>
                  <input value={permAddress.country} onChange={e => setPermAddress(p => ({ ...p, country: e.target.value }))} className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.permCountry ? 'border-red-500' : 'border-slate-300'}`} disabled={sameAsTemp} />
                  {errors.permCountry && <div className="text-xs text-red-600 mt-1">{errors.permCountry}</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Experience */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-slate-800">Work Experience</h4>
            </div>
            {experience.map((exp, idx) => (
              <div key={idx} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm relative group hover:shadow-md transition">
                {/* Remove Button */}
                {experience.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const copy = [...experience];
                      copy.splice(idx, 1);
                      setExperience(copy);
                    }}
                    className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition"
                    title="Remove Entry"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Left Col: Company Info */}
                  <div>
                    <h5 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3 border-b border-slate-100 pb-1 text-blue-600">Company Details</h5>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-semibold text-slate-700">Company Name <span className="text-red-500">*</span></label>
                        <input placeholder="Ex. Tech Solutions Inc." value={exp.companyName} onChange={e => { const v = e.target.value; const copy = [...experience]; copy[idx].companyName = v ? v.charAt(0).toUpperCase() + v.slice(1) : v; setExperience(copy); }} className="w-full border px-3 py-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none border-slate-300" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-semibold text-slate-700">From Date</label>
                          <DatePicker
                            className="w-full border px-3 py-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none border-slate-300 h-[40px]"
                            format="DD-MM-YYYY"
                            placeholder="DD-MM-YYYY"
                            value={exp.from ? dayjs(exp.from) : null}
                            onChange={(date) => { const copy = [...experience]; copy[idx].from = date ? date.format('YYYY-MM-DD') : ''; setExperience(copy); }}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-slate-700">To Date</label>
                          <DatePicker
                            className="w-full border px-3 py-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none border-slate-300 h-[40px]"
                            format="DD-MM-YYYY"
                            placeholder="DD-MM-YYYY"
                            value={exp.to ? dayjs(exp.to) : null}
                            onChange={(date) => { const copy = [...experience]; copy[idx].to = date ? date.format('YYYY-MM-DD') : ''; setExperience(copy); }}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-slate-700">Last Salary</label>
                        <input placeholder="Ex. 50000" type="number" value={exp.lastDrawnSalary} onChange={e => { const copy = [...experience]; copy[idx].lastDrawnSalary = e.target.value; setExperience(copy); }} className="w-full border px-3 py-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none border-slate-300" />
                      </div>
                    </div>
                  </div>

                  {/* Right Col: Manager Info */}
                  <div>
                    <h5 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3 border-b border-slate-100 pb-1 text-green-600">Reporting Manager</h5>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-semibold text-slate-700">Manager Name <span className="text-red-500">*</span></label>
                        <input placeholder="Full Name" value={exp.reportingPersonName || ''} onChange={e => { const v = e.target.value; const copy = [...experience]; copy[idx].reportingPersonName = v ? v.charAt(0).toUpperCase() + v.slice(1) : v; setExperience(copy); }} className="w-full border px-3 py-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none border-slate-300" />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-slate-700">Manager Email <span className="text-red-500">*</span></label>
                        <input placeholder="email@company.com" value={exp.reportingPersonEmail || ''} onChange={e => { const copy = [...experience]; copy[idx].reportingPersonEmail = e.target.value; setExperience(copy); }} className="w-full border px-3 py-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none border-slate-300" />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-slate-700">Manager Phone</label>
                        <input placeholder="Optional" value={exp.reportingPersonPhone || ''} onChange={e => { const copy = [...experience]; copy[idx].reportingPersonPhone = e.target.value; setExperience(copy); }} className="w-full border px-3 py-2 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none border-slate-300" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Verification Documents */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h5 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3 border-b border-slate-200 pb-1 text-indigo-600">Verification Documents</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Payslips */}
                    <div>
                      <label className="text-sm font-semibold text-slate-700 block mb-2">Payslips (Last 3 Months) <span className="text-red-500">*</span></label>
                      <div className="flex gap-2">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="flex-1">
                            <label className="block bg-white border border-dashed border-slate-300 rounded p-2 text-center cursor-pointer hover:border-blue-400 transition" title={`Upload Month ${i + 1}`}>
                              <div className="text-xs font-semibold text-slate-500 mb-1">Mo. {i + 1}</div>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mx-auto text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                            </label>
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files[0];
                                const copy = [...experience];
                                if (!copy[idx].payslips) copy[idx].payslips = [];
                                copy[idx].payslips[i] = file;
                                setExperience(copy);
                              }}
                            />
                            {exp.payslips && exp.payslips[i] && <div className="text-[10px] text-green-600 text-center mt-1 truncate">{exp.payslips[i].name}</div>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Chequebook */}
                    <div>
                      <label className="text-sm font-semibold text-slate-700 block mb-2">Bank Proof (Cheque/Passbook) <span className="text-red-500">*</span></label>
                      <label className="block bg-white border border-dashed border-slate-300 rounded p-2 text-center cursor-pointer hover:border-blue-400 transition h-[74px] flex flex-col justify-center items-center">
                        <div className="text-xs font-semibold text-slate-500 mb-1">{exp.chequebook ? 'File Selected' : 'Upload File'}</div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mx-auto text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </label>
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          const copy = [...experience];
                          copy[idx].chequebook = file;
                          setExperience(copy);
                        }}
                      />
                      {exp.chequebook && <div className="text-[10px] text-green-600 text-center mt-1 truncate">{exp.chequebook.name}</div>}
                    </div>
                  </div>
                </div>

              </div>
            ))}



            <button
              type="button"
              onClick={() => setExperience([...experience, { companyName: '', from: '', to: '', lastDrawnSalary: '', reportingPersonName: '', reportingPersonEmail: '', reportingPersonContact: '', payslips: [] }])}
              className="w-full py-3 border-2 border-dashed border-blue-200 rounded-lg text-blue-600 hover:bg-blue-50 font-semibold transition flex items-center justify-center gap-2 hover:border-blue-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Another Experience
            </button>
          </div>
        )}

        {/* Step 4: Bank & Job */}
        {/* Step 4: Bank & Job */}
        {step === 4 && (
          <div className="space-y-6">
            {/* Bank Details */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 border-b border-slate-200 pb-2">Bank Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Bank Name</label>
                  <input value={bankName} onChange={e => setBankName(e.target.value)} className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.bankName ? 'border-red-500' : 'border-slate-300'}`} placeholder="HDFC, SBI, etc." />
                  {errors.bankName && <div className="text-xs text-red-600 mt-1">{errors.bankName}</div>}
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Account Number</label>
                  <input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.accountNumber ? 'border-red-500' : 'border-slate-300'}`} placeholder="Account No" />
                  {errors.accountNumber && <div className="text-xs text-red-600 mt-1">{errors.accountNumber}</div>}
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">IFSC Code</label>
                  <div className="relative">
                    <input value={ifsc} onChange={e => setIfsc(e.target.value.toUpperCase())} onBlur={() => handleIfscLookup(ifsc)} className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.ifsc ? 'border-red-500' : 'border-slate-300'}`} placeholder="SBIN000...." />
                    {ifscLoading && <div className="absolute right-3 top-2.5 text-xs text-blue-500 animate-pulse">Checking...</div>}
                  </div>
                  {errors.ifsc && <div className="text-xs text-red-600 mt-1">{errors.ifsc}</div>}
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Branch Name</label>
                  <input value={branchName} onChange={e => setBranchName(e.target.value)} className={`w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none ${errors.branchName ? 'border-red-500' : 'border-slate-300'}`} />
                  {errors.branchName && <div className="text-xs text-red-600 mt-1">{errors.branchName}</div>}
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Bank Location</label>
                  <input value={bankLocation} onChange={e => setBankLocation(e.target.value)} className="w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none border-slate-300" placeholder="City/District" />
                </div>
              </div>

              {/* Bank Proof Upload */}
              <div className="mt-4 pt-4 border-t border-slate-200">
                <label className="text-sm font-semibold text-slate-700 block mb-2">Upload Cheque / Passbook <span className="text-red-500">*</span></label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-white hover:bg-slate-50 transition border-slate-400">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-8 h-8 mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                    <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                    <p className="text-xs text-slate-500">SVG, PNG, JPG or PDF (MAX. 2MB)</p>
                  </div>
                  <input ref={bankProofRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={e => setCurrentBankProof(e.target.files[0])} />
                </label>
                {currentBankProof && (
                  <div className="mt-2 flex items-center justify-between bg-blue-50 px-3 py-2 rounded border border-blue-100">
                    <div className="flex items-center space-x-2 overflow-hidden">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                      {currentBankProof instanceof File ? <span className="text-sm text-blue-700 truncate">{currentBankProof.name}</span> : <a href={`${BACKEND_URL}${currentBankProof}`} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline truncate">View Uploaded File</a>}
                    </div>
                    <button type="button" onClick={() => { setCurrentBankProof(null); if (bankProofRef.current) bankProofRef.current.value = ''; }} className="text-red-500 hover:text-red-700 p-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                    </button>
                  </div>
                )}
                {errors.bankProof && <div className="text-xs text-red-600 mt-1">{errors.bankProof}</div>}
              </div>
            </div>

            {/* Job Details */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 border-b border-slate-200 pb-2">Employment Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Job Type</label>
                  <select value={jobType} onChange={e => setJobType(e.target.value)} className="w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none border-slate-300">
                    <option>Full-Time</option>
                    <option>Part-Time</option>
                    <option>Internship</option>
                    <option>Contract</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Role / Access Level</label>
                  <select value={role} onChange={e => setRole(e.target.value)} className="w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none border-slate-300">
                    <option value="Employee">Employee</option>
                    <option value="Dep Head">Dep Head</option>
                    <option value="Manager">Manager</option>
                    <option value="HR">HR</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Department</label>
                  <select
                    value={departmentId}
                    onChange={e => {
                      const selectedDept = departments.find(d => d._id === e.target.value);
                      setDepartmentId(e.target.value);
                      setDepartment(selectedDept?.name || '');
                    }}
                    className="w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none border-slate-300"
                  >
                    <option value="">-- Select Department --</option>
                    {departments.map(dept => (
                      <option key={dept._id} value={dept._id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Reporting Manager</label>
                  <select
                    value={manager}
                    onChange={e => setManager(e.target.value)}
                    className="w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none border-slate-300"
                  >
                    <option value="">-- No Manager (Top Level) --</option>
                    {managers
                      .filter(m => !departmentId || m.departmentId === departmentId || m.department === department)
                      .map((m) => (
                        <option key={m._id} value={m._id}>
                          {[m.firstName, m.lastName].filter(Boolean).join(' ')} ({m.employeeId})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <DatePicker
                    className="w-full border px-3 py-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none border-slate-300 h-[40px]"
                    format="DD-MM-YYYY"
                    placeholder="DD-MM-YYYY"
                    allowClear={false}
                    value={joiningDate ? dayjs(joiningDate) : null}
                    onChange={(date) => setJoiningDate(date ? date.format('YYYY-MM-DD') : '')}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Education Details */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 border-b border-slate-200 pb-2">Academic Information</h4>

              <div className="mb-6">
                <label className="text-sm font-semibold text-slate-700 block mb-2">Education Track <span className="text-red-500">*</span></label>
                <div className="flex space-x-4">
                  {['Diploma', 'Bachelor'].map((type) => (
                    <label key={type} className={`cursor-pointer px-4 py-2 rounded-lg border flex items-center space-x-2 transition ${eduType === type ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                      <input type="radio" name="eduType" value={type} checked={eduType === type} onChange={e => setEduType(e.target.value)} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                      <span className="font-medium">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 10th Standard (Always Required) */}
                <div className="bg-white p-3 rounded border border-slate-200">
                  <label className="text-sm font-semibold text-slate-700 block mb-2">10th Standard Marksheet <span className="text-red-500">*</span></label>
                  <input ref={c10Ref} type="file" accept="image/*,application/pdf" onChange={e => setClass10Marksheet(e.target.files[0])} className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                  {class10Marksheet && (
                    <div className="mt-2 flex items-center justify-between bg-slate-50 px-2 py-1 rounded">
                      {class10Marksheet instanceof File ? <span className="text-xs text-slate-700 truncate">{class10Marksheet.name}</span> : <a href={`${BACKEND_URL}${class10Marksheet}`} target="_blank" className="text-xs text-blue-600 underline">View File</a>}
                      <button type="button" onClick={() => { setClass10Marksheet(null); if (c10Ref.current) c10Ref.current.value = ''; }} className="text-red-500 font-bold ml-2">×</button>
                    </div>
                  )}
                  {errors.class10 && <div className="text-xs text-red-600 mt-1">{errors.class10}</div>}
                </div>

                {/* Conditional Fields */}
                {eduType === 'Diploma' ? (
                  <>
                    <div className="bg-white p-3 rounded border border-slate-200">
                      <label className="text-sm font-semibold text-slate-700 block mb-2">Diploma Certificate <span className="text-red-500">*</span></label>
                      <input ref={diplomaRef} type="file" accept="image/*,application/pdf" onChange={e => setDiplomaCertificate(e.target.files[0])} className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                      {diplomaCertificate && (
                        <div className="mt-2 flex items-center justify-between bg-slate-50 px-2 py-1 rounded">
                          {diplomaCertificate instanceof File ? <span className="text-xs text-slate-700 truncate">{diplomaCertificate.name}</span> : <a href={`${BACKEND_URL}${diplomaCertificate}`} target="_blank" className="text-xs text-blue-600 underline">View File</a>}
                          <button type="button" onClick={() => { setDiplomaCertificate(null); if (diplomaRef.current) diplomaRef.current.value = ''; }} className="text-red-500 font-bold ml-2">×</button>
                        </div>
                      )}
                      {errors.diploma && <div className="text-xs text-red-600 mt-1">{errors.diploma}</div>}
                      <p className="text-[10px] text-slate-400 mt-1 italic">If certificate not available, upload combined marksheets below.</p>
                    </div>

                    <div className="bg-white p-3 rounded border border-slate-200">
                      <label className="text-sm font-semibold text-slate-700 block mb-2">Optional Degree</label>
                      <input ref={bachelorRef} type="file" accept="image/*,application/pdf" onChange={e => setBachelorDegree(e.target.files[0])} className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                      {bachelorDegree && (
                        <div className="mt-2 flex items-center justify-between bg-slate-50 px-2 py-1 rounded">
                          {bachelorDegree instanceof File ? <span className="text-xs text-slate-700 truncate">{bachelorDegree.name}</span> : <a href={`${BACKEND_URL}${bachelorDegree}`} target="_blank" className="text-xs text-blue-600 underline">View File</a>}
                          <button type="button" onClick={() => { setBachelorDegree(null); if (bachelorRef.current) bachelorRef.current.value = ''; }} className="text-red-500 font-bold ml-2">×</button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-white p-3 rounded border border-slate-200">
                      <label className="text-sm font-semibold text-slate-700 block mb-2">12th Standard Marksheet <span className="text-red-500">*</span></label>
                      <input ref={c12Ref} type="file" accept="image/*,application/pdf" onChange={e => setClass12Marksheet(e.target.files[0])} className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                      {class12Marksheet && (
                        <div className="mt-2 flex items-center justify-between bg-slate-50 px-2 py-1 rounded">
                          {class12Marksheet instanceof File ? <span className="text-xs text-slate-700 truncate">{class12Marksheet.name}</span> : <a href={`${BACKEND_URL}${class12Marksheet}`} target="_blank" className="text-xs text-blue-600 underline">View File</a>}
                          <button type="button" onClick={() => { setClass12Marksheet(null); if (c12Ref.current) c12Ref.current.value = ''; }} className="text-red-500 font-bold ml-2">×</button>
                        </div>
                      )}
                      {errors.class12 && <div className="text-xs text-red-600 mt-1">{errors.class12}</div>}
                    </div>

                    <div className="bg-white p-3 rounded border border-slate-200">
                      <label className="text-sm font-semibold text-slate-700 block mb-2">Bachelor Degree {eduType === 'Bachelor' && <span className="text-red-500">*</span>}</label>
                      <input ref={bachelorRef} type="file" accept="image/*,application/pdf" onChange={e => setBachelorDegree(e.target.files[0])} className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                      {bachelorDegree && (
                        <div className="mt-2 flex items-center justify-between bg-slate-50 px-2 py-1 rounded">
                          {bachelorDegree instanceof File ? <span className="text-xs text-slate-700 truncate">{bachelorDegree.name}</span> : <a href={`${BACKEND_URL}${bachelorDegree}`} target="_blank" className="text-xs text-blue-600 underline">View File</a>}
                          <button type="button" onClick={() => { setBachelorDegree(null); if (bachelorRef.current) bachelorRef.current.value = ''; }} className="text-red-500 font-bold ml-2">×</button>
                        </div>
                      )}
                      {errors.bachelor && <div className="text-xs text-red-600 mt-1">{errors.bachelor}</div>}
                    </div>

                    <div className="bg-white p-3 rounded border border-slate-200">
                      <label className="text-sm font-semibold text-slate-700 block mb-2">Master Degree (Optional)</label>
                      <input ref={masterRef} type="file" accept="image/*,application/pdf" onChange={e => setMasterDegree(e.target.files[0])} className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                      {masterDegree && (
                        <div className="mt-2 flex items-center justify-between bg-slate-50 px-2 py-1 rounded">
                          {masterDegree instanceof File ? <span className="text-xs text-slate-700 truncate">{masterDegree.name}</span> : <a href={`${BACKEND_URL}${masterDegree}`} target="_blank" className="text-xs text-blue-600 underline">View File</a>}
                          <button type="button" onClick={() => { setMasterDegree(null); if (masterRef.current) masterRef.current.value = ''; }} className="text-red-500 font-bold ml-2">×</button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Alternative */}
              <div className="mt-6 pt-4 border-t border-slate-100">
                <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Alternative: Last 3 Semester Marksheets</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[ls1Ref, ls2Ref, ls3Ref].map((ref, i) => {
                    const stateVal = i === 0 ? lastSem1 : i === 1 ? lastSem2 : lastSem3;
                    const setter = i === 0 ? setLastSem1 : i === 1 ? setLastSem2 : setLastSem3;
                    return (
                      <div key={i} className="bg-white p-2 rounded border border-slate-200">
                        <label className="text-[10px] font-semibold text-slate-400 block mb-1">Sem {i + 1} Marksheet</label>
                        <input ref={ref} type="file" accept="image/*,application/pdf" onChange={e => setter(e.target.files[0])} className="block w-full text-[10px] text-slate-500 file:mr-1 file:py-0.5 file:px-2 file:rounded-full file:border-0 file:text-[10px] file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200" />
                        {stateVal && (
                          <div className="mt-1 flex items-center justify-between">
                            {stateVal instanceof File ? <span className="text-[10px] text-slate-600 truncate max-w-[80px]">{stateVal.name}</span> : <a href={`${BACKEND_URL}${stateVal}`} target="_blank" className="text-[10px] text-blue-500 underline">View</a>}
                            <button type="button" onClick={() => { setter(null); if (ref.current) ref.current.value = ''; }} className="text-red-400 font-bold ml-1 text-[10px]">×</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Step 6: Documents & Identity */}
        {/* Step 6: Documents & Identity */}
        {step === 6 && (
          <div className="space-y-6">
            {/* Section 1: Education Documents Preview (Read-Only) */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 border-b border-slate-200 pb-2">Uploaded Education Documents</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: '10th Marksheet', file: class10Marksheet },
                  { label: '12th Marksheet', file: class12Marksheet, show: eduType !== 'Diploma' },
                  { label: 'Diploma Cert', file: diplomaCertificate, show: eduType === 'Diploma' },
                  { label: 'Bachelor Degree', file: bachelorDegree },
                  { label: 'Master Degree', file: masterDegree },
                  { label: 'Last Sem 1', file: lastSem1 },
                  { label: 'Last Sem 2', file: lastSem2 },
                  { label: 'Last Sem 3', file: lastSem3 },
                ].map((item, idx) => {
                  if (item.show === false || !item.file) return null;
                  return (
                    <div key={idx} className="bg-white border rounded p-3 flex flex-col items-center shadow-sm">
                      <div className="w-full h-24 bg-slate-100 mb-2 rounded overflow-hidden flex items-center justify-center border border-slate-200">
                        {renderFilePreview(item.file, item.label)}
                      </div>
                      <span className="text-xs font-semibold text-center text-slate-700 block truncate w-full" title={item.label}>{item.label}</span>
                    </div>
                  );
                })}
                {/* Empty State if no docs */}
                {![class10Marksheet, class12Marksheet, diplomaCertificate, bachelorDegree, masterDegree, lastSem1, lastSem2, lastSem3].some(f => f) && (
                  <div className="col-span-full text-center text-sm text-slate-500 py-4 italic">No education documents uploaded in Step 5.</div>
                )}
              </div>
            </div>

            {/* Section 2: Personal Identity (Aadhar/Pan) */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 border-b border-slate-200 pb-2">Identity Verification</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Aadhar Front */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Aadhar Front <span className="text-red-500">*</span></label>
                  <div className="bg-white p-3 rounded border border-slate-200 flex flex-col gap-3">
                    {aadharFront ? (
                      <div className="relative group">
                        <div className="w-full h-32 bg-slate-100 rounded overflow-hidden border flex items-center justify-center">
                          {renderFilePreview(aadharFront, 'Aadhar Front')}
                        </div>
                        <button
                          type="button"
                          onClick={() => { setAadharFront(null); if (aadharFrontRef.current) aadharFrontRef.current.value = ''; }}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600 opacity-0 group-hover:opacity-100 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-300 rounded cursor-pointer hover:bg-slate-50 transition">
                        <div className="text-center">
                          <svg className="mx-auto h-8 w-8 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          <p className="mt-1 text-xs text-slate-500">Upload Front</p>
                        </div>
                        <input ref={aadharFrontRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={e => setAadharFront(e.target.files[0])} />
                      </label>
                    )}
                    {errors.aadharFront && <div className="text-xs text-red-600">{errors.aadharFront}</div>}
                  </div>
                </div>

                {/* Aadhar Back */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Aadhar Back <span className="text-red-500">*</span></label>
                  <div className="bg-white p-3 rounded border border-slate-200 flex flex-col gap-3">
                    {aadharBack ? (
                      <div className="relative group">
                        <div className="w-full h-32 bg-slate-100 rounded overflow-hidden border flex items-center justify-center">
                          {renderFilePreview(aadharBack, 'Aadhar Back')}
                        </div>
                        <button
                          type="button"
                          onClick={() => { setAadharBack(null); if (aadharBackRef.current) aadharBackRef.current.value = ''; }}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600 opacity-0 group-hover:opacity-100 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-300 rounded cursor-pointer hover:bg-slate-50 transition">
                        <div className="text-center">
                          <svg className="mx-auto h-8 w-8 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          <p className="mt-1 text-xs text-slate-500">Upload Back</p>
                        </div>
                        <input ref={aadharBackRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={e => setAadharBack(e.target.files[0])} />
                      </label>
                    )}
                    {errors.aadharBack && <div className="text-xs text-red-600">{errors.aadharBack}</div>}
                  </div>
                </div>

                {/* PAN Card */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">PAN Card <span className="text-red-500">*</span></label>
                  <div className="bg-white p-3 rounded border border-slate-200 flex flex-col gap-3">
                    {panCard ? (
                      <div className="relative group">
                        <div className="w-full h-32 bg-slate-100 rounded overflow-hidden border flex items-center justify-center">
                          {renderFilePreview(panCard, 'PAN Card')}
                        </div>
                        <button
                          type="button"
                          onClick={() => { setPanCard(null); if (panRef.current) panRef.current.value = ''; }}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600 opacity-0 group-hover:opacity-100 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-300 rounded cursor-pointer hover:bg-slate-50 transition">
                        <div className="text-center">
                          <svg className="mx-auto h-8 w-8 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          <p className="mt-1 text-xs text-slate-500">Upload PAN</p>
                        </div>
                        <input ref={panRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={e => setPanCard(e.target.files[0])} />
                      </label>
                    )}
                    {errors.panCard && <div className="text-xs text-red-600">{errors.panCard}</div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 7: Account Credentials */}
        {step === 7 && (
          <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-3 mb-6 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
              Account Credentials
            </h3>

            <div className="bg-white p-4 rounded-lg flex items-center justify-between border border-blue-100 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="bg-blue-50 p-2 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
                </div>
                <div>
                  <span className="text-xs text-blue-600 font-bold uppercase tracking-wider block mb-1">Employee ID</span>
                  <span className="text-2xl font-bold text-slate-800 tracking-tight">{employeeCode || (employee?.employeeId ? employee.employeeId : 'Generating...')}</span>
                </div>
                {(!employeeCode && !employee?.employeeId) || employeeCode.startsWith('Error') ? (
                  <button
                    type="button"
                    onClick={() => { setEmployeeCode('Generating...'); loadEmployeeCodePreview(); }}
                    className="text-xs bg-white border border-blue-200 text-blue-600 px-3 py-1.5 rounded hover:bg-blue-50 font-medium transition"
                  >
                    Retry
                  </button>
                ) : null}
              </div>
              <div className="text-xs text-slate-500 max-w-xs text-right hidden sm:block leading-relaxed bg-slate-100 p-2 rounded border border-slate-200">
                <span className="font-semibold text-slate-700">Auto-Generated:</span> Based on company prefix, department code, and sequence number.
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mt-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Login Email <span className="text-red-500">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={`w-full pl-10 p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${errors.email ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-white'}`}
                    placeholder="employee@company.com"
                    disabled={viewOnly && step !== 7}
                  />
                </div>
                {errors.email && <p className="text-red-600 text-xs mt-1 font-medium">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Login Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={`w-full pl-10 p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${errors.password ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-white'}`}
                    placeholder="Create strong password"
                    disabled={viewOnly && step !== 7}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition">
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
                {errors.password && <p className="text-red-600 text-xs mt-1 font-medium">{errors.password}</p>}
              </div>
            </div>
          </div>
        )}
        {/* Step 8: Payroll / Compensation */}
        {step === 8 && (
          <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 shadow-sm space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-emerald-600" />
                Payroll / Compensation
              </h3>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">
                {salaryStatus}
              </span>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Salary Template <span className="text-red-500">*</span>
                </label>
                <select
                  className={`w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white ${errors.salaryTemplate ? 'border-red-500' : 'border-slate-300'}`}
                  value={salaryTemplateId}
                  onChange={handleTemplateChange}
                >
                  <option value="">-- Select Template --</option>
                  {salaryTemplates.map(t => (
                    <option key={t._id} value={t._id}>{t.name} (CTC: {t.annualCTC})</option>
                  ))}
                </select>
                {errors.salaryTemplate && <p className="text-red-600 text-xs mt-1">{errors.salaryTemplate}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Effective From <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className={`w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white ${errors.effectiveDate ? 'border-red-500' : 'border-slate-300'}`}
                  value={salaryEffectiveDate}
                  onChange={e => setSalaryEffectiveDate(e.target.value)}
                />
                {errors.effectiveDate && <p className="text-red-600 text-xs mt-1">{errors.effectiveDate}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Pay Frequency</label>
                <input type="text" value="Monthly" disabled className="w-full p-2.5 border border-slate-200 bg-slate-100 text-slate-500 rounded-lg cursor-not-allowed" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="salaryStatus" value="Active" checked={salaryStatus === 'Active'} onChange={e => setSalaryStatus(e.target.value)} />
                    <span className="text-sm">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="salaryStatus" value="Inactive" checked={salaryStatus === 'Inactive'} onChange={e => setSalaryStatus(e.target.value)} />
                    <span className="text-sm">Inactive</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Preview Section */}
            {selectedTemplateDetails && (
              <div className="bg-white p-4 rounded border border-slate-200 mt-4">
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 border-b pb-2">Compensation Preview</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-slate-50 p-2 rounded">
                    <div className="text-xs text-slate-500">Annual CTC</div>
                    <div className="font-bold text-slate-800">₹{selectedTemplateDetails.annualCTC?.toLocaleString()}</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded">
                    <div className="text-xs text-slate-500">Monthly Gross</div>
                    <div className="font-bold text-slate-800">₹{selectedTemplateDetails.monthlyGross?.toLocaleString()}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-xs font-bold text-green-700 mb-2">Earnings</h5>
                    <ul className="text-xs space-y-1">
                      {selectedTemplateDetails.earnings.map((e, i) => (
                        <li key={i} className="flex justify-between">
                          <span>{e.salaryComponentId?.name || 'Component'}</span>
                          <span className="font-mono">₹{e.monthlyAmount?.toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-red-700 mb-2">Deductions</h5>
                    <ul className="text-xs space-y-1">
                      {selectedTemplateDetails.deductions.map((d, i) => (
                        <li key={i} className="flex justify-between">
                          <span>{d.salaryComponentId?.name || 'Component'}</span>
                          <span className="font-mono">₹{d.monthlyAmount?.toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4">
              {!viewOnly && (
                <button
                  type="button"
                  onClick={saveSalaryAssignment}
                  className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 flex items-center gap-2 text-sm font-medium"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Assignment'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between gap-2 mt-6 pt-4 border-t border-slate-200">
          <button type="button" onClick={() => step > 1 ? handlePrev() : onClose()} className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition shadow-sm">{step > 1 ? 'Previous' : (viewOnly ? 'Close' : 'Cancel')}</button>

          <div className="flex gap-3">

            {(!viewOnly) && (
              <button
                type="button"
                onClick={(e) => saveDraft(e)}
                className="px-5 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 font-medium transition shadow-sm"
                disabled={saving}
              >
                Save as Draft
              </button>
            )}

            {step < 8 ? (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); handleNext(); }}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-md hover:shadow-lg transition flex items-center gap-2"
              >
                Next
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            ) : (
              (!viewOnly) ? (
                <button
                  onClick={(e) => submit(e)}
                  disabled={saving}
                  className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-md hover:shadow-lg transition flex items-center gap-2"
                >
                  {saving ? 'Saving...' : 'Finish & Close'}
                  {!saving && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                </button>
              ) : (
                <button type="button" onClick={onClose} className="px-5 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-medium shadow-sm">Close</button>
              )
            )}
          </div>
        </div>
      </form>

      {/* View Only Overlay style for inputs */}
      {viewOnly && (
        <style>{`
          .employee-form input, .employee-form select, .employee-form textarea {
             pointer-events: none;
             background-color: #f8fafc;
             color: #475569;
          }
          .employee-form input[type="file"] {
             display: none;
          }
           /* Keep buttons clickable */
           .employee-form button { pointer-events: auto; }
           .employee-form a { pointer-events: auto; }
        `}</style>
      )}
    </div>
  );
}

// Helper components for EmployeeProfileView
const InfoItem = ({ label, value }) => (
  <div className="mb-4">
    <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</span>
    <span className="text-sm font-medium text-slate-900 break-words">{value || '-'}</span>
  </div>
);

const SectionTitle = ({ title, icon }) => (
  <h3 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-3 mb-4 flex items-center gap-2">
    {icon} {title}
  </h3>
);

const FileLink = ({ url, label }) => {
  if (!url) return <span className="text-slate-400 text-sm italic py-1 block">Not uploaded</span>;
  return (
    <a href={`${BACKEND_URL}${url}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-2 rounded-lg transition border border-blue-100 hover:border-blue-200 mb-2">
      <div className="bg-white p-1 rounded text-blue-500">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
      </div>
      <span className="text-sm font-medium truncate flex-1">{label || 'View Document'}</span>
      <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
    </a>
  );
};