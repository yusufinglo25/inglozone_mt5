/**
 * @swagger
 * tags:
 *   - name: Health
 *   - name: Auth
 *   - name: User
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register user directly
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
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
 *     tags: [Auth]
 *     summary: Start registration and send OTP
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, email, password]
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Must contain at least one uppercase letter, one lowercase letter, and one special character.
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
 *     tags: [Auth]
 *     summary: Verify OTP and create account
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tempToken, otp]
 *             properties:
 *               tempToken:
 *                 type: string
 *               otp:
 *                 type: string
 *                 pattern: ^\d{6}$
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
 *     tags: [Auth]
 *     summary: Resend registration OTP
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tempToken]
 *             properties:
 *               tempToken:
 *                 type: string
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
 *     tags: [Auth]
 *     summary: Log in user and receive JWT token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
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
 *     tags: [Auth]
 *     summary: Check whether email already exists
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
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
 *     tags: [Auth]
 *     summary: Complete profile for OAuth signup
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, firstName, lastName, password]
 *             properties:
 *               userId:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Must contain at least one uppercase letter, one lowercase letter, and one special character.
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
 */

/**
 * @swagger
 * /api/auth/status:
 *   get:
 *     tags: [Auth]
 *     summary: Check authentication status with bearer token
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
 *     tags: [Auth]
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
 *     tags: [Auth]
 *     summary: Google OAuth callback
 *     security: []
 *     responses:
 *       302:
 *         description: Redirects to frontend with auth result
 */

/**
 * @swagger
 * /api/user/complete-profile:
 *   post:
 *     tags: [User]
 *     summary: Complete user profile using authenticated token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, password, confirmPassword]
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Must contain at least one uppercase letter, one lowercase letter, and one special character.
 *               confirmPassword:
 *                 type: string
 *                 minLength: 8
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
 * components:
 *   schemas:
 *     RegisterRequest:
 *       type: object
 *       required: [firstName, lastName, email, password]
 *       properties:
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           minLength: 8
 *           description: Must contain at least one uppercase letter, one lowercase letter, and one special character.
 *
 *     LoginRequest:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 */
