// src/routes/kyc.routes.js
const express = require('express')
const router = express.Router()

// Import controllers and middleware
const kycController = require('../controllers/kyc.controller')
const authMiddleware = require('../middleware/auth.middleware')
const kycMiddleware = require('../middleware/kyc.middleware')
const uploadMiddleware = require('../middleware/upload.middleware')

// ========== USER ROUTES ==========

// Upload KYC document
router.post(
  '/upload',
  authMiddleware.verifyToken,
  kycMiddleware.checkExistingKYC,
  uploadMiddleware.uploadRateLimit,
  uploadMiddleware.uploadSingle,
  kycController.uploadDocument
)

// Get KYC status
router.get(
  '/status',
  authMiddleware.verifyToken,
  kycController.getKYCStatus
)

// Get KYC document details
router.get(
  '/documents/:kycId',
  authMiddleware.verifyToken,
  kycMiddleware.checkKYCOwnershipOrAdmin,
  kycController.getKYCDocument
)

// ========== ADMIN ROUTES ==========

// Get pending KYC documents
router.get(
  '/admin/pending',
  authMiddleware.verifyToken,
  kycMiddleware.isAdmin,
  kycController.getPendingKYC
)

// Get KYC statistics
router.get(
  '/admin/stats',
  authMiddleware.verifyToken,
  kycMiddleware.isAdmin,
  kycController.getKYCStats
)

// Approve KYC
router.post(
  '/admin/:kycId/approve',
  authMiddleware.verifyToken,
  kycMiddleware.isAdmin,
  kycController.approveKYC
)

// Reject KYC
router.post(
  '/admin/:kycId/reject',
  authMiddleware.verifyToken,
  kycMiddleware.isAdmin,
  kycController.rejectKYC
)

// Run auto verification
router.post(
  '/admin/:kycId/verify',
  authMiddleware.verifyToken,
  kycMiddleware.isAdmin,
  kycController.runAutoVerification
)

module.exports = router