# NfinityHQ Backend

## Problem

The portal needed a server to handle accounts, team permissions, password resets, leads, and uploads. Those operations could not safely depend on whatever the browser sent, especially when users from different companies share the same application.

I also needed email, alerts, and file storage without putting provider credentials in the frontend. For this version, I wanted local development to stay manageable without setting up a separate database service.

## Solution

I built an Express API that checks the signed-in account, its company, and its role before allowing protected changes. It handles account login and password resets, manages company team members, accepts lead submissions, and validates file uploads. The same server can serve the sibling frontend during development.

Records are stored in local JSON files, while notification and production file-storage integrations run on the server. Configuration comes from environment variables, so the public source includes the integration code and setup names without including live keys, accounts, or customer files.

## Stack and Explanation

| Source or service | Stack | What it does and why |
| --- | --- | --- |
| `server.js`, `api/` | Node.js, Express | Sets up routing, static serving, request handling, errors, and shutdown in the same language as the frontend. |
| `core/auth/` | bcryptjs, jsonwebtoken, Node crypto | Hashes passwords, signs sessions, checks permissions, and manages resets and audit records. Company identity comes from the authenticated account. |
| `core/storage/` | JSON, Node filesystem APIs | Keeps local setup small. Atomic replacement protects the main stores from partially written files, with one writer process. |
| `core/uploads/` | Multer, AWS SDK for JavaScript | Validates multipart files and separates their bytes from metadata. Development uses local disk; production uses the S3 API. |
| Email | Resend API | Sends password resets, invitations, and lead notifications without exposing the email key to the browser. |
| Alerts | Telegram Bot API | Sends optional lead alerts to a privately configured chat. |
| `.env.example` | dotenv, environment variables | Documents supported settings while actual secrets remain in local or deployment configuration. |
| `scripts/` and root `tests/` | JavaScript, Node's test runner | Creates company accounts manually and verifies API permissions, input errors, uploads, and storage behavior. |

| API route | Responsibility |
| --- | --- |
| `GET /healthz` | Process health |
| `POST /api/auth/login` | Authenticate an existing account |
| `POST /api/auth/forgot-password` | Request a password-reset email |
| `GET /api/auth/reset-password` | Check a reset token |
| `POST /api/auth/reset-password` | Consume a reset token |
| `PATCH /api/auth/users/:userId/password` | Change a password with authorization |
| `/api/team` and its member routes | List, create, update, reset, and disable company members |
| `POST /api/submit-lead` | Validate and save a lead before optional notifications |
| `POST /api/uploads` | Accept a multipart file under the `file` field |

A login returns a JWT. Protected routes verify it, reload the account, and check current permissions. Uploads are checked before their bytes and metadata are saved. Browser demo tasks and reporting screens do not have shared server APIs in this version.

From this folder, use Node.js 22 or newer:

```powershell
npm ci
Copy-Item .env.example .env
npm start
```

The development listener is `127.0.0.1:3000`. `npm run client:create` creates a company owner/admin; team management adds employees after login. Production needs a strong `JWT_SECRET`, allowed frontend origins, persistent data paths, and private service configuration. AWS credentials come from the SDK's provider chain. See [.env.example](.env.example) for supported names.

Run `npm test` from the repository root for API and storage checks. Local login, company isolation, disabled accounts, uploads, malformed bodies, and corrupt storage were tested. Live email, Telegram, S3, and deployment were not. JSON files require a single writer process; PostgreSQL, public registration, and a browser file-download endpoint are not implemented. See the [project README](../README.md), [deployment guide](docs/ELASTIC_BEANSTALK_LAUNCH.md), and [onboarding guide](docs/FIRST_CLIENT_ONBOARDING.md) for the wider setup.
