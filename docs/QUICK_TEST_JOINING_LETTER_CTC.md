# 🔍 QUICK TEST: Joining Letter CTC Structure

## ✅ **STEP-BY-STEP FLOW (5 MINUTES)**

### **STEP 1: Assign Salary to Applicant** ⚡

```
POST https://hrms.gitakshmi.com/api/requirements/applicants/{applicantId}/assign-salary
Headers: Authorization: Bearer YOUR_TOKEN
Body: { "salaryTemplateId": "YOUR_TEMPLATE_ID" }
```

**Check:** Response has `salarySnapshot` with `ctc`, `basic`, `grossA`, etc.

---

### **STEP 2: Generate Joining Letter** 📄

```
POST https://hrms.gitakshmi.com/api/letters/generate-joining
Headers: Authorization: Bearer YOUR_TOKEN
Body: {
  "applicantId": "SAME_APPLICANT_ID",
  "templateId": "JOINING_LETTER_TEMPLATE_ID"
}
```

**Check:** Returns `downloadUrl` (PDF generated successfully)

---

### **STEP 3: Download & Open PDF** 📥

Open the PDF from: `https://hrms.gitakshmi.com/uploads/offers/Joining_Letter_XXX.pdf`

**Check PDF Contains:**
- ✅ CTC amount (not zero/empty)
- ✅ Basic salary amount
- ✅ HRA amount
- ✅ Gross A/B/C amounts
- ✅ Gratuity amount
- ✅ Take Home amount

---

### **STEP 4: Check Backend Logs** 🔍

Look in terminal for:
```
✅ [JOINING LETTER] Salary snapshot found
🔥 [JOINING LETTER] Salary snapshot values: { ctc: '...', basic: '...', grossA: '...' }
```

**If you see:** `❌ Salary snapshot missing` → Go back to STEP 1

---

## 🚨 **QUICK TROUBLESHOOTING**

| Problem | Solution |
|---------|----------|
| "Salary not assigned" error | Do STEP 1 first |
| PDF shows zeros/empty | Check Word template has placeholders: `{{CTC}}`, `{{BASIC_SALARY}}`, etc. |
| No salarySnapshot in response | Verify applicant status is "Selected" |
| Template not found | Check template ID is correct |

---

## ✅ **SUCCESS = PDF Has Real Salary Numbers!**

That's it! 🎉

