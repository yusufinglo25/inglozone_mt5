# backend Inglozone trade web application

## Completed Work Areas

1. Authentication and Access
- User registration and login are implemented.
- OTP-based signup verification flow is implemented.
- Google OAuth flow is integrated.
- JWT-based protected access is implemented.

2. User Profile
- Profile completion endpoints are implemented.
- Password policy validation is enforced.

3. Wallet and Transactions
- Wallet creation and balance retrieval are implemented.
- Deposit flow is integrated with Stripe checkout and verification.
- Transaction history and transaction detail retrieval are implemented.
- KYC-based deposit control is implemented:
  - Non-approved users are restricted to a capped deposit exposure.
  - Approved users operate without the deposit cap.

4. KYC Workflow
- KYC document upload (front/passport) is implemented.
- KYC back-side document upload for national ID is implemented.
- KYC status, completeness check, and country-code support endpoints are implemented.
- KYC profile submission and admin review operations are implemented.

5. API Documentation
- Swagger/OpenAPI documentation is integrated.
- Form-based request inputs are documented for key authentication, profile, and wallet endpoints.
- Multipart upload documentation is available for KYC file endpoints.

6. Platform and Operations
- Route-level middleware protection is configured.
- Database migration scripts are included.
- Health check and core service bootstrap are available.

## Current Delivery Status

Backend core modules are implemented and operational under the current project structure.
