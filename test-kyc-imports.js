// test-final-kyc.js
console.log('Final KYC System Test\n')

console.log('1. Environment Variables:')
console.log('   JWT_SECRET:', process.env.JWT_SECRET ? '✓ Set' : '✗ Missing - Add to .env')
console.log('   NODE_ENV:', process.env.NODE_ENV || 'Not set')
console.log('   KYC_ENCRYPTION_KEY:', process.env.KYC_ENCRYPTION_KEY ? '✓ Set' : '✗ Missing - Add to .env')

console.log('\n2. Testing KYC Service Instance:')
try {
  const kycService = require('./src/services/kyc.service')
  console.log('   ✓ KYC Service loaded')
  console.log('   Methods available:', Object.getOwnPropertyNames(Object.getPrototypeOf(kycService)).filter(m => m !== 'constructor'))
} catch (error) {
  console.log('   ✗ KYC Service error:', error.message)
}

console.log('\n3. Testing Route Import:')
try {
  const kycRoutes = require('./src/routes/kyc.routes')
  console.log('   ✓ KYC Routes loaded')
} catch (error) {
  console.log('   ✗ KYC Routes error:', error.message)
}

console.log('\n4. Quick Environment Setup:')
console.log('   Add to your .env file:')
console.log('   JWT_SECRET=your-super-secret-jwt-key-here')
console.log('   KYC_ENCRYPTION_KEY=32-characters-long-encryption-key')
console.log('   NODE_ENV=development')

console.log('\n✅ Test Complete')
console.log('\nNext steps:')
console.log('1. Update your .env file with the variables above')
console.log('2. Run: npm run dev')
console.log('3. Test with: curl http://localhost:4000/api/kyc/status')