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
 *     summary: Verify 2FA code and enable 2FA (rotates active session token)
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
 *         description: 2FA enabled and new token issued
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: 2FA enabled successfully
 *               token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
 */

/**
 * @swagger
 * /api/settings/2fa/disable:
 *   post:
 *     tags: [Customer - Settings]
 *     summary: Disable 2FA for current user (rotates active session token)
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
 *         description: 2FA disabled and new token issued
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: 2FA disabled successfully
 *               token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
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
 * /api/admin/auth/zoho/authorize-url:
 *   get:
 *     tags: [Admin - Auth]
 *     summary: Get backend-generated Zoho OAuth authorize URL
 *     security: []
 *     parameters:
 *       - in: query
 *         name: redirectUri
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional redirect URI override. Must match Zoho app settings.
 *     responses:
 *       200:
 *         description: Authorize URL generated
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               authUrl: https://accounts.zoho.com/oauth/v2/auth?client_id=1000.xxx&redirect_uri=https%3A%2F%2Finglo-zone-admin-panel.vercel.app%2Fauth%2Fzoho-callback&scope=ZOHOPEOPLE.forms.READ%2CZOHOPEOPLE.employee.READ%2Caaaserver.profile.READ&response_type=code&access_type=offline&prompt=consent
 *       400:
 *         description: Missing Zoho configuration
 */

/**
 * @swagger
 * /api/admin/auth/zoho/callback:
 *   get:
 *     tags: [Admin - Auth]
 *     summary: Zoho OAuth callback handler (server-side token exchange + redirect to admin frontend)
 *     security: []
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Authorization code returned by Zoho.
 *     responses:
 *       302:
 *         description: Redirects to admin frontend callback URL with token or error query params.
 *       400:
 *         description: Missing code parameter
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
 *                   legacyRole: superadmin
 *                   permissionRoleId: null
 *                   permissionRoleName: null
 *                   effectiveAccessSource: legacy_role
 *                   loginAccessStatus: allowed
 *                   zohoUserId: "1234567890"
 */

/**
 * @swagger
 * /api/admin/users/permission-catalog:
 *   get:
 *     tags: [Admin - Users]
 *     summary: Get available admin permission modules and supported read/write actions
 *     responses:
 *       200:
 *         description: Permission catalog fetched
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - key: dashboard
 *                   label: Dashboard
 *                   description: Admin dashboard visibility and stats access
 *                   supports:
 *                     read: true
 *                     write: false
 *                 - key: kyc
 *                   label: KYC
 *                   description: KYC review, approval, and rejection actions
 *                   supports:
 *                     read: true
 *                     write: true
 */

/**
 * @swagger
 * /api/admin/users/permission-context:
 *   get:
 *     tags: [Admin - Users]
 *     summary: Get the logged-in admin's effective permission context
 *     responses:
 *       200:
 *         description: Permission context fetched
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 adminId: 2cb6d8a7-72a8-4d1a-9a2c-3537db6b1300
 *                 legacyRole: admin
 *                 permissionRoleId: 8f4bb4b5-99df-4ab6-a9df-27b6bd01768e
 *                 permissionRoleName: KYC Manager
 *                 permissionRoleDescription: Can review KYC and view dashboard
 *                 source: custom_role
 *                 permissions:
 *                   - dashboard.read
 *                   - kyc.read
 *                   - kyc.write
 */

/**
 * @swagger
 * /api/admin/users/permission-roles:
 *   get:
 *     tags: [Admin - Users]
 *     summary: List all custom admin permission roles (superadmin only)
 *     responses:
 *       200:
 *         description: Permission roles fetched
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id: 8f4bb4b5-99df-4ab6-a9df-27b6bd01768e
 *                   name: KYC Manager
 *                   description: Can review KYC and view dashboard
 *                   is_active: true
 *                   assignedUserCount: 2
 *                   permissions:
 *                     - key: dashboard
 *                       canRead: true
 *                       canWrite: false
 *                     - key: kyc
 *                       canRead: true
 *                       canWrite: true
 *                   permissionTokens:
 *                     - dashboard.read
 *                     - kyc.read
 *                     - kyc.write
 *       403:
 *         description: Forbidden for non-superadmin
 *   post:
 *     tags: [Admin - Users]
 *     summary: Create a custom admin permission role (superadmin only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, permissions]
 *             properties:
 *               name:
 *                 type: string
 *                 example: KYC Manager
 *               description:
 *                 type: string
 *                 example: Can review KYC and view dashboard
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [key]
 *                   properties:
 *                     key:
 *                       type: string
 *                       example: kyc
 *                     read:
 *                       type: boolean
 *                       example: true
 *                     write:
 *                       type: boolean
 *                       example: true
 *     responses:
 *       201:
 *         description: Permission role created
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden for non-superadmin
 */

/**
 * @swagger
 * /api/admin/users/permission-roles/{roleId}:
 *   patch:
 *     tags: [Admin - Users]
 *     summary: Update a custom admin permission role (superadmin only)
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     key:
 *                       type: string
 *                     read:
 *                       type: boolean
 *                     write:
 *                       type: boolean
 *     responses:
 *       200:
 *         description: Permission role updated
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden for non-superadmin
 *       404:
 *         description: Role not found
 */

/**
 * @swagger
 * /api/admin/users/assign-permission-role:
 *   patch:
 *     tags: [Admin - Users]
 *     summary: Assign or remove a custom permission role for an employee (superadmin only)
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
 *               permissionRoleId:
 *                 type: string
 *                 nullable: true
 *                 description: Set null or empty to remove custom role and return to legacy fallback.
 *             example:
 *               email: reviewer@example.com
 *               permissionRoleId: 8f4bb4b5-99df-4ab6-a9df-27b6bd01768e
 *     responses:
 *       200:
 *         description: Permission role assignment updated
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden for non-superadmin
 */

/**
 * @swagger
 * /api/admin/users/role:
 *   patch:
 *     tags: [Admin - Users]
 *     summary: Update legacy fallback role (superadmin only)
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
 *                 id: 25110
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
 *     summary: Log in user and receive JWT token (or 2FA challenge token)
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
 *         description: Login successful or requires 2FA verification
 *         content:
 *           application/json:
 *             examples:
 *               loginSuccess:
 *                 value:
 *                   token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
 *                   user:
 *                     id: 25110
 *                     email: user@example.com
 *                     firstName: John
 *                     lastName: Doe
 *                     mobile: "+971501234567"
 *                     is2FAEnabled: false
 *                     profileCompleted: true
 *               requires2FA:
 *                 value:
 *                   requires2FA: true
 *                   message: 2FA verification required
 *                   loginToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             example:
 *               error: Invalid credentials
 */

/**
 * @swagger
 * /api/auth/login/verify-2fa:
 *   post:
 *     tags: [Customer - Auth]
 *     summary: Verify login 2FA challenge and receive JWT token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             $ref: '#/components/schemas/VerifyLogin2FARequest'
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyLogin2FARequest'
 *     responses:
 *       200:
 *         description: 2FA verified and login completed
 *         content:
 *           application/json:
 *             example:
 *               token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
 *               user:
 *                 id: 25110
 *                 email: user@example.com
 *                 firstName: John
 *                 lastName: Doe
 *                 mobile: "+971501234567"
 *                 is2FAEnabled: true
 *                 profileCompleted: true
 *       401:
 *         description: Invalid or expired login token / 2FA code
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
 *               matchTraderSync:
 *                 synced: true
 *                 source: existing
 *                 account_uuid: c7fb2e9a-13bb-4a95-8f60-8ee2f95af669
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
 *       502:
 *         description: Match-Trader sync failed
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
 *                 id: 25110
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
 *     description: Amount is provided in USD. The API stores immutable converted local amount and currency snapshot for transaction history.
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
 *                 convertedAmount: 366
 *                 currencyCode: AED
 *                 usdToLocalRate: 3.66
 *                 transactionId: ING000000000001
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
 *                 id: 25110
 *                 user_id: 25110
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
 *       required: [firstName, lastName, email, password, accountType]
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
 *         accountType:
 *           type: string
 *           enum: [trader, investor]
 *           example: trader
 *         registrationCountryCode:
 *           type: string
 *           description: ISO-2 country code locked at registration.
 *           example: AE
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
 *         twoFactorCode:
 *           type: string
 *           description: Optional. If 2FA is enabled you can send it here, or use /api/auth/login/verify-2fa.
 *           example: "123456"
 *
 *     VerifyLogin2FARequest:
 *       type: object
 *       required: [loginToken, twoFactorCode]
 *       properties:
 *         loginToken:
 *           type: string
 *           description: Token returned by /api/auth/login when requires2FA is true.
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
 *         twoFactorCode:
 *           type: string
 *           pattern: '^\d{6}$'
 *           example: "123456"
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
 *           example: 25110
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
 *           description: Deposit amount in USD.
 *           example: 100
 *
 *     WalletVerifyRequest:
 *       type: object
 *       required: [session_id]
 *       properties:
 *         session_id:
 *           type: string
 *           description: Payment gateway session id.
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
 *     description: Amount is provided in USD. Backend converts to local AED using the stored country rate and persists both values.
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
 *                 example: 100
 *     responses:
 *       200:
 *         description: Tamara checkout created
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 provider: tamara
 *                 transactionId: ING000000000001
 *                 orderId: ord_123
 *                 checkoutId: chk_123
 *                 checkoutUrl: https://checkout.tamara.co/...
 *                 status: new
 *                 amountUSD: 100
 *                 convertedAmount: 366
 *                 currencyCode: AED
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
 *                 example: ING000000000001
 *     responses:
 *       200:
 *         description: Verification result
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 success: true
 *                 transactionId: ING000000000001
 *                 orderId: ord_123
 *                 status: approved
 */

/**
 * @swagger
 * /api/wallet/payment-methods:
 *   get:
 *     tags: [Customer - Wallet]
 *     summary: Get payment methods for current user based on registered country
 *     responses:
 *       200:
 *         description: Payment methods list
 */

/**
 * @swagger
 * /api/wallet/razorpay/deposit:
 *   post:
 *     tags: [Customer - Wallet]
 *     summary: Create Razorpay order for India users from USD amount
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
 *                 example: 100
 *                 description: Amount in USD
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
 *     summary: Create bank transfer wallet transaction (Pending) from USD amount
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
 *                 example: 100
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
 * /api/admin/payments/countries:
 *   get:
 *     tags: [Admin - Payments]
 *     summary: Get backend-supported countries for currency setup dropdown
 *     responses:
 *       200:
 *         description: Country list fetched
 */

/**
 * @swagger
 * /api/admin/payments/currency-rates:
 *   get:
 *     tags: [Admin - Payments]
 *     summary: List admin-managed USD conversion rates by country
 *     responses:
 *       200:
 *         description: Currency rates fetched
 *   post:
 *     tags: [Admin - Payments]
 *     summary: Create new country currency rate
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [countryCode, countryName, currencyCode, usdRate]
 *             properties:
 *               countryCode:
 *                 type: string
 *                 example: AE
 *               countryName:
 *                 type: string
 *                 example: United Arab Emirates
 *               currencyCode:
 *                 type: string
 *                 example: AED
 *               usdRate:
 *                 type: number
 *                 example: 3.66
 *     responses:
 *       200:
 *         description: Currency rate saved
 */

/**
 * @swagger
 * /api/admin/payments/currency-rates/{currencyRateId}:
 *   patch:
 *     tags: [Admin - Payments]
 *     summary: Update an existing currency rate
 *     parameters:
 *       - in: path
 *         name: currencyRateId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Currency rate updated
 */

/**
 * @swagger
 * /api/admin/payments/currency-rates/{currencyRateId}/status:
 *   patch:
 *     tags: [Admin - Payments]
 *     summary: Enable/disable a currency rate record
 *     parameters:
 *       - in: path
 *         name: currencyRateId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isActive]
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Currency rate status updated
 */

/**
 * @swagger
 * /api/admin/payments/withdrawals:
 *   get:
 *     tags: [Admin - Payments]
 *     summary: List withdrawal requests for admin review
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           example: Pending
 *     responses:
 *       200:
 *         description: Withdrawal queue fetched
 */

/**
 * @swagger
 * /api/admin/payments/withdrawals/{transactionId}:
 *   get:
 *     tags: [Admin - Payments]
 *     summary: Get withdrawal request details
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Withdrawal details fetched
 */

/**
 * @swagger
 * /api/admin/payments/withdrawals/{transactionId}/approve:
 *   post:
 *     tags: [Admin - Payments]
 *     summary: Approve withdrawal and deduct USD balance
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Withdrawal approved
 */

/**
 * @swagger
 * /api/admin/payments/withdrawals/{transactionId}/complete:
 *   post:
 *     tags: [Admin - Payments]
 *     summary: Complete withdrawal with external reference number
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
 *             required: [referenceNumber]
 *             properties:
 *               referenceNumber:
 *                 type: string
 *                 example: WD-REF-1000001
 *     responses:
 *       200:
 *         description: Withdrawal completed
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

/**
 * @swagger
 * /api/matchtrader/customer/create-account:
 *   post:
 *     tags: [MatchTrader Customer]
 *     summary: Create customer trading account from an admin-enabled Match-Trader offer (REAL or DEMO)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [offer_uuid]
 *             properties:
 *               offer_uuid:
 *                 type: string
 *                 example: 11111111-2222-3333-4444-555555555555
 *                 description: Offer UUID selected from GET /api/matchtrader/customer/offers or GET /api/matchtrader/customer/offer-groups.
 *               mode:
 *                 type: string
 *                 enum: [REAL, DEMO]
 *                 example: REAL
 *               currency:
 *                 type: string
 *                 example: USD
 *                 description: Optional. Some broker setups require explicit currency; leverage always follows the selected offer.
 *               commission_uuid:
 *                 type: string
 *                 example: 22222222-3333-4444-5555-666666666666
 *                 description: Optional. Required by some broker setups/offers.
 *               initial_balance:
 *                 type: number
 *                 example: 10000
 *                 description: Used only when mode=DEMO.
 *     responses:
 *       201:
 *         description: Trading account created
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 trading_account_id: "1000123"
 *                 mode: REAL
 *                 broker_account_uuid: c7fb2e9a-13bb-4a95-8f60-8ee2f95af669
 *                 provider_password_returned: false
 *                 provider_generated_password: null
 *                 password_note: Use POST /api/matchtrader/customer/change-password to set or reset platform password.
 *                 selected_offer:
 *                   offer_uuid: 11111111-2222-3333-4444-555555555555
 *                   offer_name: Standard 1:100
 *                   package_name: Standard
 *                   leverage_label: "1:100"
 *                 provider:
 *                   login: "1000123"
 *                   status: ACTIVE
 *       202:
 *         description: Trading account request accepted and pending broker confirmation
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 pending: true
 *                 status: CONFIRM
 *                 provider_password_returned: false
 *                 provider_generated_password: null
 *                 password_note: Use POST /api/matchtrader/customer/change-password to set or reset platform password.
 *                 message: Trading account request submitted and awaits broker confirmation.
 *                 selected_offer:
 *                   offer_uuid: 21f85522-c043-4ed5-ae99-d4c28a316b57
 *                   package_name: Standard
 *                   leverage_label: "1:200"
 *                   trading_account_auto_creation: false
 *       400:
 *         description: Validation error or the selected offer is not enabled for customers
 *       422:
 *         description: Provider rejected account creation (offer/business-rule mismatch)
 *       401:
 *         description: Unauthorized
 *       502:
 *         description: Provider integration failure
 */

/**
 * @swagger
 * /api/matchtrader/customer/accounts:
 *   get:
 *     tags: [MatchTrader Customer]
 *     summary: Get all trading accounts linked to authenticated user
 *     responses:
 *       200:
 *         description: Trading accounts fetched
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - trading_account_id: "1000123"
 *                   mode: REAL
 *                   status: ACTIVE
 *                   leverage: "1:100"
 *                   currency: USD
 *                   balance: 1500.5
 *                   equity: 1480.1
 *               meta:
 *                 count: 1
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/matchtrader/customer/offers:
 *   get:
 *     tags: [MatchTrader Customer]
 *     summary: Get customer-visible Match-Trader offers selected in the admin panel
 *     parameters:
 *       - in: query
 *         name: mode
 *         required: false
 *         schema:
 *           type: string
 *           enum: [REAL, DEMO]
 *         description: Optional filter by account mode. Hidden CRM offers can still appear here if admin selected them.
 *       - in: query
 *         name: instant_only
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Return only offers with trading_account_auto_creation=true.
 *     responses:
 *       200:
 *         description: Offers fetched
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - offer_uuid: f6cbaca3-cc96-4275-a784-12659032b544
 *                   offer_name: Standard 1:100
 *                   package_name: Standard
 *                   demo: false
 *                   currency: USD
 *                   leverage: "100"
 *                   leverage_label: "1:100"
 *                   hidden: false
 *                   description: Standard account
 *                   verification_required: false
 *                   trading_account_auto_creation: true
 *                   initial_deposit: 50
 *               meta:
 *                 count: 1
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/matchtrader/customer/offer-groups:
 *   get:
 *     tags: [MatchTrader Customer]
 *     summary: Get customer-visible Match-Trader offers grouped by package name with leverage choices
 *     parameters:
 *       - in: query
 *         name: mode
 *         required: false
 *         schema:
 *           type: string
 *           enum: [REAL, DEMO]
 *         description: Optional filter by account mode.
 *       - in: query
 *         name: instant_only
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Return only leverage options whose underlying offer supports automatic account creation.
 *     responses:
 *       200:
 *         description: Grouped offers fetched
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - package_name: Standard
 *                   offer_count: 2
 *                   leverage_options:
 *                     - offer_uuid: f6cbaca3-cc96-4275-a784-12659032b544
 *                       offer_name: Standard 1:100
 *                       leverage: "100"
 *                       leverage_label: "1:100"
 *                       currency: USD
 *                       demo: false
 *                       trading_account_auto_creation: true
 *                     - offer_uuid: 6a86f7cd-a988-4ab4-bcaa-223456789000
 *                       offer_name: Standard 1:200
 *                       leverage: "200"
 *                       leverage_label: "1:200"
 *                       currency: USD
 *                       demo: false
 *                       trading_account_auto_creation: true
 *               meta:
 *                 count: 1
 *                 offer_count: 2
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/matchtrader/customer/change-password:
 *   post:
 *     tags: [MatchTrader Customer]
 *     summary: Change Match-Trader platform password (resolved via account UUID)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [trading_account_id, new_password]
 *             properties:
 *               trading_account_id:
 *                 type: string
 *                 example: "1000123"
 *               new_password:
 *                 type: string
 *                 example: StrongPass#2026
 *               current_password:
 *                 type: string
 *                 example: OldPass#2025
 *     responses:
 *       200:
 *         description: Password updated
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 trading_account_id: "1000123"
 *                 changed: true
 *                 account_uuid: c7fb2e9a-13bb-4a95-8f60-8ee2f95af669
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Trading account not linked to user
 */

/**
 * @swagger
 * /api/matchtrader/customer/orders:
 *   get:
 *     tags: [MatchTrader Customer]
 *     summary: Get open positions, pending orders, and closed orders for selected trading account
 *     parameters:
 *       - in: query
 *         name: trading_account_id
 *         required: true
 *         schema:
 *           type: string
 *         example: "1000123"
 *       - in: query
 *         name: from
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: system_uuid
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional override if provider requires explicit systemUuid.
 *       - in: query
 *         name: statuses
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional comma-separated statuses for history fallback (for example FILLED,CANCELLED,REJECTED,ADDED).
 *       - in: query
 *         name: include_history
 *         required: false
 *         schema:
 *           type: boolean
 *         description: If true, merges order-history entries into closed_orders.
 *     responses:
 *       200:
 *         description: Orders fetched
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 trading_account_id: "1000123"
 *                 active_orders:
 *                   - positionId: "pos-123"
 *                 open_positions:
 *                   - positionId: "pos-123"
 *                 pending_orders:
 *                   - orderId: "ord-9001"
 *                 closed_orders: []
 *       400:
 *         description: Missing trading_account_id
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/matchtrader/customer/open-positions:
 *   get:
 *     tags: [MatchTrader Customer]
 *     summary: Get open positions only for selected trading account
 *     parameters:
 *       - in: query
 *         name: trading_account_id
 *         required: true
 *         schema:
 *           type: string
 *         example: "1000123"
 *       - in: query
 *         name: from
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: system_uuid
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional provider system UUID override.
 *     responses:
 *       200:
 *         description: Open positions fetched
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 trading_account_id: "1000123"
 *                 open_positions: []
 *       400:
 *         description: Missing trading_account_id
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/matchtrader/customer/all-orders:
 *   get:
 *     tags: [MatchTrader Customer]
 *     summary: Get open positions, pending orders, and closed orders across all user trading accounts
 *     parameters:
 *       - in: query
 *         name: from
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: system_uuid
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional explicit system UUID override.
 *       - in: query
 *         name: statuses
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional comma-separated statuses for order-history fallback.
 *       - in: query
 *         name: include_history
 *         required: false
 *         schema:
 *           type: boolean
 *         description: If true, merges history records into closed orders.
 *     responses:
 *       200:
 *         description: Orders fetched from all trading accounts
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 active_orders:
 *                   - trading_account_id: "91350"
 *                     account_mode: DEMO
 *                     order: {}
 *                 open_positions:
 *                   - trading_account_id: "91350"
 *                     account_mode: DEMO
 *                     order: {}
 *                 pending_orders:
 *                   - trading_account_id: "91350"
 *                     account_mode: DEMO
 *                     order: {}
 *                 closed_orders:
 *                   - trading_account_id: "91282"
 *                     account_mode: REAL
 *                     order: {}
 *                 summary:
 *                   trading_accounts_count: 2
 *                   active_count: 1
 *                   open_positions_count: 1
 *                   pending_count: 1
 *                   closed_count: 1
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/matchtrader/customer/history:
 *   get:
 *     tags: [MatchTrader Customer]
 *     summary: Get full trading history for selected trading account
 *     parameters:
 *       - in: query
 *         name: trading_account_id
 *         required: true
 *         schema:
 *           type: string
 *         example: "1000123"
 *       - in: query
 *         name: from
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: system_uuid
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional override if provider requires explicit systemUuid.
 *       - in: query
 *         name: statuses
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional comma-separated statuses (default FILLED,CANCELLED,REJECTED,ADDED).
 *     responses:
 *       200:
 *         description: Trading history fetched
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 trading_account_id: "1000123"
 *                 history: []
 *       400:
 *         description: Missing trading_account_id
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/matchtrader/customer/create-demo:
 *   post:
 *     tags: [MatchTrader Customer]
 *     summary: Create demo trading account with optional initial balance
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [offer_uuid]
 *             properties:
 *               offer_uuid:
 *                 type: string
 *                 example: 11111111-2222-3333-4444-555555555555
 *                 description: Offer UUID selected from GET /api/matchtrader/customer/offers.
 *               leverage:
 *                 type: string
 *                 example: "1:100"
 *               currency:
 *                 type: string
 *                 example: USD
 *               commission_uuid:
 *                 type: string
 *                 example: 22222222-3333-4444-5555-666666666666
 *                 description: Optional. Required by some broker setups/offers.
 *               initial_balance:
 *                 type: number
 *                 example: 10000
 *     responses:
 *       201:
 *         description: Demo account created
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 trading_account_id: "2000456"
 *                 mode: DEMO
 *                 broker_account_uuid: c7fb2e9a-13bb-4a95-8f60-8ee2f95af669
 *                 provider_password_returned: false
 *                 provider_generated_password: null
 *                 password_note: Use POST /api/matchtrader/customer/change-password to set or reset platform password.
 *                 initial_deposit:
 *                   trading_account_id: "2000456"
 *                   amount: 10000
 *                   simulated: false
 *       202:
 *         description: Demo account request accepted and pending broker confirmation
 *       400:
 *         description: Validation error
 *       422:
 *         description: Provider rejected account creation (offer/business-rule mismatch)
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/matchtrader/customer/demo-deposit:
 *   post:
 *     tags: [MatchTrader Customer]
 *     summary: Deposit virtual/demo funds for a demo trading account (provider call with virtual fallback)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [trading_account_id, amount]
 *             properties:
 *               trading_account_id:
 *                 type: string
 *                 example: "2000456"
 *               amount:
 *                 type: number
 *                 example: 5000
 *               note:
 *                 type: string
 *                 example: bonus top-up
 *     responses:
 *       200:
 *         description: Demo deposit processed
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 trading_account_id: "2000456"
 *                 amount: 5000
 *                 simulated: true
 *                 reason: Provider did not accept demo credit, virtual handling applied
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Trading account not linked to user
 */

/**
 * @swagger
 * /api/matchtrader/customer/trade-access:
 *   get:
 *     tags: [MatchTrader Customer]
 *     summary: Get direct Match-Trader SSO launch URL (one-time token)
 *     parameters:
 *       - in: query
 *         name: trading_account_id
 *         required: true
 *         schema:
 *           type: string
 *         example: "1000123"
 *       - in: query
 *         name: validity_seconds
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 5
 *           maximum: 3600
 *         description: Optional one-time token validity in seconds (default 30).
 *         example: 30
 *       - in: query
 *         name: redirect
 *         required: false
 *         schema:
 *           type: boolean
 *         description: If true, API returns 302 redirect to launch_url instead of JSON.
 *       - in: query
 *         name: sso_disabled
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Disable SSO token generation and return platform_url only.
 *     responses:
 *       200:
 *         description: Trade launch data fetched
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 trading_account_id: "1000123"
 *                 platform_url: https://mtr-demo-prod.match-trader.com
 *                 launch_url: https://mtr-demo-prod.match-trader.com/?auth=eyJhbGciOi...
 *                 sso_enabled: true
 *                 token_validity_seconds: 30
 *       302:
 *         description: Redirect to Match-Trader launch URL (when redirect=true)
 *       400:
 *         description: Missing trading_account_id
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: SSO token request rejected (missing API permission or IP not whitelisted)
 */

/**
 * @swagger
 * /api/matchtrader/admin/offers/catalog:
 *   get:
 *     tags: [MatchTrader Admin]
 *     summary: Get all Match-Trader CRM offers with admin selection state and package grouping
 *     parameters:
 *       - in: query
 *         name: mode
 *         required: false
 *         schema:
 *           type: string
 *           enum: [REAL, DEMO]
 *         description: Optional filter by account mode.
 *     responses:
 *       200:
 *         description: Offer catalog fetched
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 offers:
 *                   - offer_uuid: f6cbaca3-cc96-4275-a784-12659032b544
 *                     offer_name: Standard 1:100
 *                     package_name: Standard
 *                     leverage_label: "1:100"
 *                     currency: USD
 *                     demo: false
 *                     selected_for_customers: true
 *                   - offer_uuid: 6a86f7cd-a988-4ab4-bcaa-223456789000
 *                     offer_name: Standard 1:200
 *                     package_name: Standard
 *                     leverage_label: "1:200"
 *                     currency: USD
 *                     demo: false
 *                     selected_for_customers: false
 *                 groups:
 *                   - package_name: Standard
 *                     offer_count: 2
 *                     leverage_options:
 *                       - offer_uuid: f6cbaca3-cc96-4275-a784-12659032b544
 *                         selected_for_customers: true
 *                       - offer_uuid: 6a86f7cd-a988-4ab4-bcaa-223456789000
 *                         selected_for_customers: false
 *                 selected_offer_uuids:
 *                   - f6cbaca3-cc96-4275-a784-12659032b544
 *               meta:
 *                 count: 2
 *                 selected_count: 1
 *       401:
 *         description: Unauthorized admin token
 *       403:
 *         description: Missing matchtrader_offers.read permission
 */

/**
 * @swagger
 * /api/matchtrader/admin/offers/customer-visibility:
 *   put:
 *     tags: [MatchTrader Admin]
 *     summary: Replace the customer-visible Match-Trader offer selection from admin panel
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [offer_uuids]
 *             properties:
 *               offer_uuids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example:
 *                   - f6cbaca3-cc96-4275-a784-12659032b544
 *                   - 6a86f7cd-a988-4ab4-bcaa-223456789000
 *                 description: Raw Match-Trader offer UUIDs that should be visible to customers.
 *     responses:
 *       200:
 *         description: Customer-visible offers updated
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 selected_offer_uuids:
 *                   - f6cbaca3-cc96-4275-a784-12659032b544
 *                   - 6a86f7cd-a988-4ab4-bcaa-223456789000
 *               meta:
 *                 selected_count: 2
 *       400:
 *         description: One or more offer UUIDs do not exist in Match-Trader
 *       401:
 *         description: Unauthorized admin token
 *       403:
 *         description: Missing matchtrader_offers.write permission
 *       503:
 *         description: Offer visibility migration table is not ready yet
 */

/**
 * @swagger
 * /api/matchtrader/admin/accounts:
 *   get:
 *     tags: [MatchTrader Admin]
 *     summary: Get all users with their linked trading accounts
 *     responses:
 *       200:
 *         description: Admin account list fetched
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - user_id: "25110"
 *                   email: trader@example.com
 *                   first_name: John
 *                   last_name: Doe
 *                   trading_account_id: "1000123"
 *                   mode: REAL
 *                   status: ACTIVE
 *               meta:
 *                 count: 1
 *       401:
 *         description: Unauthorized admin token
 */

/**
 * @swagger
 * /api/matchtrader/admin/orders:
 *   get:
 *     tags: [MatchTrader Admin]
 *     summary: Get global aggregated orders across all linked users/accounts
 *     parameters:
 *       - in: query
 *         name: from
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Aggregated order snapshot
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 active_orders: []
 *                 open_positions: []
 *                 pending_orders: []
 *                 closed_orders: []
 *                 summary:
 *                   active_count: 0
 *                   open_positions_count: 0
 *                   pending_count: 0
 *                   closed_count: 0
 *       401:
 *         description: Unauthorized admin token
 */

/**
 * @swagger
 * /api/matchtrader/admin/user/{user_id}:
 *   get:
 *     tags: [MatchTrader Admin]
 *     summary: Get user trading details (profile, accounts, balances, history)
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *         example: "25110"
 *       - in: query
 *         name: from
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: User trading details fetched
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 user:
 *                   id: "25110"
 *                   email: trader@example.com
 *                   first_name: John
 *                   last_name: Doe
 *                 trading_accounts:
 *                   - trading_account_id: "1000123"
 *                     mode: REAL
 *                     status: ACTIVE
 *                     balance: 1200
 *                     equity: 1189.5
 *                     history: []
 *                 balances:
 *                   - trading_account_id: "1000123"
 *                     balance: 1200
 *                     equity: 1189.5
 *                     currency: USD
 *                 order_history: []
 *       401:
 *         description: Unauthorized admin token
 *       404:
 *         description: User not found
 */
