// FRONTEND RUNTIME CONFIG  —  SET THIS BEFORE YOU DEPLOY THE FRONTEND
// The frontend (AWS Amplify) and backend (AWS Elastic Beanstalk) are hosted on
// SEPARATE origins. The browser must know where the backend lives so it can send
// API calls (/api/auth, /api/team, /api/uploads, /api/submit-lead) to it.
//
// Amplify replaces the deployed copy during `npm run build` using the
// NFINITY_API_BASE_URL environment variable.
//
// Use the public origin of the Elastic Beanstalk backend (its custom domain or
// the *.elasticbeanstalk.com URL). Do NOT include a path or a trailing slash.
// Never hardcode localhost here.
// ----------------------------------------------------------------------------
window.NFINITY_API_BASE_URL = "";
