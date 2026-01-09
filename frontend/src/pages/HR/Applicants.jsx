import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api'; // Centralized axios instance with auth & tenant headers
import { useAuth } from '../../context/AuthContext';
import OfferLetterPreview from '../../components/OfferLetterPreview';
import AssignSalaryModal from '../../components/AssignSalaryModal';
import { DatePicker, Pagination, Select } from 'antd';
import dayjs from 'dayjs';
import { Eye, Download, Edit2, RefreshCw, DollarSign, IndianRupee, Upload, FileText, CheckCircle, Settings, Plus, Trash2, X, GripVertical, Star, XCircle, Clock } from 'lucide-react';

export default function Applicants() {
    const navigate = useNavigate();
    const [applicants, setApplicants] = useState([]);
    const [loading, setLoading] = useState(false);

    const [requirements, setRequirements] = useState([]);
    const [selectedRequirement, setSelectedRequirement] = useState(null); // Full requirement object
    const [selectedReqId, setSelectedReqId] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [timeFilter, setTimeFilter] = useState('all'); // Added Time Filter State

    // Tab State: Dynamic based on Requirement Workflow
    // Start with default tabs for 'all' view
    const [activeTab, setActiveTab] = useState('new');
    const [workflowTabs, setWorkflowTabs] = useState(['new', 'interview', 'final']);



    // Workflow Editing State
    const [showWorkflowEditModal, setShowWorkflowEditModal] = useState(false);
    const [editingWorkflow, setEditingWorkflow] = useState([]);
    const [newStageName, setNewStageName] = useState('');

    const openWorkflowEditor = () => {
        if (!selectedRequirement) return;
        // Ensure we have at least the basic structure if empty
        const current = selectedRequirement.workflow && selectedRequirement.workflow.length > 0
            ? [...selectedRequirement.workflow]
            : ['Applied', 'Shortlisted', 'Interview', 'Finalized'];
        setEditingWorkflow(current);
        setShowWorkflowEditModal(true);
    };

    const handleStageAdd = () => {
        if (newStageName.trim()) {
            // Insert before 'Finalized' if it exists to keep logical order, or just append
            const newList = [...editingWorkflow];
            const finalIdx = newList.indexOf('Finalized');
            if (finalIdx !== -1) {
                newList.splice(finalIdx, 0, newStageName.trim());
            } else {
                newList.push(newStageName.trim());
            }
            setEditingWorkflow(newList);
            setNewStageName('');
        }
    };

    const handleStageRemove = (index) => {
        const newList = [...editingWorkflow];
        newList.splice(index, 1);
        setEditingWorkflow(newList);
    };

    const saveWorkflowChanges = async () => {
        if (!selectedRequirement) return;
        try {
            setLoading(true);
            await api.put(`/requirements/${selectedRequirement._id}`, {
                workflow: editingWorkflow
            });

            // Refresh requirements to reflect changes
            const res = await api.get('/requirements');
            setRequirements(res.data || []);

            // Update current selection
            const updatedReq = res.data.find(r => r._id === selectedRequirement._id);
            setSelectedRequirement(updatedReq);

            // Trigger tab recalc
            // logic in useEffect will handle it based on updated selectedRequirement

            setShowWorkflowEditModal(false);
            alert('Workflow updated successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to update workflow');
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        // Fetch Requirements for dropdown
        async function fetchReqs() {
            try {
                const res = await api.get('/requirements');
                setRequirements(res.data || []);
            } catch (err) {
                console.error("Failed to load requirements", err);
            }
        }
        fetchReqs();
    }, []);

    // Handle Requirement Selection
    const handleRequirementChange = (reqId) => {
        setSelectedReqId(reqId);
        if (reqId === 'all') {
            setSelectedRequirement(null);
            // setWorkflowTabs handle by useEffect
            setActiveTab('new');
        } else {
            const req = requirements.find(r => r._id === reqId);
            setSelectedRequirement(req);

            // Set default active tab
            if (req && req.workflow && req.workflow.length > 0) {
                setActiveTab(req.workflow[0]);
            } else {
                setActiveTab('Applied');
            }
        }
    };

    // Dynamic Tab Calculation (Includes Custom/Ad-hoc Stages)
    useEffect(() => {
        if (selectedReqId === 'all') {
            setWorkflowTabs(['new', 'final']);
            if (activeTab === 'interview') setActiveTab('new');
        } else if (selectedRequirement) {
            let baseParams = selectedRequirement.workflow && selectedRequirement.workflow.length > 0
                ? [...selectedRequirement.workflow]
                : ['Applied', 'Shortlisted', 'Interview', 'Finalized'];

            // Find "Ad-hoc" statuses from current applicants for this job
            const relevantApplicants = applicants.filter(a => a.requirementId?._id === selectedReqId || a.requirementId === selectedReqId);
            const foundStatuses = [...new Set(relevantApplicants.map(a => a.status))];

            const extraStatuses = foundStatuses.filter(s =>
                !baseParams.includes(s) &&
                !['Selected', 'Rejected', 'Finalized', 'Offer Generated', 'Salary Assigned', 'Interview Scheduled', 'Interview Rescheduled', 'Interview Completed', 'New Round'].includes(s)
            );

            // Insert extra statuses before 'Finalized' if present, else append
            const finalIndex = baseParams.indexOf('Finalized');
            if (finalIndex > -1) {
                baseParams.splice(finalIndex, 0, ...extraStatuses);
            } else {
                baseParams.push(...extraStatuses);
            }

            setWorkflowTabs(baseParams);
        }
    }, [selectedReqId, selectedRequirement, applicants]);

    // Custom Stage State
    const [isCustomStageModalVisible, setIsCustomStageModalVisible] = useState(false);
    const [customStageName, setCustomStageName] = useState('');
    const [candidateForCustomStage, setCandidateForCustomStage] = useState(null);

    const handleAddCustomStage = async () => {
        if (!customStageName.trim() || !candidateForCustomStage) return;
        await updateStatus(candidateForCustomStage, customStageName);
        setIsCustomStageModalVisible(false);
        setCustomStageName('');
        setCandidateForCustomStage(null);
    };

    // Drag and Drop Refs
    const dragItem = React.useRef(null);
    const dragOverItem = React.useRef(null);

    const handleSort = () => {
        // duplicate items
        let _workflowItems = [...editingWorkflow];

        // remove and save the dragged item content
        const draggedItemContent = _workflowItems.splice(dragItem.current, 1)[0];

        // switch the position
        _workflowItems.splice(dragOverItem.current, 0, draggedItemContent);

        // reset the position ref
        dragItem.current = null;
        dragOverItem.current = null;

        // update the actual array
        setEditingWorkflow(_workflowItems);
    };

    // Cumulative Filtering Logic: Check if a candidate's status has reached or passed a specific tab
    const checkStatusPassage = (applicantStatus, targetTab, tabsArray) => {
        const interviewStatuses = ['Interview Scheduled', 'Interview Rescheduled', 'Interview Completed', 'New Round'];

        let normalizedApp = applicantStatus;
        let normalizedTarget = targetTab;

        if (['Selected', 'Rejected', 'Finalized', 'final'].includes(normalizedApp)) {
            normalizedApp = tabsArray.includes('Finalized') ? 'Finalized' : (tabsArray.includes('final') ? 'final' : normalizedApp);
        }
        if (['Selected', 'Rejected', 'Finalized', 'final'].includes(normalizedTarget)) {
            normalizedTarget = tabsArray.includes('Finalized') ? 'Finalized' : (tabsArray.includes('final') ? 'final' : normalizedTarget);
        }

        if (interviewStatuses.includes(normalizedApp)) {
            if (tabsArray.includes('interview')) normalizedApp = 'interview';
            else if (tabsArray.includes('Interview')) normalizedApp = 'Interview';
            else if (tabsArray.includes('Shortlisted')) normalizedApp = 'Shortlisted';
        }

        if (normalizedApp === 'Applied' && tabsArray.includes('new')) normalizedApp = 'new';
        if (normalizedTarget === 'Applied' && tabsArray.includes('new')) normalizedTarget = 'new';

        const statusIdx = tabsArray.indexOf(normalizedApp);
        const targetIdx = tabsArray.indexOf(normalizedTarget);

        if (statusIdx === -1 || targetIdx === -1) {
            return applicantStatus === targetTab;
        }

        return statusIdx >= targetIdx;
    };

    const getFilteredApplicants = () => {
        let filtered = applicants;

        // 1. Filter by Search Query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(a =>
                a.name.toLowerCase().includes(query) ||
                a.email.toLowerCase().includes(query) ||
                (a.mobile && a.mobile.includes(query))
            );
        }

        // 2. Filter by Requirement ID
        if (selectedReqId !== 'all') {
            filtered = filtered.filter(a => a.requirementId?._id === selectedReqId || a.requirementId === selectedReqId);
        }

        // 3. Filter by Time Range
        if (timeFilter !== 'all') {
            const now = dayjs();
            let startDate;
            if (timeFilter === 'today') startDate = now.startOf('day');
            else if (timeFilter === 'week') startDate = now.subtract(7, 'days');
            else if (timeFilter === '15days') startDate = now.subtract(15, 'days');
            else if (timeFilter === 'month') startDate = now.subtract(1, 'month');

            if (startDate) {
                filtered = filtered.filter(a => dayjs(a.createdAt).isAfter(startDate));
            }
        }

        // 4. Filter by Active Tab (Stage)
        if (selectedReqId === 'all') {
            // Global Pipeline: USE EXACT/EXCLUSIVE FILTERING (User request)
            if (activeTab === 'new') return filtered.filter(a => a.status === 'Applied');
            if (activeTab === 'interview') return filtered.filter(a => ['Shortlisted', 'Interview Scheduled', 'Interview Rescheduled', 'Interview Completed', 'New Round'].some(s => a.status.includes(s) || a.status.includes('Round')));
            if (activeTab === 'final') return filtered.filter(a => ['Selected', 'Rejected', 'Finalized'].includes(a.status));
            return filtered;
        }

        // Specific Job Workflow: USE INCLUSIVE LOGIC (Preserve history)
        return filtered.filter(a => checkStatusPassage(a.status, activeTab, workflowTabs));
    };

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [showCandidateModal, setShowCandidateModal] = useState(false);

    // File Upload State
    const fileInputRef = React.useRef(null);
    const [uploading, setUploading] = useState(false);

    const triggerFileUpload = (applicant) => {
        setSelectedApplicant(applicant);
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; // Reset
            fileInputRef.current.click();
        }
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedApplicant) return;

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        try {
            await api.post(`/requirements/applicants/${selectedApplicant._id}/upload-salary-excel`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert("Excel uploaded successfully! Variables are now available for Letter Templates.");
            loadApplicants(); // Refresh incase we show status
        } catch (error) {
            console.error(error);
            alert("Upload failed: " + (error.response?.data?.error || error.message));
        } finally {
            setUploading(false);
        }
    };
    const [selectedApplicant, setSelectedApplicant] = useState(null);
    const [selectedStatusForReview, setSelectedStatusForReview] = useState(null);
    const [offerData, setOfferData] = useState({
        joiningDate: '',
        location: '',
        templateId: '',
        position: '',
        probationPeriod: '3 months',
        templateContent: '',
        isWordTemplate: false,
        refNo: '',
        fatherName: ''
    });
    const [previewPdfUrl, setPreviewPdfUrl] = useState(null);

    // Joining Letter State
    const [showJoiningModal, setShowJoiningModal] = useState(false);
    const [joiningTemplateId, setJoiningTemplateId] = useState('');
    const [joiningTemplates, setJoiningTemplates] = useState([]);
    const [joiningPreviewUrl, setJoiningPreviewUrl] = useState(null);
    const [showJoiningPreview, setShowJoiningPreview] = useState(false);

    // Salary Assignment State
    const [showSalaryModal, setShowSalaryModal] = useState(false);
    const [showSalaryPreview, setShowSalaryPreview] = useState(false);


    // Review Modal State
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewForm, setReviewForm] = useState({ rating: 0, feedback: '', scorecard: {} });
    const [showEvaluationDrawer, setShowEvaluationDrawer] = useState(false);

    // Document Upload States
    const [showDocumentModal, setShowDocumentModal] = useState(false);
    const [documentApplicant, setDocumentApplicant] = useState(null);
    const [uploadedDocuments, setUploadedDocuments] = useState([]);
    const [documentName, setDocumentName] = useState('');
    const [documentFile, setDocumentFile] = useState(null);
    const [evalActiveRound, setEvalActiveRound] = useState(0);
    const [evaluationData, setEvaluationData] = useState({
        rounds: [
            {
                id: "screening",
                name: "HR Screening",
                categories: [
                    {
                        name: "Communication & Professionalism",
                        skills: [
                            { name: "Verbal Communication", rating: 0, comment: "" },
                            { name: "Clarity of Thought", rating: 0, comment: "" },
                            { name: "Professional Attitude", rating: 0, comment: "" },
                        ],
                    },
                ],
            },
            {
                id: "technical",
                name: "Technical Interview",
                categories: [
                    {
                        name: "Technical Skills",
                        skills: [
                            { name: "Problem Solving", rating: 0, comment: "" },
                            { name: "System Design", rating: 0, comment: "" },
                            { name: "Coding Skills", rating: 0, comment: "" },
                        ],
                    },
                ],
            },
            {
                id: "managerial",
                name: "Hiring Manager Round",
                categories: [
                    {
                        name: "Leadership & Ownership",
                        skills: [
                            { name: "Decision Making", rating: 0, comment: "" },
                            { name: "Culture Fit", rating: 0, comment: "" },
                        ],
                    },
                ],
            }
        ]
    });

    const [generating, setGenerating] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;
    const [templates, setTemplates] = useState([]);
    const [companyInfo, setCompanyInfo] = useState({
        name: 'Gitakshmi Technologies',
        tagline: 'TECHNOLOGIES',
        address: 'Ahmedabad, Gujarat - 380051',
        phone: '+91 1234567890',
        email: 'hr@gitakshmi.com',
        website: 'www.gitakshmi.com',
        refPrefix: 'GITK',
        signatoryName: 'HR Manager',
        logo: 'https://via.placeholder.com/150x60/4F46E5/FFFFFF?text=COMPANY+LOGO' // Placeholder logo
    });

    // Interview State
    const [showInterviewModal, setShowInterviewModal] = useState(false);
    const [isReschedule, setIsReschedule] = useState(false);
    const [interviewData, setInterviewData] = useState({
        date: '',
        time: '',
        mode: 'Online',
        location: '',
        interviewerName: '',
        notes: ''
    });

    const openScheduleModal = (applicant, reschedule = false) => {
        setSelectedApplicant(applicant);
        setIsReschedule(reschedule);
        // Pre-fill if rescheduling
        if (reschedule && applicant.interview) {
            setInterviewData({
                date: applicant.interview.date ? dayjs(applicant.interview.date).format('YYYY-MM-DD') : '',
                time: applicant.interview.time || '',
                mode: applicant.interview.mode || 'Online',
                location: applicant.interview.location || '',
                interviewerName: applicant.interview.interviewerName || '',
                notes: applicant.interview.notes || ''
            });
        } else {
            setInterviewData({ date: '', time: '', mode: 'Online', location: '', interviewerName: '', notes: '' });
        }
        setShowInterviewModal(true);
    };

    const handleInterviewSubmit = async () => {
        if (!selectedApplicant) return;
        setLoading(true);
        try {
            const url = isReschedule
                ? `/requirements/applicants/${selectedApplicant._id}/interview/reschedule`
                : `/requirements/applicants/${selectedApplicant._id}/interview/schedule`;

            const method = isReschedule ? 'put' : 'post';

            await api[method](url, { ...interviewData, stage: activeTab });

            alert(isReschedule ? 'Interview Rescheduled Successfully!' : 'Interview Scheduled Successfully!');
            setShowInterviewModal(false);
            loadApplicants();
        } catch (error) {
            console.error(error);
            alert("Operation failed: " + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    const markInterviewCompleted = (applicant) => {
        setSelectedApplicant(applicant);
        setIsFinishingInterview(true);
        setSelectedStatusForReview('');
        setReviewRating(0);
        setReviewFeedback('');
        setShowEvaluationDrawer(true);
    };

    const updateStatus = async (applicant, status, review = null) => {
        // Only confirm if no review is being sent (direct status change)
        if (!review && !confirm(`Update status to ${status}? This will trigger an email.`)) return;

        try {
            const payload = { status };
            if (review) {
                payload.rating = review.rating;
                payload.feedback = review.feedback;
                payload.scorecard = review.scorecard; // Added scorecard
                payload.stageName = activeTab;
            }
            await api.patch(`/requirements/applicants/${applicant._id}/status`, payload);
            loadApplicants();
            return true;
        } catch (error) {
            alert("Failed: " + error.message);
            return false;
        }
    };

    const openReviewPrompt = (applicant, status) => {
        setSelectedApplicant(applicant);
        setSelectedStatusForReview(status);
        setReviewRating(0);
        setReviewFeedback('');
        setShowEvaluationDrawer(true);
    };

    const submitReviewAndStatus = async () => {
        if (!selectedApplicant || !selectedStatusForReview) return;

        setLoading(true);
        try {
            // 1. If finishing interview, mark it complete in DB first
            if (isFinishingInterview) {
                await api.put(`/requirements/applicants/${selectedApplicant._id}/interview/complete`);
            }

            // 2. Update status with review and full scorecard
            const success = await updateStatus(selectedApplicant, selectedStatusForReview, {
                rating: reviewRating,
                feedback: reviewFeedback,
                scorecard: evaluationData
            });

            if (success) {
                const status = selectedStatusForReview; // Save before clear
                const applicant = selectedApplicant;

                setShowEvaluationDrawer(false);
                setShowReviewModal(false);
                setIsFinishingInterview(false);
                setReviewRating(0);
                setReviewFeedback('');
                setSelectedStatusForReview('');
                setEvalActiveRound(0);

                // Trigger scheduling if appropriate
                if (status === 'Shortlisted' || status.includes('Interview')) {
                    openScheduleModal(applicant);
                }
            }
        } catch (error) {
            alert("Failed to complete action: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    async function loadApplicants() {
        setLoading(true);
        try {
            // Uses centralized api instance - automatically includes Authorization & X-Tenant-ID headers
            const res = await api.get('/requirements/applicants');
            setApplicants(res.data || []);
        } catch (err) {
            console.error(err);
            alert('Failed to load applicants');
        } finally {
            setLoading(false);
        }
    }

    async function fetchTemplates() {
        // Fetch Offer Templates
        try {
            const offerRes = await api.get('/letters/templates?type=offer');
            setTemplates(offerRes.data || []);
        } catch (err) {
            console.error("Failed to load offer templates", err);
        }

        // Fetch Joining Templates (independently)
        try {
            const joiningRes = await api.get('/letters/templates?type=joining');
            setJoiningTemplates(joiningRes.data || []);
        } catch (err) {
            // Non-critical, just log
            console.warn("Failed to load joining templates (might be empty or missing permission)", err.message);
        }
    }

    // Auth check for loading data
    const { user } = useAuth(); // Ensure useAuth is imported if not already, or use context if available in scope. 
    // Wait, useAuth hook is not imported in this file. I need to add it first.

    // Unified data refresh function
    const refreshData = async () => {
        setLoading(true);
        await Promise.all([
            loadApplicants(),
            fetchTemplates()
        ]);
        setLoading(false);
    };

    useEffect(() => {
        // Load data on mount if user is authenticated
        // We check if user exists (context) OR if we have a token in local storage to avoid waiting for context if unnecessary
        const token = localStorage.getItem('token');
        if (user || token) {
            refreshData();
        }
    }, [user]); // Keep user as dependency to re-run if auth state changes

    // ==================== DOCUMENT HELPER FUNCTIONS ====================

    // Helper function to check if all documents are verified
    const areAllDocumentsVerified = (applicant) => {
        if (!applicant.customDocuments || applicant.customDocuments.length === 0) {
            return false; // No documents uploaded, so CTC button should be disabled
        }
        return applicant.customDocuments.every(doc => doc.verified === true);
    };

    // Open document upload modal
    const openDocumentModal = (applicant) => {
        setDocumentApplicant(applicant);
        setUploadedDocuments(applicant.customDocuments || []);
        setDocumentName('');
        setDocumentFile(null);
        setShowDocumentModal(true);
    };

    // Handle document file selection
    const handleDocumentFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
            if (!allowedTypes.includes(file.type)) {
                alert('Only PDF, JPG, and PNG files are allowed');
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                alert('File size must be less than 5MB');
                return;
            }

            setDocumentFile(file);
        }
    };

    // Add document to list
    const addDocumentToList = () => {
        if (!documentName.trim()) {
            alert('Please enter document name');
            return;
        }

        if (!documentFile) {
            alert('Please select a file');
            return;
        }

        const newDoc = {
            name: documentName.trim(),
            fileName: documentFile.name,
            fileSize: documentFile.size,
            fileType: documentFile.type,
            file: documentFile,
            verified: false,
            uploadedAt: new Date()
        };

        setUploadedDocuments(prev => [...prev, newDoc]);
        setDocumentName('');
        setDocumentFile(null);

        const fileInput = document.getElementById('documentFileInput');
        if (fileInput) fileInput.value = '';

        alert('Document added to list');
    };

    // Remove document from list
    const removeDocumentFromList = (index) => {
        setUploadedDocuments(prev => prev.filter((_, idx) => idx !== index));
    };

    // Save all documents to backend
    const saveDocuments = async () => {
        if (uploadedDocuments.length === 0) {
            alert('Please add at least one document');
            return;
        }

        try {
            const formData = new FormData();

            uploadedDocuments.forEach((doc, index) => {
                if (doc.file) {
                    formData.append('documents', doc.file);
                    formData.append(`documentNames[${index}]`, doc.name);
                }
            });

            await api.post(
                `/requirements/applicants/${documentApplicant._id}/documents`,
                formData,
                {
                    headers: { 'Content-Type': 'multipart/form-data' }
                }
            );

            alert('Documents uploaded successfully');
            setShowDocumentModal(false);
            loadApplicants();
        } catch (err) {
            console.error('Document upload error:', err);
            alert(err.response?.data?.message || 'Failed to upload documents');
        }
    };

    // Verify a specific document
    const verifyDocument = async (applicantId, documentIndex) => {
        try {
            await api.patch(
                `/requirements/applicants/${applicantId}/documents/${documentIndex}/verify`
            );

            alert('Document verified');
            loadApplicants();
        } catch (err) {
            console.error('Document verification error:', err);
            alert('Failed to verify document');
        }
    };

    // ==================== END DOCUMENT FUNCTIONS ====================

    // Ensure templates are fresh when opening the modal
    useEffect(() => {
        if (showModal) {
            fetchTemplates();
        }
    }, [showModal]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'Applied': return 'bg-blue-100 text-blue-800';
            case 'Shortlisted': return 'bg-yellow-100 text-yellow-800';
            case 'Selected': return 'bg-green-100 text-green-800';
            case 'Rejected': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusStyles = (status) => {
        switch (status) {
            case 'Applied': return 'bg-blue-50/50 text-blue-600 border-blue-100';
            case 'Shortlisted': return 'bg-indigo-50/50 text-indigo-600 border-indigo-100';
            case 'Interview Scheduled':
            case 'Interview Rescheduled':
            case 'New Round':
                return 'bg-amber-50/50 text-amber-600 border-amber-100';
            case 'Interview Completed': return 'bg-emerald-50/50 text-emerald-600 border-emerald-100';
            case 'Selected': return 'bg-emerald-500 text-white border-emerald-600';
            case 'Rejected': return 'bg-red-50/50 text-red-600 border-red-100';
            default: return 'bg-slate-50/50 text-slate-600 border-slate-100';
        }
    };

    const openOfferModal = (applicant) => {
        setSelectedApplicant(applicant);

        // Auto-generate a default reference number
        const currentYear = new Date().getFullYear();
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const refNo = `${companyInfo.refPrefix || 'OFFER'}/${currentYear}/${randomNum}`;

        setOfferData({
            joiningDate: '',
            location: applicant.workLocation || 'Ahmedabad',
            templateId: '',
            position: applicant.requirementId?.jobTitle || '',
            probationPeriod: '3 months',
            templateContent: '',
            isWordTemplate: false,
            refNo: refNo
        });
        setPreviewPdfUrl(null);
        setShowModal(true);
        setShowPreview(false);
    };

    const handleOfferChange = (e) => {
        const { name, value } = e.target;
        setOfferData(prev => {
            const updates = { ...prev, [name]: value };

            // If template selected, save its content for preview
            if (name === 'templateId') {
                const selectedTemplate = templates.find(t => t._id === value);
                if (selectedTemplate) {
                    updates.templateContent = selectedTemplate.bodyContent;
                    updates.isWordTemplate = (selectedTemplate.templateType === 'WORD');
                    setPreviewPdfUrl(null); // Reset when template changes
                }
            }
            return updates;
        });
    };

    const handlePreview = async () => {
        if (!offerData.joiningDate) {
            alert('Please select a joining date first');
            return;
        }

        if (offerData.isWordTemplate) {
            setGenerating(true);
            try {
                const payload = {
                    applicantId: selectedApplicant._id,
                    templateId: offerData.templateId,
                    joiningDate: offerData.joiningDate,
                    location: offerData.location,
                    refNo: offerData.refNo // Pass the user-edited Ref No
                };

                const res = await api.post('/letters/generate-offer', payload, { timeout: 30000 });

                if (res.data.downloadUrl) {
                    const url = import.meta.env.VITE_API_URL
                        ? `${import.meta.env.VITE_API_URL}${res.data.downloadUrl}`
                        : `http://localhost:5000${res.data.downloadUrl}`;
                    setPreviewPdfUrl(url);
                    setShowPreview(true);
                }
            } catch (err) {
                console.error("Preview generation failed", err);
                const msg = err.response?.data?.message || err.message || "Failed to generate preview";

                if (err.response?.status === 404 && !err.response?.data?.message) {
                    alert(`Preview failed: Server endpoint not found (404). Please ensure the backend server is running and the route '/api/letters/generate-offer' exists.`);
                } else {
                    alert(`Preview failed: ${msg}`);
                }
            } finally {
                setGenerating(false);
            }
        } else {
            setShowPreview(true);
        }
    };

    const submitOffer = async (e) => {
        if (e) e.preventDefault();
        if (!selectedApplicant) return;

        // If simple download of already generated preview
        if (offerData.isWordTemplate && previewPdfUrl) {
            window.open(previewPdfUrl, '_blank');
            setShowModal(false);
            setShowPreview(false);
            loadApplicants();
            return;
        }

        setGenerating(true);
        try {
            // Use unified letter generation endpoint
            const payload = {
                applicantId: selectedApplicant._id,
                templateId: offerData.templateId,
                joiningDate: offerData.joiningDate,
                location: offerData.location,
                refNo: offerData.refNo, // Pass user-edited Ref No
                // Pass other fields if needed for specific templates
            };

            const res = await api.post('/letters/generate-offer', payload, { timeout: 30000 });

            if (res.data.downloadUrl) {
                const url = import.meta.env.VITE_API_URL
                    ? `${import.meta.env.VITE_API_URL}${res.data.downloadUrl}`
                    : `http://localhost:5000${res.data.downloadUrl}`;
                window.open(url, '_blank');

                setShowModal(false);
                setShowPreview(false); // Close preview if open
                loadApplicants(); // Refresh to show status change
            }
        } catch (err) {
            console.error(err);
            alert('Failed to generate offer letter');
        } finally {
            setGenerating(false);
        }
    };

    const downloadOffer = (filePath) => {
        // Handle both cases: just filename or full path
        let cleanPath = filePath;
        if (filePath && filePath.includes('/')) {
            // If path contains slashes, extract just the filename
            cleanPath = filePath.split('/').pop();
        }
        const url = import.meta.env.VITE_API_URL
            ? `${import.meta.env.VITE_API_URL}/uploads/offers/${cleanPath}`
            : `http://localhost:5000/uploads/offers/${cleanPath}`;
        window.open(url, '_blank');
    };

    const viewOfferLetter = (filePath) => {
        // Handle both cases: just filename or full path
        let cleanPath = filePath;
        if (filePath && filePath.includes('/')) {
            // If path contains slashes, extract just the filename
            cleanPath = filePath.split('/').pop();
        }
        const url = import.meta.env.VITE_API_URL
            ? `${import.meta.env.VITE_API_URL}/uploads/offers/${cleanPath}`
            : `http://localhost:5000/uploads/offers/${cleanPath}`;
        window.open(url, '_blank');
    };

    const viewJoiningLetter = async (applicantId) => {
        try {
            const response = await api.get(`/requirements/joining-letter/${applicantId}/preview`);
            if (response.data.downloadUrl) {
                const url = import.meta.env.VITE_API_URL
                    ? `${import.meta.env.VITE_API_URL}${response.data.downloadUrl}`
                    : `http://localhost:5000${response.data.downloadUrl}`;
                window.open(url, '_blank');
            }
        } catch (err) {
            console.error('Failed to view joining letter:', err);
            alert('Failed to view joining letter');
        }
    };

    const downloadJoiningLetter = async (applicantId) => {
        try {
            const response = await api.get(`/requirements/joining-letter/${applicantId}/download`);
            if (response.data.downloadUrl) {
                const url = import.meta.env.VITE_API_URL
                    ? `${import.meta.env.VITE_API_URL}${response.data.downloadUrl}`
                    : `http://localhost:5000${response.data.downloadUrl}`;
                const link = document.createElement('a');
                link.href = url;
                link.download = `Joining_Letter_${applicantId}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (err) {
            console.error('Failed to download joining letter:', err);
            alert('Failed to download joining letter');
        }
    };

    const getResumeUrl = (filePath) => {
        if (!filePath) return null;
        let cleanPath = filePath;
        if (filePath.includes('/') || filePath.includes('\\')) {
            cleanPath = filePath.split(/[/\\]/).pop();
        }
        return import.meta.env.VITE_API_URL
            ? `${import.meta.env.VITE_API_URL}/uploads/${cleanPath}`
            : `http://localhost:5000/uploads/${cleanPath}`;
    };

    const viewResume = (filePath) => {
        const url = getResumeUrl(filePath);
        if (url) window.open(url, '_blank');
    };

    const downloadResume = (filePath) => {
        viewResume(filePath);
    };

    const openCandidateModal = (applicant) => {
        setSelectedApplicant(applicant);
        setShowCandidateModal(true);
    };

    const openJoiningModal = (applicant) => {
        if (!applicant.offerLetterPath) {
            alert("Please generate an Offer Letter first.");
            return;
        }
        // Check if salary is assigned (either via snapshot or flat ctc field)
        const isSalaryAssigned = applicant.salarySnapshot || (applicant.ctc && applicant.ctc > 0);
        if (!isSalaryAssigned) {
            alert("Please assign salary before generating joining letter.");
            return;
        }
        setSelectedApplicant(applicant);
        setJoiningTemplateId('');
        setShowJoiningModal(true);
        setJoiningPreviewUrl(null);
        setShowJoiningPreview(false);
    };

    const openSalaryModal = (applicant) => {
        navigate(`/hr/salary-structure/${applicant._id}`);
    };

    const openSalaryPreview = (applicant) => {
        setSelectedApplicant(applicant);
        setShowSalaryPreview(true);
    };

    const handleSalaryAssigned = () => {
        loadApplicants(); // Refresh list to show updated salary status
    };

    const handleJoiningPreview = async () => {
        if (!joiningTemplateId) {
            alert('Please select a Joining Letter Template');
            return;
        }

        setGenerating(true);
        try {
            const res = await api.post('/letters/preview-joining', {
                applicantId: selectedApplicant._id,
                templateId: joiningTemplateId
            }, { timeout: 90000 }); // 90 second timeout for PDF conversion

            if (res.data.previewUrl) {
                const url = import.meta.env.VITE_API_URL
                    ? `${import.meta.env.VITE_API_URL}${res.data.previewUrl}`
                    : `http://localhost:5000${res.data.previewUrl}`;

                setJoiningPreviewUrl(url);
                setShowJoiningPreview(true);
            }
        } catch (err) {
            console.error("Failed to preview joining letter", err);

            // Extract error message from response
            const errorMessage = err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                'Failed to preview joining letter';

            // Check if it's a file not found error
            if (err.response?.data?.code === 'FILE_NOT_FOUND' ||
                errorMessage.toLowerCase().includes('file not found') ||
                errorMessage.toLowerCase().includes('template file')) {
                alert(`Template file not found. Please re-upload the joining letter template.\n\nError: ${errorMessage}`);
            } else {
                alert(`Failed to preview joining letter: ${errorMessage}`);
            }
        } finally {
            setGenerating(false);
        }
    };

    const handleJoiningGenerate = async () => {
        if (!joiningTemplateId) {
            alert('Please select a Joining Letter Template');
            return;
        }

        setGenerating(true);
        try {
            const res = await api.post('/letters/generate-joining', {
                applicantId: selectedApplicant._id,
                templateId: joiningTemplateId
            });

            if (res.data.downloadUrl) {
                const url = import.meta.env.VITE_API_URL
                    ? `${import.meta.env.VITE_API_URL}${res.data.downloadUrl}`
                    : `http://localhost:5000${res.data.downloadUrl}`;

                // Download the PDF
                const link = document.createElement('a');
                link.href = url;
                link.download = `Joining_Letter_${selectedApplicant._id}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                setShowJoiningModal(false);
                setShowJoiningPreview(false);
                loadApplicants();
            }
        } catch (err) {
            console.error("Failed to generate joining letter", err);
            const errorMsg = err.response?.data?.message ||
                err.response?.data?.error ||
                'Failed to generate joining letter';

            // Check if it's a salary not assigned error
            if (errorMsg.toLowerCase().includes('salary not assigned') ||
                err.response?.data?.code === 'SALARY_NOT_ASSIGNED') {
                alert('Please assign salary before generating joining letter.');
            } else {
                alert(errorMsg);
            }
        } finally {
            setGenerating(false);
        }
    };



    return (
        <div className="space-y-6 sm:space-y-8 relative pb-20">
            {/* Premium Header Section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[2px] text-slate-400 mb-2">
                        <span>Recruiting</span>
                        <span className="opacity-30">/</span>
                        <span className="text-blue-600">Applicants</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Candidate Pipeline</h1>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    {/* Search Bar - PMG Style */}
                    <div className="relative flex-grow lg:flex-grow-0 lg:w-64">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                        <input
                            type="text"
                            placeholder="Search name, email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-100 shadow-sm rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                        />
                    </div>

                    <div className="lg:w-64">
                        <select
                            className="w-full border border-slate-100 shadow-sm rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/10 outline-none bg-white cursor-pointer"
                            value={selectedReqId}
                            onChange={(e) => handleRequirementChange(e.target.value)}
                        >
                            <option value="all">Global Pipeline</option>
                            <optgroup label="Active Requirements">
                                {requirements.filter(r => r.status === 'Open').map(req => (
                                    <option key={req._id} value={req._id}>{req.jobTitle}</option>
                                ))}
                            </optgroup>
                        </select>
                    </div>

                    <div className="lg:w-48">
                        <select
                            className="w-full border border-slate-100 shadow-sm rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/10 outline-none bg-white cursor-pointer"
                            value={timeFilter}
                            onChange={(e) => setTimeFilter(e.target.value)}
                        >
                            <option value="all">All Time</option>
                            <option value="today">Today</option>
                            <option value="week">This Week</option>
                            <option value="15days">Past 15 Days</option>
                            <option value="month">This Month</option>
                        </select>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => alert('Exporting...')}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-600 border border-slate-100 shadow-sm rounded-xl hover:bg-slate-50 transition font-bold text-xs uppercase tracking-wider"
                        >
                            <Download size={16} />
                            <span>Export</span>
                        </button>
                        <button
                            onClick={refreshData}
                            className="p-2.5 bg-white text-slate-400 border border-slate-100 shadow-sm rounded-xl hover:text-blue-600 transition"
                            title="Refresh Data"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[24px] border border-slate-100 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500 mb-3"></div>
                        Loading applicants...
                    </div>
                ) : applicants.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 bg-slate-50/50">
                        <p>No applicants found.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <div className="inline-block min-w-full align-middle">
                            {/* Dynamic Tabs */}
                            <div className="flex gap-2 mb-0 border-b border-slate-200 overflow-x-auto px-4 pt-4">
                                {workflowTabs.map(tab => {
                                    // Count Logic - uses a local filtered copy for search awareness
                                    let sub = applicants;
                                    if (searchQuery) {
                                        const query = searchQuery.toLowerCase();
                                        sub = sub.filter(a => a.name.toLowerCase().includes(query) || a.email.toLowerCase().includes(query));
                                    }

                                    let count = sub.filter(a => {
                                        // 1. Filter by Job if not "all"
                                        if (selectedReqId !== 'all') {
                                            if (!(a.requirementId?._id === selectedReqId || a.requirementId === selectedReqId)) return false;
                                        }

                                        // Time Filtering for counts
                                        if (timeFilter !== 'all') {
                                            const now = dayjs();
                                            let startDate;
                                            if (timeFilter === 'today') startDate = now.startOf('day');
                                            else if (timeFilter === 'week') startDate = now.subtract(7, 'days');
                                            else if (timeFilter === '15days') startDate = now.subtract(15, 'days');
                                            else if (timeFilter === 'month') startDate = now.subtract(1, 'month');
                                            if (startDate && !dayjs(a.createdAt).isAfter(startDate)) return false;
                                        }

                                        // 2. Exact filtering for Global Pipeline
                                        if (selectedReqId === 'all') {
                                            if (tab === 'new') return a.status === 'Applied';
                                            if (tab === 'interview') return ['Shortlisted', 'Interview Scheduled', 'Interview Rescheduled', 'Interview Completed', 'New Round'].some(s => a.status.includes(s) || a.status.includes('Round'));
                                            if (tab === 'final') return ['Selected', 'Rejected', 'Finalized'].includes(a.status);
                                            return false;
                                        }

                                        return checkStatusPassage(a.status, tab, workflowTabs);
                                    }).length;

                                    const label = tab === 'new' ? 'New Applications' :
                                        tab === 'interview' ? 'Interviews' :
                                            tab === 'final' ? 'Finalized' : tab;

                                    return (
                                        <button
                                            key={tab}
                                            onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                                            className={`pb-3 px-4 font-medium text-sm transition-colors relative whitespace-nowrap flex-shrink-0 border-b-2 ${activeTab === tab
                                                ? 'text-blue-600 border-blue-600'
                                                : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'
                                                }`}
                                        >
                                            {label}
                                            <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${activeTab === tab ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {count}
                                            </span>
                                        </button>
                                    );

                                })}

                                {/* Edit Workflow Button (Only for specific job view) */}
                                {selectedReqId !== 'all' && (
                                    <button
                                        onClick={openWorkflowEditor}
                                        className="sticky right-0 ml-auto mb-1 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition border border-blue-200 shadow-sm z-10"
                                        title="Update Hiring Steps"
                                    >
                                        <Settings size={14} />
                                        <span>Update Hiring</span>
                                    </button>
                                )}
                            </div>

                            <table className="min-w-full">
                                <thead className="bg-slate-50/40 sticky top-0 z-10 backdrop-blur-md border-b border-slate-100">
                                    <tr>
                                        <th className="px-8 py-5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Candidate</th>
                                        <th className="px-6 py-5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Resume</th>
                                        <th className="px-6 py-5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest hidden md:table-cell">Role</th>
                                        <th className="px-6 py-5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Status</th>

                                        {/* Dynamic Columns - Only show for specific job */}
                                        {selectedReqId !== 'all' && (
                                            <>
                                                {/* Custom Workflow Columns */}
                                                {activeTab !== 'Finalized' && <th className="px-6 py-5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Process</th>}
                                                {activeTab === 'Finalized' && (
                                                    <>
                                                        <th className="px-6 py-5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Outcome</th>
                                                        {applicants.some(a => a.status === 'Selected') && (
                                                            <>
                                                                <th className="px-6 py-5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Offer</th>
                                                                <th className="px-6 py-5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Documents</th>
                                                                <th className="px-6 py-5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Salary</th>
                                                                <th className="px-6 py-5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Joining</th>
                                                            </>
                                                        )}
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    {getFilteredApplicants().slice((currentPage - 1) * pageSize, currentPage * pageSize).map(app => (
                                        <tr key={app._id} className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            {/* Common Columns */}
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ring-4 ring-white
                                                        ${app.status === 'Rejected' ? 'bg-red-50 text-red-500' :
                                                            app.status === 'Selected' ? 'bg-emerald-50 text-emerald-500' : 'bg-indigo-50 text-indigo-500'}`}>
                                                        {app.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{app.name}</div>
                                                        <div className="text-[10px] text-slate-400 mt-0.5">{app.email}</div>
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{app.mobile || 'N/A'}</div>
                                                            <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                                            <div className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold">
                                                                APPLIED: {dayjs(app.createdAt).format('DD MMM')}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                {app.resume ? (
                                                    <div className="flex gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => openCandidateModal(app)}
                                                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                            title="View Application"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => downloadResume(app.resume)}
                                                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                                            title="Download Resume"
                                                        >
                                                            <Download size={18} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-[11px] text-slate-300 font-medium">None</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-5 hidden md:table-cell">
                                                <div className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md inline-block">
                                                    {app.requirementId?.jobTitle || 'N/A'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${getStatusStyles(app.status)}`}>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40"></span>
                                                    {app.status.toUpperCase()}
                                                </div>
                                            </td>

                                            {/* Logic for 'All' View - No Actions visible */}
                                            {selectedReqId === 'all' && null}

                                            {/* Logic for 'Custom Workflow' View */}
                                            {selectedReqId !== 'all' && (
                                                <>
                                                    {activeTab !== 'Finalized' && (
                                                        <td className="px-6 py-5 align-top">
                                                            <div className="flex flex-col gap-4">
                                                                {/* 1. Evaluation History (Filtered by Stage) */}
                                                                {app.reviews && app.reviews.length > 0 && (
                                                                    <div className="space-y-2">
                                                                        {app.reviews
                                                                            .filter(rev => rev.stage === activeTab)
                                                                            .map((rev, idx) => (
                                                                                <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] relative">
                                                                                    <div className="flex justify-between items-center mb-1.5">
                                                                                        <span className="font-bold text-slate-500 uppercase tracking-wider">{rev.stage}</span>
                                                                                        <div className="flex text-amber-500 scale-90">
                                                                                            {[...Array(5)].map((_, i) => (
                                                                                                <span key={i} className={i < rev.rating ? 'fill-current' : 'text-slate-200'}>★</span>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                    <p className="text-slate-600 italic line-clamp-2 leading-relaxed" title={rev.feedback}>"{rev.feedback}"</p>
                                                                                    <div className="mt-2 pt-2 border-t border-slate-100 text-[9px] text-slate-400 font-medium flex justify-between uppercase tracking-tighter">
                                                                                        <span>{rev.interviewerName}</span>
                                                                                        <span>{dayjs(rev.createdAt).format('DD MMM')}</span>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                    </div>
                                                                )}

                                                                {/* 2. Interview Row (Schedule / Details) */}
                                                                {(activeTab !== 'Applied' || app.status !== 'Applied') && (
                                                                    <div className="pt-2 border-t border-slate-50">
                                                                        {app.interview?.date && app.interview.stage === activeTab ? (
                                                                            <div className={`p-4 border rounded-2xl ${app.interview.completed ? 'bg-emerald-50/40 border-emerald-100' : 'bg-blue-50/40 border-blue-100'}`}>
                                                                                <div className="flex items-center justify-between mb-3">
                                                                                    <div className={`text-[10px] font-black uppercase tracking-[1.5px] ${app.interview.completed ? 'text-emerald-600' : 'text-blue-600'}`}>
                                                                                        {app.interview.completed ? 'Interview Done' : 'Next Interview'}
                                                                                    </div>
                                                                                    {app.interview.completed && <CheckCircle size={14} className="text-emerald-500" />}
                                                                                </div>

                                                                                <div className="flex flex-col gap-2">
                                                                                    <div className="flex items-center gap-3 text-[11px] font-bold text-slate-700">
                                                                                        <div className="flex items-center gap-1.5">
                                                                                            <span className="opacity-50">📅</span> {dayjs(app.interview.date).format('DD MMM, YYYY')}
                                                                                        </div>
                                                                                        <div className="flex items-center gap-1.5">
                                                                                            <span className="opacity-50">⏰</span> {app.interview.time}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                                                        MODE: <span className="text-slate-900">{app.interview.mode.toUpperCase()}</span>
                                                                                    </div>
                                                                                </div>

                                                                                {!app.interview.completed && (
                                                                                    <div className="flex gap-4 mt-4 border-t border-blue-100/50 pt-3">
                                                                                        <button onClick={() => openScheduleModal(app, true)} className="text-[10px] font-black text-blue-600 hover:text-blue-700 tracking-wider">RESCHEDULE</button>
                                                                                        <button onClick={() => markInterviewCompleted(app)} className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 tracking-wider">COMPLETED</button>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <button
                                                                                onClick={() => openScheduleModal(app)}
                                                                                className="w-full py-4 bg-emerald-600/5 text-emerald-600 text-[10px] font-black uppercase tracking-[2px] rounded-2xl hover:bg-emerald-600 hover:text-white transition-all duration-300 flex items-center justify-center gap-3 border border-emerald-100/50 group/sched"
                                                                            >
                                                                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center group-hover/sched:bg-emerald-500 transition-colors">
                                                                                    <span className="text-sm">📅</span>
                                                                                </div>
                                                                                Schedule Interview
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* 3. Review & Progression Rows */}
                                                                <div className="flex flex-col gap-3 mt-1 pt-2 border-t border-slate-50">
                                                                    {activeTab === 'Applied' && app.status === 'Applied' ? (
                                                                        <div className="space-y-2">
                                                                            <button
                                                                                onClick={() => {
                                                                                    const nextStage = workflowTabs[workflowTabs.indexOf(activeTab) + 1] || workflowTabs[1];
                                                                                    if (nextStage && nextStage !== 'Finalized') {
                                                                                        openReviewPrompt(app, nextStage);
                                                                                    } else {
                                                                                        // If no direct next stage, just open the select
                                                                                        alert("Please use the dropdown to select a destination stage.");
                                                                                    }
                                                                                }}
                                                                                className="w-full py-4 bg-blue-600 text-white text-[10px] font-black uppercase tracking-[2px] rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                                                                            >
                                                                                <CheckCircle size={14} />
                                                                                Shortlist Candidate
                                                                            </button>
                                                                            <button
                                                                                onClick={() => openReviewPrompt(app, 'Rejected')}
                                                                                className="w-full py-2.5 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-[1px] rounded-xl hover:bg-red-100 transition-all"
                                                                            >
                                                                                Reject Application
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            {/* Review Button Row */}
                                                                            <button
                                                                                onClick={() => openReviewPrompt(app, app.status)}
                                                                                className="w-full py-3 bg-blue-600/5 text-blue-600 text-[10px] font-black uppercase tracking-[2px] rounded-2xl hover:bg-blue-600 hover:text-white transition-all duration-300 flex items-center justify-center gap-2 border border-blue-100/50"
                                                                            >
                                                                                <Star size={14} className="fill-current" />
                                                                                Give Review & Scorecard
                                                                            </button>

                                                                            {/* Move to Stage Row */}
                                                                            {(() => {
                                                                                const hasReviewForCurrentStage = app.reviews?.some(rev => rev.stage === activeTab);
                                                                                // Allow 'Applied' stage to bypass review if needed (though we handle it above primarily)
                                                                                const canMove = hasReviewForCurrentStage || activeTab === 'Applied';

                                                                                return (
                                                                                    <div className="relative group/select">
                                                                                        <Select
                                                                                            placeholder={canMove ? "Move to Stage..." : "Complete Review to Move"}
                                                                                            className={`w-full premium-select ${!canMove ? 'opacity-50' : ''}`}
                                                                                            disabled={!canMove}
                                                                                            size="large"
                                                                                            variant="borderless"
                                                                                            style={{ background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}
                                                                                            onChange={(val) => val === 'custom_add' ? (setCandidateForCustomStage(app), setIsCustomStageModalVisible(true)) : openReviewPrompt(app, val)}
                                                                                            value={null}
                                                                                        >
                                                                                            <Select.OptGroup label="PROMOTE TO">
                                                                                                {workflowTabs.filter(t => t !== 'Finalized' && t !== app.status).map(stage => (
                                                                                                    <Select.Option key={stage} value={stage}>Move to {stage}</Select.Option>
                                                                                                ))}
                                                                                            </Select.OptGroup>
                                                                                            <Select.Option value="custom_add" className="text-blue-600 font-bold">+ Custom Stage</Select.Option>
                                                                                            <Select.OptGroup label="FINAL DECISION">
                                                                                                <Select.Option value="Selected" className="text-emerald-600 font-bold">Hire Candidate</Select.Option>
                                                                                                <Select.Option value="Rejected" className="text-red-600 font-bold">Reject Application</Select.Option>
                                                                                            </Select.OptGroup>
                                                                                        </Select>
                                                                                        {!canMove && (
                                                                                            <div className="hidden group-hover/select:block absolute -top-8 left-0 right-0 py-1.5 px-3 bg-slate-900 text-white text-[9px] font-bold rounded-lg text-center animate-in fade-in slide-in-from-bottom-2 z-50">
                                                                                                SCORECARD REQUIRED
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })()}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    )}

                                                    {activeTab === 'Finalized' && (
                                                        <>
                                                            <td className="px-6 py-5">
                                                                <div className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${app.status === 'Selected' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                                    {app.status}
                                                                </div>
                                                            </td>
                                                            {applicants.some(a => a.status === 'Selected') && (
                                                                <>
                                                                    <td className="px-6 py-5">
                                                                        {app.status === 'Selected' ? (
                                                                            app.offerLetterPath ? (
                                                                                <div className="flex gap-1.5 grayscale hover:grayscale-0 transition-all">
                                                                                    <button onClick={() => viewOfferLetter(app.offerLetterPath)} className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg"><Eye size={16} /></button>
                                                                                    <button onClick={() => downloadOffer(app.offerLetterPath)} className="w-8 h-8 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-lg"><Download size={16} /></button>
                                                                                </div>
                                                                            ) : <button onClick={() => openOfferModal(app)} className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg shadow-lg shadow-blue-100 transition-transform active:scale-95">GENERATE OFFER</button>
                                                                        ) : <span className="text-slate-200">/</span>}
                                                                    </td>

                                                                    {/* Documents Column */}
                                                                    <td className="px-6 py-5">
                                                                        {app.status === 'Selected' ? (
                                                                            <div className="flex flex-col gap-2">
                                                                                {app.customDocuments && app.customDocuments.length > 0 ? (
                                                                                    <>
                                                                                        <div className="flex flex-wrap gap-1.5">
                                                                                            {app.customDocuments.map((doc, idx) => (
                                                                                                <div key={idx} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-bold ${doc.verified ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'
                                                                                                    }`}>
                                                                                                    {doc.verified ? <CheckCircle size={12} /> : <Clock size={12} />}
                                                                                                    {doc.name}
                                                                                                    {!doc.verified && (
                                                                                                        <button
                                                                                                            onClick={() => verifyDocument(app._id, idx)}
                                                                                                            className="ml-1 text-emerald-600 hover:text-emerald-700"
                                                                                                        >
                                                                                                            ✓
                                                                                                        </button>
                                                                                                    )}
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                        <button
                                                                                            onClick={() => openDocumentModal(app)}
                                                                                            className="text-[9px] font-bold text-blue-600 hover:text-blue-700 underline mt-1"
                                                                                        >
                                                                                            + Add More
                                                                                        </button>
                                                                                    </>
                                                                                ) : (
                                                                                    <button
                                                                                        onClick={() => openDocumentModal(app)}
                                                                                        className="px-3 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg border border-blue-200 hover:bg-blue-100 transition-all"
                                                                                    >
                                                                                        Upload Documents
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        ) : <span className="text-slate-200">—</span>}
                                                                    </td>

                                                                    <td className="px-6 py-5">
                                                                        {app.status === 'Selected' ? (
                                                                            app.salarySnapshot?.ctc?.yearly > 0 ? (
                                                                                <div className="flex items-center gap-2 group/sal">
                                                                                    <div className="text-[11px] font-black text-slate-800 bg-slate-100 px-2 py-1 rounded-lg">₹{(app.salarySnapshot.ctc.yearly / 100000).toFixed(1)}L <span className="text-[9px] text-slate-400">/YR</span></div>
                                                                                    <button onClick={() => openSalaryModal(app)} className="opacity-0 group-hover/sal:opacity-100 transition-opacity p-1 text-slate-400 hover:text-blue-600"><Edit2 size={12} /></button>
                                                                                </div>
                                                                            ) : (
                                                                                <button
                                                                                    onClick={() => openSalaryModal(app)}
                                                                                    disabled={!areAllDocumentsVerified(app)}
                                                                                    className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all ${areAllDocumentsVerified(app)
                                                                                        ? 'text-emerald-600 bg-emerald-50 border-emerald-100 hover:bg-emerald-100 cursor-pointer'
                                                                                        : 'text-slate-400 bg-slate-50 border-slate-200 cursor-not-allowed opacity-50'
                                                                                        }`}
                                                                                    title={!areAllDocumentsVerified(app) ? 'Please verify all documents first' : 'Set CTC'}
                                                                                >
                                                                                    SET CTC
                                                                                </button>
                                                                            )
                                                                        ) : <span className="text-slate-200">/</span>}
                                                                    </td>
                                                                    <td className="px-6 py-5">
                                                                        {app.status === 'Selected' ? (
                                                                            app.joiningLetterPath ? (
                                                                                <div className="flex gap-1.5 grayscale hover:grayscale-0 transition-all">
                                                                                    <button onClick={() => viewJoiningLetter(app.joiningLetterPath)} className="w-8 h-8 flex items-center justify-center bg-purple-50 text-purple-600 rounded-lg"><Eye size={16} /></button>
                                                                                    <button onClick={() => downloadJoining(app.joiningLetterPath)} className="w-8 h-8 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-lg"><Download size={16} /></button>
                                                                                </div>
                                                                            ) : <button onClick={() => openJoiningModal(app)} className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-lg shadow-lg shadow-indigo-100 transition-transform active:scale-95">JOINING LETTER</button>
                                                                        ) : <span className="text-slate-200">/</span>}
                                                                    </td>
                                                                </>
                                                            )}
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 flex justify-center sm:justify-end">
                            <Pagination
                                current={currentPage}
                                pageSize={pageSize}
                                total={getFilteredApplicants().length}
                                onChange={(page) => setCurrentPage(page)}
                                showSizeChanger={false}
                                responsive={true}
                                size="small"
                                className="text-xs sm:text-sm"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Offer Generation Modal */}
            {
                showModal && selectedApplicant && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Generate Offer Letter</h2>
                            <div className="mb-4 text-sm text-gray-600">
                                <p><strong>Candidate:</strong> {selectedApplicant.name}</p>
                                <p><strong>Role:</strong> {selectedApplicant.requirementId?.jobTitle}</p>
                            </div>

                            <form onSubmit={(e) => { e.preventDefault(); handlePreview(); }} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Offer Template</label>
                                    <select
                                        name="templateId"
                                        value={offerData.templateId}
                                        onChange={handleOfferChange}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                    >
                                        <option value="">-- Select Template --</option>
                                        {templates.map(t => (
                                            <option key={t._id} value={t._id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Reference Number</label>
                                    <input
                                        type="text"
                                        name="refNo"
                                        value={offerData.refNo || ''}
                                        onChange={handleOfferChange}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                        placeholder="e.g. OFFER/2025/001"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Joining Date *</label>
                                    <DatePicker
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 h-[42px]"
                                        format="DD-MM-YYYY"
                                        placeholder="DD-MM-YYYY"
                                        value={offerData.joiningDate ? dayjs(offerData.joiningDate) : null}
                                        onChange={(date) => setOfferData(prev => ({ ...prev, joiningDate: date ? date.format('YYYY-MM-DD') : '' }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Work Location</label>
                                    <input
                                        type="text"
                                        name="location"
                                        value={offerData.location}
                                        onChange={handleOfferChange}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                        placeholder="e.g. New York, Remote"
                                    />
                                </div>

                                <div className="flex justify-end space-x-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handlePreview}
                                        className="px-4 py-2 border border-blue-600 rounded-md text-sm font-medium text-blue-600 hover:bg-blue-50"
                                    >
                                        Preview
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => submitOffer(e)}
                                        disabled={generating}
                                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        {generating ? 'Generating...' : 'Generate & Download'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Joining Letter Generation Modal */}
            {
                showJoiningModal && selectedApplicant && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Generate Joining Letter</h2>
                            <div className="mb-4 text-sm text-gray-600 space-y-2">
                                <p><strong>Candidate:</strong> {selectedApplicant.name}</p>
                                <p><strong>Joining Date:</strong> {selectedApplicant.joiningDate ? new Date(selectedApplicant.joiningDate).toLocaleDateString() : 'N/A'}</p>
                                <p><strong>Location:</strong> {selectedApplicant.location || selectedApplicant.workLocation || 'N/A'}</p>
                                <p className="text-xs text-orange-600 mt-2 bg-orange-50 p-2 rounded">
                                    Note: Joining Date and Location are pulled from the Offer Letter data.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Select Template</label>
                                    <select
                                        value={joiningTemplateId}
                                        onChange={(e) => setJoiningTemplateId(e.target.value)}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                    >
                                        <option value="">-- Select Template --</option>
                                        {joiningTemplates.map(t => (
                                            <option key={t._id} value={t._id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex justify-end space-x-3 mt-6">
                                    <button
                                        onClick={() => setShowJoiningModal(false)}
                                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleJoiningPreview}
                                        disabled={generating}
                                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                                    >
                                        {generating ? 'Loading...' : 'Preview'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Joining Letter Preview Modal */}
            {
                showJoiningPreview && selectedApplicant && (
                    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 overflow-y-auto">
                        <div className="min-h-screen py-8 px-4">
                            {/* Sticky Header with Buttons */}
                            <div className="sticky top-0 z-10 bg-gradient-to-b from-black via-black to-transparent pb-6 mb-4">
                                <div className="max-w-5xl mx-auto flex justify-between items-center gap-3">
                                    <h2 className="text-xl font-bold text-white">Joining Letter Preview</h2>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowJoiningPreview(false)}
                                            className="px-4 py-2 bg-white text-slate-700 rounded-lg hover:bg-slate-100 shadow-lg font-medium transition"
                                        >
                                            ✕ Close Preview
                                        </button>
                                        <button
                                            onClick={handleJoiningGenerate}
                                            disabled={generating}
                                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg font-medium disabled:opacity-50 transition"
                                        >
                                            {generating ? 'Generating...' : '✓ Generate & Download'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Scrollable Preview Content */}
                            <div className="max-w-5xl mx-auto">
                                {joiningPreviewUrl ? (
                                    <iframe
                                        src={joiningPreviewUrl}
                                        className="w-full h-[80vh] rounded-lg shadow-xl bg-white"
                                        title="Joining Letter PDF Preview"
                                    />
                                ) : (
                                    <div className="w-full h-[80vh] rounded-lg shadow-xl bg-white flex items-center justify-center">
                                        <p className="text-gray-500">Loading preview...</p>
                                    </div>
                                )}
                            </div>

                            {/* Bottom Padding */}
                            <div className="h-8"></div>
                        </div>
                    </div>
                )
            }

            {/* Offer Letter Preview Modal (Unified for both Offer & Joining) */}
            {
                showPreview && selectedApplicant && (
                    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 overflow-y-auto">
                        <div className="min-h-screen py-8 px-4">
                            {/* Sticky Header with Buttons */}
                            <div className="sticky top-0 z-10 bg-gradient-to-b from-black via-black to-transparent pb-6 mb-4">
                                <div className="max-w-5xl mx-auto flex justify-between items-center gap-3">
                                    <h2 className="text-xl font-bold text-white">Offer Letter Preview</h2>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowPreview(false)}
                                            className="px-4 py-2 bg-white text-slate-700 rounded-lg hover:bg-slate-100 shadow-lg font-medium transition"
                                        >
                                            ✕ Close Preview
                                        </button>
                                        <button
                                            onClick={(e) => submitOffer(e)}
                                            disabled={generating}
                                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg font-medium disabled:opacity-50 transition"
                                        >
                                            {generating ? 'Downloading...' : '✓ Download PDF'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Scrollable Preview Content */}
                            <div className="max-w-5xl mx-auto">
                                {offerData.isWordTemplate && previewPdfUrl ? (
                                    <iframe
                                        src={previewPdfUrl}
                                        className="w-full h-[80vh] rounded-lg shadow-xl bg-white"
                                        title="PDF Preview"
                                    />
                                ) : (
                                    <OfferLetterPreview
                                        applicant={selectedApplicant}
                                        offerData={offerData}
                                        companyInfo={companyInfo}
                                    />
                                )}
                            </div>

                            {/* Bottom Padding */}
                            <div className="h-8"></div>
                        </div>
                    </div>
                )
            }

            {/* Assign Salary Modal */}
            {
                showSalaryModal && selectedApplicant && (
                    <AssignSalaryModal
                        isOpen={showSalaryModal}
                        onClose={() => {
                            setShowSalaryModal(false);
                            setSelectedApplicant(null);
                        }}
                        applicant={selectedApplicant}
                        onSuccess={handleSalaryAssigned}
                    />
                )
            }

            {/* Salary Preview Modal */}
            {
                showSalaryPreview && selectedApplicant && selectedApplicant.salarySnapshot && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                            {/* Header */}
                            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Salary Structure</h3>
                                    <p className="text-sm text-slate-500">{selectedApplicant.name} • {selectedApplicant.requirementId?.jobTitle}</p>
                                </div>
                                <button onClick={() => setShowSalaryPreview(false)} className="p-2 hover:bg-slate-200 rounded-full transition text-slate-500">
                                    ✕
                                </button>
                            </div>

                            {/* Body - Scrollable */}
                            <div className="p-6 overflow-y-auto space-y-6">
                                {/* Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Earnings */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider border-b border-emerald-100 pb-2">Earnings (Monthly)</h4>
                                        <div className="space-y-2">
                                            {selectedApplicant.salarySnapshot.earnings.map((e, i) => (
                                                <div key={i} className="flex justify-between text-sm group border-b border-dashed border-slate-100 pb-1 last:border-0">
                                                    <span className="text-slate-600 group-hover:text-slate-900">{e.name}</span>
                                                    <span className="font-medium text-slate-800">₹{e.monthlyAmount?.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-800 mt-2">
                                            <span>Gross Earnings</span>
                                            <span>₹{(selectedApplicant.salarySnapshot.grossA?.monthly ?? selectedApplicant.salarySnapshot.grossA)?.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {/* Deductions */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-rose-600 uppercase tracking-wider border-b border-rose-100 pb-2">Deductions (Monthly)</h4>
                                        <div className="space-y-2">
                                            {selectedApplicant.salarySnapshot.employeeDeductions.length > 0 ? (
                                                selectedApplicant.salarySnapshot.employeeDeductions.map((d, i) => (
                                                    <div key={i} className="flex justify-between text-sm group border-b border-dashed border-slate-100 pb-1 last:border-0">
                                                        <span className="text-slate-600 group-hover:text-slate-900">{d.name}</span>
                                                        <span className="font-medium text-rose-600">-₹{d.monthlyAmount?.toLocaleString()}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-xs text-slate-400 italic">No deductions</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Summary Card */}
                                <div className="bg-slate-900 text-white rounded-xl p-5 shadow-lg ring-1 ring-white/10">
                                    <div className="grid grid-cols-2 gap-4 text-center divide-x divide-slate-700/50">
                                        <div>
                                            <div className="text-slate-400 text-[10px] uppercase tracking-widest mb-1">Monthly Net Pay</div>
                                            <div className="text-2xl font-bold text-emerald-400">₹{(selectedApplicant.salarySnapshot.takeHome?.monthly ?? selectedApplicant.salarySnapshot.takeHome)?.toLocaleString()}</div>
                                        </div>
                                        <div>
                                            <div className="text-slate-400 text-[10px] uppercase tracking-widest mb-1">Annual CTC</div>
                                            <div className="text-xl font-bold text-white">₹{(selectedApplicant.salarySnapshot.ctc?.yearly ?? selectedApplicant.salarySnapshot.ctc)?.toLocaleString()}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                                <button
                                    onClick={() => { setShowSalaryPreview(false); openSalaryModal(selectedApplicant); }}
                                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                >
                                    Edit Structure
                                </button>
                                <button
                                    onClick={() => setShowSalaryPreview(false)}
                                    className="px-6 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition shadow-lg"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* INTERVIEW MODAL */}
            {
                showInterviewModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                            <h2 className="text-xl font-bold text-slate-800 mb-4">
                                {isReschedule ? 'Reschedule Interview' : 'Schedule Interview'}
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Date</label>
                                    <input
                                        type="date"
                                        value={interviewData.date}
                                        onChange={(e) => setInterviewData({ ...interviewData, date: e.target.value })}
                                        className="w-full mt-1 p-2 border rounded"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700">Time</label>
                                        <input
                                            type="time"
                                            value={interviewData.time}
                                            onChange={(e) => setInterviewData({ ...interviewData, time: e.target.value })}
                                            className="w-full mt-1 p-2 border rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700">Mode</label>
                                        <select
                                            value={interviewData.mode}
                                            onChange={(e) => setInterviewData({ ...interviewData, mode: e.target.value })}
                                            className="w-full mt-1 p-2 border rounded"
                                        >
                                            <option value="Online">Online</option>
                                            <option value="Offline">Offline</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">
                                        {interviewData.mode === 'Online' ? 'Meeting Link' : 'Office/Location Address'}
                                    </label>
                                    <input
                                        type="text"
                                        value={interviewData.location}
                                        onChange={(e) => setInterviewData({ ...interviewData, location: e.target.value })}
                                        placeholder={interviewData.mode === 'Online' ? 'Zoom/Teams/Meet Link' : 'Enter work location address'}
                                        className="w-full mt-1 p-2 border rounded"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Interviewer Name</label>
                                    <input
                                        type="text"
                                        value={interviewData.interviewerName}
                                        onChange={(e) => setInterviewData({ ...interviewData, interviewerName: e.target.value })}
                                        className="w-full mt-1 p-2 border rounded"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Notes (Optional)</label>
                                    <textarea
                                        value={interviewData.notes}
                                        onChange={(e) => setInterviewData({ ...interviewData, notes: e.target.value })}
                                        className="w-full mt-1 p-2 border rounded"
                                        rows="2"
                                    />
                                </div>

                                <div className="flex gap-2 justify-end mt-4">
                                    <button
                                        onClick={() => setShowInterviewModal(false)}
                                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleInterviewSubmit}
                                        disabled={loading}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        {loading ? 'Sending...' : (isReschedule ? 'Reschedule & Notify' : 'Schedule & Notify')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Custom Stage Modal */}
            {
                isCustomStageModalVisible && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
                            <h2 className="text-lg font-bold text-slate-800 mb-4">Add Custom Stage</h2>
                            <p className="text-sm text-slate-600 mb-4">Enter the name for the new ad-hoc stage. This will be added for <b>{candidateForCustomStage?.name}</b>.</p>

                            <input
                                type="text"
                                value={customStageName}
                                onChange={(e) => setCustomStageName(e.target.value)}
                                placeholder="e.g. Manager Review 2"
                                className="w-full p-2 border border-slate-300 rounded mb-4"
                                autoFocus
                            />

                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setIsCustomStageModalVisible(false)} className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
                                <button onClick={handleAddCustomStage} className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">Add & Move</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Workflow Edit Modal */}
            {
                showWorkflowEditModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800">Edit Hiring Workflow</h2>
                                <button onClick={() => setShowWorkflowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                                    <X size={20} />
                                </button>
                            </div>

                            <p className="text-sm text-slate-500 mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                Customize the hiring process for <b>{selectedRequirement?.jobTitle}</b>.
                                Adding steps here updates the job for all candidates.
                            </p>

                            <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-2">
                                {editingWorkflow.map((stage, index) => (
                                    <div
                                        key={index}
                                        className={`flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-200 group ${stage === 'Applied' || stage === 'Finalized' ? 'opacity-80' : 'cursor-move hover:border-blue-300'}`}
                                        draggable={stage !== 'Applied' && stage !== 'Finalized'}
                                        onDragStart={(e) => {
                                            dragItem.current = index;
                                            e.target.classList.add('opacity-50');
                                        }}
                                        onDragEnter={(e) => {
                                            dragOverItem.current = index;
                                        }}
                                        onDragEnd={(e) => {
                                            e.target.classList.remove('opacity-50');
                                            handleSort();
                                        }}
                                        onDragOver={(e) => e.preventDefault()}
                                    >
                                        {/* Grip Handle for Draggable Items */}
                                        {stage !== 'Applied' && stage !== 'Finalized' ? (
                                            <div className="text-slate-400 cursor-grab active:cursor-grabbing">
                                                <GripVertical size={16} />
                                            </div>
                                        ) : (
                                            <div className="w-4"></div> // Spacer
                                        )}

                                        <div className="flex-1 text-sm font-medium text-slate-700">
                                            {index + 1}. {stage}
                                        </div>
                                        {/* Prevent removing critical stages if needed, or allow full flexibility */}
                                        {stage !== 'Applied' && stage !== 'Finalized' && (
                                            <button
                                                onClick={() => handleStageRemove(index)}
                                                className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2 mb-6">
                                <input
                                    type="text"
                                    value={newStageName}
                                    onChange={(e) => setNewStageName(e.target.value)}
                                    placeholder="New Stage Name (e.g. Logic Test)"
                                    className="flex-1 p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    onKeyDown={(e) => e.key === 'Enter' && handleStageAdd()}
                                />
                                <button
                                    onClick={handleStageAdd}
                                    className="bg-blue-100 text-blue-600 p-2 rounded hover:bg-blue-200 transition"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>

                            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                                <button
                                    onClick={() => setShowWorkflowEditModal(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveWorkflowChanges}
                                    disabled={loading}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md text-sm font-medium disabled:opacity-50"
                                >
                                    {loading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* End of Workflow Edit Modal */}
            {/* Candidate Details & Resume Modal */}
            {
                showCandidateModal && selectedApplicant && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-6">
                        <div className="bg-white w-full max-w-7xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        {selectedApplicant.name}
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(selectedApplicant.status)}`}>
                                            {selectedApplicant.status}
                                        </span>
                                    </h2>
                                    <p className="text-sm text-slate-500">Applied for <span className="font-medium text-slate-700">{selectedApplicant.requirementId?.jobTitle}</span></p>
                                </div>
                                <div className="flex gap-3">
                                    <a
                                        href={getResumeUrl(selectedApplicant.resume)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm flex items-center gap-2"
                                    >
                                        <Download size={16} /> Download Resume
                                    </a>
                                    <button
                                        onClick={() => setShowCandidateModal(false)}
                                        className="p-2 hover:bg-slate-200 rounded-full transition text-slate-500"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                                {/* Sidebar: Candidate Details */}
                                <div className="w-full lg:w-1/3 bg-white border-r border-slate-200 overflow-y-auto p-6 space-y-6">
                                    <section>
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Personal Information</h3>
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 text-slate-400"><FileText size={16} /></div>
                                                <div>
                                                    <p className="text-xs text-slate-500">Father's Name</p>
                                                    <p className="text-sm font-medium text-slate-800">{selectedApplicant.fatherName || '-'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 text-slate-400">@</div>
                                                <div>
                                                    <p className="text-xs text-slate-500">Email Address</p>
                                                    <p className="text-sm font-medium text-slate-800 break-all">{selectedApplicant.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 text-slate-400">#</div>
                                                <div>
                                                    <p className="text-xs text-slate-500">Mobile Number</p>
                                                    <p className="text-sm font-medium text-slate-800">{selectedApplicant.mobile}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 text-slate-400">📅</div>
                                                <div>
                                                    <p className="text-xs text-slate-500">Date of Birth</p>
                                                    <p className="text-sm font-medium text-slate-800">
                                                        {selectedApplicant.dob ? dayjs(selectedApplicant.dob).format('DD MMM YYYY') : '-'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 text-slate-400">📍</div>
                                                <div>
                                                    <p className="text-xs text-slate-500">Address</p>
                                                    <p className="text-sm text-slate-700 leading-relaxed">{selectedApplicant.address || '-'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    <div className="border-t border-slate-100 my-2"></div>

                                    <section>
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Professional Details</h3>
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-xs text-slate-500">Experience</p>
                                                    <p className="text-sm font-medium text-slate-800">{selectedApplicant.experience || '0'} Years</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500">Notice Period</p>
                                                    <p className="text-sm font-medium text-slate-800">{selectedApplicant.noticePeriod ? 'Yes' : 'No'}</p>
                                                </div>
                                            </div>

                                            <div>
                                                <p className="text-xs text-slate-500">Current Company</p>
                                                <p className="text-sm font-medium text-slate-800">{selectedApplicant.currentCompany || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">Designation</p>
                                                <p className="text-sm font-medium text-slate-800">{selectedApplicant.currentDesignation || '-'}</p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-xs text-slate-500">Current CTC</p>
                                                    <p className="text-sm font-medium text-slate-800">{selectedApplicant.currentCTC || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500">Expected CTC</p>
                                                    <p className="text-sm font-medium text-emerald-600">{selectedApplicant.expectedCTC || '-'}</p>
                                                </div>
                                            </div>

                                            {selectedApplicant.linkedin && (
                                                <div>
                                                    <p className="text-xs text-slate-500 mb-1">LinkedIn Profile</p>
                                                    <a href={selectedApplicant.linkedin} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline truncate block">
                                                        {selectedApplicant.linkedin}
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </section>

                                    {selectedApplicant.intro && (
                                        <>
                                            <div className="border-t border-slate-100 my-2"></div>
                                            <section>
                                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Introduction / Notes</h3>
                                                <p className="text-sm text-slate-600 italic leading-relaxed bg-slate-50 p-3 rounded">
                                                    "{selectedApplicant.intro}"
                                                </p>
                                            </section>
                                        </>
                                    )}
                                </div>

                                {/* Main Area: Resume Preview */}
                                <div className="flex-1 bg-slate-100 flex items-center justify-center p-4">
                                    {selectedApplicant.resume ? (
                                        selectedApplicant.resume.toLowerCase().endsWith('.pdf') ? (
                                            <iframe
                                                src={getResumeUrl(selectedApplicant.resume)}
                                                className="w-full h-full rounded-lg shadow-input bg-white"
                                                title="Resume Preview"
                                            />
                                        ) : (
                                            <div className="text-center p-8 bg-white rounded-xl shadow-sm max-w-md">
                                                <FileText size={48} className="mx-auto text-slate-300 mb-4" />
                                                <p className="text-lg font-medium text-slate-800 mb-2">Preview not available</p>
                                                <p className="text-slate-500 mb-6">This file type cannot be previewed directly in the browser.</p>
                                                <a
                                                    href={getResumeUrl(selectedApplicant.resume)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                                                >
                                                    <Download size={18} /> Download File
                                                </a>
                                            </div>
                                        )
                                    ) : (
                                        <div className="text-center text-slate-400">
                                            <p>No resume uploaded</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Premium Candidate Evaluation Drawer */}
            {
                showEvaluationDrawer && selectedApplicant && (
                    <div className="fixed inset-0 z-[100] flex justify-end">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
                            onClick={() => setShowEvaluationDrawer(false)}
                        />

                        {/* Drawer Content */}
                        <div className="relative w-full max-w-2xl bg-white h-screen shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 ease-out overflow-hidden">
                            {/* Header */}
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                                <div>
                                    <h1 className="text-xl font-black text-slate-800 tracking-tight">Candidate Evaluation</h1>
                                    <p className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-widest flex items-center gap-2">
                                        <span className="text-blue-600 font-black">{selectedApplicant.name}</span>
                                        <span className="opacity-20 italic">|</span>
                                        <span>{selectedApplicant.requirementId?.jobTitle}</span>
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowEvaluationDrawer(false);
                                        setIsFinishingInterview(false);
                                    }}
                                    className="p-2 hover:bg-slate-50 rounded-full transition-colors"
                                >
                                    <X size={24} className="text-slate-400" />
                                </button>
                            </div>

                            {/* Middle Area (Scrollable) */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">

                                {/* Round Navigation Tabs */}
                                <div className="flex gap-2 p-1 bg-slate-50 rounded-xl">
                                    {evaluationData.rounds.map((round, idx) => (
                                        <button
                                            key={round.id}
                                            onClick={() => setEvalActiveRound(idx)}
                                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all
                                            ${evalActiveRound === idx
                                                    ? 'bg-white text-blue-600 shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            {round.name}
                                        </button>
                                    ))}
                                </div>

                                {/* Active Evaluation Criteria */}
                                <div className="space-y-6">
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">0{evalActiveRound + 1}</span>
                                        {evaluationData.rounds[evalActiveRound].name}
                                    </h3>

                                    {evaluationData.rounds[evalActiveRound].categories.map((cat, catIdx) => (
                                        <div key={catIdx} className="space-y-4">
                                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{cat.name}</h4>
                                            <div className="space-y-2">
                                                {cat.skills.map((skill, skillIdx) => (
                                                    <div key={skillIdx} className="grid grid-cols-12 gap-4 items-center p-4 bg-slate-50/50 border border-slate-100/50 rounded-2xl group hover:bg-white hover:shadow-xl hover:shadow-slate-100 transition-all duration-300">
                                                        <div className="col-span-12 md:col-span-5">
                                                            <p className="text-xs font-black text-slate-700">{skill.name}</p>
                                                        </div>
                                                        <div className="col-span-12 md:col-span-3 flex gap-2">
                                                            {[1, 2, 3, 4, 5].map(num => (
                                                                <button
                                                                    key={num}
                                                                    onClick={() => {
                                                                        const newData = { ...evaluationData };
                                                                        newData.rounds[evalActiveRound].categories[catIdx].skills[skillIdx].rating = num;
                                                                        setEvaluationData(newData);
                                                                        const allRatings = evaluationData.rounds.flatMap(r => r.categories.flatMap(c => c.skills.map(s => s.rating))).filter(r => r > 0);
                                                                        if (allRatings.length > 0) {
                                                                            const avg = Math.round(allRatings.reduce((a, b) => a + b, 0) / allRatings.length);
                                                                            setReviewRating(avg);
                                                                        }
                                                                    }}
                                                                    className={`w-8 h-8 rounded-full text-[11px] font-black transition-all flex items-center justify-center
                                                                    ${skill.rating === num
                                                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-110'
                                                                            : 'bg-white text-slate-400 border border-slate-200 hover:border-blue-400 font-bold'}`}
                                                                >
                                                                    {num}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <div className="col-span-12 md:col-span-4">
                                                            <input
                                                                type="text"
                                                                placeholder="Short Note..."
                                                                value={skill.comment}
                                                                onChange={(e) => {
                                                                    const newData = { ...evaluationData };
                                                                    newData.rounds[evalActiveRound].categories[catIdx].skills[skillIdx].comment = e.target.value;
                                                                    setEvaluationData(newData);
                                                                    // Sync with main feedback
                                                                    setReviewFeedback(e.target.value);
                                                                }}
                                                                className="w-full text-[10px] p-2 bg-white border border-slate-100 rounded-lg outline-none focus:border-blue-500 transition-colors"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Footer - Bottom Action Bar */}
                            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-6 flex items-center justify-between shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                                <div className="flex items-center gap-6">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[2px] mb-1">Total Score</p>
                                        <div className="text-2xl font-black text-slate-800">
                                            {(evaluationData.rounds.flatMap(r => r.categories.flatMap(c => c.skills.map(s => s.rating))).filter(r => r > 0).reduce((a, b, _, arr) => a + b / arr.length, 0) || 0).toFixed(2)}
                                            <span className="text-xs text-slate-300"> / 5</span>
                                        </div>
                                    </div>
                                    <div className="w-px h-10 bg-slate-100"></div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[2px] mb-1">Decision</p>
                                        <Select
                                            className="w-40 premium-select"
                                            placeholder="Pick Step"
                                            value={selectedStatusForReview || null}
                                            variant="borderless"
                                            style={{ background: '#f8fafc', borderRadius: '12px', padding: '0 8px', border: '1px solid #f1f5f9' }}
                                            onChange={(val) => setSelectedStatusForReview(val)}
                                        >
                                            <Select.OptGroup label="Hiring Pipeline">
                                                {workflowTabs.filter(t => !['Applied', 'Finalized'].includes(t)).map(tab => (
                                                    <Select.Option key={tab} value={tab}>{tab}</Select.Option>
                                                ))}
                                            </Select.OptGroup>
                                            <Select.OptGroup label="Final Result">
                                                <Select.Option value="Selected" className="text-emerald-600 font-bold">Selected / Hire</Select.Option>
                                                <Select.Option value="Rejected" className="text-red-500 font-bold">Reject</Select.Option>
                                            </Select.OptGroup>
                                        </Select>
                                    </div>
                                </div>

                                <button
                                    onClick={submitReviewAndStatus}
                                    disabled={loading || !selectedStatusForReview}
                                    className="px-8 py-3 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                                >
                                    {loading ? 'Processing...' : 'Complete Evaluation'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Document Upload Modal */}
            {showDocumentModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Upload Documents</h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    {documentApplicant?.name} - {documentApplicant?.requirementId?.title}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDocumentModal(false)}
                                className="p-2 hover:bg-white rounded-lg transition-colors"
                            >
                                <XCircle size={20} className="text-slate-400" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Add New Document */}
                            <div className="bg-slate-50 rounded-xl p-4 space-y-4">
                                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Add New Document</h4>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-2">Document Name *</label>
                                    <input
                                        type="text"
                                        value={documentName}
                                        onChange={(e) => setDocumentName(e.target.value)}
                                        placeholder="e.g., Aadhar Card, PAN Card, Degree Certificate"
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-2">Select File * (PDF, JPG, PNG - Max 5MB)</label>
                                    <input
                                        id="documentFileInput"
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={handleDocumentFileChange}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                    />
                                    {documentFile && (
                                        <p className="mt-2 text-xs text-slate-500">
                                            Selected: {documentFile.name} ({(documentFile.size / 1024).toFixed(1)} KB)
                                        </p>
                                    )}
                                </div>

                                <button
                                    onClick={addDocumentToList}
                                    className="w-full py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    + Add to List
                                </button>
                            </div>

                            {/* Uploaded Documents List */}
                            {uploadedDocuments.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                                        Documents to Upload ({uploadedDocuments.length})
                                    </h4>
                                    <div className="space-y-2">
                                        {uploadedDocuments.map((doc, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                                                <div className="flex-1">
                                                    <div className="text-sm font-bold text-slate-800">{doc.name}</div>
                                                    <div className="text-xs text-slate-500 mt-1">
                                                        {doc.fileName} • {(doc.fileSize / 1024).toFixed(1)} KB
                                                        {doc.verified && <span className="ml-2 text-emerald-600">✓ Verified</span>}
                                                    </div>
                                                </div>
                                                {!doc.verified && (
                                                    <button
                                                        onClick={() => removeDocumentFromList(idx)}
                                                        className="ml-3 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
                            <button
                                onClick={() => setShowDocumentModal(false)}
                                className="flex-1 py-2 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveDocuments}
                                disabled={uploadedDocuments.length === 0}
                                className={`flex-1 py-2 font-bold rounded-lg transition-colors ${uploadedDocuments.length > 0
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    }`}
                            >
                                Save Documents ({uploadedDocuments.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}



