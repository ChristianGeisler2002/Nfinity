# NfinityHQ frontend

The frontend contains the public pages, account screens, and interactive business operations demo. It uses HTML, CSS, and vanilla JavaScript. The older JSX files are retained prototypes and are not needed to build or run the active interface.

I keep the frontend as static HTML, CSS, and JavaScript so it can run behind Express or on static hosting. Node.js is only needed for the build and preview scripts. Browser `fetch` calls the Express account, team, lead, and upload routes; the guest demo uses browser-local sample records. No provider credentials belong here.

From this directory:

```powershell
npm ci
$env:NFINITY_API_BASE_URL = "http://127.0.0.1:3000"
npm run build
npm run preview
```

Open `http://127.0.0.1:4173`. For integrated local development, run `npm start` from the repository root instead; the backend serves these same source assets.

Production builds require `NFINITY_API_BASE_URL` to be the backend HTTPS origin. The generated runtime configuration contains only a public URL. API credentials stay on the backend.

`public/` holds the homepage, login/reset pages, and shared styles. `apps/demo/` contains the workspace HTML, JavaScript, and styles. `core/` contains browser API helpers and scenario simulations. `scripts/` builds and previews the static artifact in `dist/`.

The guest workspace uses demonstration data. Tasks and file previews are stored locally in the browser; company team management uses the API after a real account signs in. See the [main README](../README.md) for architecture, workflows, configuration, and verification limits.
