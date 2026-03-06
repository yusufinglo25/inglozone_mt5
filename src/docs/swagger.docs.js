/**
 * @swagger
 * tags:
 *   - name: Health
 *   - name: Customer
 *   - name: Customer - Auth
 *   - name: Customer - User
 *   - name: Customer - Wallet
 *   - name: Customer - KYC
 *   - name: Customer - Settings
 *   - name: Admin
 *   - name: Admin - Auth
 *   - name: Admin - Users
 *   - name: Admin - Compliance
 *   - name: Admin - Dashboard
 *   - name: Admin - Payments
 */

/**
 * @swagger
 * /api/settings/email-change/request-old-otp:
 *   post:
 *     tags: [Customer - Settings]
 *     summary: Send OTP to current email for email-change verification
 *     responses:
 *       200:
 *         description: OTP sent to old email
 */

/**
 * @swagger
 * /api/settings/email-change/verify-old-otp:
 *   post:
 *     tags: [Customer - Settings]
 *     summary: Verify OTP sent to current email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [verificationToken, otp]
 *             properties:
 *               verificationToken:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Old email verified
 */

/**
 * @swagger
 * /api/settings/email-change/request-new-otp:
 *   post:
 *     tags: [Customer - Settings]
 *     summary: Send OTP to new email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [emailChangeToken, newEmail]
 *             properties:
 *               emailChangeToken:
 *                 type: string
 *               newEmail:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP sent to new email
 */

/**
 * @swagger
 * /api/settings/email-change/verify-new-otp:
 *   post:
 *     tags: [Customer - Settings]
 *     summary: Verify OTP sent to new email and update account email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newEmailVerificationToken, otp]
 *             properties:
 *               newEmailVerificationToken:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email updated
 */

/**
 * @swagger
 * /api/settings/password/change:
 *   post:
 *     tags: [Customer - Settings]
 *     summary: Change current user password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword, confirmNewPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *               confirmNewPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated
 */

/**
 * @swagger
 * /api/settings/2fa/generate:
 *   post:
 *     tags: [Customer - Settings]
 *     summary: Generate Google Authenticator QR for 2FA setup
 *     responses:
 *       200:
 *         description: QR generated
 */

/**
 * @swagger
 * /api/settings/2fa/verify:
 *   post:
 *     tags: [Customer - Settings]
 *     summary: Verify 2FA code and enable 2FA
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: 2FA enabled
 */

/**
 * @swagger
 * /api/settings/2fa/disable:
 *   post:
 *     tags: [Customer - Settings]
 *     summary: Disable 2FA for current user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: 2FA disabled
 */

/**
 * @swagger
 * /api/settings/logout-all:
 *   post:
 *     tags: [Customer - Settings]
 *     summary: Logout from all devices
 *     responses:
 *       200:
 *         description: Logged out from all sessions
 */

/**
 * @swagger
 * /api/settings/logout-others:
 *   post:
 *     tags: [Customer - Settings]
 *     summary: Logout from all devices except current
 *     responses:
 *       200:
 *         description: Logged out from other sessions
 */

/**
 * @swagger
 * /api/admin/auth/login:
 *   post:
 *     tags: [Admin - Auth]
 *     summary: Admin login via Zoho OAuth authorization code
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *               redirectUri:
 *                 type: string
 *     responses:
 *       200:
 *         description: Admin login successful
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Admin login successful
 *               token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
 *               admin:
 *                 id: e8f7d0f9-254c-4f1a-bf75-a7f7524fdbaf
 *                 email: admin@example.com
 *                 fullName: Admin User
 *                 department: Compliance
 *                 role: superadmin
 *       401:
 *         description: Invalid admin credentials
 */

/**
 * @swagger
 * /api/admin/auth/login-password:
 *   post:
 *     tags: [Admin - Auth]
 *     summary: Admin login using email and password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Admin login successful
 *       401:
 *         description: Invalid credentials
 */

/**
 * @swagger
 * /api/admin/auth/logout:
 *   post:
 *     tags: [Admin - Auth]
 *     summary: Admin logout and revoke current session token
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Admin logout successful
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     tags: [Admin - Users]
 *     summary: Get all admin-manageable users (Zoho employees + local role/access)
 *     responses:
 *       200:
 *         description: User list fetched
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - fullName: Yusuf Mohamed
 *                   email: yusuf@example.com
 *                   department: Compliance
 *                   status: Active
 *                   role: superadmin
 *                   loginAccessStatus: allowed
 *                   zohoUserId: "1234567890"
 */

/**
 * @swagger
 * /api/admin/users/role:
 *   patch:
 *     tags: [Admin - Users]
 *     summary: Update user role (superadmin only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               zohoUserId:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [superadmin, admin, accounts]
 *             required: [role]
 *     responses:
 *       200:
 *         description: Role updated
 *       403:
 *         description: Forbidden for non-superadmin
 */

/**
 * @swagger
 * /api/admin/users/allow-login:
 *   patch:
 *     tags: [Admin - Users]
 *     summary: Allow user login access (superadmin only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               zohoUserId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login access allowed
 */

/**
 * @swagger
 * /api/admin/users/block-login:
 *   patch:
 *     tags: [Admin - Users]
 *     summary: Block user login access (superadmin only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               zohoUserId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login access blocked
 */

/**
 * @swagger
 * /api/admin/users/set-password:
 *   patch:
 *     tags: [Admin - Users]
 *     summary: Create or reset password for a Zoho-managed admin user (superadmin only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               email:
 *                 type: string
 *               zohoUserId:
 *                 type: string
 *               password:
 *                 type: string
 *               fullName:
 *                 type: string
 *               department:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password created or updated
 */

/**
 * @swagger
 * /api/admin/kyc:
 *   get:
 *     tags: [Admin - Compliance]
 *     summary: Get all KYC records for admin compliance review
 *     responses:
 *       200:
 *         description: KYC records fetched
 */

/**
 * @swagger
 * /api/admin/kyc/{userId}:
 *   get:
 *     tags: [Admin - Compliance]
 *     summary: Get single customer full KYC details
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer KYC details fetched
 *       404:
 *         description: Not found
 */

/**
 * @swagger
 * /api/admin/kyc/{userId}/start-review:
 *   post:
 *     tags: [Admin - Compliance]
 *     summary: Start KYC review and fetch profile/docs with checklist
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review context fetched
 *       404:
 *         description: Not found
 */

/**
 * @swagger
 * /api/admin/kyc/{userId}/approve-documents:
 *   post:
 *     tags: [Admin - Compliance]
 *     summary: Approve customer KYC documents (left panel step)
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Documents approved
 */

/**
 * @swagger
 * /api/admin/kyc/{userId}/approve-profile:
 *   post:
 *     tags: [Admin - Compliance]
 *     summary: Approve customer KYC profile data (right panel step)
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile approved
 */

/**
 * @swagger
 * /api/admin/kyc/{userId}/approve:
 *   post:
 *     tags: [Admin - Compliance]
 *     summary: Approve full customer KYC (documents + profile)
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: KYC approved
 */

/**
 * @swagger
 * /api/admin/kyc/{userId}/reject:
 *   post:
 *     tags: [Admin - Compliance]
 *     summary: Reject customer KYC and reject all linked states
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [comment]
 *             properties:
 *               comment:
 *                 type: string
 *                 description: Mandatory rejection reason shown to customer
 *     responses:
 *       200:
 *         description: KYC rejected
 */

/**
 * @swagger
 * /api/admin/dashboard/stats:
 *   get:
 *     tags: [Admin - Dashboard]
 *     summary: Get admin dashboard statistics
 *     responses:
 *       200:
 *         description: Dashboard stats fetched
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 totalCustomers: 150
 *                 totalApprovedKYC: 95
 *                 totalPendingKYC: 35
 *                 totalHighRiskCustomers: 7
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Customer - Auth]
 *     summary: Register user directly
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       200:
 *         description: Registration response
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Account created successfully
 *               next: login
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             example:
 *               error: Email already registered. Please use another email or login.
 */

/**
 * @swagger
 * /api/auth/register-with-otp:
 *   post:
 *     tags: [Customer - Auth]
 *     summary: Start registration and send OTP
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       200:
 *         description: OTP sent
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: OTP sent to your email. Please check your inbox.
 *               tempToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
 *               email: user@example.com
 *               expiresIn: 300
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             example:
 *               error: All fields are required
 */

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     tags: [Customer - Auth]
 *     summary: Verify OTP and create account
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             $ref: '#/components/schemas/VerifyOtpRequest'
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyOtpRequest'
 *     responses:
 *       201:
 *         description: Account created
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Account created successfully!
 *               token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
 *               user:
 *                 id: 0d95e2f8-fc73-4ffa-bef4-9d8a3a6c6f9f
 *                 email: user@example.com
 *                 firstName: John
 *                 lastName: Doe
 *                 emailVerified: true
 *                 isVerified: true
 *                 provider: local
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             example:
 *               error: OTP and verification token are required
 */

/**
 * @swagger
 * /api/auth/resend-otp:
 *   post:
 *     tags: [Customer - Auth]
 *     summary: Resend registration OTP
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             $ref: '#/components/schemas/ResendOtpRequest'
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResendOtpRequest'
 *     responses:
 *       200:
 *         description: OTP resent
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: New OTP sent to your email.
 *               tempToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
 *               expiresIn: 300
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             example:
 *               error: Verification token is required
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Customer - Auth]
 *     summary: Log in user and receive JWT token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             example:
 *               token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
 *               user:
 *                 id: 0d95e2f8-fc73-4ffa-bef4-9d8a3a6c6f9f
 *                 email: user@example.com
 *                 firstName: John
 *                 lastName: Doe
 *                 mobile: "+971501234567"
 *                 is2FAEnabled: false
 *                 profileCompleted: true
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             example:
 *               error: Invalid credentials
 */

/**
 * @swagger
 * /api/auth/check-email:
 *   post:
 *     tags: [Customer - Auth]
 *     summary: Check whether email already exists
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             $ref: '#/components/schemas/CheckEmailRequest'
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CheckEmailRequest'
 *     responses:
 *       200:
 *         description: Email availability response
 *         content:
 *           application/json:
 *             examples:
 *               available:
 *                 value:
 *                   success: true
 *                   message: Email is available
 *                   exists: false
 *               alreadyRegistered:
 *                 value:
 *                   success: false
 *                   error: Email already registered with google authentication
 *                   provider: google
 *                   exists: true
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             example:
 *               error: Email is required
 */

/**
 * @swagger
 * /api/auth/complete-profile:
 *   post:
 *     tags: [Customer - Auth]
 *     summary: Complete profile for OAuth signup (authenticated)
 *     description: Requires a valid JWT. Send token in Authorization Bearer header (recommended). Legacy clients may still pass token in body/query.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             $ref: '#/components/schemas/AuthCompleteProfileRequest'
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthCompleteProfileRequest'
 *     responses:
 *       200:
 *         description: Profile completed
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Profile completed successfully
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             example:
 *               error: All fields are required
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             example:
 *               error: Access denied. No token provided.
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             example:
 *               error: Forbidden. You can only complete your own profile.
 */

/**
 * @swagger
 * /api/auth/status:
 *   get:
 *     tags: [Customer - Auth]
 *     summary: Check authentication status with bearer token
 *     description: Accepts Authorization Bearer token. Legacy support also allows token query param.
 *     parameters:
 *       - in: query
 *         name: token
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional legacy JWT token.
 *     responses:
 *       200:
 *         description: Authenticated
 *         content:
 *           application/json:
 *             example:
 *               authenticated: true
 *               user:
 *                 id: 0d95e2f8-fc73-4ffa-bef4-9d8a3a6c6f9f
 *                 email: user@example.com
 *                 iat: 1739500000
 *                 exp: 1739600000
 *       401:
 *         description: Token missing or invalid
 *         content:
 *           application/json:
 *             example:
 *               authenticated: false
 */

/**
 * @swagger
 * /api/auth/google:
 *   get:
 *     tags: [Customer - Auth]
 *     summary: Start Google OAuth flow
 *     security: []
 *     responses:
 *       302:
 *         description: Redirects to Google OAuth consent screen
 */

/**
 * @swagger
 * /api/auth/google/callback:
 *   get:
 *     tags: [Customer - Auth]
 *     summary: Google OAuth callback
 *     description: Redirects to frontend with token in URL hash by default (`#token=...`). If `LEGACY_QUERY_TOKEN_REDIRECT=true`, token is sent as query param for backward compatibility.
 *     security: []
 *     responses:
 *       302:
 *         description: Redirects to frontend with auth result
 */

/**
 * @swagger
 * /api/user/complete-profile:
 *   post:
 *     tags: [Customer - User]
 *     summary: Complete user profile using authenticated token
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             $ref: '#/components/schemas/UserCompleteProfileRequest'
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserCompleteProfileRequest'
 *     responses:
 *       200:
 *         description: Profile completed successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Profile completed
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             example:
 *               error: Passwords do not match
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             examples:
 *               missingToken:
 *                 value:
 *                   error: Access denied. No token provided.
 *               invalidToken:
 *                 value:
 *                   error: Invalid token
 */

/**
 * @swagger
 * /api/wallet/deposit:
 *   post:
 *     tags: [Customer - Wallet]
 *     summary: Create Stripe checkout session for wallet deposit
 *     description: Amount is provided in AED and converted to USD internally. Non-approved KYC users are capped to a maximum wallet exposure of 5000 USD (current balance + pending deposits + new deposit). Fully approved KYC users have unlimited deposits.
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             $ref: '#/components/schemas/WalletDepositRequest'
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WalletDepositRequest'
 *     responses:
 *       200:
 *         description: Checkout session created
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 sessionId: cs_test_123
 *                 url: https://checkout.stripe.com/c/pay/cs_test_123
 *                 amountUSD: 100
 *                 amountAED: 366
 *                 transactionId: 0d95e2f8-fc73-4ffa-bef4-9d8a3a6c6f9f
 *       400:
 *         description: Validation or business-rule error
 *         content:
 *           application/json:
 *             examples:
 *               invalidAmount:
 *                 value:
 *                   success: false
 *                   error: Valid amount is required
 *               limitReached:
 *                 value:
 *                   success: false
 *                   error: Deposit limit reached. Non-approved accounts can hold up to 5000.00 USD. Complete KYC approval for unlimited deposits.
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             example:
 *               error: Access denied. No token provided.
 */

/**
 * @swagger
 * /api/wallet/deposit/verify:
 *   post:
 *     tags: [Customer - Wallet]
 *     summary: Verify Stripe session and finalize wallet deposit
 *     description: Final verification and wallet credit. The non-approved KYC deposit cap is re-validated at completion time to prevent bypass.
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             $ref: '#/components/schemas/WalletVerifyRequest'
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WalletVerifyRequest'
 *     responses:
 *       200:
 *         description: Verification result
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 success: true
 *                 message: Deposit completed successfully
 *                 amount: 100
 *                 currency: USD
 *       400:
 *         description: Verification or business-rule error
 *         content:
 *           application/json:
 *             examples:
 *               missingSession:
 *                 value:
 *                   success: false
 *                   error: Session ID is required
 *               limitReached:
 *                 value:
 *                   success: false
 *                   error: Deposit limit reached. Non-approved accounts can hold up to 5000.00 USD. Complete KYC approval for unlimited deposits.
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             example:
 *               error: Access denied. No token provided.
 */

/**
 * @swagger
 * /api/wallet/balance:
 *   get:
 *     tags: [Customer - Wallet]
 *     summary: Get wallet balance and totals
 *     responses:
 *       200:
 *         description: Wallet fetched
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               wallet:
 *                 id: 0d95e2f8-fc73-4ffa-bef4-9d8a3a6c6f9f
 *                 user_id: 0d95e2f8-fc73-4ffa-bef4-9d8a3a6c6f9f
 *                 balance: 1500
 *                 currency: USD
 *                 available_balance: 1500
 *                 total_deposited: 2000
 *                 total_withdrawn: 500
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/wallet/transactions:
 *   get:
 *     tags: [Customer - Wallet]
 *     summary: Get paginated transaction history
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Transaction history fetched
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/wallet/transactions/{id}:
 *   get:
 *     tags: [Customer - Wallet]
 *     summary: Get single transaction by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transaction fetched
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Transaction not found
 */

/**
 * @swagger
 * /api/kyc/upload:
 *   post:
 *     tags: [Customer - KYC]
 *     summary: Upload KYC document (front/passport)
 *     description: Uses multipart form upload. This endpoint expects file field name `document`.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/KycUploadRequest'
 *     responses:
 *       201:
 *         description: KYC document uploaded
 *       400:
 *         description: Validation error (missing file or invalid document type)
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Too many upload attempts
 */

/**
 * @swagger
 * /api/kyc/upload/back:
 *   post:
 *     tags: [Customer - KYC]
 *     summary: Upload back side of national ID
 *     description: Uses multipart form upload. This endpoint expects file field name `document`.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/KycUploadBackRequest'
 *     responses:
 *       201:
 *         description: Back document uploaded
 *       400:
 *         description: Validation error (missing file)
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Too many upload attempts
 */

/**
 * @swagger
 * /api/kyc/documents/completeness:
 *   get:
 *     tags: [Customer - KYC]
 *     summary: Check uploaded KYC document completeness
 *     responses:
 *       200:
 *         description: Completeness fetched
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/kyc/country-codes:
 *   get:
 *     tags: [Customer - KYC]
 *     summary: Get phone country codes list
 *     responses:
 *       200:
 *         description: Country codes fetched
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     RegisterRequest:
 *       type: object
 *       required: [firstName, lastName, email, password]
 *       properties:
 *         firstName:
 *           type: string
 *           example: John
 *         lastName:
 *           type: string
 *           example: Doe
 *         email:
 *           type: string
 *           format: email
 *           example: user@example.com
 *         password:
 *           type: string
 *           minLength: 8
 *           description: Must contain at least one uppercase letter, one lowercase letter, and one special character.
 *           example: Strong@123
 *
 *     VerifyOtpRequest:
 *       type: object
 *       required: [tempToken, otp]
 *       properties:
 *         tempToken:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
 *         otp:
 *           type: string
 *           pattern: '^\d{6}$'
 *           example: "123456"
 *
 *     ResendOtpRequest:
 *       type: object
 *       required: [tempToken]
 *       properties:
 *         tempToken:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
 *
 *     LoginRequest:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: user@example.com
 *         password:
 *           type: string
 *           example: Strong@123
 *
 *     CheckEmailRequest:
 *       type: object
 *       required: [email]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: user@example.com
 *
 *     AuthCompleteProfileRequest:
 *       type: object
 *       required: [firstName, lastName, password]
 *       properties:
 *         userId:
 *           type: string
 *           format: uuid
 *           description: Optional. If provided, must match authenticated user.
 *         firstName:
 *           type: string
 *           example: John
 *         lastName:
 *           type: string
 *           example: Doe
 *         password:
 *           type: string
 *           minLength: 8
 *           example: Strong@123
 *
 *     UserCompleteProfileRequest:
 *       type: object
 *       required: [firstName, lastName, password, confirmPassword]
 *       properties:
 *         firstName:
 *           type: string
 *           example: John
 *         lastName:
 *           type: string
 *           example: Doe
 *         password:
 *           type: string
 *           minLength: 8
 *           example: Strong@123
 *         confirmPassword:
 *           type: string
 *           minLength: 8
 *           example: Strong@123
 *
 *     WalletDepositRequest:
 *       type: object
 *       required: [amount]
 *       properties:
 *         amount:
 *           type: number
 *           format: float
 *           minimum: 0.01
 *           description: Deposit amount in AED.
 *           example: 366
 *
 *     WalletVerifyRequest:
 *       type: object
 *       required: [session_id]
 *       properties:
 *         session_id:
 *           type: string
 *           description: Stripe checkout session id.
 *           example: cs_test_123
 *
 *     KycUploadRequest:
 *       type: object
 *       required: [documentType, document]
 *       properties:
 *         documentType:
 *           type: string
 *           enum: [passport, national_id]
 *           example: passport
 *         document:
 *           type: string
 *           format: binary
 *           description: Image or PDF file uploaded in multipart form-data.
 *
 *     KycUploadBackRequest:
 *       type: object
 *       required: [document]
 *       properties:
 *         document:
 *           type: string
 *           format: binary
 *           description: Back-side image/PDF uploaded in multipart form-data.
 */


/**
 * @swagger
 * /api/wallet/tamara/deposit:
 *   post:
 *     tags: [Customer - Wallet]
 *     summary: Create Tamara checkout for wallet deposit
 *     description: Amount is provided in AED. Backend creates a pending USD wallet transaction and returns Tamara checkout URL.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 366
 *     responses:
 *       200:
 *         description: Tamara checkout created
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 provider: tamara
 *                 transactionId: 0d95e2f8-fc73-4ffa-bef4-9d8a3a6c6f9f
 *                 orderId: ord_123
 *                 checkoutId: chk_123
 *                 checkoutUrl: https://checkout.tamara.co/...
 *                 status: new
 *                 amountAED: 366
 *                 amountUSD: 100
 */

/**
 * @swagger
 * /api/wallet/tamara/deposit/verify:
 *   post:
 *     tags: [Customer - Wallet]
 *     summary: Verify Tamara order status and finalize wallet deposit
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               order_id:
 *                 type: string
 *                 example: ord_123
 *               transaction_id:
 *                 type: string
 *                 example: 0d95e2f8-fc73-4ffa-bef4-9d8a3a6c6f9f
 *     responses:
 *       200:
 *         description: Verification result
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 success: true
 *                 transactionId: 0d95e2f8-fc73-4ffa-bef4-9d8a3a6c6f9f
 *                 orderId: ord_123
 *                 status: approved
 */

/**
 * @swagger
 * /api/wallet/payment-methods:
 *   get:
 *     tags: [Customer - Wallet]
 *     summary: Get payment methods for current user based on detected country
 *     responses:
 *       200:
 *         description: Payment methods list
 */

/**
 * @swagger
 * /api/wallet/razorpay/deposit:
 *   post:
 *     tags: [Customer - Wallet]
 *     summary: Create Razorpay order for India users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 5000
 *                 description: Amount in INR
 *     responses:
 *       200:
 *         description: Razorpay order created
 */

/**
 * @swagger
 * /api/wallet/razorpay/deposit/verify:
 *   post:
 *     tags: [Customer - Wallet]
 *     summary: Verify Razorpay payment and credit wallet
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [razorpay_order_id, razorpay_payment_id, razorpay_signature]
 *             properties:
 *               razorpay_order_id:
 *                 type: string
 *               razorpay_payment_id:
 *                 type: string
 *               razorpay_signature:
 *                 type: string
 *               transaction_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Razorpay payment verified
 */

/**
 * @swagger
 * /api/wallet/bank-transfer/deposit:
 *   post:
 *     tags: [Customer - Wallet]
 *     summary: Create bank transfer wallet transaction (Pending)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 250
 *     responses:
 *       200:
 *         description: Bank transfer transaction created
 */

/**
 * @swagger
 * /api/wallet/bank-transfer/bank-details:
 *   get:
 *     tags: [Customer - Wallet]
 *     summary: Get country-specific bank transfer details
 *     responses:
 *       200:
 *         description: Bank details fetched
 */

/**
 * @swagger
 * /api/wallet/bank-transfer/{transactionId}/proof:
 *   post:
 *     tags: [Customer - Wallet]
 *     summary: Upload bank transfer proof for a pending transaction (single upload only)
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [document]
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Proof uploaded and status moved to Reviewing
 */

/**
 * @swagger
 * /api/admin/payments/gateways:
 *   get:
 *     tags: [Admin - Payments]
 *     summary: Get payment gateway configurations (secrets masked)
 *     responses:
 *       200:
 *         description: Gateway configurations fetched
 */

/**
 * @swagger
 * /api/admin/payments/gateways/{gatewayCode}:
 *   patch:
 *     tags: [Admin - Payments]
 *     summary: Update payment gateway configuration
 *     parameters:
 *       - in: path
 *         name: gatewayCode
 *         required: true
 *         schema:
 *           type: string
 *           enum: [stripe, tamara, razorpay]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isEnabled:
 *                 type: boolean
 *               publicKey:
 *                 type: string
 *               secretKey:
 *                 type: string
 *               extraConfig:
 *                 type: object
 *     responses:
 *       200:
 *         description: Gateway updated
 */

/**
 * @swagger
 * /api/admin/payments/bank-accounts:
 *   get:
 *     tags: [Admin - Payments]
 *     summary: Get bank account configurations by country
 *     responses:
 *       200:
 *         description: Bank accounts fetched
 *   post:
 *     tags: [Admin - Payments]
 *     summary: Create bank account configuration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [countryCode, fields]
 *             properties:
 *               countryCode:
 *                 type: string
 *                 example: IN
 *               isEnabled:
 *                 type: boolean
 *               fields:
 *                 type: array
 *                 maxItems: 6
 *                 items:
 *                   type: object
 *                   required: [label, value]
 *                   properties:
 *                     label:
 *                       type: string
 *                     value:
 *                       type: string
 *     responses:
 *       200:
 *         description: Bank account saved
 */

/**
 * @swagger
 * /api/admin/payments/bank-accounts/{bankAccountId}:
 *   patch:
 *     tags: [Admin - Payments]
 *     summary: Update bank account configuration
 *     parameters:
 *       - in: path
 *         name: bankAccountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bank account updated
 *   delete:
 *     tags: [Admin - Payments]
 *     summary: Delete bank account configuration
 *     parameters:
 *       - in: path
 *         name: bankAccountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bank account deleted
 */

/**
 * @swagger
 * /api/admin/payments/bank-transfers:
 *   get:
 *     tags: [Admin - Payments]
 *     summary: List bank transfer transactions in Reviewing status
 *     responses:
 *       200:
 *         description: Bank transfer queue fetched
 */

/**
 * @swagger
 * /api/admin/payments/bank-transfers/{transactionId}:
 *   get:
 *     tags: [Admin - Payments]
 *     summary: Get single bank transfer transaction details
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bank transfer details fetched
 */

/**
 * @swagger
 * /api/admin/payments/bank-transfers/{transactionId}/approve:
 *   post:
 *     tags: [Admin - Payments]
 *     summary: Approve bank transfer and credit wallet
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bank transfer approved
 */

/**
 * @swagger
 * /api/admin/payments/bank-transfers/{transactionId}/reject:
 *   post:
 *     tags: [Admin - Payments]
 *     summary: Reject bank transfer, store reason, and delete uploaded proof
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bank transfer rejected
 */
