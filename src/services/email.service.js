const nodemailer = require('nodemailer')

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'yusuf.inglo@gmail.com',
        pass: process.env.SMTP_PASS || 'orqs qwkq kxzp ryjc'
      },
      tls: {
        rejectUnauthorized: false
      }
    })
  }

  sender() {
    return process.env.SMTP_FROM || `"Inglozone Security" <${process.env.SMTP_USER || 'yusuf.inglo@gmail.com'}>`
  }

  async sendMail({ to, subject, html, text }) {
    try {
      await this.transporter.sendMail({
        from: this.sender(),
        to,
        subject,
        html,
        text
      })
      return { success: true }
    } catch (error) {
      console.error('Email sending failed:', error.message)
      throw new Error('Failed to send email')
    }
  }

  notificationTemplate({ title, greeting, message, details = [], footer = null }) {
    const detailRows = details
      .filter((item) => item && item.label)
      .map((item) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;"><strong>${item.label}</strong></td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${item.value ?? ''}</td></tr>`)
      .join('')

    return `
      <div style="font-family:Arial,Helvetica,sans-serif;background:#f6f8fb;padding:24px;">
        <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e7e9ee;border-radius:10px;overflow:hidden;">
          <div style="background:#0d3b66;color:#fff;padding:18px 24px;">
            <h2 style="margin:0;font-size:22px;">${title}</h2>
          </div>
          <div style="padding:24px;">
            <p style="margin:0 0 12px 0;font-size:15px;color:#222;">${greeting}</p>
            <p style="margin:0 0 18px 0;font-size:14px;color:#333;line-height:1.6;">${message}</p>
            ${detailRows ? `<table style="width:100%;border-collapse:collapse;font-size:13px;color:#222;">${detailRows}</table>` : ''}
            ${footer ? `<p style="margin:18px 0 0 0;font-size:12px;color:#666;">${footer}</p>` : ''}
          </div>
        </div>
      </div>
    `
  }

  async sendOTPEmail(email, firstName, otpCode) {
    const subject = 'Verify Your Inglozone Account - OTP Required'
    const details = [
      { label: 'OTP Code', value: otpCode },
      { label: 'Valid For', value: '5 minutes' }
    ]
    const html = this.notificationTemplate({
      title: 'Account Verification OTP',
      greeting: `Hello ${firstName || 'User'},`,
      message: 'Use the OTP below to complete your verification. Do not share this code with anyone.',
      details,
      footer: `This email was sent to ${email}. If you did not request this, you can ignore it.`
    })
    const text = `Hello ${firstName || 'User'},\n\nYour verification OTP is ${otpCode}. It is valid for 5 minutes.\nDo not share this code with anyone.\n\nInglozone`
    return this.sendMail({ to: email, subject, html, text })
  }

  async sendWithdrawalOtpEmail(email, firstName, otpCode, payload = {}) {
    const subject = 'Withdrawal OTP Verification'
    const html = this.notificationTemplate({
      title: 'Withdrawal OTP',
      greeting: `Hello ${firstName || 'User'},`,
      message: 'Use this OTP to confirm your withdrawal request.',
      details: [
        { label: 'OTP Code', value: otpCode },
        { label: 'Amount (USD)', value: payload.amountUSD ?? '-' },
        { label: 'Converted Amount', value: payload.localAmount && payload.localCurrencyCode ? `${payload.localAmount} ${payload.localCurrencyCode}` : '-' },
        { label: 'Valid For', value: '5 minutes' }
      ],
      footer: `If you did not initiate this withdrawal, contact support immediately.`
    })
    const text = `Hello ${firstName || 'User'},\n\nYour withdrawal OTP is ${otpCode}. Amount: ${payload.amountUSD || '-'} USD.\nIt is valid for 5 minutes.\n\nInglozone`
    return this.sendMail({ to: email, subject, html, text })
  }

  async sendDepositSuccessEmail(email, firstName, payload = {}) {
    const subject = 'Deposit Successful'
    const html = this.notificationTemplate({
      title: 'Deposit Successful',
      greeting: `Hello ${firstName || 'User'},`,
      message: 'Your deposit has been successfully processed and credited to your wallet.',
      details: [
        { label: 'Transaction Number', value: payload.transactionNumber || '-' },
        { label: 'Amount (USD)', value: payload.amountUSD ?? '-' },
        { label: 'Converted Amount', value: payload.localAmount && payload.localCurrencyCode ? `${payload.localAmount} ${payload.localCurrencyCode}` : '-' },
        { label: 'Status', value: payload.status || 'Approved' }
      ]
    })
    const text = `Deposit successful. Transaction: ${payload.transactionNumber || '-'}. Amount: ${payload.amountUSD || '-'} USD.`
    return this.sendMail({ to: email, subject, html, text })
  }

  async sendDepositPendingReminderEmail(email, firstName, payload = {}) {
    const subject = 'Deposit Pending Reminder'
    const html = this.notificationTemplate({
      title: 'Deposit Still Pending',
      greeting: `Hello ${firstName || 'User'},`,
      message: 'Your deposit request is still pending for more than 2 hours. Our team is reviewing it.',
      details: [
        { label: 'Transaction Number', value: payload.transactionNumber || '-' },
        { label: 'Amount (USD)', value: payload.amountUSD ?? '-' },
        { label: 'Converted Amount', value: payload.localAmount && payload.localCurrencyCode ? `${payload.localAmount} ${payload.localCurrencyCode}` : '-' },
        { label: 'Status', value: payload.status || 'Pending' }
      ]
    })
    const text = `Deposit pending reminder. Transaction: ${payload.transactionNumber || '-'}. Amount: ${payload.amountUSD || '-'} USD.`
    return this.sendMail({ to: email, subject, html, text })
  }

  async sendWithdrawalRequestCreatedEmail(email, firstName, payload = {}) {
    const subject = 'Withdrawal Request Created'
    const html = this.notificationTemplate({
      title: 'Withdrawal Request Submitted',
      greeting: `Hello ${firstName || 'User'},`,
      message: 'Your withdrawal request has been created and is now pending admin review.',
      details: [
        { label: 'Transaction Number', value: payload.transactionNumber || '-' },
        { label: 'Amount (USD)', value: payload.amountUSD ?? '-' },
        { label: 'Converted Amount', value: payload.localAmount && payload.localCurrencyCode ? `${payload.localAmount} ${payload.localCurrencyCode}` : '-' },
        { label: 'Status', value: 'Pending' }
      ]
    })
    const text = `Withdrawal request created. Transaction: ${payload.transactionNumber || '-'}. Amount: ${payload.amountUSD || '-'} USD.`
    return this.sendMail({ to: email, subject, html, text })
  }

  async sendWithdrawalApprovedEmail(email, firstName, payload = {}) {
    const subject = 'Withdrawal Approved'
    const html = this.notificationTemplate({
      title: 'Withdrawal Approved',
      greeting: `Hello ${firstName || 'User'},`,
      message: 'Your withdrawal has been approved and the USD amount was deducted from your wallet.',
      details: [
        { label: 'Transaction Number', value: payload.transactionNumber || '-' },
        { label: 'Amount (USD)', value: payload.amountUSD ?? '-' },
        { label: 'Converted Amount', value: payload.localAmount && payload.localCurrencyCode ? `${payload.localAmount} ${payload.localCurrencyCode}` : '-' },
        { label: 'Status', value: 'Approved' }
      ]
    })
    const text = `Withdrawal approved. Transaction: ${payload.transactionNumber || '-'}. Amount: ${payload.amountUSD || '-'} USD.`
    return this.sendMail({ to: email, subject, html, text })
  }

  async sendWithdrawalCompletedEmail(email, firstName, payload = {}) {
    const subject = 'Withdrawal Completed'
    const html = this.notificationTemplate({
      title: 'Withdrawal Completed',
      greeting: `Hello ${firstName || 'User'},`,
      message: 'Your withdrawal has been completed successfully.',
      details: [
        { label: 'Transaction Number', value: payload.transactionNumber || '-' },
        { label: 'Amount (USD)', value: payload.amountUSD ?? '-' },
        { label: 'Converted Amount', value: payload.localAmount && payload.localCurrencyCode ? `${payload.localAmount} ${payload.localCurrencyCode}` : '-' },
        { label: 'Reference Number', value: payload.referenceNumber || '-' },
        { label: 'Status', value: 'completed' }
      ]
    })
    const text = `Withdrawal completed. Transaction: ${payload.transactionNumber || '-'}. Reference: ${payload.referenceNumber || '-'}.`
    return this.sendMail({ to: email, subject, html, text })
  }
}

module.exports = new EmailService()
