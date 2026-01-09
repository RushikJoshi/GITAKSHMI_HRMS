# 📄 DOCUMENT UPLOAD & VERIFICATION FEATURE
## Implementation Guide

### ✅ WHAT'S BEEN DONE:

1. **Frontend (Applicants.jsx):**
   - ✅ Added "Documents" column in Finalized tab
   - ✅ Added document state management
   - ✅ Added helper functions (areAllDocumentsVerified, openDocumentModal, etc.)
   - ✅ Modified SET CTC button to be disabled until all documents are verified
   - ✅ Fixed syntax errors

2. **Reference Files Created:**
   - ✅ DOCUMENT_UPLOAD_MODAL.txt - Modal UI component
   - ✅ BACKEND_DOCUMENT_ROUTES.txt - API endpoints
   - ✅ APPLICANT_SCHEMA_UPDATE.txt - Database schema

---

### 🔧 WHAT YOU NEED TO DO:

#### **STEP 1: Update Applicant Model**
File: `backend/models/Applicant.js`

Add this field to the schema:
```javascript
customDocuments: [{
    name: { type: String, required: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileSize: { type: Number },
    fileType: { type: String },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    verifiedBy: { type: String },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: String }
}],
```

#### **STEP 2: Create uploads/documents Directory**
```bash
cd backend
mkdir -p uploads/documents
```

#### **STEP 3: Add Backend Routes**
File: `backend/routes/requirement.routes.js` (or create new `document.routes.js`)

Copy the code from `BACKEND_DOCUMENT_ROUTES.txt` and add:
- POST `/api/requirements/applicants/:id/documents`
- PATCH `/api/requirements/applicants/:id/documents/:docIndex/verify`

Don't forget to:
```javascript
const multer = require('multer');
npm install multer  // if not installed
```

#### **STEP 4: Add Document Modal to Frontend**
File: `frontend/src/pages/HR/Applicants.jsx`

Find the return statement (around line 1000+) and add the modal code from `DOCUMENT_UPLOAD_MODAL.txt` before the closing `</div>`.

Also add these imports at the top:
```javascript
import { Trash2 } from 'lucide-react';
import { message } from 'antd';
```

#### **STEP 5: Add Missing Icons**
The code uses `Trash2` icon. Make sure it's imported:
```javascript
import { 
    Eye, Download, Edit2, CheckCircle, Clock, 
    XCircle, Trash2  // ← Add this
} from 'lucide-react';
```

---

### 🎯 HOW IT WORKS:

1. **After Offer Letter is Generated:**
   - HR sees "Upload Documents" button in Documents column
   
2. **Upload Process:**
   - HR clicks "Upload Documents"
   - Modal opens with form to add multiple documents
   - Each document needs: Name + File (PDF/JPG/PNG, max 5MB)
   - HR can add multiple documents (Aadhar, PAN, Certificates, etc.)
   - Click "Save Documents" to upload all at once

3. **Verification:**
   - Uploaded documents show with ⏰ (pending) icon
   - HR clicks ✓ button next to each document to verify
   - Once verified, shows ✓ (green checkmark)

4. **SET CTC Button:**
   - **DISABLED** until ALL documents are verified
   - **ENABLED** only when all documents have green checkmark
   - Tooltip shows "Please verify all documents first" when disabled

---

### 📊 WORKFLOW:

```
Candidate Selected
    ↓
Generate Offer Letter
    ↓
Upload Documents (ID, Certificates, etc.)
    ↓
Verify Each Document ✓
    ↓
SET CTC Button Enabled ✅
    ↓
Assign Salary
    ↓
Generate Joining Letter
```

---

### 🧪 TESTING:

1. Select a candidate and generate offer letter
2. Click "Upload Documents"
3. Add 2-3 documents (e.g., "Aadhar Card", "PAN Card")
4. Save documents
5. Verify each document by clicking ✓
6. SET CTC button should now be enabled
7. Click SET CTC and assign salary

---

### 🐛 TROUBLESHOOTING:

**Issue:** SET CTC button not enabling
- **Fix:** Make sure ALL documents are verified (green checkmark)

**Issue:** File upload fails
- **Fix:** Check file size (< 5MB) and type (PDF/JPG/PNG only)

**Issue:** Modal not showing
- **Fix:** Make sure you added the modal code from DOCUMENT_UPLOAD_MODAL.txt

**Issue:** Backend error
- **Fix:** Ensure multer is installed: `npm install multer`
- **Fix:** Create uploads/documents directory

---

### 📝 NOTES:

- Documents are stored in `backend/uploads/documents/`
- Each document has unique filename with timestamp
- Verification is tracked with verifiedBy and verifiedAt fields
- Frontend shows document count and verification status
- Can add more documents even after initial upload

---

### 🎨 UI FEATURES:

- ✅ Clean, modern document cards
- ✅ Color-coded verification status (amber = pending, green = verified)
- ✅ File size display
- ✅ One-click verification
- ✅ "+ Add More" button for additional documents
- ✅ Disabled state for SET CTC with tooltip
- ✅ Responsive design

---

**જો કોઈ પ્રશ્ન હોય તો પૂછો! 🚀**
