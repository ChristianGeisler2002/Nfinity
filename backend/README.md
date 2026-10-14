# NfinityHQ API

The API handles existing-account login, password resets, company team management, lead intake, and uploads. The integrated server serves the sibling `frontend` directory.

From this directory, run `npm ci`, copy `.env.example` to `.env`, and run `npm start`. The development listener uses `127.0.0.1:3000`. `npm run client:create` creates a local company owner or admin; employee accounts are added through the authenticated team API.

| Route | Purpose |
| --- | --- |
| `GET /healthz` | Process health |
| `POST /api/auth/login` | Authenticate an onboarded account |
| `POST /api/auth/forgot-password` | Request a reset email |
| `GET /api/auth/reset-password` | Check a reset token |
| `POST /api/auth/reset-password` | Consume a reset token |
| `PATCH /api/auth/users/:userId/password` | Authorized password change |
| `/api/team` | Company-scoped listing and management |
| `POST /api/submit-lead` | Validate and save a contact request |
| `POST /api/uploads` | Multipart upload under the `file` field |

Data uses local JSON files. Configure persistent paths before deployment and keep one writer process. Production uploads use S3; notifications use Resend and optionally Telegram. A production JWT secret is required at startup. No public registration, task API, PostgreSQL store, or browser download endpoint is implemented in this version.

See the [main README](../README.md) for architecture, frontend hosting, configuration, test commands, and verification limits.
