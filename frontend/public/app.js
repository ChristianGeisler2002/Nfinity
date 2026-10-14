/* ═══════════════════════════════════════════════════════
   NfinityHQ — app.js
   Galaxy canvas · Header · Form auth · Portal init
   ═══════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────
   UTILITY
───────────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);
const rand = (a, b) => Math.random() * (b - a) + a;

function scrollTo(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ─────────────────────────────────────────────────────
   GALAXY CANVAS — deep blue night sky
───────────────────────────────────────────────────── */
(function initGalaxy() {
  const canvas = $('galaxy');
  if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d');
  let W, H, stars, dust, bands, raf;

  function build() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;

    /* Stars — 4 tiers, night-sky palette */
    const n = Math.floor((W * H) / 820);
    stars = Array.from({ length: n }, () => {
      const tier = Math.random();
      const roll = Math.random();

      const color =
        roll > 0.88 ? 'rgba(255,255,255,'     // pure white
      : roll > 0.72 ? 'rgba(210,228,255,'     // blue-white
      : roll > 0.54 ? 'rgba(180,210,255,'     // icy blue
      : roll > 0.38 ? 'rgba(220,235,255,'     // cold white
      : roll > 0.20 ? 'rgba(200,215,255,'     // steel blue-white
      :               'rgba(230,220,255,';    // faint violet-white

      const halo = roll > 0.72 ? 'rgba(180,210,255,' : 'rgba(210,230,255,';

      return {
        x: rand(0, W), y: rand(0, H),
        r:     tier > 0.972 ? rand(2.2, 3.6)
             : tier > 0.88  ? rand(1.0, 2.1)
             : tier > 0.60  ? rand(0.4, 1.0)
             :                rand(0.15, 0.5),
        alpha: tier > 0.972 ? rand(0.92, 1.0)
             : tier > 0.88  ? rand(0.65, 0.95)
             : tier > 0.60  ? rand(0.35, 0.75)
             :                rand(0.18, 0.50),
        speed: rand(0.00004, 0.00025),
        phase: rand(0, Math.PI * 2),
        tier, color, halo,
      };
    });

    /* Nebula dust — deep blue/indigo only */
    dust = Array.from({ length: 9 }, () => ({
      x:     rand(0, W), y:   rand(0, H),
      rx:    rand(120, 340), ry: rand(60, 170),
      rot:   rand(0, Math.PI),
      alpha: rand(0.018, 0.052),
      hue:   ['20,60,180','10,40,140','30,80,200','15,50,160','40,100,220'][Math.floor(rand(0, 5))],
    }));

    /* Milky-way arc bands */
    bands = [
      { x: W*0.5, y: H*0.42, w: W*1.1, h: 130, angle: -0.18, alpha: 0.016, hue: '12,35,120' },
      { x: W*0.4, y: H*0.55, w: W*0.8, h:  70, angle:  0.08, alpha: 0.010, hue: '8,25,90'   },
    ];
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);

    /* Sky depth gradient */
    const sky = ctx.createRadialGradient(W*0.3, H*0.15, 0, W*0.5, H*0.5, Math.max(W, H)*0.95);
    sky.addColorStop(0,    'rgba(6,22,100,0.14)');
    sky.addColorStop(0.35, 'rgba(3,12,55,0.08)');
    sky.addColorStop(0.7,  'rgba(1,5,20,0.04)');
    sky.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    /* Bands */
    bands.forEach(b => {
      ctx.save();
      ctx.translate(b.x, b.y); ctx.rotate(b.angle);
      const g = ctx.createLinearGradient(-b.w/2, 0, b.w/2, 0);
      g.addColorStop(0,    `rgba(${b.hue},0)`);
      g.addColorStop(0.25, `rgba(${b.hue},${b.alpha})`);
      g.addColorStop(0.5,  `rgba(${b.hue},${b.alpha * 2.2})`);
      g.addColorStop(0.75, `rgba(${b.hue},${b.alpha})`);
      g.addColorStop(1,    `rgba(${b.hue},0)`);
      ctx.filter = 'blur(18px)';
      ctx.fillStyle = g;
      ctx.fillRect(-b.w/2, -b.h/2, b.w, b.h);
      ctx.restore();
    });

    /* Dust */
    dust.forEach(d => {
      ctx.save();
      ctx.translate(d.x, d.y); ctx.rotate(d.rot);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, d.rx);
      g.addColorStop(0,    `rgba(${d.hue},${d.alpha})`);
      g.addColorStop(0.45, `rgba(${d.hue},${(d.alpha * 0.38).toFixed(4)})`);
      g.addColorStop(1,    `rgba(${d.hue},0)`);
      ctx.scale(1, d.ry / d.rx);
      ctx.beginPath(); ctx.arc(0, 0, d.rx, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
      ctx.restore();
    });

    /* Stars */
    stars.forEach(s => {
      const tw = 0.78 + 0.22 * Math.sin(t * s.speed * 1000 + s.phase);
      const a  = Math.min(1, s.alpha * tw);

      if (s.tier > 0.972) {
        /* Hero: wide atmospheric halo */
        const g1 = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 11);
        g1.addColorStop(0,    `${s.halo}${(a * 0.18).toFixed(3)})`);
        g1.addColorStop(0.35, `${s.halo}${(a * 0.08).toFixed(3)})`);
        g1.addColorStop(1,    `${s.halo}0)`);
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 11, 0, Math.PI * 2);
        ctx.fillStyle = g1; ctx.fill();

        /* Inner tight halo */
        const g2 = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 3.5);
        g2.addColorStop(0,   `rgba(255,255,255,${(a * 0.9).toFixed(3)})`);
        g2.addColorStop(0.3, `${s.color}${(a * 0.55).toFixed(3)})`);
        g2.addColorStop(1,   `${s.color}0)`);
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = g2; ctx.fill();

      } else if (s.tier > 0.88) {
        /* Mid: diffuse halo */
        const gm = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4.5);
        gm.addColorStop(0, `${s.color}${(a * 0.4).toFixed(3)})`);
        gm.addColorStop(1, `${s.color}0)`);
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 4.5, 0, Math.PI * 2);
        ctx.fillStyle = gm; ctx.fill();
      }

      /* White-hot core on bright stars */
      if (s.tier > 0.88) {
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1, a * 1.1).toFixed(3)})`; ctx.fill();
      }

      /* Star body */
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `${s.color}${a.toFixed(3)})`; ctx.fill();
    });

    raf = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => { build(); });
  build();
  raf = requestAnimationFrame(draw);
})();

/* ─────────────────────────────────────────────────────
   HEADER — scroll state
───────────────────────────────────────────────────── */
(function initHeader() {
  const header = $('site-header');
  if (!header) return;
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 30);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ─────────────────────────────────────────────────────
   PASSWORD TOGGLE
───────────────────────────────────────────────────── */
(function initPasswordToggle() {
  const btn   = $('toggle-pw');
  const input = $('password');
  const svg   = $('eye-svg');
  if (!btn || !input) return;

  btn.addEventListener('click', () => {
    const isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    svg.innerHTML = isText
      ? `<path d="M1.5 7.5s2.3-4.5 6-4.5 6 4.5 6 4.5-2.3 4.5-6 4.5-6-4.5-6-4.5z" stroke="currentColor" stroke-width="1.2"/>
         <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" stroke-width="1.2"/>`
      : `<path d="M1.5 7.5s2.3-4.5 6-4.5 6 4.5 6 4.5-2.3 4.5-6 4.5-6-4.5-6-4.5z" stroke="currentColor" stroke-width="1.2"/>
         <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" stroke-width="1.2"/>
         <line x1="2" y1="2" x2="13" y2="13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`;
  });
})();

/* ─────────────────────────────────────────────────────
   LOGIN FORM — validation + mock auth
───────────────────────────────────────────────────── */
(function initLoginForm() {
  const form = $('login-form');
  if (!form) return;

  // Login uses stored server accounts. The public demo opens separately.
  function apiUrl(path) {
    const base = (window.NFINITY_API_BASE_URL || '').replace(/\/+$/, '');
    return base + path;
  }

  async function serverAuth(credential, password) {
    const res = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
      body: JSON.stringify({ email: credential, password }),
    });
    if (res.status === 401) throw new Error('Invalid credentials');
    if (!res.ok) throw new Error('Sign-in is unavailable. Please try again shortly.');
    const body = await res.json();
    return {
      clientName: body.user.company_name || body.user.companyName || 'NFINITY HQ',
      role: body.user.role || 'employee',
      redirectUrl: body.redirectUrl || '/apps/demo/index.html#/dashboard',
      user: body.user,
      sessionToken: body.sessionToken,
    };
  }

  /* Helpers */
  function setError(field, msg) {
    const fg  = $('fg-' + field);
    const err = $('err-' + field);
    if (fg)  fg.classList.add('has-error');
    if (err) err.textContent = msg;
  }
  function clearError(field) {
    const fg  = $('fg-' + field);
    const err = $('err-' + field);
    if (fg)  fg.classList.remove('has-error');
    if (err) err.textContent = '';
  }
  function setLoading(on) {
    const btn  = $('btn-submit');
    const text = $('btn-text');
    const spin = $('spinner');
    btn.disabled  = on;
    if (text) text.style.display = on ? 'none' : '';
    if (spin) spin.style.display = on ? 'block' : 'none';
  }

  /* Clear errors on input */
  ['email','password'].forEach(f => {
    const el = $(f);
    if (el) el.addEventListener('input', () => clearError(f));
  });

  /* Submit */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError('email'); clearError('password');

    const credential = $('email').value.trim();
    const password   = $('password').value;
    let ok = true;

    if (!credential) { setError('email',    'Email or username is required.'); ok = false; }
    if (!password)   { setError('password', 'Password is required.'); ok = false; }
    if (!ok) return;

    setLoading(true);

    try {
      const client = await serverAuth(credential, password);

      // Keep the current bearer-token session format for the portal.
      localStorage.setItem('nfinity_auth_session', JSON.stringify({
        userId:         client.user?.id || 'user-demo-001',
        sessionToken:   client.sessionToken || null,
        email:          credential.toLowerCase(),
        displayName:    client.user?.display_name || 'Demo User',
        role:           client.role,
        clientId:       client.user?.client_id || 'demo',
        companyName:    client.clientName,
        avatarInitials: client.user?.avatar_initials || 'DU',
        mustChangePassword: !!(client.user && client.user.must_change_password),
        loginTime:      Date.now(),
        lastActivity:   Date.now(),
      }));
      window.location.href = client.redirectUrl;

    } catch (error) {
      setError('password', error.message === 'Invalid credentials' ? 'Incorrect credentials. Please try again.' : 'Could not reach sign-in. Please try again.');
      setLoading(false);
    }
  });
})();

/* ─────────────────────────────────────────────────────
   PORTAL PAGE — session read + personalisation
───────────────────────────────────────────────────── */
(function initPortal() {
  const wrap = document.querySelector('.portal-wrap');
  if (!wrap) return;

  const signOut = $('btn-signout');
  if (signOut) {
    signOut.addEventListener('click', () => {
      localStorage.removeItem('nfinity_auth_session');
      localStorage.removeItem('nfinity_client_config');
      window.location.href = 'index.html';
    });
  }

  const raw = localStorage.getItem('nfinity_auth_session');
  if (!raw) return;

  try {
    const s = JSON.parse(raw);

    const badge    = $('client-name-badge');
    const greeting = $('portal-greeting');

    if (badge && (s.companyName || s.clientName)) {
      badge.textContent = (s.companyName || s.clientName);
    }

    if (greeting && (s.companyName || s.clientName)) {
      const h   = new Date().getHours();
      const sal = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
      greeting.textContent =
        `${sal}, ${(s.companyName || s.clientName)}. Session started at ${new Date(s.loginTime).toLocaleTimeString()}.`;
    }
  } catch (_) {}
})();

/* ─────────────────────────────────────────────────────
   LOGOUT PAGE — ensure the session is fully cleared.
   Belt-and-suspenders: the page is reached after a logout
   action already cleared the session, but clearing again
   here means a direct visit also lands in a signed-out state.
───────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────
   DEMO LAUNCHER — Auto-login the public demo viewer.
   SECURITY: This account is intentionally a low-privilege
   "viewer" role so the public demo cannot be used to
   exercise admin-only paths once the backend is wired up.
───────────────────────────────────────────────────── */
function launchDemo() {
  localStorage.setItem('nfinity_auth_session', JSON.stringify({
    userId:         'user-demo-001',
    email:          'demo@nfinityhq.com',
    displayName:    'Demo User',
    role:           'viewer',
    clientId:       'demo',
    companyName:    'NFINITY HQ',
    avatarInitials: 'DU',
    loginTime:      Date.now(),
    lastActivity:   Date.now(),
  }));
  window.location.href = '../apps/demo/index.html#/dashboard';
}
