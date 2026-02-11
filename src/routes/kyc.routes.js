// src/routes/kyc.routes.js - UPDATED WITH AUTO-FILL
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

// Get auto-fill data from KYC document
router.get(
  '/documents/:kycId/auto-fill',
  authMiddleware.verifyToken,
  kycMiddleware.checkKYCOwnershipOrAdmin,
  kycController.getAutoFillData
)

// ========== KYC PROFILE ROUTES ==========

// Save/update KYC profile
router.post(
  '/profile',
  authMiddleware.verifyToken,
  kycController.saveProfile
)

// Save KYC profile with auto-fill from document
router.post(
  '/profile/auto-fill',
  authMiddleware.verifyToken,
  kycController.saveProfileWithAutoFill
)

// Get auto-fill suggestions
router.get(
  '/profile/auto-fill/suggestions',
  authMiddleware.verifyToken,
  kycController.getAutoFillSuggestions
)

// Submit KYC profile for review
router.post(
  '/profile/submit',
  authMiddleware.verifyToken,
  kycController.submitProfile
)

// Get KYC profile
router.get(
  '/profile',
  authMiddleware.verifyToken,
  kycController.getProfile
)

// Get KYC completion status
router.get(
  '/completion',
  authMiddleware.verifyToken,
  kycController.getCompletionStatus
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

// Approve KYC document
router.post(
  '/admin/:kycId/approve',
  authMiddleware.verifyToken,
  kycMiddleware.isAdmin,
  kycController.approveKYC
)

// Reject KYC document
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

// Get all KYC profiles (admin)
router.get(
  '/admin/profiles',
  authMiddleware.verifyToken,
  kycMiddleware.isAdmin,
  kycController.getAllProfiles
)

// Update KYC profile status (admin)
router.post(
  '/admin/profiles/:profileId/status',
  authMiddleware.verifyToken,
  kycMiddleware.isAdmin,
  kycController.updateProfileStatus
)

module.exports = router