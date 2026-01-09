// Document Upload Helper Functions for Applicants.jsx
// Add these functions to your Applicants.jsx component

// Helper function to check if all documents are verified
const areAllDocumentsVerified = (applicant) => {
    if (!applicant.customDocuments || applicant.customDocuments.length === 0) {
        return false; // No documents uploaded
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
        // Validate file type (PDF, JPG, PNG)
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
            message.error('Only PDF, JPG, and PNG files are allowed');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            message.error('File size must be less than 5MB');
            return;
        }

        setDocumentFile(file);
    }
};

// Add document to list
const addDocumentToList = () => {
    if (!documentName.trim()) {
        message.error('Please enter document name');
        return;
    }

    if (!documentFile) {
        message.error('Please select a file');
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

    // Reset file input
    const fileInput = document.getElementById('documentFileInput');
    if (fileInput) fileInput.value = '';

    message.success('Document added to list');
};

// Remove document from list
const removeDocumentFromList = (index) => {
    setUploadedDocuments(prev => prev.filter((_, idx) => idx !== index));
};

// Save all documents to backend
const saveDocuments = async () => {
    if (uploadedDocuments.length === 0) {
        message.error('Please add at least one document');
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

        const res = await api.post(
            `/requirements/applicants/${documentApplicant._id}/documents`,
            formData,
            {
                headers: { 'Content-Type': 'multipart/form-data' }
            }
        );

        message.success('Documents uploaded successfully');
        setShowDocumentModal(false);
        loadApplicants(); // Refresh data
    } catch (err) {
        console.error('Document upload error:', err);
        message.error(err.response?.data?.message || 'Failed to upload documents');
    }
};

// Verify a specific document
const verifyDocument = async (applicantId, documentIndex) => {
    try {
        await api.patch(
            `/requirements/applicants/${applicantId}/documents/${documentIndex}/verify`
        );

        message.success('Document verified');
        loadApplicants(); // Refresh data
    } catch (err) {
        console.error('Document verification error:', err);
        message.error('Failed to verify document');
    }
};

export {
    areAllDocumentsVerified,
    openDocumentModal,
    handleDocumentFileChange,
    addDocumentToList,
    removeDocumentFromList,
    saveDocuments,
    verifyDocument
};
