# Onboard a company

1. Configure a persistent user store and back it up.
2. From `backend`, run `npm run client:create` and provide the company, owner email, display name, and initial owner/admin role.
3. Deliver the one-time temporary password securely. Do not paste it into source, issues, or logs.
4. Have the owner sign in and choose a new password.
5. Add employees from Team Members. Company and role checks are enforced by the API.

Invitation email is optional. If Resend is unconfigured or fails, the interface reports the result and shows the temporary password for manual delivery. It does not store plaintext passwords in the JSON account file.

The public guest demo is separate from company accounts. Its local team records do not create real logins.
