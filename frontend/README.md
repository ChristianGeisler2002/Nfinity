# NfinityHQ Frontend

## Problem

I wanted the public pages and operations workspace to feel like parts of the same project. Users needed a clear way to move between account screens, tasks, team members, and the other workspace views without learning a different layout for each one.

The frontend also needed to work as a public demo without depending on private company data. I wanted to keep deployment simple while still leaving room for the screens that connect to the real API.

## Solution

I built the active frontend with HTML, CSS, and vanilla JavaScript. Public pages handle the homepage and account flows, while the demo workspace brings the operations screens together with shared navigation and styling.

Guests use fictional records and browser-local changes. Signed-in account and team screens connect to the Express backend. The same frontend can be served directly by that backend or built into static files for separate hosting.

![NfinityHQ frontend dashboard using demonstration data](../docs/screenshots/dashboard.jpg)

## Stack and Explanation

| Source | Stack | What it does and why |
| --- | --- | --- |
| `public/` | HTML, CSS, JavaScript | Public, login, and reset pages plus shared browser behavior. Plain files can be served without a frontend framework runtime. |
| `apps/demo/` | HTML, JavaScript, CSS | The active workspace lives in its page, `demo.js`, and `demo.css`, keeping its behavior and styling easy to find. |
| `core/` | JavaScript, browser fetch | API helpers and scenario simulations separate server requests from demo behavior. |
| `client_configs/` | JSON | Holds demonstration branding and module settings separately from page code. |
| Browser storage | localStorage | Keeps demo changes on the current browser. Existing authenticated flows also retain bearer tokens here. |
| `scripts/` | Node.js | Copies assets, writes public runtime configuration, and serves a local preview. The active build does not need React; JSX files are older prototypes. |

Account and team requests go to the Express API. Resend, Telegram, and S3 credentials stay on the backend. Tasks, CRM, analytics, and file previews are demonstrations; the demo upload screen stores metadata and is not connected to the file-upload API.

From this folder, use Node.js 22 or newer:

```powershell
npm ci
$env:NFINITY_API_BASE_URL = "http://127.0.0.1:3000"
npm run build
npm run preview
```

The build writes `dist/`, and the preview runs at `http://127.0.0.1:4173`. Add that origin to the backend's `ALLOWED_ORIGINS`. Production builds require an HTTPS API origin; the generated configuration contains only that public URL, never service keys. For integrated development, run `npm start` from the repository root.

Root `npm run check` parses browser scripts, and `npm test` checks the API/storage side. Browser verification covered navigation, task persistence, modals, and smaller layouts. See the [project README](../README.md) for the full stack and current demo limits, and the [deployment guide](docs/AMPLIFY_LAUNCH.md) for static hosting.
