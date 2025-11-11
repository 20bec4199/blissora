import nodemailer from "nodemailer"
import "dotenv/config"

export const sendSuccessMail = async (email, name, subject, message, options = {}) => {
    try {
        // Validate environment variables
        if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
            throw new Error('Email configuration missing')
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS
            },
            pool: true
        })

        // Verify connection
        await transporter.verify()

        // Default options
        const {
            type = 'success',
            ctaText = 'Get Started',
            ctaUrl = process.env.CLIENT_URL || 'http://localhost:5173',
            additionalInfo = [],
            showCta = true
        } = options

        // Icon based on type
        const getIcon = () => {
            switch (type) {
                case 'registration':
                    return '🎉';
                case 'product':
                    return '📦';
                case 'success':
                    return '✅';
                case 'warning':
                    return '⚠️';
                case 'info':
                    return 'ℹ️';
                default:
                    return '🎉';
            }
        }

        // Color based on type
        const getColor = () => {
            switch (type) {
                case 'registration':
                    return '#4f46e5';
                case 'product':
                    return '#10b981';
                case 'success':
                    return '#059669';
                case 'warning':
                    return '#f59e0b';
                case 'info':
                    return '#3b82f6';
                default:
                    return '#4f46e5';
            }
        }

        const icon = getIcon();
        const color = getColor();

        const mailOptions = {
            from: `"Blissora" <${process.env.MAIL_USER}>`,
            to: email,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                    <div style="background: ${color}; color: white; padding: 30px; text-align: center;">
                        <div style="font-size: 48px; margin-bottom: 10px;">${icon}</div>
                        <h1 style="margin: 0; font-size: 28px; font-weight: 600;">${subject}</h1>
                    </div>
                    
                    <div style="padding: 40px; background: #f9fafb;">
                        <h2 style="color: #1f2937; margin-bottom: 20px; font-size: 20px;">Hello ${name},</h2>
                        
                        <div style="background: white; padding: 25px; border-radius: 8px; border-left: 4px solid ${color}; margin: 25px 0;">
                            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0;">${message}</p>
                        </div>

                        ${additionalInfo.length > 0 ? `
                        <div style="margin: 30px 0;">
                            <h3 style="color: #1f2937; margin-bottom: 15px; font-size: 18px;">Details:</h3>
                            <ul style="color: #4b5563; line-height: 1.8; padding-left: 20px; margin: 0;">
                                ${additionalInfo.map(info => `<li>${info}</li>`).join('')}
                            </ul>
                        </div>
                        ` : ''}

                        ${showCta ? `
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${ctaUrl}" 
                               style="background: ${color}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">
                                ${ctaText}
                            </a>
                        </div>
                        ` : ''}

                        <div style="border-top: 1px solid #e5e7eb; padding-top: 25px; margin-top: 25px;">
                            <p style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">
                                If you have any questions, feel free to reach out to our support team.
                            </p>
                            <p style="color: #6b7280; font-size: 14px; margin: 0;">
                                Best regards,<br>
                                <strong>The Blissora Team</strong>
                            </p>
                        </div>
                    </div>
                </div>
            `
        }

        const info = await transporter.sendMail(mailOptions)
        console.log(`✅ Success email sent to ${email}`)
        return info
        
    } catch (error) {
        console.error('❌ Success email failed:', error.message)
        throw error
    }
}