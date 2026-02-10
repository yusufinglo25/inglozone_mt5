const express = require('express')
const router = express.Router()
const kycController = require('../controllers/kyc.controller')
const authMiddleware = require('../middleware/auth.middleware')
const kycMiddleware = require('../middleware/kyc.middleware')
const { uploadSingle, uploadRateLimit } = require('../middleware/upload.middleware')

/**
 * @swagger
 * tags:
 *   name: KYC
 *   description: KYC document management
 */

/**
 * @swagger
 * /api/kyc/upload:
 *   post:
 *     summary: Upload KYC document
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - document
 *               - documentType
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *                 description: KYC document file (JPG, PNG, PDF up to 5MB)
 *               documentType:
 *                 type: string
 *                 enum: [passport, national_id]
 *                 description: Type of document
 *     responses:
 *       201:
 *         description: KYC document uploaded successfully
 *       400:
 *         description: Invalid input or file
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Too many upload requests
 */
router.post(
  '/upload',
  authMiddleware.verifyToken,
  kycMiddleware.checkExistingKYC,
  uploadRateLimit,
  uploadSingle,
  kycController.uploadDocument
)

/**
 * @swagger
 * /api/kyc/status:
 *   get:
 *     summary: Get user's KYC status
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: KYC status retrieved
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/status',
  authMiddleware.verifyToken,
  kycController.getKYCStatus
)

/**
 * @swagger
 * /api/kyc/documents/{kycId}:
 *   get:
 *     summary: Get KYC document details
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kycId
 *         required: true
 *         schema:
 *           type: string
 *         description: KYC document ID
 *     responses:
 *       200:
 *         description: KYC document details
 *       403:
 *         description: Forbidden - not owner or admin
 *       404:
 *         description: KYC document not found
 */
router.get(
  '/documents/:kycId',
  authMiddleware.verifyToken,
  kycMiddleware.checkKYCOwnershipOrAdmin,
  kycController.getKYCDocument
)

// Admin routes
/**
 * @swagger
 * /api/kyc/admin/pending:
 *   get:
 *     summary: Get pending KYC documents (Admin only)
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of records to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset for pagination
 *     responses:
 *       200:
 *         description: List of pending KYC documents
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 */
router.get(
  '/admin/pending',
  authMiddleware.verifyToken,
  kycMiddleware.isAdmin,
  kycController.getPendingKYC
)

/**
 * @swagger
 * /api/kyc/admin/stats:
 *   get:
 *     summary: Get KYC statistics (Admin only)
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: KYC statistics
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 */
router.get(
  '/admin/stats',
  authMiddleware.verifyToken,
  kycMiddleware.isAdmin,
  kycController.getKYCStats
)

/**
 * @swagger
 * /api/kyc/admin/{kycId}/approve:
 *   post:
 *     summary: Approve KYC document (Admin only)
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kycId
 *         required: true
 *         schema:
 *           type: string
 *         description: KYC document ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               comment:
 *                 type: string
 *                 description: Optional approval comment
 *     responses:
 *       200:
 *         description: KYC approved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       404:
 *         description: KYC document not found
 */
router.post(
  '/admin/:kycId/approve',
  authMiddleware.verifyToken,
  kycMiddleware.isAdmin,
  kycController.approveKYC
)

/**
 * @swagger
 * /api/kyc/admin/{kycId}/reject:
 *   post:
 *     summary: Reject KYC document (Admin only)
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kycId
 *         required: true
 *         schema:
 *           type: string
 *         description: KYC document ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - comment
 *             properties:
 *               comment:
 *                 type: string
 *                 minLength: 10
 *                 description: Reason for rejection (minimum 10 characters)
 *               reason:
 *                 type: string
 *                 description: Additional rejection reason
 *     responses:
 *       200:
 *         description: KYC rejected successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       404:
 *         description: KYC document not found
 */
router.post(
  '/admin/:kycId/reject',
  authMiddleware.verifyToken,
  kycMiddleware.isAdmin,
  kycController.rejectKYC
)

/**
 * @swagger
 * /api/kyc/admin/{kycId}/verify:
 *   post:
 *     summary: Run auto verification manually (Admin only)
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kycId
 *         required: true
 *         schema:
 *           type: string
 *         description: KYC document ID
 *     responses:
 *       200:
 *         description: Auto verification completed
 *       400:
 *         description: Auto verification failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 */
router.post(
  '/admin/:kycId/verify',
  authMiddleware.verifyToken,
  kycMiddleware.isAdmin,
  kycController.runAutoVerification
)

module.exports = router