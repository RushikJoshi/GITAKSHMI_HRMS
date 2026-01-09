const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        // Create transporter using Gmail SMTP with App Password
        // Environment variables must be set: SMTP_USER, SMTP_PASS, SMTP_HOST, SMTP_PORT
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_PORT == 465, // true for 465, false for 587
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }

    /**
     * Send an email to a specific recipient
     * @param {string} to - Recipient email address
     * @param {string} subject - Subject line
     * @param {string} html - HTML body content
     * @returns {Promise<Object>} - The result of the send operation
     */
    async sendEmail(to, subject, html) {
        try {
            if (!to) {
                throw new Error("Recipient email address is required.");
            }

            console.log(`📧 [EmailService] Sending email to: ${to}`);

            const mailOptions = {
                from: `"HRMS Notifications" <${process.env.SMTP_USER}>`,
                to: to,
                subject: subject,
                html: html,
            };

            const info = await this.transporter.sendMail(mailOptions);

            console.log(`✅ [EmailService] Email sent successfully. MessageID: ${info.messageId}`);
            return { success: true, messageId: info.messageId };

        } catch (error) {
            console.error(`❌ [EmailService] Failed to send email to ${to}:`, error.message);
            // We throw the error so the calling controller handles it
            throw error;
        }
    }
    /**
     * Send Status Update Email (Standardized Template)
     * @param {string} to - Recipient Email
     * @param {string} candidateName - Name of Candidate
     * @param {string} jobTitle - Job Title
     * @param {string} applicationId - Application ID
     * @param {string} status - New Status
     */
    /**
     * Send Status Update Email (Standardized Template)
     * ALIAS: sendStatusEmail (for backward compatibility)
     */
    async sendApplicationStatusEmail(to, candidateName, jobTitle, applicationId, status, feedback = null, rating = null) {
        const subject = `Application Status Update - ${jobTitle}`;

        // Color coding for status
        let statusColor = '#3498db'; // Default Blue (Applied)
        if (status === 'Shortlisted') statusColor = '#f1c40f'; // Yellow
        if (status === 'Selected') statusColor = '#2ecc71'; // Green
        if (status === 'Rejected') statusColor = '#e74c3c'; // Red
        if (status === 'Under Review') statusColor = '#9b59b6'; // Purple

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px; overflow: hidden;">
                <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">Application Update</h2>
                </div>
                
                <div style="padding: 25px; background-color: #ffffff;">
                    <p style="font-size: 16px; color: #333;">Dear <strong>${candidateName}</strong>,</p>
                    
                    <p style="color: #555; line-height: 1.5;">
                        The status of your application for the position of <strong>${jobTitle}</strong> has been updated.
                    </p>

                    <div style="background-color: #f8f9fa; border-left: 5px solid ${statusColor}; padding: 15px; margin: 20px 0;">
                        <p style="margin: 5px 0; font-size: 14px; color: #777;">Application ID:</p>
                        <p style="margin: 0; font-weight: bold; color: #333;">${applicationId}</p>
                        
                        <p style="margin: 15px 0 5px; font-size: 14px; color: #777;">Current Status:</p>
                        </span>
                    </div>

                    ${feedback ? `
                        <div style="margin: 20px 0; padding: 15px; background-color: #fcfcfc; border: 1px dashed #e0e0e0; border-radius: 8px;">
                            <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: bold; color: #7f8c8d; text-transform: uppercase;">Feedback / Assessment</p>
                            <p style="margin: 0; color: #34495e; font-style: italic; line-height: 1.6;">"${feedback}"</p>
                            ${rating ? `
                                <div style="margin-top: 10px; color: #f1c40f; font-size: 18px;">
                                    ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}

                    <p style="color: #555; font-size: 14px; margin-top: 20px;">
                        ${status === 'Selected'
                ? 'Congratulations! Our HR team will contact you shortly regarding the next steps.'
                : status === 'Rejected'
                    ? 'We appreciate your interest. Unfortunately, we will not be proceeding with your application at this time.'
                    : 'Your application is currently being reviewed by our recruitment team.'}
                    </p>
                </div>

                <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                    <p style="margin: 0;">This is an automated email. Please do not reply.</p>
                </div>
            </div>
        `;

        return this.sendEmail(to, subject, html);
    }

    // Alias for backward compatibility
    async sendStatusEmail(to, candidateName, jobTitle, applicationId, status) {
        return this.sendApplicationStatusEmail(to, candidateName, jobTitle, applicationId, status);
    }

    /**
     * Send Offer Letter Email with Attachment
     * @param {string} to - Recipient Email
     * @param {string} candidateName - Candidate Name
     * @param {string} jobTitle - Job Title
     * @param {string} companyName - Company Name
     * @param {string} offerLetterPdfPath - Path to the generated PDF file
     */
    async sendOfferLetterEmail(to, candidateName, jobTitle, companyName, offerLetterPdfPath) {
        const subject = `Offer Letter – ${companyName}`;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px;">
                <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">Congratulations!</h2>
                </div>
                <div style="padding: 25px; background-color: #ffffff;">
                    <p style="font-size: 16px; color: #333;">Dear <strong>${candidateName}</strong>,</p>
                    
                    <p style="color: #555; line-height: 1.6;">
                        We are pleased to offer you the position of <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.
                    </p>

                    <p style="color: #555; line-height: 1.6;">
                        Please find your official Offer Letter attached to this email. We were impressed with your skills and experience, and we believe you will be a great addition to our team.
                    </p>

                    <div style="background-color: #f8f9fa; border-left: 5px solid #2ecc71; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; color: #555; font-size: 14px;">Next Steps:</p>
                        <p style="margin: 5px 0 0; color: #333;">Please review the attached document and let us know your acceptance.</p>
                    </div>

                    <p style="color: #666; font-size: 14px; margin-top: 30px;">
                        We look forward to welcoming you aboard!
                    </p>

                    <p style="color: #888; font-size: 14px;">
                        Best Regards,<br>
                        HR Team, ${companyName}
                    </p>
                </div>
                <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                    <p style="margin: 0;">This is an automated email. Please do not reply.</p>
                </div>
            </div>
        `;

        // Attachment configuration
        const attachments = [{
            filename: `Offer_Letter_${candidateName.replace(/\s+/g, '_')}.pdf`,
            path: offerLetterPdfPath
        }];

        console.log(`📧 [EMAIL SERVICE] Sending Offer Letter to ${to} with attachment: ${offerLetterPdfPath}`);

        try {
            const mailOptions = {
                from: `"HRMS Notifications" <${process.env.SMTP_USER}>`,
                to: to,
                subject: subject,
                html: html,
                attachments: attachments
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✅ [EMAIL SERVICE] Offer Letter sent successfully. MessageID: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error(`❌ [EMAIL SERVICE] Failed to send Offer Letter to ${to}:`, error.message);
            throw error;
        }
    }


    /**
     * Send Joining Letter Email with Attachment
     * @param {string} to - Recipient Email
     * @param {string} candidateName - Candidate Name
     * @param {string} jobTitle - Job Title
     * @param {string} companyName - Company Name
     * @param {string} joiningDate - Joining Date (formatted)
     * @param {string} joiningLetterPdfPath - Path to the generated PDF file
     */
    async sendJoiningLetterEmail(to, candidateName, jobTitle, companyName, joiningDate, joiningLetterPdfPath) {
        const subject = `Joining Letter – ${companyName}`;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px;">
                <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">Welcome Aboard!</h2>
                </div>
                <div style="padding: 25px; background-color: #ffffff;">
                    <p style="font-size: 16px; color: #333;">Dear <strong>${candidateName}</strong>,</p>
                    
                    <p style="color: #555; line-height: 1.6;">
                        We are excited to welcome you to <strong>${companyName}</strong> as a <strong>${jobTitle}</strong>.
                    </p>

                    <p style="color: #555; line-height: 1.6;">
                        Please find your official Joining Letter attached to this email. This document confirms your joining details.
                    </p>

                    <div style="background-color: #f8f9fa; border-left: 5px solid #3498db; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; color: #555; font-size: 14px;">Joining Date:</p>
                        <p style="margin: 5px 0 0; color: #333; font-weight: bold;">${joiningDate}</p>
                    </div>

                    <p style="color: #666; font-size: 14px; margin-top: 30px;">
                        We look forward to a successful journey together!
                    </p>

                    <p style="color: #888; font-size: 14px;">
                        Best Regards,<br>
                        HR Team, ${companyName}
                    </p>
                </div>
                <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                    <p style="margin: 0;">This is an automated email. Please do not reply.</p>
                </div>
            </div>
        `;

        // Attachment configuration
        const attachments = [{
            filename: `Joining_Letter_${candidateName.replace(/\s+/g, '_')}.pdf`,
            path: joiningLetterPdfPath
        }];

        console.log(`📧 [EMAIL SERVICE] Sending Joining Letter to ${to} with attachment: ${joiningLetterPdfPath}`);

        try {
            const mailOptions = {
                from: `"HRMS Notifications" <${process.env.SMTP_USER}>`,
                to: to,
                subject: subject,
                html: html,
                attachments: attachments
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✅ [EMAIL SERVICE] Joining Letter sent successfully. MessageID: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error(`❌ [EMAIL SERVICE] Failed to send Joining Letter to ${to}:`, error.message);
            throw error;
        }
    }


    /**
     * Send Interview Scheduled Email
     */
    async sendInterviewScheduledEmail(to, candidateName, jobTitle, interviewDetails) {
        const subject = `Interview Scheduled - ${jobTitle}`;
        const { date, time, mode, location, interviewerName, notes } = interviewDetails;

        // Format date strictly
        const dateStr = new Date(date).toLocaleDateString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px;">
                <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">Interview Invitation</h2>
                </div>
                <div style="padding: 25px; background-color: #ffffff;">
                    <p style="font-size: 16px; color: #333;">Dear <strong>${candidateName}</strong>,</p>
                    
                    <p style="color: #555; line-height: 1.6;">
                        We are pleased to invite you for an interview for the position of <strong>${jobTitle}</strong>.
                    </p>

                    <div style="background-color: #f8f9fa; border-left: 5px solid #3498db; padding: 15px; margin: 20px 0;">
                        <p style="margin: 5px 0; color: #555;"><strong>Date:</strong> ${dateStr}</p>
                        <p style="margin: 5px 0; color: #555;"><strong>Time:</strong> ${time}</p>
                        <p style="margin: 5px 0; color: #555;"><strong>Mode:</strong> ${mode}</p>
                        <p style="margin: 5px 0; color: #555;"><strong>Location/Link:</strong> ${location}</p>
                        <p style="margin: 5px 0; color: #555;"><strong>Interviewer:</strong> ${interviewerName}</p>
                         ${notes ? `<p style="margin: 10px 0 0; font-style: italic; color: #666;">Note: ${notes}</p>` : ''}
                    </div>

                    <p style="color: #666; font-size: 14px; margin-top: 20px;">
                        Please ensure you are available 10 minutes prior to the scheduled time.
                    </p>

                    <p style="color: #888; font-size: 14px;">
                        Best Regards,<br>
                        Recruitment Team
                    </p>
                </div>
                <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                    <p style="margin: 0;">This is an automated email. Please do not reply.</p>
                </div>
            </div>
        `;
        return this.sendEmail(to, subject, html);
    }

    /**
     * Send Interview Rescheduled Email
     */
    async sendInterviewRescheduledEmail(to, candidateName, jobTitle, interviewDetails) {
        const subject = `Interview Rescheduled - ${jobTitle}`;
        const { date, time, mode, location, interviewerName, notes } = interviewDetails;

        const dateStr = new Date(date).toLocaleDateString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px;">
                <div style="background-color: #e67e22; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">Interview Rescheduled</h2>
                </div>
                <div style="padding: 25px; background-color: #ffffff;">
                    <p style="font-size: 16px; color: #333;">Dear <strong>${candidateName}</strong>,</p>
                    
                    <p style="color: #555; line-height: 1.6;">
                        Your interview for the position of <strong>${jobTitle}</strong> has been rescheduled.
                    </p>

                    <div style="background-color: #fff3e0; border-left: 5px solid #e67e22; padding: 15px; margin: 20px 0;">
                        <p style="margin: 5px 0; color: #555;"><strong>New Date:</strong> ${dateStr}</p>
                        <p style="margin: 5px 0; color: #555;"><strong>New Time:</strong> ${time}</p>
                        <p style="margin: 5px 0; color: #555;"><strong>Mode:</strong> ${mode}</p>
                        <p style="margin: 5px 0; color: #555;"><strong>Location/Link:</strong> ${location}</p>
                        <p style="margin: 5px 0; color: #555;"><strong>Interviewer:</strong> ${interviewerName}</p>
                         ${notes ? `<p style="margin: 10px 0 0; font-style: italic; color: #666;">Note: ${notes}</p>` : ''}
                    </div>

                    <p style="color: #666; font-size: 14px; margin-top: 20px;">
                        We apologize for any inconvenience caused.
                    </p>

                    <p style="color: #888; font-size: 14px;">
                        Best Regards,<br>
                        Recruitment Team
                    </p>
                </div>
                <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                    <p style="margin: 0;">This is an automated email. Please do not reply.</p>
                </div>
            </div>
        `;
        return this.sendEmail(to, subject, html);
    }
}

module.exports = new EmailService();
