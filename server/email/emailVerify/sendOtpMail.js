import nodemailer from "nodemailer"
import "dotenv/config"

export const sendOtpMail = async (email, otp) => {
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

        const mailOptions = {
            from: `"Blissora" <${process.env.MAIL_USER}>`,
            to: email,
            subject: 'Your OTP for Password Reset - Blissora',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #4f46e5; color: white; padding: 20px; text-align: center;">
                        <h1>Blissora</h1>
                    </div>
                    <div style="padding: 30px; background: #f9fafb;">
                        <h2>Password Reset OTP</h2>
                        <p>Use the following OTP to reset your password:</p>
                        <div style="font-size: 32px; font-weight: bold; color: #4f46e5; text-align: center; margin: 20px 0;">
                            ${otp}
                        </div>
                        <p style="color: #6b7280; font-size: 14px;">
                            This OTP is valid for 10 minutes. If you didn't request this, please ignore this email.
                        </p>
                    </div>
                </div>
            `
        }

        const info = await transporter.sendMail(mailOptions)
        console.log(`✅ OTP email sent to ${email}`)
        return info
        
    } catch (error) {
        console.error('❌ OTP email failed:', error.message)
        throw error
    }
}