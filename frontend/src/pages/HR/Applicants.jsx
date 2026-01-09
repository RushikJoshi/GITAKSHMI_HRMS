import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api'; // Centralized axios instance with auth & tenant headers
import { useAuth } from '../../context/AuthContext';
import OfferLetterPreview from '../../components/OfferLetterPreview';
import AssignSalaryModal from '../../components/AssignSalaryModal';
import { DatePicker, Pagination, Select } from 'antd';
import dayjs from 'dayjs';
import { Eye, Download, Edit2, RefreshCw, IndianRupee, Upload, FileText, CheckCircle, Settings, Plus, Trash2, X, GripVertical, Star } from 'lucide-react';

export default function Applicants() {
    const navigate = useNavigate();
    const [applicants, setApplicants] = useState([]);
    const [loading, setLoading] = useState(false);

    const [requirements, setRequirements] = useState([]);
    const [selectedRequirement, setSelectedRequirement] = useState(null); // Full requirement object
    const [selectedReqId, setSelectedReqId] = useState('all');

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
            setWorkflowTabs(['new', 'interview', 'final']);
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

    const getFilteredApplicants = () => {
        // First filter by Requirement ID
        let filtered = applicants;
        if (selectedReqId !== 'all') {
            filtered = applicants.filter(a => a.requirementId?._id === selectedReqId || a.requirementId === selectedReqId);
        }

        // Then filter by Active Tab (Stage)
        if (selectedReqId === 'all') {
            // Default "All Jobs" buckets logic
            if (activeTab === 'new') {
                return filtered.filter(a => a.status === 'Applied');
            } else if (activeTab === 'interview') {
                return filtered.filter(a => ['Shortlisted', 'Interview Scheduled', 'Interview Rescheduled', 'Interview Completed', 'New Round'].some(s => a.status.includes(s) || a.status.includes('Round')));
            } else if (activeTab === 'final') {
                return filtered.filter(a => ['Selected', 'Rejected', 'Finalized'].includes(a.status));
            }
        } else {
            // Specific Job Workflow Logic
            // In this mode, activeTab IS the status name (e.g. "Technical Round")
            // BUT strict equality might miss generic statuses if not careful.
            // For custom workflows, we assign status exactly as the stage name.

            // Special case: 'Finalized' tab usually holds both 'Selected' and 'Rejected' 
            if (activeTab === 'Finalized') {
                return filtered.filter(a => ['Selected', 'Rejected', 'Finalized'].includes(a.status));
            }

            return filtered.filter(a => {
                if (a.status === activeTab) return true;
                // Fallback: If status is an interview-specific one and we are on Shortlisted tab
                const interviewStatuses = ['Interview Scheduled', 'Interview Rescheduled', 'Interview Completed', 'New Round'];
                if (interviewStatuses.includes(a.status) && activeTab === 'Shortlisted') return true;
                return false;
            });
        }

        return [];
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
    const [selectedStatusForReview, setSelectedStatusForReview] = useState('');
    const [isFinishingInterview, setIsFinishingInterview] = useState(false);
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewFeedback, setReviewFeedback] = useState('');

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

            await api[method](url, interviewData);

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
        setSelectedStatusForReview(''); // User will pick the next stage
        setReviewRating(0);
        setReviewFeedback('');
        setShowReviewModal(true);
    };

    const updateStatus = async (applicant, status, review = null) => {
        // Only confirm if no review is being sent (direct status change)
        if (!review && !confirm(`Update status to ${status}? This will trigger an email.`)) return;

        try {
            const payload = { status };
            if (review) {
                payload.rating = review.rating;
                payload.feedback = review.feedback;
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
        setShowReviewModal(true);
    };

    const submitReviewAndStatus = async () => {
        if (!selectedApplicant || !selectedStatusForReview) return;

        setLoading(true);
        try {
            // 1. If finishing interview, mark it complete in DB first
            if (isFinishingInterview) {
                await api.put(`/requirements/applicants/${selectedApplicant._id}/interview/complete`);
            }

            // 2. Update status with review
            const success = await updateStatus(selectedApplicant, selectedStatusForReview, {
                rating: reviewRating,
                feedback: reviewFeedback
            });

            if (success) {
                const status = selectedStatusForReview; // Save before clear
                const applicant = selectedApplicant;

                setShowReviewModal(false);
                setIsFinishingInterview(false);
                setReviewRating(0);
                setReviewFeedback('');
                setSelectedStatusForReview('');

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
        <div className="space-y-4 sm:space-y-6 relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Applicants</h1>
                    <p className="text-sm sm:text-base text-slate-500 mt-1">Manage candidates and generate letters.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <div className="w-full sm:w-64">
                        <select
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            value={selectedReqId}
                            onChange={(e) => handleRequirementChange(e.target.value)}
                        >
                            <option value="all">View All Applications</option>
                            <optgroup label="Filter by Job">
                                {requirements.map(req => (
                                    <option key={req._id} value={req._id}>{req.jobTitle}</option>
                                ))}
                            </optgroup>
                        </select>
                    </div>
                    <button
                        onClick={refreshData}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm sm:text-base justify-center"
                    >
                        <RefreshCw size={18} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-200/60 overflow-hidden">
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
                                    // Count Logic
                                    let count = 0;
                                    if (selectedReqId === 'all') {
                                        if (tab === 'new') count = applicants.filter(a => a.status === 'Applied').length;
                                        else if (tab === 'interview') count = applicants.filter(a => ['Shortlisted', 'Interview Scheduled', 'Interview Rescheduled', 'Interview Completed'].includes(a.status)).length;
                                        else if (tab === 'final') count = applicants.filter(a => ['Selected', 'Rejected'].includes(a.status)).length;
                                    } else {
                                        const sub = applicants.filter(a => (a.requirementId?._id === selectedReqId || a.requirementId === selectedReqId));
                                        if (tab === 'Finalized') count = sub.filter(a => ['Selected', 'Rejected', 'Finalized'].includes(a.status)).length;
                                        else count = sub.filter(a => a.status === tab).length;
                                    }

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

                            <table className="min-w-full divide-y divide-slate-100">
                                <thead className="bg-slate-50/80 text-slate-600 font-bold sticky top-0 z-10 backdrop-blur-sm">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Candidate</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Resume</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider hidden md:table-cell">Role</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Status</th>

                                        {/* Dynamic Columns - Only show for specific job */}
                                        {selectedReqId !== 'all' && (
                                            <>
                                                {/* Custom Workflow Columns */}
                                                {activeTab !== 'Finalized' && <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Process</th>}
                                                {activeTab === 'Finalized' && (
                                                    <>
                                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Outcome</th>
                                                        {applicants.some(a => a.status === 'Selected') && (
                                                            <>
                                                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Offer</th>
                                                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Salary</th>
                                                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Joining</th>
                                                            </>
                                                        )}
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 bg-white">
                                    {getFilteredApplicants().slice((currentPage - 1) * pageSize, currentPage * pageSize).map(app => (
                                        <tr key={app._id} className="hover:bg-slate-50 transition-colors">
                                            {/* Common Columns */}
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-slate-900">{app.name}</div>
                                                <div className="text-xs text-slate-500">{app.email}</div>
                                                <div className="text-xs text-slate-500">{app.mobile || 'N/A'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {app.resume ? (
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => openCandidateModal(app)}
                                                            className="text-slate-500 hover:text-blue-600 p-1 rounded hover:bg-blue-50 transition"
                                                            title="View Application & Resume"
                                                        >
                                                            <Eye size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => downloadResume(app.resume)}
                                                            className="text-slate-500 hover:text-green-600 p-1 rounded hover:bg-green-50 transition"
                                                            title="Download Resume"
                                                        >
                                                            <Download size={16} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">No Resume</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 hidden md:table-cell">
                                                <div className="text-sm font-medium text-slate-900 truncate max-w-[150px]">{app.requirementId?.jobTitle}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(app.status)}`}>
                                                    {app.status}
                                                </span>
                                            </td>

                                            {/* Logic for 'All' View - No Actions visible */}
                                            {selectedReqId === 'all' && null}

                                            {/* Logic for 'Custom Workflow' View */}
                                            {selectedReqId !== 'all' && (
                                                <>
                                                    {activeTab !== 'Finalized' && (
                                                        <td className="px-6 py-4">
                                                            {/* Show Reviews / Feedback History */}
                                                            {app.reviews && app.reviews.length > 0 && (
                                                                <div className="mb-3 space-y-2">
                                                                    {app.reviews.map((rev, idx) => (
                                                                        <div key={idx} className="p-2 bg-slate-50 border border-slate-100 rounded text-[10px] relative group">
                                                                            <div className="flex justify-between items-start mb-1">
                                                                                <span className="font-bold text-slate-700 uppercase">{rev.stage}</span>
                                                                                <div className="flex text-amber-500">
                                                                                    {[...Array(5)].map((_, i) => (
                                                                                        <span key={i} className={i < rev.rating ? 'fill-current' : 'text-slate-200'}>★</span>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                            <p className="text-slate-600 italic line-clamp-2" title={rev.feedback}>"{rev.feedback}"</p>
                                                                            <div className="mt-1 text-slate-400 text-[9px] flex justify-between">
                                                                                <span>By {rev.interviewerName}</span>
                                                                                <span>{dayjs(rev.createdAt).format('DD/MM')}</span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Show Scheduled Interview Details if available */}
                                                            {app.interview?.date && (
                                                                <div className={`mb-2 p-2 border rounded-md ${app.interview.completed ? 'bg-emerald-50 border-emerald-100' : 'bg-indigo-50 border-indigo-100'}`}>
                                                                    <div className="text-xs font-semibold flex items-center justify-between">
                                                                        <div className={`${app.interview.completed ? 'text-emerald-900' : 'text-indigo-900'} flex items-center gap-1`}>
                                                                            <span>📅 {dayjs(app.interview.date).format('DD MMM')}</span>
                                                                            <span>⏰ {app.interview.time}</span>
                                                                        </div>
                                                                        {app.interview.completed && (
                                                                            <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full font-bold">DONE</span>
                                                                        )}
                                                                    </div>
                                                                    <div className={`text-[10px] mt-1 ${app.interview.completed ? 'text-emerald-700' : 'text-indigo-700'}`}>
                                                                        Mode: {app.interview.mode}
                                                                    </div>

                                                                    {!app.interview.completed && (
                                                                        <div className="flex gap-2 mt-1">
                                                                            <button
                                                                                onClick={() => openScheduleModal(app, true)}
                                                                                className="text-[10px] text-indigo-600 underline hover:text-indigo-800"
                                                                            >
                                                                                Reschedule
                                                                            </button>
                                                                            <button
                                                                                onClick={() => markInterviewCompleted(app)}
                                                                                className="text-[10px] text-emerald-600 underline hover:text-emerald-800"
                                                                            >
                                                                                Mark Complete
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            <div className="flex gap-2 items-center">
                                                                <Select
                                                                    placeholder="Change Status"
                                                                    style={{ width: 160 }}
                                                                    size="small"
                                                                    onChange={(val) => {
                                                                        if (val === 'custom_add') {
                                                                            setCandidateForCustomStage(app);
                                                                            setIsCustomStageModalVisible(true);
                                                                        } else {
                                                                            openReviewPrompt(app, val);
                                                                        }
                                                                    }}
                                                                    dropdownMatchSelectWidth={false}
                                                                    value={null}
                                                                >
                                                                    <Select.Option disabled value="">Move to...</Select.Option>
                                                                    {workflowTabs
                                                                        .filter(t => t !== 'Finalized' && t !== app.status)
                                                                        .map(stage => (
                                                                            <Select.Option key={stage} value={stage}>
                                                                                Move to {stage}
                                                                            </Select.Option>
                                                                        ))
                                                                    }
                                                                    {/* Custom Stage Option */}
                                                                    <Select.Option value="custom_add" className="text-blue-600 font-bold border-t border-gray-100">+ Add Custom Stage</Select.Option>

                                                                    <Select.Option value="Selected" className="text-green-600 font-medium border-t border-gray-100">Select Candidate</Select.Option>
                                                                    <Select.Option value="Rejected" className="text-red-600 font-medium">Reject Candidate</Select.Option>
                                                                </Select>
                                                            </div>
                                                        </td>
                                                    )}

                                                    {activeTab === 'Finalized' && (
                                                        <>
                                                            <td className="px-6 py-4">
                                                                {app.status === 'Selected'
                                                                    ? <span className="text-xs font-bold text-green-600">Selected</span>
                                                                    : <span className="text-xs font-bold text-red-600">Rejected</span>}
                                                            </td>
                                                            {applicants.some(a => a.status === 'Selected') && (
                                                                <>
                                                                    {/* Reuse Offer/Salary/Joining display logic here simplified */}
                                                                    <td className="px-6 py-4">
                                                                        {app.status === 'Selected' ? (
                                                                            app.offerLetterPath ? (
                                                                                <div className="flex gap-2">
                                                                                    <button onClick={() => viewOfferLetter(app.offerLetterPath)} className="text-slate-500 hover:text-blue-600"><Eye size={16} /></button>
                                                                                    <button onClick={() => downloadOffer(app.offerLetterPath)} className="text-slate-500 hover:text-green-600"><Download size={16} /></button>
                                                                                </div>
                                                                            ) : <button onClick={() => openOfferModal(app)} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-200">Generate</button>
                                                                        ) : <span className="text-xs text-slate-300">-</span>}
                                                                    </td>
                                                                    <td className="px-6 py-4">
                                                                        {app.status === 'Selected' ? (
                                                                            app.salarySnapshot?.ctc?.yearly > 0 ? (
                                                                                <div className="flex items-center gap-2">
                                                                                    <button onClick={() => openSalaryModal(app)} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded"><Edit2 size={14} /></button>
                                                                                    <span className="text-xs font-bold text-slate-700">₹{(app.salarySnapshot.ctc.yearly / 100000).toFixed(1)}L</span>
                                                                                </div>
                                                                            ) : <button onClick={() => openSalaryModal(app)} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Assign</button>
                                                                        ) : <span className="text-xs text-slate-300">-</span>}
                                                                    </td>
                                                                    <td className="px-6 py-4">
                                                                        {app.status === 'Selected' && app.offerLetterPath ? (
                                                                            app.joiningLetterPath ? (
                                                                                <div className="flex gap-2">
                                                                                    <button onClick={() => viewJoiningLetter(app._id)} className="text-slate-500 hover:text-blue-600"><Eye size={16} /></button>
                                                                                    <button onClick={() => downloadJoiningLetter(app._id)} className="text-slate-500 hover:text-green-600"><Download size={16} /></button>
                                                                                </div>
                                                                            ) : <button onClick={() => openJoiningModal(app)} className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded border border-purple-200">Generate</button>
                                                                        ) : <span className="text-xs text-slate-300">-</span>}
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
            {showModal && selectedApplicant && (
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
            )}

            {/* Joining Letter Generation Modal */}
            {showJoiningModal && selectedApplicant && (
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
            )}

            {/* Joining Letter Preview Modal */}
            {showJoiningPreview && selectedApplicant && (
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
            )}

            {/* Offer Letter Preview Modal (Unified for both Offer & Joining) */}
            {showPreview && selectedApplicant && (
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
            )}

            {/* Assign Salary Modal */}
            {showSalaryModal && selectedApplicant && (
                <AssignSalaryModal
                    isOpen={showSalaryModal}
                    onClose={() => {
                        setShowSalaryModal(false);
                        setSelectedApplicant(null);
                    }}
                    applicant={selectedApplicant}
                    onSuccess={handleSalaryAssigned}
                />
            )}

            {/* Salary Preview Modal */}
            {showSalaryPreview && selectedApplicant && selectedApplicant.salarySnapshot && (
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
            )}

            {/* INTERVIEW MODAL */}
            {showInterviewModal && (
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
            )}

            {/* Custom Stage Modal */}
            {isCustomStageModalVisible && (
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
            )}

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
                )}
            {/* End of Workflow Edit Modal */}
            {/* Candidate Details & Resume Modal */}
            {showCandidateModal && selectedApplicant && (
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
            )}
            {/* Review & Feedback Modal */}
            {showReviewModal && selectedApplicant && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <h2 className="text-xl font-bold text-slate-800 mb-2">
                                {isFinishingInterview ? 'Interview Completed: Evaluation' : 'Evaluate Candidate'}
                            </h2>
                            <p className="text-sm text-slate-500 mb-6">
                                {isFinishingInterview
                                    ? `Rate ${selectedApplicant.name}'s performance and decide the next step.`
                                    : `You are moving ${selectedApplicant.name} to ${selectedStatusForReview}.`
                                }
                            </p>

                            <div className="space-y-6">
                                {/* Next Stage Picker (Only when finishing interview) */}
                                {isFinishingInterview && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 text-blue-600">Decision: Move To</label>
                                        <Select
                                            className="w-full h-10"
                                            placeholder="Select Next Stage / Result"
                                            value={selectedStatusForReview || null}
                                            onChange={(val) => setSelectedStatusForReview(val)}
                                        >
                                            <Select.OptGroup label="Hiring Pipeline">
                                                {workflowTabs.filter(t => !['Applied', 'Finalized'].includes(t)).map(tab => (
                                                    <Select.Option key={tab} value={tab}>{tab}</Select.Option>
                                                ))}
                                            </Select.OptGroup>
                                            <Select.OptGroup label="Final Result">
                                                <Select.Option value="Selected">Selected / Selected</Select.Option>
                                                <Select.Option value="Rejected">Rejected</Select.Option>
                                                <Select.Option value="Finalized">Finalized</Select.Option>
                                            </Select.OptGroup>
                                        </Select>
                                    </div>
                                )}
                                {/* Star Rating */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Rating (Star)</label>
                                    <div className="flex gap-2">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                onClick={() => setReviewRating(star)}
                                                className={`p-1 transition-all ${reviewRating >= star ? 'text-amber-400 scale-110' : 'text-slate-200 hover:text-amber-200'}`}
                                            >
                                                <Star size={32} fill={reviewRating >= star ? 'currentColor' : 'none'} />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Feedback Text */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Feedback / Call Notes</label>
                                    <textarea
                                        value={reviewFeedback}
                                        onChange={(e) => setReviewFeedback(e.target.value)}
                                        placeholder="Add your interview performance, reasons for selection, or call notes..."
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                                        rows="4"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end mt-8">
                                <button
                                    onClick={() => {
                                        setShowReviewModal(false);
                                        setIsFinishingInterview(false);
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={submitReviewAndStatus}
                                    disabled={loading || reviewRating === 0 || (isFinishingInterview && !selectedStatusForReview)}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-lg shadow-blue-200 transition-all transform active:scale-95 disabled:opacity-50 disabled:grayscale"
                                >
                                    {isFinishingInterview ? 'Complete & Move' : `Submit & Move to ${selectedStatusForReview}`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


