const nodemailer = require('nodemailer')

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'yusuf.inglo@gmail.com',
        pass: 'orqs qwkq kxzp ryjc'
      },
      tls: {
        rejectUnauthorized: false
      }
    })
  }

  async sendOTPEmail(email, firstName, otpCode) {
    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Inglozone Verification</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          }
          
          body {
            background-color: #f6f9fc;
            padding: 20px;
          }
          
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          }
          
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px 20px;
            text-align: center;
          }
          
          .logo {
            color: white;
            font-size: 28px;
            font-weight: bold;
            letter-spacing: 1px;
            margin-bottom: 10px;
          }
          
          .tagline {
            color: rgba(255, 255, 255, 0.9);
            font-size: 14px;
          }
          
          .content {
            padding: 40px 30px;
          }
          
          .greeting {
            color: #333;
            font-size: 24px;
            margin-bottom: 20px;
            font-weight: 600;
          }
          
          .message {
            color: #555;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 30px;
          }
          
          .otp-container {
            background: linear-gradient(135deg, #f6f9fc 0%, #eef2f7 100%);
            border-radius: 10px;
            padding: 25px;
            text-align: center;
            margin: 30px 0;
            border: 1px solid #e1e8f0;
          }
          
          .otp-label {
            color: #666;
            font-size: 14px;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          
          .otp-code {
            font-size: 42px;
            font-weight: 700;
            color: #333;
            letter-spacing: 8px;
            font-family: monospace;
            background: white;
            padding: 15px;
            border-radius: 8px;
            display: inline-block;
            margin: 10px 0;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
          }
          
          .expiry-note {
            color: #e74c3c;
            font-size: 14px;
            margin-top: 15px;
            font-weight: 600;
          }
          
          .security-tip {
            background: #fff8e1;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 25px 0;
            border-radius: 4px;
            font-size: 14px;
            color: #5d4037;
          }
          
          .footer {
            background: #f8f9fa;
            padding: 25px;
            text-align: center;
            border-top: 1px solid #eaeaea;
          }
          
          .footer-text {
            color: #666;
            font-size: 12px;
            margin-bottom: 10px;
          }
          
          .copyright {
            color: #999;
            font-size: 11px;
            margin-top: 15px;
          }
          
          .support {
            color: #667eea;
            font-size: 12px;
            margin-top: 10px;
          }
          
          @media (max-width: 600px) {
            .content {
              padding: 25px 20px;
            }
            
            .otp-code {
              font-size: 32px;
              letter-spacing: 5px;
              padding: 12px;
            }
            
            .greeting {
              font-size: 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <div class="logo">INGLOZONE</div>
            <div class="tagline">Secure Trading Platform</div>
          </div>
          
          <div class="content">
            <h1 class="greeting">Hello ${firstName},</h1>
            
            <p class="message">
              Thank you for choosing Inglozone! To complete your registration and secure your account, 
              please use the following One-Time Password (OTP) verification code.
            </p>
            
            <div class="otp-container">
              <div class="otp-label">Your Verification Code</div>
              <div class="otp-code">${otpCode}</div>
              <div class="expiry-note">⏰ Expires in 5 minutes</div>
            </div>
            
            <div class="security-tip">
              🔒 <strong>Security Tip:</strong> Never share this code with anyone. 
              Inglozone will never ask for your password or OTP via email, phone, or SMS.
            </div>
            
            <p class="message">
              If you didn't request this verification, please ignore this email or contact our 
              support team if you have any concerns.
            </p>
          </div>
          
          <div class="footer">
            <div class="footer-text">
              Need help? Our support team is here for you.
            </div>
            <div class="support">
              📧 support@inglozone.com | 🌐 www.inglozone.com
            </div>
            <div class="copyright">
              © 2024 Inglozone. All rights reserved.<br>
              This email was sent to ${email}
            </div>
          </div>
        </div>
      </body>
      </html>
    `

    const mailOptions = {
      from: '"Inglozone Security" <yusuf.inglo@gmail.com>',
      to: email,
      subject: 'Verify Your Inglozone Account - OTP Required',
      html: htmlTemplate,
      text: `Hello ${firstName},\n\nYour Inglozone verification code is: ${otpCode}\n\nThis code expires in 5 minutes. Never share this code with anyone.\n\nIf you didn't request this, please ignore this email.\n\n© 2024 Inglozone. All rights reserved.`
    }

    try {
      await this.transporter.sendMail(mailOptions)
      return { success: true }
    } catch (error) {
      console.error('Email sending failed:', error)
      throw new Error('Failed to send OTP email')
    }
  }
}

module.exports = new EmailService()