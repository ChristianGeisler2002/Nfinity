# NfinityHQ

## Problem

Business work can get spread across task lists, spreadsheets, email, and separate account tools. I wanted to bring the main pieces into one workspace so it was easier to see what needed attention and move between tasks, people, and client activity.

I also wanted a way to demonstrate the idea without putting real customer accounts or business records online. That meant keeping the public demo separate from the backend features that need authentication or private service credentials.

## Solution

I built NfinityHQ as a client portal with an interactive operations demo and an Express API. The workspace brings together tasks, team members, CRM views, uploads, alerts, and reporting screens. The API handles real account login, password resets, company-scoped team management, lead intake, and file uploads.

The guest workspace uses sample data and browser-local changes. Tasks, CRM activity, analytics, automation, and file previews are demo features; the demo upload screen does not send file bytes to the upload API. Keeping those boundaries clear lets someone explore the project without accessing a real company workspace.

![NfinityHQ operations dashboard with demonstration data](docs/screenshots/dashboard.jpg)

![NfinityHQ task screen with sample work](docs/screenshots/tasks.jpg)

## Stack and Explanation

| Part of the source | Stack | What it does and why |
| --- | --- | --- |
| `frontend/public/` | HTML, CSS, JavaScript | Holds public pages, login, password reset, and shared UI behavior. Static files keep the active frontend straightforward to host. |
| `frontend/apps/demo/` | HTML, CSS, vanilla JavaScript | Implements the workspace, navigation, forms, and sample workflows. Older JSX files are reference prototypes, not a required React build. |
| `frontend/core/`, `frontend/client_configs/` | JavaScript, JSON, browser fetch/localStorage | Provides API helpers, scenario simulations, and demo configuration. The browser can try the workspace independently of live accounts. |
| `backend/server.js`, `backend/api/` | Node.js, Express | Sets up HTTP routes, static serving, errors, and shutdown. JavaScript is shared across the frontend and backend. |
| `backend/core/auth/` | bcryptjs, jsonwebtoken, Node crypto | Hashes passwords, signs sessions, checks account roles, and manages reset tokens. Company permissions are enforced on the server. |
| `backend/core/storage/` | JSON files, Node filesystem APIs | Stores accounts and application records with atomic replacement for the main stores. This keeps local setup small, with a single writer process. |
| Email and alerts | Resend API, Telegram Bot API | Sends invitations, resets, and optional lead notifications from the backend. |
| `backend/core/uploads/` | Multer, AWS SDK for JavaScript, Amazon S3 API | Validates multipart uploads and stores bytes locally in development or in S3 in production. |
| Environment configuration | dotenv, environment variables | Keeps service credentials, signing secrets, and private storage paths outside browser assets and Git. |
| Build scripts and `tests/` | Node scripts, Node's test runner | Builds the static frontend and checks syntax, authentication, company isolation, uploads, and storage behavior. |

The main languages are JavaScript, HTML, and CSS, with JSON for configuration and local records. A login returns a JWT; protected requests send it as a Bearer token. The API reloads the account and checks company and role before allowing changes. Lead submissions save before optional notifications, and uploaded file bytes are stored separately from their metadata. The [backend README](backend/README.md) lists the routes.

For local development, use Node.js 22 or newer:

```powershell
npm ci --prefix backend
Copy-Item backend/.env.example backend/.env
npm start
```

Open `http://127.0.0.1:3000`, or `/apps/demo/` for the guest workspace. Run `npm run client:create` from `backend/` to create a local company owner/admin. Team members are then managed through the signed-in API; there is no public signup.

The [environment example](backend/.env.example) documents `JWT_SECRET`, allowed origins, Resend, Telegram, S3, and storage settings. External services are optional for local demo use. Production requires a strong signing secret, persistent storage, and private credentials. Only `NFINITY_API_BASE_URL`, a public backend origin, is included in a static frontend build:

```powershell
npm ci --prefix frontend
$env:NFINITY_API_BASE_URL = "http://127.0.0.1:3000"
npm run build
npm run preview
npm run check
npm test
```

The preview uses `http://127.0.0.1:4173`; allow that origin in the backend. Production builds require an HTTPS API origin. See the [frontend README](frontend/README.md), [frontend deployment guide](frontend/docs/AMPLIFY_LAUNCH.md), [backend deployment guide](backend/docs/ELASTIC_BEANSTALK_LAUNCH.md), and [onboarding guide](backend/docs/FIRST_CLIENT_ONBOARDING.md) for details.

JSON storage is intended for one server process, and sessions currently use localStorage bearer tokens. Shared production storage and stronger session handling remain future work. Local API/storage tests and browser flows were verified; live Resend delivery, Telegram messages, S3 uploads, and cloud deployment were not. Private records, credentials, uploads, and dependency folders are excluded from the public source.
