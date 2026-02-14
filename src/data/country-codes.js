// src/data/country-codes.js
// Comprehensive list of country phone codes with validation rules

const countryCodes = [
  { country: 'Afghanistan', code: '+93', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Albania', code: '+355', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Algeria', code: '+213', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Andorra', code: '+376', regex: '^[0-9]{6,9}$', minLength: 6, maxLength: 9 },
  { country: 'Angola', code: '+244', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Argentina', code: '+54', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'Armenia', code: '+374', regex: '^[0-9]{8}$', minLength: 8, maxLength: 8 },
  { country: 'Australia', code: '+61', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Austria', code: '+43', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'Azerbaijan', code: '+994', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Bahrain', code: '+973', regex: '^[0-9]{8}$', minLength: 8, maxLength: 8 },
  { country: 'Bangladesh', code: '+880', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'Belarus', code: '+375', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Belgium', code: '+32', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Brazil', code: '+55', regex: '^[0-9]{10,11}$', minLength: 10, maxLength: 11 },
  { country: 'Bulgaria', code: '+359', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Canada', code: '+1', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'Chile', code: '+56', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'China', code: '+86', regex: '^[0-9]{11}$', minLength: 11, maxLength: 11 },
  { country: 'Colombia', code: '+57', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'Croatia', code: '+385', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Cyprus', code: '+357', regex: '^[0-9]{8}$', minLength: 8, maxLength: 8 },
  { country: 'Czech Republic', code: '+420', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Denmark', code: '+45', regex: '^[0-9]{8}$', minLength: 8, maxLength: 8 },
  { country: 'Egypt', code: '+20', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'Estonia', code: '+372', regex: '^[0-9]{7,8}$', minLength: 7, maxLength: 8 },
  { country: 'Finland', code: '+358', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'France', code: '+33', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Georgia', code: '+995', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Germany', code: '+49', regex: '^[0-9]{10,11}$', minLength: 10, maxLength: 11 },
  { country: 'Ghana', code: '+233', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Greece', code: '+30', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'Hong Kong', code: '+852', regex: '^[0-9]{8}$', minLength: 8, maxLength: 8 },
  { country: 'Hungary', code: '+36', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Iceland', code: '+354', regex: '^[0-9]{7}$', minLength: 7, maxLength: 7 },
  { country: 'India', code: '+91', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'Indonesia', code: '+62', regex: '^[0-9]{9,12}$', minLength: 9, maxLength: 12 },
  { country: 'Iran', code: '+98', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'Iraq', code: '+964', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'Ireland', code: '+353', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Israel', code: '+972', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Italy', code: '+39', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'Japan', code: '+81', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'Jordan', code: '+962', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Kazakhstan', code: '+7', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'Kenya', code: '+254', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Kuwait', code: '+965', regex: '^[0-9]{8}$', minLength: 8, maxLength: 8 },
  { country: 'Latvia', code: '+371', regex: '^[0-9]{8}$', minLength: 8, maxLength: 8 },
  { country: 'Lebanon', code: '+961', regex: '^[0-9]{8}$', minLength: 8, maxLength: 8 },
  { country: 'Lithuania', code: '+370', regex: '^[0-9]{8}$', minLength: 8, maxLength: 8 },
  { country: 'Luxembourg', code: '+352', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Malaysia', code: '+60', regex: '^[0-9]{9,10}$', minLength: 9, maxLength: 10 },
  { country: 'Maldives', code: '+960', regex: '^[0-9]{7}$', minLength: 7, maxLength: 7 },
  { country: 'Malta', code: '+356', regex: '^[0-9]{8}$', minLength: 8, maxLength: 8 },
  { country: 'Mexico', code: '+52', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'Monaco', code: '+377', regex: '^[0-9]{8,9}$', minLength: 8, maxLength: 9 },
  { country: 'Mongolia', code: '+976', regex: '^[0-9]{8}$', minLength: 8, maxLength: 8 },
  { country: 'Morocco', code: '+212', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Nepal', code: '+977', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'Netherlands', code: '+31', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'New Zealand', code: '+64', regex: '^[0-9]{8,10}$', minLength: 8, maxLength: 10 },
  { country: 'Nigeria', code: '+234', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'North Macedonia', code: '+389', regex: '^[0-9]{8}$', minLength: 8, maxLength: 8 },
  { country: 'Norway', code: '+47', regex: '^[0-9]{8}$', minLength: 8, maxLength: 8 },
  { country: 'Oman', code: '+968', regex: '^[0-9]{8}$', minLength: 8, maxLength: 8 },
  { country: 'Pakistan', code: '+92', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'Palestine', code: '+970', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Peru', code: '+51', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Philippines', code: '+63', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'Poland', code: '+48', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Portugal', code: '+351', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Qatar', code: '+974', regex: '^[0-9]{8}$', minLength: 8, maxLength: 8 },
  { country: 'Romania', code: '+40', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Russia', code: '+7', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'Saudi Arabia', code: '+966', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Serbia', code: '+381', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Singapore', code: '+65', regex: '^[0-9]{8}$', minLength: 8, maxLength: 8 },
  { country: 'Slovakia', code: '+421', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Slovenia', code: '+386', regex: '^[0-9]{8}$', minLength: 8, maxLength: 8 },
  { country: 'South Africa', code: '+27', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'South Korea', code: '+82', regex: '^[0-9]{9,10}$', minLength: 9, maxLength: 10 },
  { country: 'Spain', code: '+34', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Sri Lanka', code: '+94', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Sweden', code: '+46', regex: '^[0-9]{9,10}$', minLength: 9, maxLength: 10 },
  { country: 'Switzerland', code: '+41', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Taiwan', code: '+886', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Tanzania', code: '+255', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Thailand', code: '+66', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Tunisia', code: '+216', regex: '^[0-9]{8}$', minLength: 8, maxLength: 8 },
  { country: 'Turkey', code: '+90', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'Uganda', code: '+256', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Ukraine', code: '+380', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'United Arab Emirates', code: '+971', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'United Kingdom', code: '+44', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'United States', code: '+1', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'Uruguay', code: '+598', regex: '^[0-9]{8}$', minLength: 8, maxLength: 8 },
  { country: 'Uzbekistan', code: '+998', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Vatican City', code: '+39', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'Venezuela', code: '+58', regex: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
  { country: 'Vietnam', code: '+84', regex: '^[0-9]{9,10}$', minLength: 9, maxLength: 10 },
  { country: 'Yemen', code: '+967', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Zambia', code: '+260', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 },
  { country: 'Zimbabwe', code: '+263', regex: '^[0-9]{9}$', minLength: 9, maxLength: 9 }
];

// Helper functions
const getCountryByCode = (code) => {
  return countryCodes.find(c => c.code === code);
};

const getCountryByCountryName = (countryName) => {
  return countryCodes.find(c => 
    c.country.toLowerCase() === countryName.toLowerCase() ||
    c.country.includes(countryName)
  );
};

const validatePhoneNumber = (countryCode, phoneNumber) => {
  const country = getCountryByCode(countryCode);
  if (!country) return { valid: false, message: 'Invalid country code' };
  
  // Remove any non-digit characters
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  
  if (cleanNumber.length < country.minLength || cleanNumber.length > country.maxLength) {
    return { 
      valid: false, 
      message: `Phone number must be between ${country.minLength} and ${country.maxLength} digits for ${country.country}` 
    };
  }
  
  const regex = new RegExp(country.regex);
  if (!regex.test(cleanNumber)) {
    return { valid: false, message: `Invalid phone number format for ${country.country}` };
  }
  
  return { valid: true, country };
};

const formatPhoneNumber = (countryCode, phoneNumber) => {
  const country = getCountryByCode(countryCode);
  if (!country) return phoneNumber;
  
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  return `${countryCode} ${cleanNumber}`;
};

module.exports = {
  countryCodes,
  getCountryByCode,
  getCountryByCountryName,
  validatePhoneNumber,
  formatPhoneNumber
};