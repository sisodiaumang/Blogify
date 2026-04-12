const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS,
    },
});

async function sendOTP(email, otp) {
    await transporter.sendMail({
        from: `"Blogify Support" <${process.env.EMAIL}>`,
        to: email,
        subject: "Verify your identity - Blogify",
        html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                @media only screen and (max-width: 600px) {
                    .email-container { width: 100% !important; padding: 20px !important; }
                    .otp-box { font-size: 28px !important; letter-spacing: 4px !important; padding: 10px 15px !important; }
                    .header-text { font-size: 20px !important; }
                }
            </style>
        </head>
        <body style="margin: 0; padding: 0; background-color: #fcfaf7;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                    <td align="center" style="padding: 20px 0;">
                        <table class="email-container" width="500" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e0d8; box-shadow: 0 10px 25px rgba(0,0,0,0.05); overflow: hidden;">
                            <tr>
                                <td style="padding: 40px;">
                                    
                                    <h2 class="header-text" style="font-family: 'Georgia', serif; color: #2d3e50; font-size: 24px; margin: 0 0 20px 0; text-align: center;">Reset your password</h2>
                                    
                                    <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #666; text-align: center; margin: 0 0 30px 0;">
                                        We received a request to access your account. Use the code below to continue.
                                    </p>

                                    <div style="text-align: center; margin: 30px 0;">
                                        <span class="otp-box" style="display: inline-block; background-color: #f9f9f9; color: #2d3e50; font-size: 36px; font-weight: 700; letter-spacing: 8px; padding: 15px 30px; border: 1px dashed #2d3e50; border-radius: 8px;">
                                            ${otp}
                                        </span>
                                    </div>

                                    <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 14px; color: #999; text-align: center; margin: 30px 0 0 0;">
                                        This code will expire in 5 minutes. <br>
                                        If you didn't request this, you can safely ignore this email.
                                    </p>

                                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

                                    <div style="text-align: center; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #aaa;">
                                        <strong>Blogify</strong><br>
                                        Stories & Ideas
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        `,
    });
}

async function sendWelcomeEmail(email, fullName) {
    await transporter.sendMail({
        from: `"Blogify" <${process.env.EMAIL}>`,
        to: email,
        subject: "Welcome to Blogify — Let's start writing!",
        html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                @media only screen and (max-width: 600px) {
                    .email-container { width: 100% !important; padding: 20px !important; }
                    .header-text { font-size: 24px !important; }
                    .welcome-card { padding: 30px 20px !important; }
                }
            </style>
        </head>
        <body style="margin: 0; padding: 0; background-color: #fcfaf7;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                    <td align="center" style="padding: 40px 0;">
                        <table class="email-container" width="550" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e0d8; box-shadow: 0 10px 25px rgba(0,0,0,0.05); overflow: hidden;">
                            <tr>
                                <td class="welcome-card" style="padding: 50px;">
                                    <h1 class="header-text" style="font-family: 'Georgia', serif; color: #2d3e50; font-size: 32px; margin: 0 0 20px 0; text-align: center;">Welcome, ${fullName}.</h1>
                                    
                                    <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.8; color: #444; text-align: center; margin: 0 0 30px 0;">
                                        Thank you for joining <strong>Blogify</strong>. We built this space for thinkers, storytellers, and creators like you to share ideas with the world.
                                    </p>

                                    <div style="text-align: center; margin: 40px 0;">
                                        <a href="http://localhost:8000/blog/add-new" style="background-color: #2d3e50; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 50px; font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 15px rgba(45, 62, 80, 0.2);">
                                            Write Your First Story
                                        </a>
                                    </div>

                                    <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 15px; color: #666; text-align: center; margin: 30px 0 0 0;">
                                        Need inspiration? Explore the latest ideas on your home feed or customize your profile to let people know who you are.
                                    </p>

                                    <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0;">

                                    <div style="text-align: center; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #aaa;">
                                        <strong>Blogify</strong><br>
                                        Stories & Ideas • Delhi, India
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        `,
    });
}

module.exports = {sendOTP,sendWelcomeEmail};