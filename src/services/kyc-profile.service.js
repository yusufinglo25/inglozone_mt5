// src/services/kyc-profile.service.js
const db = require('../config/db')
const { v4: uuidv4 } = require('uuid')

class KYCProfileService {
  // Create or update KYC profile
  async saveProfile(userId, profileData) {
    try {
      // Remove empty strings and null values
      const cleanedData = {}
      for (const [key, value] of Object.entries(profileData)) {
        if (value !== '' && value !== null && value !== undefined) {
          cleanedData[key] = value
        }
      }
      
      // Check if profile already exists
      const [existingProfile] = await db.promise().query(
        `SELECT id FROM kyc_profiles WHERE user_id = ?`,
        [userId]
      )
      
      if (existingProfile.length > 0) {
        // Update existing profile
        const [result] = await db.promise().query(
          `UPDATE kyc_profiles SET ? WHERE user_id = ?`,
          [cleanedData, userId]
        )
        
        return {
          success: true,
          message: 'KYC profile updated successfully',
          action: 'updated',
          profileId: existingProfile[0].id
        }
      } else {
        // Create new profile
        const profileId = uuidv4()
        
        const [result] = await db.promise().query(
          `INSERT INTO kyc_profiles (id, user_id, ?) VALUES (?, ?, ?)`,
          [cleanedData, profileId, userId, cleanedData]
        )
        
        return {
          success: true,
          message: 'KYC profile created successfully',
          action: 'created',
          profileId: profileId
        }
      }
    } catch (error) {
      console.error('Error saving KYC profile:', error)
      throw new Error('Failed to save KYC profile: ' + error.message)
    }
  }
  
  // Submit KYC profile for review
  async submitProfile(userId) {
    try {
      const [result] = await db.promise().query(
        `UPDATE kyc_profiles 
         SET profile_status = 'SUBMITTED', 
             submitted_at = NOW(),
             updated_at = NOW()
         WHERE user_id = ? AND profile_status = 'DRAFT'`,
        [userId]
      )
      
      if (result.affectedRows === 0) {
        throw new Error('Profile not found or already submitted')
      }
      
      return {
        success: true,
        message: 'KYC profile submitted for review'
      }
    } catch (error) {
      console.error('Error submitting KYC profile:', error)
      throw new Error('Failed to submit KYC profile: ' + error.message)
    }
  }
  
  // Get KYC profile by user ID
  async getProfileByUserId(userId) {
    try {
      const [profiles] = await db.promise().query(
        `SELECT kp.*, 
                u.email, u.first_name as user_first_name, u.last_name as user_last_name, u.mobile,
                kd.id as document_id, kd.document_type, kd.status as document_status,
                kd.extracted_data as document_extracted_data
         FROM kyc_profiles kp
         LEFT JOIN users u ON kp.user_id = u.id
         LEFT JOIN kyc_documents kd ON kp.user_id = kd.user_id 
           AND kd.status IN ('APPROVED', 'AUTO_VERIFIED', 'PENDING')
         WHERE kp.user_id = ?
         ORDER BY kd.created_at DESC
         LIMIT 1`,
        [userId]
      )
      
      if (profiles.length === 0) {
        return null
      }
      
      const profile = profiles[0]
      
      // Parse extracted data if exists
      if (profile.document_extracted_data) {
        try {
          profile.document_extracted_data = JSON.parse(profile.document_extracted_data)
        } catch (e) {
          profile.document_extracted_data = null
        }
      }
      
      // Remove sensitive data
      delete profile.social_security_number
      delete profile.tax_identification_number
      
      return profile
    } catch (error) {
      console.error('Error fetching KYC profile:', error)
      throw new Error('Failed to fetch KYC profile: ' + error.message)
    }
  }
  
  // Get all KYC profiles for admin (with pagination)
  async getAllProfiles(status = null, limit = 50, offset = 0) {
    try {
      let query = `
        SELECT kp.*, 
               u.email, u.first_name, u.last_name,
               kd.id as document_id, kd.document_type, kd.status as document_status
        FROM kyc_profiles kp
        LEFT JOIN users u ON kp.user_id = u.id
        LEFT JOIN kyc_documents kd ON kp.user_id = kd.user_id 
          AND kd.status IN ('APPROVED', 'AUTO_VERIFIED', 'PENDING')
      `
      
      const params = []
      
      if (status) {
        query += ` WHERE kp.profile_status = ?`
        params.push(status)
      }
      
      query += ` ORDER BY kp.submitted_at DESC, kp.created_at DESC LIMIT ? OFFSET ?`
      params.push(parseInt(limit), parseInt(offset))
      
      const [profiles] = await db.promise().query(query, params)
      
      // Get total count
      let countQuery = `SELECT COUNT(*) as total FROM kyc_profiles`
      const countParams = []
      
      if (status) {
        countQuery += ` WHERE profile_status = ?`
        countParams.push(status)
      }
      
      const [totalResult] = await db.promise().query(countQuery, countParams)
      
      return {
        profiles,
        total: totalResult[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    } catch (error) {
      console.error('Error fetching all KYC profiles:', error)
      throw new Error('Failed to fetch KYC profiles: ' + error.message)
    }
  }
  
  // Update KYC profile status (admin only)
  async updateProfileStatus(profileId, status, adminUserId, notes = null) {
    try {
      const updateData = {
        profile_status: status,
        updated_at: new Date()
      }
      
      if (status === 'APPROVED' || status === 'REJECTED') {
        updateData.reviewed_by = adminUserId
        updateData.reviewed_at = new Date()
        if (notes) updateData.review_notes = notes
      }
      
      const [result] = await db.promise().query(
        `UPDATE kyc_profiles SET ? WHERE id = ?`,
        [updateData, profileId]
      )
      
      if (result.affectedRows === 0) {
        throw new Error('Profile not found')
      }
      
      return {
        success: true,
        message: `KYC profile ${status.toLowerCase()} successfully`
      }
    } catch (error) {
      console.error('Error updating profile status:', error)
      throw new Error('Failed to update profile status: ' + error.message)
    }
  }
  
  // Get KYC completion status
  async getCompletionStatus(userId) {
    try {
      const [profile] = await db.promise().query(
        `SELECT * FROM kyc_profiles WHERE user_id = ?`,
        [userId]
      )
      
      const [documents] = await db.promise().query(
        `SELECT status FROM kyc_documents 
         WHERE user_id = ? AND status IN ('APPROVED', 'AUTO_VERIFIED', 'PENDING')
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      )
      
      const hasProfile = profile.length > 0
      const hasDocument = documents.length > 0
      const profileStatus = hasProfile ? profile[0].profile_status : 'NOT_STARTED'
      const documentStatus = hasDocument ? documents[0].status : 'NOT_SUBMITTED'
      
      // Calculate completion percentage
      let completion = 0
      let steps = []
      
      // Step 1: Personal Information (30%)
      if (hasProfile) {
        const p = profile[0]
        const personalInfoComplete = p.date_of_birth && p.nationality && p.country_of_residence && p.address_line1
        if (personalInfoComplete) {
          completion += 30
          steps.push({ 
            name: 'Personal Information', 
            completed: true,
            details: 'All personal details provided'
          })
        } else {
          steps.push({ 
            name: 'Personal Information', 
            completed: false,
            details: 'Missing some personal details'
          })
        }
        
        // Step 2: Financial Information (30%)
        const financialInfoComplete = p.employment_status && p.annual_income > 0 && p.source_of_funds
        if (financialInfoComplete) {
          completion += 30
          steps.push({ 
            name: 'Financial Information', 
            completed: true,
            details: 'Financial details provided'
          })
        } else {
          steps.push({ 
            name: 'Financial Information', 
            completed: false,
            details: 'Missing financial information'
          })
        }
        
        // Step 3: Experience & Purpose (10%)
        const experienceComplete = p.trading_experience_level && p.risk_tolerance && p.account_purpose
        if (experienceComplete) {
          completion += 10
          steps.push({ 
            name: 'Experience & Purpose', 
            completed: true,
            details: 'Trading experience provided'
          })
        } else {
          steps.push({ 
            name: 'Experience & Purpose', 
            completed: false,
            details: 'Missing trading experience'
          })
        }
      } else {
        steps.push({ 
          name: 'Personal Information', 
          completed: false,
          details: 'Not started'
        })
        steps.push({ 
          name: 'Financial Information', 
          completed: false,
          details: 'Not started'
        })
        steps.push({ 
          name: 'Experience & Purpose', 
          completed: false,
          details: 'Not started'
        })
      }
      
      // Step 4: ID Document (30%)
      if (hasDocument) {
        if (documentStatus === 'APPROVED') {
          completion += 30
          steps.push({ 
            name: 'ID Verification', 
            completed: true, 
            status: 'APPROVED',
            details: 'ID document verified'
          })
        } else if (documentStatus === 'AUTO_VERIFIED') {
          completion += 20
          steps.push({ 
            name: 'ID Verification', 
            completed: true, 
            status: 'AUTO_VERIFIED',
            details: 'ID document auto-verified, awaiting admin approval'
          })
        } else if (documentStatus === 'PENDING') {
          completion += 15
          steps.push({ 
            name: 'ID Verification', 
            completed: true, 
            status: 'PENDING',
            details: 'ID document submitted, awaiting verification'
          })
        }
      } else {
        steps.push({ 
          name: 'ID Verification', 
          completed: false,
          details: 'No ID document uploaded'
        })
      }
      
      const canTrade = completion >= 100 && profileStatus === 'APPROVED' && documentStatus === 'APPROVED'
      const canDeposit = completion >= 70 && documentStatus !== 'REJECTED'
      
      return {
        completion: Math.min(completion, 100),
        steps,
        profileStatus,
        documentStatus,
        canTrade,
        canDeposit,
        nextAction: !hasProfile ? 'fill_profile' : 
                   !hasDocument ? 'upload_id' :
                   profileStatus === 'DRAFT' ? 'submit_profile' :
                   'wait_for_approval'
      }
    } catch (error) {
      console.error('Error getting completion status:', error)
      throw new Error('Failed to get completion status: ' + error.message)
    }
  }
  
  // Validate profile data
  validateProfileData(data) {
    const errors = []
    
    // Required personal information
    if (!data.date_of_birth) errors.push('Date of birth is required')
    if (!data.nationality) errors.push('Nationality is required')
    if (!data.country_of_residence) errors.push('Country of residence is required')
    if (!data.address_line1) errors.push('Address is required')
    if (!data.city) errors.push('City is required')
    if (!data.postal_code) errors.push('Postal code is required')
    
    // Validate date of birth (must be at least 18 years old)
    if (data.date_of_birth) {
      const dob = new Date(data.date_of_birth)
      const today = new Date()
      const age = today.getFullYear() - dob.getFullYear()
      const monthDiff = today.getMonth() - dob.getMonth()
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--
      }
      
      if (age < 18) {
        errors.push('You must be at least 18 years old')
      }
      
      if (age > 100) {
        errors.push('Please enter a valid date of birth')
      }
    }
    
    // Required financial information
    if (!data.employment_status) errors.push('Employment status is required')
    if (!data.annual_income || data.annual_income <= 0) {
      errors.push('Annual income is required and must be greater than 0')
    }
    if (!data.source_of_funds) errors.push('Source of funds is required')
    if (!data.trading_experience_level) errors.push('Trading experience level is required')
    if (!data.risk_tolerance) errors.push('Risk tolerance is required')
    if (!data.account_purpose) errors.push('Account purpose is required')
    
    // Income validation
    if (data.annual_income && data.annual_income < 1000) {
      errors.push('Annual income seems too low for trading')
    }
    
    if (data.annual_income && data.annual_income > 10000000) {
      errors.push('Please enter a valid annual income')
    }
    
    // Regulatory compliance
    if (data.us_citizen_or_resident && !data.tax_identification_number) {
      errors.push('Tax identification number is required for US citizens/residents')
    }
    
    return errors
  }
  
  // Get auto-fill suggestions from user's KYC documents
  async getAutoFillSuggestions(userId) {
    try {
      // Get user's latest KYC document with extracted data
      const [documents] = await db.promise().query(
        `SELECT extracted_data, document_type 
         FROM kyc_documents 
         WHERE user_id = ? AND extracted_data IS NOT NULL
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      )
      
      if (documents.length === 0) {
        return { success: false, message: 'No KYC document with extracted data found' }
      }
      
      const document = documents[0]
      const extractedData = JSON.parse(document.extracted_data)
      
      // Extract suggestions from OCR data
      const suggestions = {}
      
      // Personal information suggestions
      if (extractedData.first_name) suggestions.first_name = extractedData.first_name
      if (extractedData.last_name) suggestions.last_name = extractedData.last_name
      if (extractedData.date_of_birth) suggestions.date_of_birth = extractedData.date_of_birth
      if (extractedData.place_of_birth) suggestions.place_of_birth = extractedData.place_of_birth
      if (extractedData.gender) suggestions.gender = extractedData.gender
      if (extractedData.nationality) {
        suggestions.nationality = extractedData.nationality
        suggestions.country_of_residence = extractedData.nationality
      }
      if (extractedData.address_line1) suggestions.address_line1 = extractedData.address_line1
      if (extractedData.address_line2) suggestions.address_line2 = extractedData.address_line2
      if (extractedData.city) suggestions.city = extractedData.city
      if (extractedData.state) suggestions.state = extractedData.state
      if (extractedData.postal_code) suggestions.postal_code = extractedData.postal_code
      
      // If we have personal_info from OCR
      if (extractedData.personal_info) {
        Object.assign(suggestions, extractedData.personal_info)
      }
      
      return {
        success: true,
        suggestions,
        document_type: document.document_type,
        source: 'ocr_extraction',
        confidence: 'medium'
      }
      
    } catch (error) {
      console.error('Error getting auto-fill suggestions:', error)
      return { success: false, message: 'Failed to get suggestions' }
    }
  }
}

// Export the service instance
module.exports = new KYCProfileService()