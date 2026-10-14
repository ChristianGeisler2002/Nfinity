# NfinityHQ API

The API handles existing-account login, password resets, company team management, lead intake, and uploads. The integrated server serves the sibling `frontend` directory.

I use Node.js and Express for the HTTP routes, bcryptjs for password hashes, and jsonwebtoken for signed sessions. Multer handles multipart uploads, dotenv reads local configuration, Resend sends email, Telegram receives optional alerts, and the AWS S3 SDK handles production file storage. JSON files keep the local version easy to run, with atomic replacement for the main stores. Keep this version on one writer process.

All service keys and private chat IDs come from environment variables. The source includes configuration names in `.env.example`, with no live credentials or account data. External integration code stays here rather than in browser assets.

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
