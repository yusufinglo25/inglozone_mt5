// src/middleware/kyc.middleware.js
const db = require('../config/db')

// Check if user has already uploaded KYC
const checkExistingKYC = async (req, res, next) => {
  try {
    const userId = req.user.id
    
    const [existingKYC] = await db.promise().query(
      `SELECT status FROM kyc_documents 
       WHERE user_id = ? AND status IN ('PENDING', 'AUTO_VERIFIED', 'APPROVED')
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    )
    
    if (existingKYC.length > 0) {
      const status = existingKYC[0].status
      
      return res.status(400).json({
        error: 'KYC already submitted',
        status: status,
        message: `You already have a ${status.toLowerCase()} KYC submission.`
      })
    }
    
    next()
  } catch (error) {
    console.error('Error checking existing KYC:', error)
    res.status(500).json({
      error: 'Internal server error'
    })
  }
}

// Check if user has APPROVED KYC
const hasApprovedKYC = async (req, res, next) => {
  try {
    const userId = req.user.id
    
    const [approvedKYC] = await db.promise().query(
      `SELECT id FROM kyc_documents 
       WHERE user_id = ? AND status = 'APPROVED'
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    )
    
    if (approvedKYC.length === 0) {
      return res.status(403).json({
        error: 'KYC verification required',
        message: 'Please complete KYC verification before accessing this resource.'
      })
    }
    
    next()
  } catch (error) {
    console.error('Error checking approved KYC:', error)
    res.status(500).json({
      error: 'Internal server error'
    })
  }
}

// Admin middleware (check if user is admin)
const isAdmin = async (req, res, next) => {
  try {
    // For now, check if user email contains "admin"
    // You should implement proper admin role checking
    const userEmail = req.user.email || ''
    const isAdminUser = userEmail.includes('admin') || userEmail === process.env.ADMIN_EMAIL
    
    if (!isAdminUser) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required'
      })
    }
    
    next()
  } catch (error) {
    console.error('Error in admin middleware:', error)
    res.status(500).json({
      error: 'Internal server error'
    })
  }
}

// Check KYC document ownership or admin access
const checkKYCOwnershipOrAdmin = async (req, res, next) => {
  try {
    const { kycId } = req.params
    const userId = req.user.id
    const userEmail = req.user.email || ''
    const isAdminUser = userEmail.includes('admin') || userEmail === process.env.ADMIN_EMAIL
    
    const [kycDoc] = await db.promise().query(
      `SELECT user_id FROM kyc_documents WHERE id = ?`,
      [kycId]
    )
    
    if (kycDoc.length === 0) {
      return res.status(404).json({
        error: 'KYC document not found'
      })
    }
    
    // Allow if admin or document owner
    if (!isAdminUser && kycDoc[0].user_id !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this KYC document'
      })
    }
    
    next()
  } catch (error) {
    console.error('Error checking KYC ownership:', error)
    res.status(500).json({
      error: 'Internal server error'
    })
  }
}

module.exports = {
  checkExistingKYC,
  hasApprovedKYC,
  isAdmin,
  checkKYCOwnershipOrAdmin
}