# SALARY ASSIGNMENT MODULE - TESTING GUIDE
**Purpose:** Step-by-step guide to test and verify the Salary Assignment module

---

## 📋 **PREREQUISITES**

Before testing, ensure:
1. ✅ Backend server is running (`npm start` or `node backend/index.js`)
2. ✅ MongoDB is running
3. ✅ You have HR user credentials (logged in)
4. ✅ At least one Salary Template exists in the system
5. ✅ At least one Applicant with status "Selected" exists

---

## 🧪 **TESTING CHECKLIST**

### **STEP 1: Verify Prerequisites**

#### 1.1 Check Salary Templates Exist
```bash
# In browser console or Postman
GET https://hrms.gitakshmi.com/api/payroll/salary-templates
Headers: Authorization: Bearer <your-token>
```

**Expected:** Returns array of salary templates
**Action if empty:** Create a salary template first via HR Dashboard

---

#### 1.2 Check Applicants Exist
```bash
# In browser console or Postman
GET https://hrms.gitakshmi.com/api/requirements/applicants
Headers: Authorization: Bearer <your-token>
```

**Expected:** Returns array of applicants
**Action if empty:** Create an applicant first

---

#### 1.3 Verify Applicant Status is "Selected"
```bash
# Check applicant status
GET https://hrms.gitakshmi.com/api/requirements/applicants
# Find an applicant with status: "Selected"
```

**Action if no "Selected" applicants:**
- Update applicant status to "Selected" first
- OR generate an offer letter for an applicant (automatically sets status to "Selected")

---

### **STEP 2: Test Salary Assignment API**

#### 2.1 Assign Salary to Applicant
```bash
POST https://hrms.gitakshmi.com/api/requirements/applicants/{applicantId}/assign-salary
Headers: 
  Authorization: Bearer <your-token>
  Content-Type: application/json
Body (JSON):
{
  "salaryTemplateId": "YOUR_SALARY_TEMPLATE_ID"
}
```

**Example with curl:**
```bash
curl -X POST https://hrms.gitakshmi.com/api/requirements/applicants/60a1b2c3d4e5f6g7h8i9j0k1/assign-salary \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"salaryTemplateId": "60a1b2c3d4e5f6g7h8i9j0k2"}'
```

**Expected Success Response (200):**
```json
{
  "success": true,
  "message": "Salary assigned successfully",
  "data": {
    "applicant": {
      "_id": "...",
      "name": "John Doe",
      "salaryTemplateId": "..."
    },
    "salarySnapshot": {
      "salaryTemplateId": "...",
      "earnings": [...],
      "employerContributions": [...],
      "employeeDeductions": [...],
      "grossA": { "monthly": 25000, "yearly": 300000 },
      "grossB": { "monthly": 26200, "yearly": 314400 },
      "grossC": { "monthly": 50000, "yearly": 600000 },
      "takeHome": { "monthly": 23000, "yearly": 276000 },
      "gratuity": { "monthly": 1200, "yearly": 14400 },
      "ctc": { "monthly": 50000, "yearly": 600000 },
      "calculatedAt": "2025-01-XX..."
    }
  }
}
```

**Check Terminal/Console:**
- Look for log: `✅ [ASSIGN SALARY] Salary assigned successfully`
- No errors should appear

---

#### 2.2 Verify Assignment in Database

**Option A: Using API**
```bash
GET https://hrms.gitakshmi.com/api/requirements/applicants/{applicantId}/salary
Headers: Authorization: Bearer <your-token>
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "applicantId": "...",
    "applicantName": "John Doe",
    "salaryTemplateId": "...",
    "salarySnapshot": { ... }
  }
}
```

**Option B: Using MongoDB Compass/Shell**
```javascript
// Connect to your database
use company_YOUR_TENANT_ID

// Find applicant
db.applicants.findOne({ _id: ObjectId("YOUR_APPLICANT_ID") })

// Check fields:
// - salaryTemplateId (should be ObjectId)
// - salarySnapshot (should have earnings, grossA, grossB, etc.)
```

---

### **STEP 3: Test Error Cases**

#### 3.1 Test with Invalid Applicant ID
```bash
POST https://hrms.gitakshmi.com/api/requirements/applicants/INVALID_ID/assign-salary
Body: { "salaryTemplateId": "VALID_TEMPLATE_ID" }
```

**Expected Response (400):**
```json
{
  "success": false,
  "error": "Invalid applicant ID format"
}
```

---

#### 3.2 Test with Non-Selected Applicant
```bash
# Use applicant with status: "Applied" or "Shortlisted"
POST https://hrms.gitakshmi.com/api/requirements/applicants/{applicantId}/assign-salary
Body: { "salaryTemplateId": "VALID_TEMPLATE_ID" }
```

**Expected Response (400):**
```json
{
  "success": false,
  "error": "Cannot assign salary to applicant with status \"Applied\". Applicant must be in \"Selected\" status."
}
```

---

#### 3.3 Test Duplicate Assignment
```bash
# Try assigning salary to same applicant twice
POST https://hrms.gitakshmi.com/api/requirements/applicants/{applicantId}/assign-salary
Body: { "salaryTemplateId": "VALID_TEMPLATE_ID" }
# Run the same request again
```

**Expected Response (400) on second call:**
```json
{
  "success": false,
  "error": "Salary already assigned to this applicant. To change salary, please contact administrator.",
  "currentSalary": {
    "salaryTemplateId": "...",
    "calculatedAt": "..."
  }
}
```

---

#### 3.4 Test with Missing Salary Template
```bash
POST https://hrms.gitakshmi.com/api/requirements/applicants/{applicantId}/assign-salary
Body: { "salaryTemplateId": "NON_EXISTENT_ID" }
```

**Expected Response (404):**
```json
{
  "success": false,
  "error": "Salary template not found"
}
```

---

### **STEP 4: Test Joining Letter Generation**

#### 4.1 Test WITHOUT Salary Assignment (Should Fail)
```bash
POST https://hrms.gitakshmi.com/api/letters/generate-joining
Headers: Authorization: Bearer <your-token>
Body:
{
  "applicantId": "APPLICANT_ID_WITHOUT_SALARY",
  "templateId": "JOINING_LETTER_TEMPLATE_ID"
}
```

**Expected Response (400):**
```json
{
  "success": false,
  "message": "Salary not assigned. Please assign salary to applicant first using POST /api/requirements/applicants/:id/assign-salary",
  "code": "SALARY_NOT_ASSIGNED"
}
```

---

#### 4.2 Test WITH Salary Assignment (Should Succeed)
```bash
# 1. First assign salary (from Step 2.1)
# 2. Then generate joining letter
POST https://hrms.gitakshmi.com/api/letters/generate-joining
Headers: Authorization: Bearer <your-token>
Body:
{
  "applicantId": "APPLICANT_ID_WITH_SALARY",
  "templateId": "JOINING_LETTER_TEMPLATE_ID"
}
```

**Expected Success Response (200):**
```json
{
  "success": true,
  "downloadUrl": "/uploads/offers/Joining_Letter_XXX_XXX.pdf",
  "pdfUrl": "/uploads/offers/Joining_Letter_XXX_XXX.pdf",
  "letterId": "...",
  "pdfPath": "offers/Joining_Letter_XXX_XXX.pdf"
}
```

**Check Terminal/Console:**
- Look for: `✅ [JOINING LETTER] Salary snapshot found`
- Look for: `🔥 [JOINING LETTER] Salary snapshot values:` with ctc, basic, grossA, takeHome
- PDF should be generated successfully

---

#### 4.3 Verify PDF Contains Salary Data

**Check PDF File:**
1. Download the generated PDF from: `https://hrms.gitakshmi.com/uploads/offers/Joining_Letter_XXX_XXX.pdf`
2. Open PDF and verify:
   - ✅ CTC amount is present
   - ✅ Basic salary is present
   - ✅ HRA is present (if applicable)
   - ✅ Gross A/B/C are present (if template uses these placeholders)
   - ✅ Gratuity is present
   - ✅ Take Home is present
   - ✅ All amounts match the salary snapshot

**Expected Placeholders in Word Template:**
Your Word template should have placeholders like:
- `{{BASIC_SALARY}}` or `{{basic_monthly}}`
- `{{HRA}}` or `{{hra_monthly}}`
- `{{CTC}}` or `{{ctc_yearly}}`
- `{{GRATUITY}}` or `{{gratuity_monthly}}`
- `{{TAKE_HOME}}` or `{{take_home_monthly}}`

---

## 🔍 **DEBUGGING TIPS**

### **Check Backend Logs**

Look for these log messages in terminal:

**Successful Assignment:**
```
🔥 [ASSIGN SALARY] Request received: { applicantId: '...', bodyKeys: [...], tenantId: '...' }
🔥 [ASSIGN SALARY] Using existing template: ...
✅ [ASSIGN SALARY] Salary assigned successfully: { applicantId: '...', salaryTemplateId: '...', ctc: ... }
```

**Successful Joining Letter:**
```
🔥 [JOINING LETTER] Request received: ...
✅ [JOINING LETTER] Salary snapshot found: { ctc: ..., calculatedAt: ... }
🔥 [JOINING LETTER] Salary snapshot values: { ctc: '...', basic: '...', grossA: '...', takeHome: '...' }
✅ [JOINING LETTER] PDF Ready: /uploads/offers/...
```

**Error Logs:**
```
❌ [ASSIGN SALARY] Error: ...
🔥 [JOINING LETTER] Salary snapshot missing for applicant: ...
```

---

### **Common Issues & Solutions**

#### Issue 1: "Applicant not found"
**Solution:** 
- Verify applicant ID is correct
- Check applicant exists in database
- Ensure you're using correct tenant ID

#### Issue 2: "Salary template not found"
**Solution:**
- Verify template ID is correct
- Check template exists in database
- Ensure template belongs to your tenant

#### Issue 3: "Cannot assign salary to applicant with status..."
**Solution:**
- Update applicant status to "Selected" first
- OR generate offer letter (automatically sets status to "Selected")

#### Issue 4: "Salary already assigned"
**Solution:**
- This is expected behavior (salary is locked)
- Check current salary using GET endpoint
- To change, you may need to clear salarySnapshot in database (admin action)

#### Issue 5: "Salary not assigned" when generating joining letter
**Solution:**
- Assign salary first using POST /assign-salary
- Verify salarySnapshot exists using GET /salary

#### Issue 6: Salary amounts are "0.00" in PDF
**Solution:**
- Check salary snapshot in database
- Verify salary template has valid earnings data
- Check Word template placeholders match expected names (e.g., `{{BASIC_SALARY}}` vs `{{basic_monthly}}`)

---

## 📝 **QUICK TEST SCRIPT**

**Using Browser Console (if frontend is available):**

```javascript
// 1. Get your token from localStorage or cookies
const token = localStorage.getItem('token'); // or wherever your token is stored

// 2. Get applicants
fetch('https://hrms.gitakshmi.com/api/requirements/applicants', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(data => {
  console.log('Applicants:', data);
  const selectedApplicant = data.find(a => a.status === 'Selected');
  console.log('Selected Applicant:', selectedApplicant);
});

// 3. Get salary templates
fetch('https://hrms.gitakshmi.com/api/payroll/salary-templates', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(data => {
  console.log('Salary Templates:', data);
  const template = data.data[0];
  console.log('First Template:', template);
});

// 4. Assign salary
fetch('https://hrms.gitakshmi.com/api/requirements/applicants/YOUR_APPLICANT_ID/assign-salary', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    salaryTemplateId: 'YOUR_TEMPLATE_ID'
  })
})
.then(r => r.json())
.then(data => {
  console.log('Assignment Result:', data);
});

// 5. Get salary
fetch('https://hrms.gitakshmi.com/api/requirements/applicants/YOUR_APPLICANT_ID/salary', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(data => {
  console.log('Salary Snapshot:', data);
});
```

---

## ✅ **SUCCESS CRITERIA**

Your implementation is working correctly if:

1. ✅ Salary assignment API returns success (200) with salarySnapshot
2. ✅ Applicant record in database has `salaryTemplateId` and `salarySnapshot`
3. ✅ Duplicate assignment is prevented (returns error)
4. ✅ Joining letter generation fails if salary not assigned (returns error)
5. ✅ Joining letter generation succeeds if salary is assigned
6. ✅ Generated PDF contains salary amounts (not zeros or empty)
7. ✅ All salary placeholders in Word template are populated

---

**Need Help?** Check backend terminal logs for detailed error messages!

