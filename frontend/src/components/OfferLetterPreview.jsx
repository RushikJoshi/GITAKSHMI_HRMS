import React, {
  forwardRef,
  useImperativeHandle,
  memo,
  useMemo
} from 'react';
import html2canvas from 'html2canvas';
import './editor/document.css';

/**
 * FINAL MERGED OFFER LETTER PREVIEW
 * - LEFT: Full offer letter content (static, legal)
 * - RIGHT: Template engine + A4 preview + screenshot
 */

const OfferLetterPreview = memo(
  forwardRef(
    (
      {
        applicant,
        offerData,
        companyInfo,
        templateType = 'NORMAL',
        headerHeight = 0,
        footerHeight = 0,
        hasHeader = false,
        hasFooter = false
      },
      ref
    ) => {
      const isLetterPad = templateType === 'LETTER_PAD';

      /* ------------------ SCREENSHOT SUPPORT ------------------ */
      useImperativeHandle(ref, () => ({
        captureScreenshot: async () => {
          const el = document.getElementById('offer-letter-preview');
          if (!el) throw new Error('Preview element not found');
          const canvas = await html2canvas(el, {
            scale: 1,
            backgroundColor: '#ffffff',
            useCORS: true
          });
          return canvas.toDataURL('image/png');
        }
      }));

      /* ------------------ DATE ------------------ */
      const today = new Date().toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      /* ------------------ LETTERHEAD BG ------------------ */
      const rawBgPath = companyInfo?.branding?.letterheadBg;
      const bgUrl = rawBgPath
        ? (rawBgPath.startsWith('http')
          ? rawBgPath
          : `${import.meta.env.VITE_API_URL || 'https://hrms.gitakshmi.com'}${rawBgPath.startsWith('/') ? '' : '/'}${rawBgPath}`
        ).replace(/\\/g, '/')
        : null;

      /* ------------------ BODY HTML (LEFT CONTENT) ------------------ */
      const previewHtml = useMemo(() => {
        // Use the fetched template content if available, otherwise default fallback
        let content = offerData.templateContent || `
<div class="bg-white p-8 max-w-4xl mx-auto rounded-lg">
  <div class="flex justify-between items-start mb-8 pb-6 border-b-2 border-blue-600">
    <div>
      <h1 class="text-3xl font-bold text-blue-600 mb-1">${companyInfo?.name || 'Company Name'}</h1>
      <p class="text-sm text-slate-600">${companyInfo?.tagline || 'Technologies'}</p>
    </div>
  </div>
  <div class="text-right mb-6 text-xs text-slate-500">
    Ref: ${companyInfo?.refPrefix || 'OFFER'}/${new Date().getFullYear()}/${Math.floor(Math.random() * 10000)}
  </div>
  <div class="mb-6">
    <p class="font-semibold">Ms./Mr. ${applicant?.name}</p>
    <p class="text-sm">${applicant?.address || '-'}</p>
  </div>
  <p class="font-bold underline mb-4">Offer to Join ${companyInfo?.name || 'Our Company'}</p>
  <p class="mb-4">Dear ${applicant?.name?.split(' ')[0]},</p>
  <p class="mb-4">
    We are pleased to offer you the position of
    <b> ${applicant?.requirementId?.jobTitle || offerData?.position}</b>
    at our <b>${offerData?.location || 'Ahmedabad'}</b> office.
  </p>
  <ol class="list-decimal ml-6 space-y-2 text-sm">
    <li><b>Date of Joining:</b> ${offerData?.joiningDate || '_________'}</li>
    <li><b>Probation:</b> ${offerData?.probationPeriod || '3 months'}</li>
    <li><b>Compensation:</b> As per company policy.</li>
    <li><b>Verification:</b> Subject to document verification.</li>
  </ol>
  <p class="mt-6">We look forward to a long and mutually beneficial association.</p>
  <div class="mt-12">
    <p>For ${companyInfo?.name}</p>
    <p class="mt-6 font-semibold">Authorized Signatory</p>
  </div>
  <div class="mt-12 border-t pt-4">
    <p class="font-semibold mb-2">Acceptance of Offer</p>
    <p>I accept the above terms.</p>
    <p class="mt-6 font-semibold">${applicant?.name?.toUpperCase()}</p>
  </div>
</div>
        `;

        // Get issued date (current date when letter is generated)
        const issuedDate = new Date().toLocaleDateString('en-IN');

        // Replacements Map
        const replacements = {
          '{{employee_name}}': applicant?.name || '',
          '{{candidate_name}}': applicant?.name || '',
          '{{father_name}}': applicant?.fatherName || '',
          '{{designation}}': applicant?.requirementId?.jobTitle || offerData?.position || '',
          '{{joining_date}}': offerData?.joiningDate || '',
          '{{location}}': offerData?.location || applicant?.workLocation || '',
          '{{address}}': applicant?.address || '',
          '{{offer_ref_no}}': `OFFER/${new Date().getFullYear()}/${applicant?._id?.slice(-4).toUpperCase()}`,
          // Issued Date - support multiple placeholder variations
          '{{issued_date}}': issuedDate,
          '{{issuedDate}}': issuedDate, // CamelCase alias
          '{{ISSUED_DATE}}': issuedDate, // Uppercase alias
          // Current date (legacy support)
          '{{current_date}}': issuedDate
        };

        // Perform Replacements
        Object.keys(replacements).forEach(key => {
          const regex = new RegExp(key, 'g');
          content = content.replace(regex, replacements[key]);
        });

        // Ensure content is wrapped if it's just raw HTML fragments
        if (!content.trim().startsWith('<div') && !content.trim().startsWith('<html')) {
          content = `<div class="p-8">${content}</div>`;
        }

        return content;
      }, [applicant, offerData, companyInfo]);

      /* ------------------ RENDER ------------------ */
      return (
        <div className="bg-gray-100 p-8 flex justify-center overflow-auto">
          <div
            id="offer-letter-preview"
            className="a4-page shadow-lg relative"
            style={{
              width: '210mm',
              minHeight: '297mm',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'white',
              ...(isLetterPad && bgUrl
                ? {
                  backgroundImage: `url('${bgUrl}')`,
                  backgroundSize: '210mm 297mm',
                  backgroundRepeat: 'no-repeat'
                }
                : {})
            }}
          >
            {/* Issue Date - Only show if not in content */}
            {!previewHtml.includes('Issue Date') && (
              <div
                style={{
                  position: 'absolute',
                  top: '5mm',
                  left: '10mm',
                  fontSize: '10px',
                  color: '#9ca3af'
                }}
              >
                Issue Date: {today}
              </div>
            )}


            {/* Header Spacer */}
            <div style={{ height: `${headerHeight}mm` }} />

            {/* Body */}
            <div
              className="flex-1 formatted-content"
              style={{ padding: '10mm' }}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />

            {/* Footer Spacer */}
            <div style={{ height: `${footerHeight}mm` }} />
          </div>
        </div>
      );
    }
  )
);

export default OfferLetterPreview;
