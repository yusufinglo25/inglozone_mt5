// src/services/kyc-profile.service.js
const db = require('../config/db')
const { v4: uuidv4 } = require('uuid')
const { validatePhoneNumber, getCountryByCode } = require('../data/country-codes')

class KYCProfileService {
  // ENHANCED: Create or update KYC profile with phone country codes
  async saveProfile(userId, profileData) {
    try {
      // Check if profile already exists and its status
      const [existingProfile] = await db.promise().query(
        `SELECT id, profile_status FROM kyc_profiles WHERE user_id = ?`,
        [userId]
      )

      // If profile exists and is not DRAFT, disallow editing
      if (existingProfile.length > 0 && existingProfile[0].profile_status !== 'DRAFT') {
        throw new Error('Profile already submitted and cannot be edited')
      }

      // Remove empty strings and null values
      const cleanedData = {}
      for (const [key, value] of Object.entries(profileData)) {
        if (value !== '' && value !== null && value !== undefined) {
          cleanedData[key] = value
        }
      }

      // Remove fields that don't exist in kyc_profiles table
      delete cleanedData.first_name
      delete cleanedData.last_name
      delete cleanedData.email
      delete cleanedData.password

      // Validate phone numbers if provided
      if (cleanedData.primary_phone_number && cleanedData.primary_phone_country_code) {
        const validation = validatePhoneNumber(
          cleanedData.primary_phone_country_code,
          cleanedData.primary_phone_number
        )
        if (!validation.valid) {
          throw new Error(`Primary phone: ${validation.message}`)
        }
        // Store clean number without formatting
        cleanedData.primary_phone_number = cleanedData.primary_phone_number.replace(/\D/g, '')
      }

      if (cleanedData.secondary_phone_number && cleanedData.secondary_phone_country_code) {
        const validation = validatePhoneNumber(
          cleanedData.secondary_phone_country_code,
          cleanedData.secondary_phone_number
        )
        if (!validation.valid) {
          throw new Error(`Secondary phone: ${validation.message}`)
        }
        cleanedData.secondary_phone_number = cleanedData.secondary_phone_number.replace(/\D/g, '')
      }

      if (existingProfile.length > 0) {
        // UPDATE existing profile (only allowed if status is DRAFT, already checked)
        const setClause = Object.keys(cleanedData).map(key => `${key} = ?`).join(', ')
        const values = Object.values(cleanedData)

        const [result] = await db.promise().query(
          `UPDATE kyc_profiles SET ${setClause} WHERE user_id = ?`,
          [...values, userId]
        )

        return {
          success: true,
          message: 'KYC profile updated successfully',
          action: 'updated',
          profileId: existingProfile[0].id
        }
      } else {
        // CREATE new profile
        const profileId = uuidv4()

        const columns = ['id', 'user_id', ...Object.keys(cleanedData)]
        const placeholders = columns.map(() => '?').join(', ')
        const values = [profileId, userId, ...Object.values(cleanedData)]

        const [result] = await db.promise().query(
          `INSERT INTO kyc_profiles (${columns.join(', ')}) VALUES (${placeholders})`,
          values
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

  // ENHANCED: Get KYC profile by user ID with formatted phone numbers
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

      // Format phone numbers for display
      if (profile.primary_phone_country_code && profile.primary_phone_number) {
        profile.primary_phone_formatted = 
          `${profile.primary_phone_country_code} ${profile.primary_phone_number}`
      }

      if (profile.secondary_phone_country_code && profile.secondary_phone_number) {
        profile.secondary_phone_formatted = 
          `${profile.secondary_phone_country_code} ${profile.secondary_phone_number}`
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

      // Format phone numbers for each profile
      profiles.forEach(profile => {
        if (profile.primary_phone_country_code && profile.primary_phone_number) {
          profile.primary_phone_formatted = 
            `${profile.primary_phone_country_code} ${profile.primary_phone_number}`
        }
      })

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

      const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ')
      const values = [...Object.values(updateData), profileId]

      const [result] = await db.promise().query(
        `UPDATE kyc_profiles SET ${setClause} WHERE id = ?`,
        values
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

  // ENHANCED: Get KYC completion status with document side awareness
  async getCompletionStatus(userId) {
    try {
      const [profile] = await db.promise().query(
        `SELECT * FROM kyc_profiles WHERE user_id = ?`,
        [userId]
      )

      const [documents] = await db.promise().query(
        `SELECT document_type, document_side, status 
         FROM kyc_documents 
         WHERE user_id = ?`,
        [userId]
      )

      const hasProfile = profile.length > 0
      const profileStatus = hasProfile ? profile[0].profile_status : 'NOT_STARTED'

      // Check document completeness with side awareness
      const hasPassport = documents.some(d => d.document_type === 'passport')
      const hasNationalIdFront = documents.some(d => d.document_type === 'national_id_front')
      const hasNationalIdBack = documents.some(d => d.document_type === 'national_id_back')
      const hasCompleteNationalId = hasNationalIdFront && hasNationalIdBack

      // Get document status based on most restrictive
      let documentStatus = 'NOT_SUBMITTED'
      let documentApprovalStatus = 'PENDING'

      const relevantDocs = documents.filter(d => 
        d.document_type === 'passport' || 
        d.document_type === 'national_id_front' || 
        d.document_type === 'national_id_back'
      )

      if (relevantDocs.length > 0) {
        const allApproved = relevantDocs.every(d => d.status === 'APPROVED')
        const anyRejected = relevantDocs.some(d => d.status === 'REJECTED')
        const anyPending = relevantDocs.some(d => d.status === 'PENDING' || d.status === 'AUTO_VERIFIED')

        if (allApproved) {
          documentStatus = 'APPROVED'
          documentApprovalStatus = 'APPROVED'
        } else if (anyRejected) {
          documentStatus = 'REJECTED'
          documentApprovalStatus = 'REJECTED'
        } else if (anyPending) {
          documentStatus = 'PENDING'
          documentApprovalStatus = 'PENDING'
        }
      }

      // Calculate completion percentage
      let completion = 0
      let steps = []

      // Step 1: Personal Information (20%)
      if (hasProfile) {
        const p = profile[0]
        const personalInfoComplete = p.date_of_birth && p.nationality && p.country_of_residence && p.address_line1
        if (personalInfoComplete) {
          completion += 20
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

        // Step 2: Contact Information (15%) - NEW
        const contactComplete = p.primary_phone_country_code && p.primary_phone_number
        if (contactComplete) {
          completion += 15
          steps.push({ 
            name: 'Contact Information', 
            completed: true,
            details: 'Primary phone provided'
          })
        } else {
          steps.push({ 
            name: 'Contact Information', 
            completed: false,
            details: 'Phone number required'
          })
        }

        // Step 3: Financial Information (25%)
        const financialInfoComplete = p.employment_status && p.annual_income > 0 && p.source_of_funds
        if (financialInfoComplete) {
          completion += 25
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

        // Step 4: Experience & Purpose (10%)
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
        steps.push({ name: 'Personal Information', completed: false, details: 'Not started' })
        steps.push({ name: 'Contact Information', completed: false, details: 'Not started' })
        steps.push({ name: 'Financial Information', completed: false, details: 'Not started' })
        steps.push({ name: 'Experience & Purpose', completed: false, details: 'Not started' })
      }

      // Step 5: ID Document (30%) - Enhanced with side tracking
      let idCompletion = 0
      if (hasPassport) {
        idCompletion = 30
        if (documentApprovalStatus === 'APPROVED') {
          steps.push({ 
            name: 'ID Verification (Passport)', 
            completed: true, 
            status: 'APPROVED',
            details: 'Passport verified'
          })
        } else {
          steps.push({ 
            name: 'ID Verification (Passport)', 
            completed: true, 
            status: documentApprovalStatus,
            details: 'Passport submitted'
          })
        }
        completion += idCompletion
      } else if (hasCompleteNationalId) {
        idCompletion = 30
        if (documentApprovalStatus === 'APPROVED') {
          steps.push({ 
            name: 'ID Verification (National ID)', 
            completed: true, 
            status: 'APPROVED',
            details: 'Both sides verified'
          })
        } else {
          steps.push({ 
            name: 'ID Verification (National ID)', 
            completed: true, 
            status: documentApprovalStatus,
            details: 'Both sides submitted'
          })
        }
        completion += idCompletion
      } else {
        if (hasNationalIdFront && !hasNationalIdBack) {
          completion += 15
          steps.push({ 
            name: 'ID Verification (Front Only)', 
            completed: true,
            details: 'Please upload back side'
          })
        } else if (hasNationalIdBack && !hasNationalIdFront) {
          completion += 15
          steps.push({ 
            name: 'ID Verification (Back Only)', 
            completed: true,
            details: 'Please upload front side'
          })
        } else {
          steps.push({ 
            name: 'ID Verification', 
            completed: false,
            details: 'Upload your ID'
          })
        }
      }

      const canTrade = completion >= 100 && profileStatus === 'APPROVED' && documentApprovalStatus === 'APPROVED'
      const canDeposit = completion >= 70 && documentStatus !== 'REJECTED'

      return {
        completion: Math.min(completion, 100),
        steps,
        profileStatus,
        documentStatus,
        documentDetails: {
          hasPassport,
          hasNationalIdFront,
          hasNationalIdBack,
          hasCompleteNationalId
        },
        canTrade,
        canDeposit,
        nextAction: !hasProfile ? 'fill_profile' : 
                   !profile[0]?.primary_phone_number ? 'add_phone' :
                   !hasPassport && !hasNationalIdFront ? 'upload_id_front' :
                   !hasPassport && hasNationalIdFront && !hasNationalIdBack ? 'upload_id_back' :
                   profileStatus === 'DRAFT' ? 'submit_profile' :
                   'wait_for_approval'
      }
    } catch (error) {
      console.error('Error getting completion status:', error)
      throw new Error('Failed to get completion status: ' + error.message)
    }
  }

  // ENHANCED: Validate profile data with phone validation
  validateProfileData(data) {
    const errors = []

    // Required personal information
    if (!data.date_of_birth) errors.push('Date of birth is required')
    if (!data.nationality) errors.push('Nationality is required')
    if (!data.country_of_residence) errors.push('Country of residence is required')
    if (!data.address_line1) errors.push('Address is required')
    if (!data.city) errors.push('City is required')
    if (!data.postal_code) errors.push('Postal code is required')

    // Phone validation
    if (!data.primary_phone_country_code) {
      errors.push('Phone country code is required')
    }
    if (!data.primary_phone_number) {
      errors.push('Phone number is required')
    } else if (data.primary_phone_country_code) {
      // Will be validated in saveProfile
    }

    // Validate date of birth (must be at least 18 years old)
    if (data.date_of_birth) {
      const dob = new Date(data.date_of_birth)
      const today = new Date()
      let age = today.getFullYear() - dob.getFullYear()
      const monthDiff = today.getMonth() - dob.getMonth()

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age = age - 1
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
      const [documents] = await db.promise().query(
        `SELECT extracted_data, document_type, document_side
         FROM kyc_documents 
         WHERE user_id = ? AND extracted_data IS NOT NULL
         ORDER BY 
           CASE document_side
             WHEN 'front' THEN 1
             WHEN 'single' THEN 2
             ELSE 3
           END,
           created_at DESC`,
        [userId]
      )

      if (documents.length === 0) {
        return { success: false, message: 'No KYC document with extracted data found' }
      }

      const suggestions = {}
      let bestDocument = null

      // Merge data from multiple documents, prioritizing front/single
      for (const doc of documents) {
        const extractedData = JSON.parse(doc.extracted_data)

        if (doc.document_side === 'front' || doc.document_side === 'single') {
          bestDocument = doc
        }

        // Personal information suggestions
        if (extractedData.first_name && !suggestions.first_name) 
          suggestions.first_name = extractedData.first_name
        if (extractedData.last_name && !suggestions.last_name) 
          suggestions.last_name = extractedData.last_name
        if (extractedData.date_of_birth && !suggestions.date_of_birth) 
          suggestions.date_of_birth = extractedData.date_of_birth
        if (extractedData.place_of_birth && !suggestions.place_of_birth) 
          suggestions.place_of_birth = extractedData.place_of_birth
        if (extractedData.gender && !suggestions.gender) 
          suggestions.gender = extractedData.gender
        if (extractedData.nationality && !suggestions.nationality) {
          suggestions.nationality = extractedData.nationality
          suggestions.country_of_residence = extractedData.nationality
        }
      }

      return {
        success: true,
        suggestions,
        document_type: bestDocument?.document_type,
        document_side: bestDocument?.document_side,
        source: 'ocr_extraction',
        confidence: 'medium'
      }

    } catch (error) {
      console.error('Error getting auto-fill suggestions:', error)
      return { success: false, message: 'Failed to get suggestions' }
    }
  }
}

module.exports = new KYCProfileService()