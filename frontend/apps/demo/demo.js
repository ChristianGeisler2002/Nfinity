'use strict';

/* ══════════════════════════════════════════════
   AUTH + ROUTE GUARD
══════════════════════════════════════════════ */
const CLIENT_CONFIGS = {
  demo: {color:'#fbbf24', company:'NFINITY HQ', logo:'N'},
};

let SESSION = null;
try { SESSION = JSON.parse(localStorage.getItem('nfinity_auth_session')); } catch {}

// INTENTIONAL PUBLIC DEMO: if no session, auto-inject guest credentials
// so prospects can access the demo directly without logging in.
// SECURITY: Guest role is "viewer" — never "admin" — so a forgotten backend
// wire-up cannot let a public visitor invoke privileged APIs.
// Integration note: Replace this block with a real session check / redirect to login.
if (!SESSION) {
  SESSION = {
    userId: 'guest-demo',
    email: 'demo@nfinityhq.com',
    displayName: 'Demo User',
    role: 'viewer',
    clientId: 'demo',
    companyName: 'NFINITY HQ',
    avatarInitials: 'DU',
    loginTime: Date.now(),
    lastActivity: Date.now(),
    isGuest: true
  };
}

// Apply branding
if (SESSION) {
  const cfg = CLIENT_CONFIGS[SESSION.clientId] || CLIENT_CONFIGS.demo;
  document.documentElement.style.setProperty('--amber', cfg.color);
  document.documentElement.style.setProperty('--amber-d', cfg.color);
  document.title = cfg.company + ' — NFINITY HQ';
  const initials = SESSION.avatarInitials || SESSION.displayName?.charAt(0) || 'U';
  ['sb-av','tn-av'].forEach(id => { const e = document.getElementById(id); if(e) e.textContent = initials; });
  _t('sb-uname', SESSION.displayName); _t('sb-uemail', SESSION.email);
  _t('tn-name', SESSION.displayName);
  _t('sb-mark', cfg.logo);
  _t('set-name', SESSION.displayName); _t('set-email', SESSION.email);
  _t('set-company', SESSION.companyName); _t('set-role', SESSION.role);
  const dd = document.getElementById('dash-date');
  if(dd) dd.textContent = new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
}

function _t(id,val){ const e=document.getElementById(id); if(e) e.textContent=val; }

// XSS-safe rendering helpers.
//
// SECURITY: Most of this file builds HTML by string concatenation and assigns
// it to innerHTML. Any field that originates from user input (task titles,
// notes, contact names, prospect company names, file names, etc.) MUST be
// passed through esc() before being interpolated into a template literal.
// Use escAttr() inside HTML attribute values, and never interpolate
// untrusted strings into an attribute that takes JS or a URL.
const _HTML_ESCAPES = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;', '`':'&#96;' };
function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"'`]/g, ch => _HTML_ESCAPES[ch]);
}
function escAttr(v) { return esc(v); }
// Sanitize a free-form string before storage so storage-bound caps and
// length limits keep one tab from filling localStorage with junk.
function sanitizeText(v, maxLen) {
  if (v === null || v === undefined) return '';
  const s = String(v).replace(/[\x00-\x1f\x7f]/g, '');
  return maxLen ? s.slice(0, maxLen) : s;
}

document.getElementById('logout-btn').addEventListener('click',()=>{
  localStorage.removeItem('nfinity_auth_session');
  localStorage.removeItem('nfinity_client_config');
  window.location.href='/public/index.html';
});

/* ══════════════════════════════════════════════
   ROUTING
══════════════════════════════════════════════ */
const ROUTES = ['dashboard','tasks','crm','team','outreach','pipeline','uploads','analytics','notifications','simulator','roi','virtual','settings'];
const TITLES  = {dashboard:'Dashboard',tasks:'Tasks',crm:'CRM',team:'Team Members',outreach:'Outreach',pipeline:'Client Pipeline',uploads:'Document Management',analytics:'Analytics',notifications:'Notifications',simulator:'Automation Engine',roi:'ROI Dashboard',virtual:'Virtual Employees',settings:'Settings'};

function navigate(page) {
  if (!ROUTES.includes(page)) page='dashboard';
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn[data-page]').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  document.querySelector('.nav-btn[data-page="'+page+'"]')?.classList.add('active');
  if (location.hash !== '#/'+page) history.pushState(null,'','#/'+page);
  document.querySelectorAll('.nav-btn[data-page]').forEach(button => {
    if (button.dataset.page === page) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  if(window.innerWidth<=768) closeSidebar();
  // Re-render on navigate so data is always current
  if(page==='tasks')         renderTasks();
  if(page==='crm')           { updateCrmAction(); renderCrmTab(); }
  if(page==='team')          renderTeam();
  if(page==='notifications') renderNotifications();
  if(page==='uploads')       renderFiles();
  if(page==='outreach')      { renderOutreachStats(); renderOutreach(); }
  if(page==='analytics')     { initCharts(); renderAnalyticsTasks(); }
  if(page==='settings')      { populateSettingsAccount(); initSettingsToggles(); }
  if(page==='dashboard')     updateDashMetrics({});
}

document.querySelectorAll('.nav-btn[data-page]').forEach(btn=>btn.addEventListener('click',()=>navigate(btn.dataset.page)));
window.addEventListener('hashchange',()=>{ const h=location.hash.slice(2); if(ROUTES.includes(h)) navigate(h); });
const initH=location.hash.slice(2); // Navigate called after all modules are initialized (see INIT section below)

/* ══════════════════════════════════════════════
   MOBILE
══════════════════════════════════════════════ */
const sidebar=document.getElementById('sidebar'), overlay=document.getElementById('overlay');
document.getElementById('menu-toggle').addEventListener('click',()=>{sidebar.classList.toggle('open');overlay.classList.toggle('visible');});
overlay.addEventListener('click',closeSidebar);
function closeSidebar(){sidebar.classList.remove('open');overlay.classList.remove('visible');}
document.getElementById('notif-btn').addEventListener('click',(e)=>{
  e.stopPropagation();
  const panel = document.getElementById('notif-dropdown-panel');
  if (!panel) return;
  const isOpen = panel.classList.contains('open');
  if (isOpen) {
    panel.classList.remove('open');
  } else {
    renderNotifDropdown();
    panel.classList.add('open');
  }
});
document.addEventListener('click', ()=>{
  const panel = document.getElementById('notif-dropdown-panel');
  if (panel) panel.classList.remove('open');
});

function renderNotifDropdown() {
  const panel = document.getElementById('notif-dropdown-panel');
  if (!panel) return;
  const catColor = {compliance:'red', finance:'amber', upload:'blue', system:'slate'};
  const recent = notifications.filter(n=>!n.dismissed).slice(0, 7);
  const unreadCount = notifications.filter(n=>n.unread&&!n.dismissed).length;
  panel.innerHTML = `
    <div class="ndp-header">
      <span class="ndp-title">Notifications</span>
      <span class="ndp-count">${unreadCount > 0 ? Number(unreadCount)+' unread' : 'All caught up'}</span>
    </div>
    ${recent.length ? recent.map(n=>`
      <div class="ndp-item ${n.unread?'unread':''}" onclick="readNotif(${Number(n.id)});renderNotifications();renderNotifDropdown()">
        <div class="ndp-item-dot ${catColor[n.cat]||'slate'}"></div>
        <div>
          <div class="ndp-item-title">${esc(n.title)}</div>
          <div class="ndp-item-desc">${esc(n.desc)}</div>
          <div class="ndp-item-time">${esc(n.time)}</div>
        </div>
      </div>`).join('')
    : '<div class="ndp-empty">No notifications yet. Click <strong>Simulate Issue</strong> to generate one.</div>'}
    <div class="ndp-footer">
      <button onclick="document.getElementById('notif-dropdown-panel').classList.remove('open');navigate('notifications')">View all notifications</button>
    </div>`;
}

function runDashboardSimulation() {
  if (typeof SIM_SCENARIOS === 'undefined' || !SIM_SCENARIOS.length) return;
  const btn = document.getElementById('sim-trigger-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Running...'; }
  setTimeout(()=>{
    const scenario = SIM_SCENARIOS[Math.floor(Math.random()*SIM_SCENARIOS.length)];
    scenario.run();
    updateNotifBadge();
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M7.5 1L3 7.5h4L6 12l7-6.5H9L10 1z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg> Simulate Issue'; }
  }, 300);
}

/* ══════════════════════════════════════════════
   DEMO_STORE — CENTRALIZED DATA STORE
══════════════════════════════════════════════ */
/* ── CENTRALIZED DEMO STATE STORE ─────────────────────────
   Single source of truth. All modules read/write these arrays.
   Integration note: Replace each array with a fetch() call
   to a server endpoint when these demo modules become live features.
────────────────────────────────────────────────────────── */
const DEMO_STORE = {
  companies: [
    { id:1, name:'Echo Global',          contact:'James Porter', email:'james@example.test',      phone:'(312) 555-0192', status:'Active',   deals:2 },
    { id:2, name:'Atlas Mechanical',     contact:'Mike Chang',   email:'mchang@example.test',      phone:'(615) 555-0381', status:'Active',   deals:1 },
    { id:3, name:'Blue Ridge Logistics', contact:'Diana Wu',     email:'dwu@example.test',         phone:'(828) 555-0347', status:'Active',   deals:1 },
    { id:4, name:'River City HVAC',      contact:'Bob Russo',    email:'brusso@example.test',  phone:'(901) 555-0228', status:'Lead',     deals:0 },
    { id:5, name:'Precision Auto Repair',contact:'Carol Ames',   email:'cames@example.test',   phone:'(504) 555-0415', status:'Prospect', deals:0 },
  ],
  // Live array references — set after module initialization below
  get tasks()         { return typeof tasks        !== 'undefined' ? tasks        : []; },
  get notifications() { return typeof notifications !== 'undefined' ? notifications : []; },
  get files()         { return typeof files         !== 'undefined' ? files         : []; },
  get contacts()      { return typeof contacts      !== 'undefined' ? contacts      : []; },
  get prospects()     { return typeof prospects     !== 'undefined' ? prospects     : []; },
  get pipelineCards() { return typeof pipelineCards !== 'undefined' ? pipelineCards : []; },
  get metrics()       { return typeof dashMetrics   !== 'undefined' ? dashMetrics   : {}; },
};

/* ══════════════════════════════════════════════
   SHARED STATE
══════════════════════════════════════════════ */
let dashMetrics = { tasks:4, alerts:3, docs:7, hours:38, workflows:21 };

function updateDashMetrics(delta={}) {
  Object.keys(delta).forEach(k=>{ if(dashMetrics[k]!==undefined) dashMetrics[k]+=delta[k]; });
  dashMetrics.tasks = tasks.filter(task => task.status !== 'done').length;
  dashMetrics.alerts = notifications.filter(notification => notification.cat === 'compliance' && !notification.dismissed).length;
  dashMetrics.docs = files.filter(file => file.status !== 'completed').length;
  _t('dc-tasks', dashMetrics.tasks);
  _t('dc-alerts', dashMetrics.alerts);
  _t('dc-docs', dashMetrics.docs);
  _t('dc-hours', dashMetrics.hours+'h');
  _t('dc-workflows', dashMetrics.workflows);
  _t('nb-tasks', tasks.filter(t=>t.status!=='done').length);
  // Sync ROI live if initialized
  if(typeof roiLive !== 'undefined') updateROILive();
  // Sync notification badge
  if(typeof updateNotifBadge === 'function') updateNotifBadge();
}

/* ══════════════════════════════════════════════
   STEP 1: TASKS MODULE
══════════════════════════════════════════════ */
const TASK_KEY = 'nfinity_tasks';
let tasks = loadTasksLS();
let taskFilter = 'all', taskView = 'list';

function loadTasksLS() {
  try { const d=JSON.parse(localStorage.getItem(TASK_KEY)); if(Array.isArray(d)) return d; } catch{}
  return [
    {id:1, title:'Q2 Compliance Audit — Certifications Review',  priority:'high',   status:'open',        assigned_to:'Mike Torres',  client_id:'demo', due_date:'2026-05-16', tag:'Compliance', notes:'Annual certification review due. Verify all team credentials are current.'},
    {id:2, title:'Follow up — INV-2231 · Echo Global · $2,650',priority:'high',  status:'open',        assigned_to:'Sandra Liu',   client_id:'demo', due_date:'2026-05-16', tag:'Finance',    notes:'18 days overdue. Call broker contact: Sarah M. at (312) 555-0991'},
    {id:3, title:'Renew Business License — Expires Jun 7',          priority:'medium', status:'open',        assigned_to:'Sandra Liu',   client_id:'demo', due_date:'2026-06-07', tag:'Compliance', notes:'Annual renewal required. Submit via state portal. Allow 2 weeks for processing.'},
    {id:4, title:'Q2 Tax Filing Prep — Gather Documents',           priority:'medium', status:'in_progress', assigned_to:'Mike Torres',  client_id:'demo', due_date:'2026-07-31', tag:'Filing',     notes:'Collect Q2 financial records. Coordinate with accounting team by July 15.'},
    {id:5, title:'Update Service Agreement — June Rate Schedule',   priority:'medium', status:'review',      assigned_to:'Admin User',   client_id:'demo', due_date:'2026-05-23', tag:'Legal',      notes:'New rate schedule effective June 1. Review contract terms before signing.'},
    {id:6, title:'Renew General Liability Insurance — 2026',        priority:'low',    status:'open',        assigned_to:'Admin User',   client_id:'demo', due_date:'2026-06-15', tag:'Insurance',  notes:'Current policy expires Jun 30. Request quotes from 3 providers minimum.'},
    {id:7, title:'Annual Registration Renewal — Completed',         priority:'low',    status:'done',        assigned_to:'Admin User',   client_id:'demo', due_date:'2026-05-10', tag:'Regulatory', notes:'Completed. Confirmation received and filed.'},
    {id:8, title:'Upload Signed Service Agreement — Client JB-4826',priority:'low',    status:'done',        assigned_to:'Sandra Liu',   client_id:'demo', due_date:'2026-05-12', tag:'Operations', notes:'Agreement received and countersigned. Filed under Contracts/JB-4826.'},
    {id:9, title:'New Team Member Onboarding — Jordan Kim',         priority:'medium', status:'open',        assigned_to:'Mike Torres',  client_id:'demo', due_date:'2026-05-20', tag:'HR',         notes:'Start date May 20. Complete system access setup and compliance orientation.'},
    {id:10,title:'Expense Reconciliation — April Statement',        priority:'low',    status:'open',        assigned_to:'Admin User',   client_id:'demo', due_date:'2026-05-22', tag:'Finance',    notes:'Cross-reference April statement against records. 4 discrepancies flagged for review.'},
  ];
}
function saveTasksLS(){ try { localStorage.setItem(TASK_KEY, JSON.stringify(tasks)); } catch { toast('Browser storage is full. Changes could not be saved.', 'error'); } }

function setTaskView(v,btn){ taskView=v; document.querySelectorAll('.vtab').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); document.getElementById('task-list-view').style.display=v==='list'?'block':'none'; document.getElementById('task-kanban-view').style.display=v==='kanban'?'block':'none'; document.getElementById('task-calendar-view').style.display=v==='calendar'?'block':'none'; renderTasks(); }
function setTaskFilter(f,btn){ taskFilter=f; document.querySelectorAll('#task-filters .fpill').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderTasks(); }

// Task detail drawer
let drawerTaskId = null;
function openTaskDrawer(id) {
  const t = tasks.find(t=>t.id===id); if(!t) return;
  drawerTaskId = id;
  const body = document.getElementById('tdd-body');
  const TAGS = ['Compliance','Finance','Operations','Legal','HR','Insurance','Filing','Regulatory','Escalated','General'];
  body.innerHTML = `
    <div class="tdd-section">
      <div class="tdd-label">Title</div>
      <input class="tdd-input" id="tdd-title" value="${escAttr(t.title)}">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
      <div class="tdd-section">
        <div class="tdd-label">Priority</div>
        <select class="tdd-select" id="tdd-priority">
          <option ${t.priority==='high'?'selected':''}>high</option>
          <option ${t.priority==='medium'?'selected':''}>medium</option>
          <option ${t.priority==='low'?'selected':''}>low</option>
        </select>
      </div>
      <div class="tdd-section">
        <div class="tdd-label">Status</div>
        <select class="tdd-select" id="tdd-status">
          <option value="open" ${t.status==='open'?'selected':''}>Open</option>
          <option value="in_progress" ${t.status==='in_progress'?'selected':''}>In Progress</option>
          <option value="review" ${t.status==='review'?'selected':''}>Review</option>
          <option value="done" ${t.status==='done'?'selected':''}>Done</option>
        </select>
      </div>
    </div>
    <div class="tdd-section">
      <div class="tdd-label">Assigned To</div>
      <input class="tdd-input" id="tdd-assignee" value="${escAttr(t.assigned_to)}">
    </div>
    <div class="tdd-section">
      <div class="tdd-label">Due Date</div>
      <input class="tdd-input" type="date" id="tdd-due" value="${escAttr(t.due_date||'')}">
    </div>
    <div class="tdd-section">
      <div class="tdd-label">Tag / Category</div>
      <select class="tdd-select" id="tdd-tag">
        ${TAGS.map(tag=>`<option ${t.tag===tag?'selected':''}>${esc(tag)}</option>`).join('')}
      </select>
    </div>
    <div class="tdd-section">
      <div class="tdd-label">Notes</div>
      <textarea class="tdd-textarea" id="tdd-notes" placeholder="Add notes, context, or next steps...">${esc(t.notes||'')}</textarea>
    </div>
    <div class="tdd-section">
      <div class="tdd-label">Quick Actions</div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <button class="btn-outline btn-sm" onclick="toggleTask(${id});closeTaskDrawer()">
          ${t.status==='done'?'&#10226; Reopen':'&#10003; Mark Done'}
        </button>
        <button class="btn-outline btn-sm" onclick="setTaskStatus(${id},'in_progress');closeTaskDrawer()">&#9654; Start</button>
        <button class="btn-outline btn-sm" onclick="setTaskStatus(${id},'review');closeTaskDrawer()"><svg width="11" height="11" viewBox="0 0 11 11" fill="none" style="vertical-align:middle;margin-right:.2rem"><path d="M1 5.5s1.8-3.5 4.5-3.5S10 5.5 10 5.5s-1.8 3.5-4.5 3.5S1 5.5 1 5.5z" stroke="currentColor" stroke-width="1.1"/><circle cx="5.5" cy="5.5" r="1.3" stroke="currentColor" stroke-width="1.1"/></svg>Review</button>
      </div>
    </div>`;
  document.getElementById('tdd-delete-btn').onclick = ()=>{ deleteTask(id); closeTaskDrawer(); };
  document.getElementById('task-detail-drawer').classList.add('open');
  document.getElementById('drawer-overlay').classList.add('visible');
}
function closeTaskDrawer(){
  document.getElementById('task-detail-drawer').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('visible');
  drawerTaskId=null;
}
function saveTaskDrawer(){
  const t=tasks.find(t=>t.id===drawerTaskId); if(!t) return;
  const allowedPriority = ['high','medium','low'];
  const allowedStatus = ['open','in_progress','review','done'];
  t.title=sanitizeText(document.getElementById('tdd-title').value, _FIELD_CAPS.short)||t.title;
  const p = document.getElementById('tdd-priority').value;
  t.priority = allowedPriority.includes(p) ? p : t.priority;
  const s = document.getElementById('tdd-status').value;
  t.status = allowedStatus.includes(s) ? s : t.status;
  t.assigned_to=sanitizeText(document.getElementById('tdd-assignee').value, _FIELD_CAPS.short)||t.assigned_to;
  t.due_date=sanitizeText(document.getElementById('tdd-due').value, _FIELD_CAPS.ident)||t.due_date;
  t.tag=sanitizeText(document.getElementById('tdd-tag').value, _FIELD_CAPS.ident);
  t.notes=sanitizeText(document.getElementById('tdd-notes').value, _FIELD_CAPS.long);
  saveTasksLS(); renderTasks();
  toast('Task updated');
  closeTaskDrawer();
  addActivity('blue', '"'+t.title+'" edited.', 'Task updated');
}
function setTaskStatus(id,status){
  const t=tasks.find(t=>t.id===id); if(!t) return;
  t.status=status; saveTasksLS(); renderTasks();
  toast('Task status: '+status);
}

function renderTasks() {
  const q=(document.getElementById('task-search')?.value||'').toLowerCase();
  const sortBy=document.getElementById('task-sort')?.value||'due';
  let filtered=tasks.filter(t=>{
    const matchQ=!q||t.title.toLowerCase().includes(q)||t.assigned_to.toLowerCase().includes(q)||t.tag.toLowerCase().includes(q);
    let matchF=true;
    if(taskFilter==='open')       matchF=t.status!=='done';
    else if(taskFilter==='done')  matchF=t.status==='done';
    else if(taskFilter==='high')  matchF=t.priority==='high';
    else if(taskFilter==='medium')matchF=t.priority==='medium';
    else if(taskFilter==='compliance') matchF=t.tag==='Compliance';
    else if(taskFilter==='finance')    matchF=t.tag==='Finance';
    return matchQ&&matchF;
  });

  // Sort
  if(sortBy==='priority'){const po={high:0,medium:1,low:2};filtered.sort((a,b)=>(po[a.priority]??1)-(po[b.priority]??1));}
  else if(sortBy==='status'){const so={open:0,in_progress:1,review:2,done:3};filtered.sort((a,b)=>(so[a.status]??2)-(so[b.status]??2));}
  else{filtered.sort((a,b)=>{if(!a.due_date)return 1;if(!b.due_date)return -1;return a.due_date.localeCompare(b.due_date);});}

  const STATUS_LABEL = {open:'Open',in_progress:'In Progress',review:'Review',done:'Done'};
  const STATUS_COLOR = {open:'slate',in_progress:'blue',review:'amber',done:'green'};

  // List view
  const lv=document.getElementById('task-list-view');
  if(lv) lv.innerHTML=filtered.length?filtered.map(t=>`
    <div class="task-item ${t.status==='done'?'done-item':''}" onclick="openTaskDrawer(${Number(t.id)})">
      <div class="task-check ${t.status==='done'?'checked':''}" onclick="event.stopPropagation();toggleTask(${Number(t.id)})">${t.status==='done'?'&#10003;':''}</div>
      <div class="task-info">
        <div class="task-title ${t.status==='done'?'done':''}">${esc(t.title)}</div>
        <div class="task-meta">Due: ${esc(fmtDate(t.due_date))} &middot; ${esc(t.assigned_to)}${t.notes?` &middot; <span style="color:var(--dim);font-style:italic">${esc(String(t.notes).slice(0,40))}${String(t.notes).length>40?'...':''}</span>`:''}</div>
      </div>
      <span class="tag ${STATUS_COLOR[t.status]||'slate'}" style="margin-right:.25rem">${esc(STATUS_LABEL[t.status]||t.status)}</span>
      <span class="tag ${t.priority==='high'?'red':t.priority==='medium'?'amber':'green'}">${esc(t.priority)}</span>
      <span class="tag slate" style="margin-left:.25rem">${esc(t.tag)}</span>
      <button class="btn-danger btn-sm" style="margin-left:.5rem" onclick="event.stopPropagation();deleteTask(${Number(t.id)})">&#x2715;</button>
    </div>`).join('')
    :`<div class="empty-state"><div class="empty-state-icon"><svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M8 4h16a2 2 0 012 2v20a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" stroke-width="1.5"/><path d="M11 10h10M11 15h10M11 20h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div><div class="empty-state-title">No tasks found</div><div class="empty-state-desc">Try a different filter, or create a new task using the button above.</div></div>`;

  // Kanban view
  const kv=document.getElementById('task-kanban-view');
  if(kv){
    const allKanban={
      'Open':tasks.filter(t=>t.status==='open'&&filtered.includes(t)),
      'In Progress':tasks.filter(t=>t.status==='in_progress'&&filtered.includes(t)),
      'Review':tasks.filter(t=>t.status==='review'&&filtered.includes(t)),
      'Done':tasks.filter(t=>t.status==='done'&&filtered.includes(t)),
    };
    kv.innerHTML=`<div class="kanban-board">${Object.entries(allKanban).map(([col,cards])=>`
      <div class="kanban-col" data-col="${escAttr(col)}">
        <div class="kanban-hd"><span class="kanban-title">${esc(col)}</span><span class="kanban-count">${cards.length}</span></div>
        <div class="kanban-body">${cards.map(t=>`
          <div class="kanban-card" draggable="true" data-tid="${Number(t.id)}" onclick="openTaskDrawer(${Number(t.id)})">
            <div class="kanban-card-title">${esc(t.title)}</div>
            <div class="kanban-card-meta">${esc(t.assigned_to)} &middot; <span class="tag ${t.priority==='high'?'red':t.priority==='medium'?'amber':'green'}" style="font-size:.65rem">${esc(t.priority)}</span></div>
            ${t.due_date?`<div style="font-size:.68rem;color:var(--dim);margin-top:.25rem">Due: ${esc(fmtDate(t.due_date))}</div>`:''}
          </div>`).join('')}
        </div>
      </div>`).join('')}</div>`;
    initKanbanDrag();
  }

  // Calendar view
  const cv=document.getElementById('task-calendar-view');
  if(cv) renderTaskCalendar(cv, filtered);

  const open=tasks.filter(t=>t.status!=='done').length;
  _t('nb-tasks', open); _t('dc-tasks', open);
}

// Calendar
let calYear=new Date().getFullYear(), calMonth=new Date().getMonth();
function renderTaskCalendar(cv, filtered){
  const today=new Date(); const td=today.getDate(),tm=today.getMonth(),ty=today.getFullYear();
  const firstDay=new Date(calYear,calMonth,1).getDay();
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Build task map by date
  const taskMap={};
  tasks.forEach(t=>{
    if(!t.due_date) return;
    const d=new Date(t.due_date+'T12:00:00');
    const k=`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if(!taskMap[k]) taskMap[k]=[];
    taskMap[k].push(t);
  });

  let cells='';
  // Prev month fill
  const prevDays=new Date(calYear,calMonth,0).getDate();
  for(let i=firstDay-1;i>=0;i--){
    cells+=`<div class="cal-day other-month"><div class="cal-day-num">${prevDays-i}</div></div>`;
  }
  for(let d=1;d<=daysInMonth;d++){
    const isToday=d===td&&calMonth===tm&&calYear===ty;
    const k=`${calYear}-${calMonth}-${d}`;
    const dayTasks=taskMap[k]||[];
    const shown=dayTasks.slice(0,3);
    const extra=dayTasks.length-shown.length;
    cells+=`<div class="cal-day${isToday?' today':''}">
      <div class="cal-day-num">${d}</div>
      ${shown.map(t=>`<div class="cal-task-dot ${esc(t.priority)} ${t.status==='done'?'done':''}" onclick="event.stopPropagation();openTaskDrawer(${Number(t.id)})" title="${escAttr(t.title)}">${esc(String(t.title).slice(0,20))}${String(t.title).length>20?'...':''}</div>`).join('')}
      ${extra>0?`<div class="cal-more">+${extra} more</div>`:''}
    </div>`;
  }
  // Next month fill
  const totalCells=Math.ceil((firstDay+daysInMonth)/7)*7;
  let nxt=1;
  for(let i=firstDay+daysInMonth;i<totalCells;i++,nxt++){
    cells+=`<div class="cal-day other-month"><div class="cal-day-num">${nxt}</div></div>`;
  }

  cv.innerHTML=`
    <div class="cal-nav">
      <button class="cal-nav-btn" onclick="calNav(-1)">&#8592; Prev</button>
      <div class="cal-month-label">${MONTHS[calMonth]} ${calYear}</div>
      <button class="cal-nav-btn" onclick="calNav(1)">Next &#8594;</button>
    </div>
    <div class="cal-grid">
      ${DAYS.map(d=>`<div class="cal-day-header">${d}</div>`).join('')}
      ${cells}
    </div>
    <div style="display:flex;gap:1rem;margin-top:.75rem;font-size:.75rem;color:var(--dim)">
      <span><span style="border-left:2px solid var(--red);padding-left:.3rem">High</span></span>
      <span><span style="border-left:2px solid var(--amber);padding-left:.3rem">Medium</span></span>
      <span><span style="border-left:2px solid var(--green);padding-left:.3rem">Low / Done</span></span>
    </div>`;
}
function calNav(dir){
  calMonth+=dir;
  if(calMonth>11){calMonth=0;calYear++;}
  if(calMonth<0){calMonth=11;calYear--;}
  renderTasks();
}

function initKanbanDrag(){
  let dragging=null;
  document.querySelectorAll('.kanban-card').forEach(card=>{
    card.addEventListener('dragstart',e=>{dragging=card;card.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
    card.addEventListener('dragend',()=>{card.classList.remove('dragging');dragging=null;document.querySelectorAll('.kanban-col').forEach(c=>c.classList.remove('drag-over'));});
  });
  document.querySelectorAll('.kanban-col').forEach(col=>{
    col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('drag-over');});
    col.addEventListener('dragleave',()=>col.classList.remove('drag-over'));
    col.addEventListener('drop',e=>{
      e.preventDefault();col.classList.remove('drag-over');
      if(!dragging) return;
      const tid=parseInt(dragging.dataset.tid);
      const t=tasks.find(t=>t.id===tid); if(!t) return;
      const targetCol=col.dataset.col;
      if(targetCol==='Done') t.status='done';
      else if(targetCol==='In Progress') t.status='in_progress';
      else if(targetCol==='Review') t.status='review';
      else t.status='open';
      saveTasksLS(); renderTasks(); toast('Task moved to '+targetCol);
    });
  });
}

function toggleTask(id){
  const t=tasks.find(t=>t.id===id); if(!t) return;
  t.status=t.status==='done'?'open':'done';
  saveTasksLS(); renderTasks();
  toast(t.status==='done'?'Task completed':'Task reopened');
  if(t.status==='done') addActivity('green','<strong>Task completed</strong> — "'+t.title+'" marked done.');
}
function deleteTask(id){ tasks=tasks.filter(t=>t.id!==id); saveTasksLS(); renderTasks(); toast('Task removed'); }
function addTask(t){ tasks.unshift({id:Date.now(),...t}); saveTasksLS(); renderTasks(); }

renderTasks();

/* ══════════════════════════════════════════════
   STEP 2: CRM MODULE
══════════════════════════════════════════════ */
let contacts = [
  {id:1,name:'Marcus Webb',     company:'NFINITY HQ',  email:'m.webb@nfinityhq.com',    phone:'(312) 555-0142',role:'Operations', status:'Active',  deals:['JB-4821'],notes:'Operations lead. Manages day-to-day workflow coordination.'},
  {id:2,name:'Jordan Reyes',    company:'NFINITY HQ',  email:'j.reyes@nfinityhq.com',   phone:'(214) 555-0187',role:'Compliance', status:'Alert',   deals:['JB-4822'],notes:'Compliance renewal overdue. Immediate follow-up required.'},
  {id:3,name:'Sandra Liu',      company:'NFINITY HQ',  email:'s.liu@nfinityhq.com',     phone:'(614) 555-0231',role:'Manager',    status:'Active',  deals:[],          notes:'Operations manager. Key contact for invoicing and approvals.'},
  {id:4,name:'Tony Marsh',      company:'NFINITY HQ',  email:'t.marsh@nfinityhq.com',   phone:'(502) 555-0094',role:'Specialist', status:'Alert',   deals:['JB-4826'], notes:'License renewal due in 22 days. Schedule processing.'},
  {id:5,name:'Karen Okonkwo',   company:'NFINITY HQ',  email:'k.okonkwo@nfinityhq.com', phone:'(720) 555-0388',role:'Coordinator',status:'Active',  deals:[],          notes:'Project coordinator. Fast responder. Key escalation contact.'},
  {id:6,name:'Darnell King',    company:'NFINITY HQ',  email:'d.king@nfinityhq.com',    phone:'(704) 555-0229',role:'Associate',  status:'Active',  deals:['JB-4823'], notes:'Reliable team member. Available for high-priority assignments.'},
  {id:7,name:'Tom Diaz',        company:'Apex Solutions LLC',    email:'t.diaz@example.test',   phone:'(312) 555-0410',role:'CEO',      status:'Prospect',deals:[],notes:'Interested in full platform. Follow up Friday.'},
  {id:8,name:'Diana Wu',        company:'Blue Ridge Logistics',  email:'d.wu@example.test',         phone:'(415) 555-0502',role:'Director', status:'Lead',    deals:[],notes:'Saw LinkedIn post. Requested demo.'},
  {id:9,name:'Mike Chang',      company:'Atlas Mechanical',      email:'mchang@example.test',       phone:'(615) 555-0381',role:'Operations Manager',status:'Active',deals:['JB-4825'],notes:'Key operations contact. Manages fleet compliance and scheduling.'},
  {id:10,name:'Carol Ames',     company:'Precision Auto Repair', email:'cames@example.test',    phone:'(504) 555-0415',role:'Owner',    status:'Prospect',deals:[],notes:'Phone qualified. Interested in compliance automation. Send proposal this week.'},
];

let crmTab = 'contacts';

const companies = [
  {name:'Echo Global',           type:'Active Client', contacts:3, mrr:'$9,200/mo', since:'Nov 2023', status:'Active'},
  {name:'Atlas Mechanical',      type:'Active Client', contacts:2, mrr:'$7,100/mo', since:'Feb 2024', status:'Active'},
  {name:'Blue Ridge Logistics',  type:'Active Client', contacts:2, mrr:'$5,500/mo', since:'Mar 2024', status:'Active'},
  {name:'River City HVAC',       type:'Lead',          contacts:2, mrr:'—',         since:'—',        status:'Lead'},
  {name:'Precision Auto Repair', type:'Prospect',      contacts:1, mrr:'—',         since:'—',        status:'Prospect'},
  {name:'Apex Solutions LLC',    type:'Prospect',      contacts:1, mrr:'—',         since:'—',        status:'Prospect'},
];

const deals = [
  {company:'Echo Global',          value:'$9,200/mo', stage:'Closed Won',probability:'100%', nextStep:'Quarterly check-in May 30',  owner:'Demo User'},
  {company:'Atlas Mechanical',     value:'$7,100/mo', stage:'Closed Won',probability:'100%', nextStep:'Upsell compliance add-on',   owner:'Demo User'},
  {company:'Apex Solutions LLC',   value:'$5,500/mo', stage:'Demo',      probability:'70%',  nextStep:'Demo call Thu 2pm',          owner:'Demo User'},
  {company:'Blue Ridge Logistics', value:'$4,800/mo', stage:'Qualified', probability:'40%',  nextStep:'Send proposal by Friday',    owner:'Demo User'},
  {company:'River City HVAC',      value:'$7,200/mo', stage:'Proposal',  probability:'60%',  nextStep:'Follow up on proposal',      owner:'Admin User'},
  {company:'Precision Auto Repair',value:'$3,100/mo', stage:'Discovery', probability:'25%',  nextStep:'Schedule 2nd discovery call',owner:'Admin User'},
];

const meetings = [
  {company:'Apex Solutions LLC',    contact:'Tom Diaz',   date:'Thu May 22, 2:00 PM', type:'Demo Call',      status:'Scheduled',notes:'Full platform demo. Prepare NFINITY HQ walkthrough.'},
  {company:'Blue Ridge Logistics',  contact:'Diana Wu',   date:'Fri May 23, 10:00 AM',type:'Discovery Call', status:'Scheduled',notes:'Initial call. Identify operational pain points.'},
  {company:'River City HVAC',       contact:'Bob Russo',  date:'Mon May 19, 11:00 AM',type:'Proposal Review',status:'Completed',notes:'Reviewed proposal. Awaiting internal approval.'},
  {company:'Atlas Mechanical',      contact:'Mike Chang', date:'Fri May 16, 1:00 PM', type:'QBR',            status:'Completed',notes:'Q2 business review. Client satisfied. Upsell compliance module discussed.'},
  {company:'Echo Global',           contact:'James Porter',date:'Tue May 13, 10:00 AM',type:'Check-In',       status:'Completed',notes:'Monthly check-in. Invoice INV-2231 follow-up. Resolved.'},
];

const interactions = [
  {icon:'email',  company:'Apex Solutions LLC',    type:'Email sent',     detail:'Sent follow-up with case study. Requested time for demo this week.',        time:'Today, 9:15 AM'},
  {icon:'call',   company:'Blue Ridge Logistics',  type:'Call logged',    detail:'15-min discovery call. Diana confirmed compliance is biggest pain point.',  time:'Yesterday, 2:30 PM'},
  {icon:'task',   company:'NFINITY HQ',            type:'Task created',   detail:'Compliance renewal task auto-created for Jordan Reyes.',                    time:'Yesterday, 11:00 AM'},
  {icon:'doc',    company:'River City HVAC',        type:'Proposal sent',  detail:'Sent Q3 proposal for operations module. $7,200/mo.',                       time:'May 14, 3:45 PM'},
  {icon:'meeting',company:'Atlas Mechanical',       type:'Meeting held',   detail:'Q2 business review. Mike requested compliance add-on pricing.',            time:'May 14, 11:00 AM'},
  {icon:'finance',company:'Echo Global',            type:'Invoice created', detail:'INV-2231 sent for $2,650. 18 days outstanding. Follow-up scheduled.',   time:'May 13, 8:00 AM'},
];

const CRM_ACTIONS = {
  contacts: { label: '+ Add Contact', modal: 'contact' },
  companies: { label: '+ Add Company', modal: 'company' },
  deals: { label: '+ Add Deal', modal: 'deal' },
  proposals: { label: '+ Add Proposal', modal: 'proposal' },
  meetings: { label: '+ Add Meeting', modal: 'meeting' },
  interactions: { label: '+ Add Activity', modal: 'interaction' },
};

function updateCrmAction() {
  const btn = document.getElementById('crm-action-btn');
  const action = CRM_ACTIONS[crmTab] || CRM_ACTIONS.contacts;
  if (!btn) return;
  btn.textContent = action.label;
  btn.dataset.modal = action.modal;
}

function handleCrmAction() {
  const action = CRM_ACTIONS[crmTab] || CRM_ACTIONS.contacts;
  openModal(action.modal);
}

function setCrmTab(tab, btn) {
  crmTab=tab;
  document.querySelectorAll('.crm-tab').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  ['contacts','companies','deals','proposals','meetings','interactions'].forEach(t=>{ const el=document.getElementById('crm-'+t+'-tab'); if(el) el.style.display=t===tab?'block':'none'; });
  updateCrmAction();
  renderCrmTab();
}

function renderContacts() {
  const grid=document.getElementById('contact-grid'); if(!grid) return;
  const q=(document.getElementById('crm-search')?.value||'').toLowerCase();
  const filtered=contacts.filter(c=>!q||c.name.toLowerCase().includes(q)||c.company.toLowerCase().includes(q)||c.role.toLowerCase().includes(q));
  const sc={Active:'var(--green)',Alert:'var(--red)',Prospect:'var(--amber)',Lead:'var(--blue)'};
  grid.innerHTML=filtered.map(c=>`
    <div class="contact-card">
      <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem">
        <div class="contact-av">${esc(String(c.name||'?').charAt(0))}</div>
        <div><div class="contact-name">${esc(c.name)}</div><div class="contact-co">${esc(c.role)} · <span style="color:${sc[c.status]||'var(--subtle)'}">${esc(c.status)}</span></div></div>
      </div>
      <div class="contact-row">${esc(c.company)}</div>
      <div class="contact-row">${esc(c.email)}</div>
      <div class="contact-row">${esc(c.phone)}</div>
      ${c.notes?`<div style="font-size:.75rem;color:var(--dim);margin-top:.5rem;background:var(--surface);padding:.4rem .6rem;border-radius:4px">${esc(c.notes)}</div>`:''}
    </div>`).join('');
}

const proposals = [
  {id:1,company:'Apex Solutions LLC', contact:'Tom Diaz',  value:'$5,500/mo',sent:'May 14, 2026',stage:'Demo Scheduled',probability:70,status:'active',  notes:'Platform demo Thu 2pm. Decision expected by May 30.'},
  {id:2,company:'Blue Ridge Logistics', contact:'Diana Wu',  value:'$4,800/mo',sent:'May 15, 2026',stage:'Sent',          probability:40,status:'active',  notes:'Discovery call complete. Proposal sent. Follow up Mon.'},
  {id:3,company:'River City HVAC',     contact:'Bob Russo', value:'$7,200/mo',sent:'May 12, 2026',stage:'Under Review',  probability:60,status:'active',  notes:'CFO reviewing. Bob confident on budget approval.'},
  {id:4,company:'Precision Auto Repair',     contact:'Carol Ames',value:'$3,100/mo',sent:'May 10, 2026',stage:'Qualified',     probability:30,status:'active',  notes:'Initial fit confirmed. Sending full proposal this week.'},
  {id:5,company:'Peak Operations Co.',contact:'Lisa Brown',value:'$3,900/mo',sent:'Apr 28, 2026',stage:'Accepted',      probability:100,status:'won',    notes:'Signed. Onboarding Jun 1. Referral from NFINITY HQ.'},
  {id:6,company:'Sunset Consulting',  contact:'Jay Nash',  value:'$2,100/mo',sent:'Apr 20, 2026',stage:'Lost',          probability:0,  status:'lost',   notes:'Went with competitor. Price sensitivity cited.'},
];
const PROPOSAL_STAGES=['Qualified','Sent','Demo Scheduled','Under Review','Accepted'];

function renderCrmTab() {
  if(crmTab==='contacts') { renderContacts(); return; }
  if(crmTab==='companies') {
    const el=document.getElementById('crm-companies-tab'); if(!el) return;
    el.innerHTML=`<div class="panel"><div class="panel-body" style="padding:0"><table class="data-table">
      <thead><tr><th>Company</th><th>Type</th><th>Contacts</th><th>MRR</th><th>Since</th><th>Status</th></tr></thead>
      <tbody>${companies.map(c=>`<tr>
        <td><strong style="color:var(--heading)">${esc(c.name)}</strong></td>
        <td style="color:var(--dim)">${esc(c.type)}</td>
        <td style="color:var(--subtle)">${esc(c.contacts)}</td>
        <td style="color:var(--green);font-family:'DM Mono',monospace">${esc(c.mrr)}</td>
        <td style="color:var(--dim)">${esc(c.since)}</td>
        <td><span class="tag ${c.status==='Active'?'green':c.status==='Prospect'?'amber':'blue'}">${esc(c.status)}</span></td>
      </tr>`).join('')}</tbody>
    </table></div></div>`;
  }
  if(crmTab==='deals') {
    const el=document.getElementById('crm-deals-tab'); if(!el) return;
    el.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1rem">${deals.map(d=>`
      <div class="deal-card">
        <div class="deal-company">${esc(d.company)}</div>
        <div class="deal-value">${esc(d.value)}</div>
        <div class="deal-meta">Stage: <strong style="color:var(--heading)">${esc(d.stage)}</strong> &middot; ${esc(d.probability)} likely</div>
        <div class="deal-meta" style="margin-top:.35rem">Next: ${esc(d.nextStep)}</div>
        <div class="deal-meta" style="margin-top:.25rem;color:var(--dim)">Owner: ${esc(d.owner)}</div>
      </div>`).join('')}</div>`;
  }
  if(crmTab==='proposals') {
    const el=document.getElementById('crm-proposals-tab'); if(!el) return;
    const active=proposals.filter(p=>p.status==='active');
    const won=proposals.filter(p=>p.status==='won');
    const lost=proposals.filter(p=>p.status==='lost');
    const pipeline=active.reduce((s,p)=>{const n=parseFloat(p.value.replace(/[^0-9.]/g,''))||0;return s+n;},0);
    el.innerHTML=`
      <div class="cards-grid" style="margin-bottom:1.25rem">
        <div class="stat amber"><div class="stat-label">Active Proposals</div><div class="stat-val">${active.length}</div><div class="stat-sub">In pipeline</div></div>
        <div class="stat green"><div class="stat-label">Pipeline Value</div><div class="stat-val">$${(pipeline/1000).toFixed(1)}k</div><div class="stat-sub">Active MRR potential</div></div>
        <div class="stat green"><div class="stat-label">Won</div><div class="stat-val">${won.length}</div><div class="stat-sub">Closed successfully</div></div>
        <div class="stat red"><div class="stat-label">Lost</div><div class="stat-val">${lost.length}</div><div class="stat-sub">Didn't close</div></div>
      </div>
      ${proposals.map(p=>{
        const stageIdx=PROPOSAL_STAGES.indexOf(p.stage);
        return `<div class="proposal-card">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap">
            <div>
              <div style="font-size:.95rem;font-weight:700;color:var(--heading)">${esc(p.company)}</div>
              <div style="font-size:.8rem;color:var(--subtle);margin-top:.15rem">${esc(p.contact)} &middot; Sent ${esc(p.sent)}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:1rem;font-weight:700;color:var(--green);font-family:'DM Mono',monospace">${esc(p.value)}</div>
              <span class="tag ${p.status==='won'?'green':p.status==='lost'?'red':'amber'}">${p.status==='won'?'Won':p.status==='lost'?'Lost':esc(p.stage)}</span>
            </div>
          </div>
          ${p.status==='active'?`<div class="proposal-stage-bar">
            ${PROPOSAL_STAGES.map((s,i)=>`<div class="proposal-stage-seg ${i<stageIdx?'done':i===stageIdx?'active':''}" title="${escAttr(s)}"></div>`).join('')}
          </div>
          <div style="font-size:.72rem;color:var(--dim);display:flex;gap:1rem;margin-bottom:.5rem">
            ${PROPOSAL_STAGES.map((s,i)=>`<span style="flex:1;text-align:center;${i===stageIdx?'color:var(--amber);font-weight:700':''}">${esc(s)}</span>`).join('')}
          </div>`:``}
          <div style="font-size:.8rem;color:var(--body);background:var(--surface);border-radius:4px;padding:.5rem .75rem">${esc(p.notes)}</div>
          <div style="margin-top:.625rem;display:flex;gap:.375rem">
            <div style="font-size:.75rem;color:var(--dim)">Probability: <strong style="color:var(--heading)">${Number(p.probability)||0}%</strong></div>
          </div>
        </div>`;
      }).join('')}`;
  }
  if(crmTab==='meetings') {
    const el=document.getElementById('crm-meetings-tab'); if(!el) return;
    el.innerHTML=`<div style="display:flex;flex-direction:column;gap:.75rem">${meetings.map(m=>`
      <div class="panel" style="margin-bottom:0">
        <div class="panel-body">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap">
            <div>
              <div style="font-size:.95rem;font-weight:700;color:var(--heading)">${esc(m.company)}</div>
              <div style="font-size:.82rem;color:var(--subtle);margin-top:.15rem">${esc(m.contact)} &middot; ${esc(m.type)}</div>
              <div style="font-size:.8rem;color:var(--dim);margin-top:.15rem;display:flex;align-items:center;gap:.3rem"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x=".5" y="2" width="10" height="8.5" rx="1" stroke="currentColor" stroke-width="1.1"/><path d="M.5 5h10" stroke="currentColor" stroke-width="1.1"/><path d="M3 1v2M8 1v2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>${esc(m.date)}</div>
              <div style="font-size:.8rem;color:var(--body);margin-top:.5rem">${esc(m.notes)}</div>
            </div>
            <span class="tag ${m.status==='Scheduled'?'blue':'green'}">${esc(m.status)}</span>
          </div>
        </div>
      </div>`).join('')}</div>`;
  }
  if(crmTab==='interactions') {
    const el=document.getElementById('crm-interactions-tab'); if(!el) return;
    const INT_ICONS={
      email:   '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="8" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M1 4.5l6 4 6-4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
      call:    '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 2C3.5 4.5 3.5 6.5 10 11.5c.9-.5 1.8-.9 2.2-1.3l-1.4-2.3-1.4.5C9 8 6.5 5.5 6 4.5l.5-1.5L4 2z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      task:    '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      doc:     '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 1.5h6.5l2 2V12.5H3V1.5z" stroke="currentColor" stroke-width="1.2"/><path d="M9 1.5v2.5h2.5" stroke="currentColor" stroke-width="1.2"/><path d="M5 6h4M5 8.5h4M5 11h2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
      meeting: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="5" cy="4" r="1.8" stroke="currentColor" stroke-width="1.2"/><circle cx="9" cy="4" r="1.8" stroke="currentColor" stroke-width="1.2"/><path d="M1 12c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M9 10c.6-.6 1.3-1 2-1 1.7 0 3 1.3 3 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
      finance: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2"/><path d="M7 4v6M5.5 5.5h2a1 1 0 010 2h-1a1 1 0 000 2H8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
    };
    el.innerHTML=`<div class="panel"><div class="panel-body" style="padding-top:0;padding-bottom:0">${interactions.map(i=>`
      <div class="interaction-item">
        <div class="int-icon">${INT_ICONS[i.icon]||INT_ICONS.doc}</div>
        <div class="int-body">
          <div class="int-title">${esc(i.type)} &mdash; ${esc(i.company)}</div>
          <div class="int-detail">${esc(i.detail)}</div>
        </div>
        <div class="int-time">${esc(i.time)}</div>
      </div>`).join('')}</div></div>`;
  }
}
renderContacts();

/* ══════════════════════════════════════════════
   STEP 3: OUTREACH MODULE
══════════════════════════════════════════════ */
const OUTREACH_STATUSES = {
  not_contacted:'Not Contacted',contacted:'Contacted',interested:'Interested',
  meeting_booked:'Meeting Booked',proposal_sent:'Proposal Sent',closed:'Closed'
};
const STATUS_TAG = {not_contacted:'slate',contacted:'blue',interested:'amber',meeting_booked:'violet',proposal_sent:'orange',closed:'green'};

let prospects = [
  {id:1,company:'Apex Solutions LLC', contact:'Tom Diaz',   method:'Email',    status:'meeting_booked',lastTouch:'Today',     followUp:'Thu May 22',notes:'Saw our LinkedIn post. Interested in full platform. Demo booked Thu 2pm.'},
  {id:2,company:'Blue Ridge Logistics', contact:'Diana Wu',   method:'LinkedIn', status:'interested',    lastTouch:'Yesterday', followUp:'Fri May 23', notes:'Responded positively. Operations automation is their #1 need. Discovery call Friday.'},
  {id:3,company:'River City HVAC',     contact:'Bob Russo',  method:'Email',    status:'proposal_sent', lastTouch:'May 14',    followUp:'May 20',     notes:'Cold outreach, warm response. Proposal sent. CFO review in progress.'},
  {id:4,company:'Precision Auto Repair',     contact:'Carol Ames', method:'Phone',    status:'contacted',     lastTouch:'May 8',     followUp:'May 19',     notes:'Left voicemail. Sent intro email. Follow up this week.'},
  {id:5,company:'Atlas Mechanical',  contact:'Mike Chang', method:'Email',    status:'not_contacted', lastTouch:'—',         followUp:'May 19',     notes:'Found via LinkedIn. 45-person team. Strong workflow automation need.'},
  {id:6,company:'BlueLine Consulting',contact:'Sara Patel', method:'LinkedIn', status:'interested',    lastTouch:'May 13',    followUp:'May 20',     notes:'Connected on LinkedIn. Interested in demo after current software contract ends.'},
  {id:7,company:'FastLane Freight',contact:'Greg King',  method:'Email',    status:'contacted',     lastTouch:'May 15',    followUp:'May 20',     notes:'Sent intro email with case study. No response yet.'},
  {id:8,company:'Peak Operations Co.',contact:'Lisa Brown', method:'Referral', status:'closed',        lastTouch:'May 10',    followUp:'—',          notes:'Referred by NFINITY HQ. Closed deal. Onboarding June 1.'},
];

let outreachFilter = 'all';
function setOutreachFilter(f,btn){ outreachFilter=f; document.querySelectorAll('#outreach-filters .fpill').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderOutreach(); }

function renderOutreachStats(){
  const el=document.getElementById('outreach-stats-bar'); if(!el) return;
  const counts={};
  Object.keys(OUTREACH_STATUSES).forEach(k=>counts[k]=0);
  prospects.forEach(p=>{ if(counts[p.status]!==undefined) counts[p.status]++; });
  const total=prospects.length;
  const pipeline=prospects.filter(p=>['interested','meeting_booked','proposal_sent'].includes(p.status)).length;
  const closed=prospects.filter(p=>p.status==='closed').length;
  el.innerHTML=`
    <div class="outreach-stat"><div class="outreach-stat-val">${total}</div><div class="outreach-stat-label">Total</div></div>
    <div class="outreach-stat"><div class="outreach-stat-val" style="color:var(--amber)">${counts.not_contacted+counts.contacted}</div><div class="outreach-stat-label">To Contact</div></div>
    <div class="outreach-stat"><div class="outreach-stat-val" style="color:var(--violet)">${pipeline}</div><div class="outreach-stat-label">In Pipeline</div></div>
    <div class="outreach-stat"><div class="outreach-stat-val" style="color:var(--green)">${closed}</div><div class="outreach-stat-label">Closed</div></div>`;
}

function renderOutreach() {
  renderOutreachStats();
  const el=document.getElementById('outreach-list'); if(!el) return;
  const q=(document.getElementById('outreach-search')?.value||'').toLowerCase();
  let filtered=prospects.filter(p=>{
    const matchQ=!q||p.company.toLowerCase().includes(q)||p.contact.toLowerCase().includes(q)||p.status.toLowerCase().includes(q);
    return matchQ&&(outreachFilter==='all'||p.status===outreachFilter);
  });
  el.innerHTML=filtered.map(p=>{
    const hist=p.history||[];
    return `
    <div class="prospect-card">
      <div class="prospect-top">
        <div>
          <div class="prospect-name">${esc(p.company)}</div>
          <div class="prospect-contact">${esc(p.contact)} &middot; via ${esc(p.method)}${p.value?` &middot; <span style="color:var(--green);font-family:'DM Mono',monospace">${esc(p.value)}</span>`:''}</div>
        </div>
        <span class="tag ${STATUS_TAG[p.status]}">${esc(OUTREACH_STATUSES[p.status]||p.status)}</span>
      </div>
      <div class="prospect-meta">
        <span>Last touch: ${esc(p.lastTouch)}</span>
        <span>Follow-up: ${esc(p.followUp)}</span>
      </div>
      ${p.notes?`<div class="prospect-notes">${esc(p.notes)}</div>`:''}
      ${hist.length>0?`<div class="prospect-history">
        <div class="prospect-history-title">Contact History (${hist.length})</div>
        ${hist.slice(-4).reverse().map(h=>`<div class="prospect-history-item"><span class="prospect-hist-icon" style="width:14px;display:inline-flex;align-items:center"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="3" r="1.8" stroke="currentColor" stroke-width="1.1"/><path d="M1 10c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg></span><div><span style="color:var(--subtle)">${esc(h.action)}</span> &mdash; <span style="color:var(--dim)">${esc(h.date)}</span>${h.note?`<div style="color:var(--dim);font-size:.72rem">${esc(h.note)}</div>`:''}</div></div>`).join('')}
      </div>`:''}
      <div style="display:flex;gap:.375rem;margin-top:.625rem;align-items:center;flex-wrap:wrap">
        <input class="ph-note-input" id="ph-note-${Number(p.id)}" placeholder="Log a note or next action..." style="flex:1;min-width:140px">
        <button class="btn-outline btn-sm" onclick="logProspectNote(${Number(p.id)})">Log Note</button>
        <button class="btn-outline btn-sm" onclick="logProspectContact(${Number(p.id)},'Email','')">Email</button>
        <button class="btn-outline btn-sm" onclick="logProspectContact(${Number(p.id)},'Call','')">Call</button>
        <button class="btn-outline btn-sm" onclick="logProspectContact(${Number(p.id)},'Meeting','')">Meeting</button>
      </div>
      <div class="prospect-actions" style="margin-top:.5rem">
        ${Object.entries(OUTREACH_STATUSES).filter(([k])=>k!==p.status).map(([k,v])=>`<button class="btn-outline btn-sm" onclick="setProspectStatus(${Number(p.id)},'${escAttr(k)}')">${esc(v)}</button>`).join('')}
        <button class="btn-danger btn-sm" onclick="deleteProspect(${Number(p.id)})">Remove</button>
      </div>
    </div>`;
  }).join('') || `<div class="empty-state"><div class="empty-state-icon"><svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M4 24l8-8 6 4 10-12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="empty-state-title">No prospects in this category</div><div class="empty-state-desc">Add a new prospect using the button above, or switch to a different filter.</div></div>`;
}

function logProspectNote(id){
  const p=prospects.find(p=>p.id===id); if(!p) return;
  const input=document.getElementById('ph-note-'+id);
  const note=input?.value?.trim();
  if(!note){toast('Enter a note first','warn');return;}
  if(!p.history) p.history=[];
  p.history.push({action:'Note logged',date:'Today',note});
  p.lastTouch='Today';
  input.value='';
  renderOutreach();
  toast('Note logged for '+p.company);
}

function logProspectContact(id,type,icon){
  const p=prospects.find(p=>p.id===id); if(!p) return;
  if(!p.history) p.history=[];
  const note=document.getElementById('ph-note-'+id)?.value?.trim()||'';
  p.history.push({icon,action:type+' logged',date:'Today',note});
  p.lastTouch='Today';
  if(document.getElementById('ph-note-'+id)) document.getElementById('ph-note-'+id).value='';
  renderOutreach();
  addActivity('blue','<strong>'+type+' logged</strong> &mdash; '+p.company+' ('+p.contact+')');
  toast(type+' logged for '+p.company);
}

function setProspectStatus(id,status){ const p=prospects.find(p=>p.id===id); if(p){p.status=status;p.lastTouch='Today';if(!p.history)p.history=[];p.history.push({action:'Status changed to '+OUTREACH_STATUSES[status],date:'Today'});renderOutreach();toast('Status updated: '+OUTREACH_STATUSES[status]);} }
function deleteProspect(id){ prospects=prospects.filter(p=>p.id!==id); renderOutreach(); toast('Prospect removed'); }
renderOutreach();

/* ══════════════════════════════════════════════
   STEP 4: PIPELINE (DRAG-AND-DROP)
══════════════════════════════════════════════ */
const PIP_COLS = ['new','contacted','interested','meeting_booked','proposal_sent','won','lost'];
const PIP_LABELS = {new:'New',contacted:'Contacted',interested:'Interested',meeting_booked:'Meeting Booked',proposal_sent:'Proposal Sent',won:'Won',lost:'Lost'};
const PIP_COL_COLOR = {new:'var(--dim)',contacted:'var(--blue)',interested:'var(--amber)',meeting_booked:'var(--violet)',proposal_sent:'var(--orange)',won:'var(--green)',lost:'var(--red)'};

let pipelineCards = [
  {id:1,name:'Atlas Mechanical',  value:'$4,200/mo',col:'new',         contact:'Mike Chang', notes:'45-person team'},
  {id:2,name:'FastLane Freight',value:'$2,800/mo',col:'contacted',   contact:'Greg King',  notes:'Email sequence started'},
  {id:3,name:'Precision Auto Repair',     value:'$3,100/mo',col:'contacted',   contact:'Carol Ames', notes:'Phone qualified'},
  {id:4,name:'Blue Ridge Logistics', value:'$5,500/mo',col:'interested',  contact:'Diana Wu',   notes:'LinkedIn outreach'},
  {id:5,name:'BlueLine Consulting',value:'$6,000/mo',col:'interested',  contact:'Sara Patel', notes:'Contract ends Q3'},
  {id:6,name:'Apex Solutions LLC', value:'$4,800/mo',col:'meeting_booked',contact:'Tom Diaz',notes:'Demo Thu 2pm'},
  {id:7,name:'River City HVAC',    value:'$7,200/mo',col:'proposal_sent',contact:'Bob Russo',notes:'CFO review'},
  {id:8,name:'Peak Operations Co.',value:'$3,900/mo',col:'won',        contact:'Lisa Brown', notes:'Onboarding Jun 1'},
  {id:9,name:'Echo Global',          value:'$9,200/mo',col:'won', contact:'James Porter',notes:'Active client since Nov 2023'},
  {id:10,name:'Sunset Consulting',value:'$2,100/mo',col:'lost',        contact:'Jay Nash',   notes:'Went with competitor'},
];

function renderPipelineTotals(){
  const el=document.getElementById('pip-total-bar'); if(!el) return;
  const active=pipelineCards.filter(c=>c.col!=='lost');
  const won=pipelineCards.filter(c=>c.col==='won');
  const pipeline=pipelineCards.filter(c=>!['won','lost'].includes(c.col));
  function sumVal(arr){return arr.reduce((s,c)=>{const n=parseFloat(c.value.replace(/[^0-9.]/g,''))||0;return s+n;},0);}
  el.innerHTML=`
    <div class="pip-total-item"><div class="pip-total-label">Total Deals</div><div class="pip-total-val" style="color:var(--heading)">${pipelineCards.length}</div></div>
    <div class="pip-total-item"><div class="pip-total-label">Pipeline</div><div class="pip-total-val">$${(sumVal(pipeline)/1000).toFixed(1)}k/mo</div></div>
    <div class="pip-total-item"><div class="pip-total-label">Won MRR</div><div class="pip-total-val">$${(sumVal(won)/1000).toFixed(1)}k/mo</div></div>
    <div class="pip-total-item"><div class="pip-total-label">Active</div><div class="pip-total-val" style="color:var(--amber)">${pipeline.length}</div></div>
    <div class="pip-total-item"><div class="pip-total-label">Won</div><div class="pip-total-val" style="color:var(--green)">${won.length}</div></div>
    <div class="pip-total-item"><div class="pip-total-label">Lost</div><div class="pip-total-val" style="color:var(--red)">${pipelineCards.filter(c=>c.col==='lost').length}</div></div>`;
}

function renderPipeline() {
  renderPipelineTotals();
  const board=document.getElementById('pipeline-board'); if(!board) return;
  board.innerHTML=PIP_COLS.map(col=>{
    const cards=pipelineCards.filter(c=>c.col===col);
    const colTotal=cards.reduce((s,c)=>{const n=parseFloat(c.value.replace(/[^0-9.]/g,''))||0;return s+n;},0);
    return `<div class="pip-col" data-col="${escAttr(col)}">
      <div class="pip-hd">
        <div>
          <span class="pip-col-name" style="color:${PIP_COL_COLOR[col]||'inherit'}">${esc(PIP_LABELS[col]||col)}</span>
          <div class="pip-col-total">${colTotal>0?'$'+(colTotal/1000).toFixed(1)+'k/mo':''}</div>
        </div>
        <span class="pip-count">${cards.length}</span>
      </div>
      <div class="pip-body">${cards.map(c=>`
        <div class="pip-card" draggable="true" data-cid="${Number(c.id)}">
          <div class="pip-card-name">${esc(c.name)}</div>
          <div class="pip-card-val">${esc(c.value)}</div>
          <div class="pip-card-meta">${esc(c.contact)} &middot; ${esc(c.notes)}</div>
          <div class="pip-card-actions">
            ${PIP_COLS.filter(nextCol=>nextCol!==col&&PIP_COLS.indexOf(nextCol)===PIP_COLS.indexOf(col)+1).map(nextCol=>
              `<button class="btn-outline btn-sm" style="font-size:.68rem;padding:.2rem .5rem" onclick="event.stopPropagation();movePipCard(${Number(c.id)},'${escAttr(nextCol)}')">&#8594; ${esc(PIP_LABELS[nextCol])}</button>`).join('')}
            <button class="btn-danger btn-sm" style="margin-left:auto;font-size:.68rem;padding:.2rem .5rem" onclick="event.stopPropagation();removePipCard(${Number(c.id)})">&#x2715;</button>
          </div>
        </div>`).join('')}
      <button class="pip-add-btn" onclick="openModal('deal')">+ Add deal here</button>
      </div>
    </div>`;
  }).join('');
  initPipelineDrag();
}

function movePipCard(cid,newCol){
  const card=pipelineCards.find(c=>c.id===cid); if(!card) return;
  const prevCol=card.col; card.col=newCol;
  renderPipeline();
  if(newCol==='won'&&prevCol!=='won'){addActivity('green','<strong>Deal won</strong> &mdash; '+card.name+' closed. '+card.value);toast('Deal won: '+card.name);}
  else toast('Moved '+card.name+' to '+PIP_LABELS[newCol]);
}
function removePipCard(cid){ pipelineCards=pipelineCards.filter(c=>c.id!==cid); renderPipeline(); toast('Deal removed'); }

function initPipelineDrag() {
  let dragging=null;
  document.querySelectorAll('.pip-card').forEach(card=>{
    card.addEventListener('dragstart',e=>{dragging=card;card.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
    card.addEventListener('dragend',()=>{if(dragging)dragging.classList.remove('dragging');dragging=null;document.querySelectorAll('.pip-col').forEach(c=>c.classList.remove('drag-over'));});
  });
  document.querySelectorAll('.pip-col').forEach(col=>{
    col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('drag-over');});
    col.addEventListener('dragleave',()=>col.classList.remove('drag-over'));
    col.addEventListener('drop',e=>{
      e.preventDefault();col.classList.remove('drag-over');if(!dragging)return;
      const cid=parseInt(dragging.dataset.cid);
      const card=pipelineCards.find(c=>c.id===cid);if(!card)return;
      const prevCol=card.col; card.col=col.dataset.col;
      renderPipeline();
      if(card.col==='won'&&prevCol!=='won'){addActivity('green','<strong>Deal won</strong> &mdash; '+card.name+' moved to Won stage. '+card.value);toast('Deal won: '+card.name,'');}
      else toast('Moved '+card.name+' to '+PIP_LABELS[card.col]);
    });
  });
}
renderPipeline();

/* ══════════════════════════════════════════════
   NOTIFICATION + FILE ICON MAPS
   (declared here so renderFiles() can use FILE_TYPE_SVG)
══════════════════════════════════════════════ */
const NOTIF_ICONS={
  alert:   '<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 2.5L1.5 12.5h12L7.5 2.5z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.5 6v3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="7.5" cy="11" r=".7" fill="currentColor"/></svg>',
  warning: '<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 2.5L1.5 12.5h12L7.5 2.5z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.5 6v3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="7.5" cy="11" r=".7" fill="currentColor"/></svg>',
  finance: '<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="currentColor" stroke-width="1.3"/><path d="M7.5 4v8M5.5 5.5h2.5a1.2 1.2 0 010 2.4H6.7a1.2 1.2 0 000 2.4h2.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  payment: '<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="currentColor" stroke-width="1.3"/><path d="M7.5 4v8M5.5 5.5h2.5a1.2 1.2 0 010 2.4H6.7a1.2 1.2 0 000 2.4h2.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  upload:  '<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 4.5a1 1 0 011-1h3l2 2.5h6a1 1 0 011 1v5a1 1 0 01-1 1H2a1 1 0 01-1-1v-7.5z" stroke="currentColor" stroke-width="1.3"/></svg>',
  done:    '<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 7.5l2.5 2.5 3.5-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trend:   '<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1.5 12l4-5 3.5 2.5 5-7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  task:    '<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2.5 7.5l3.5 3.5 6.5-7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  system:  '<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" stroke-width="1.3"/><path d="M7.5 1.5v2M7.5 11.5v2M13.5 7.5h-2M3.5 7.5h-2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
};
const FILE_TYPE_SVG={
  PDF:   '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 3h8l4 4v10H4V3z" stroke="currentColor" stroke-width="1.2"/><path d="M12 3v4h4" stroke="currentColor" stroke-width="1.2"/><path d="M6.5 12h1.2a1.2 1.2 0 000-2.4H6.5V14" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 9.6H12a1.7 1.7 0 010 3.4h-1.5V9.6z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 9.6v4.4M14 9.6h2M14 11.8h1.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>',
  Image: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="3" width="16" height="14" rx="1.5" stroke="currentColor" stroke-width="1.2"/><circle cx="7" cy="8" r="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M2 14l4-4 3 3 3-3 4 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  Sheet: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M2 7h16M2 12h16M8 2v16M13 2v16" stroke="currentColor" stroke-width="1.2"/></svg>',
  Doc:   '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 2h8l4 4v12H4V2z" stroke="currentColor" stroke-width="1.2"/><path d="M12 2v4h4" stroke="currentColor" stroke-width="1.2"/><path d="M7 9h6M7 12h6M7 15h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
};

/* ══════════════════════════════════════════════
   STEP 5+10: UPLOADS MODULE (COMPLETE)
══════════════════════════════════════════════ */
const FILE_KEY = 'nfinity_files';
function loadFilesLS(){
  try { const d=JSON.parse(localStorage.getItem(FILE_KEY)); if(Array.isArray(d)) return d; } catch{}
  return FILE_SEED;
}
function saveFilesLS(){ try { localStorage.setItem(FILE_KEY, JSON.stringify(files.slice(0,500))); } catch{} }
const FILE_SEED = [
  {id:1,  name:'DOT_Insurance_Certificate_2026.pdf',       type:'PDF',  size:'312 KB', date:'Today',     tag:'Insurance',  status:'completed', category:'Compliance', icon:'doc'},
  {id:2,  name:'Invoice_INV-2231_EchoGlobal.pdf',          type:'PDF',  size:'88 KB',  date:'Today',     tag:'Invoice',    status:'completed', category:'Finance',    icon:'doc'},
  {id:3,  name:'VehicleInspection_FleetUnit14_2026.docx',  type:'Doc',  size:'210 KB', date:'Yesterday', tag:'Inspection', status:'completed', category:'Operations', icon:'doc'},
  {id:4,  name:'QuarterlyFiling_Q1_2026.xlsx',             type:'Sheet',size:'445 KB', date:'Yesterday', tag:'Filing',     status:'completed', category:'Compliance', icon:''},
  {id:5,  name:'Service_Agreement_JB4824_Signed.pdf',      type:'PDF',  size:'142 KB', date:'2d ago',    tag:'Agreement',  status:'completed', category:'Operations', icon:'doc'},
  {id:6,  name:'CDL_Marcus_Webb_Unit14_exp2026.jpg',        type:'Image',size:'1.2 MB', date:'3d ago',    tag:'Compliance', status:'completed', category:'Compliance', icon:''},
  {id:7,  name:'Commercial_Liability_Policy_2026.pdf',      type:'PDF',  size:'2.4 MB', date:'1w ago',    tag:'Insurance',  status:'completed', category:'Compliance', icon:'doc'},
  {id:8,  name:'Operations_Report_May2026.xlsx',            type:'Sheet',size:'320 KB', date:'1w ago',    tag:'Report',     status:'completed', category:'Operations', icon:''},
  {id:9,  name:'Q1_2026_Regulatory_Filing_IFTA.pdf',        type:'PDF',  size:'540 KB', date:'2w ago',    tag:'Filing',     status:'flagged',   category:'Compliance', icon:'doc'},
  {id:10, name:'Medical_Card_TonyMarsh_DOT_exp062026.jpg',  type:'Image',size:'890 KB', date:'2w ago',    tag:'Compliance', status:'completed', category:'Compliance', icon:''},
  {id:11, name:'Contract_JB4821_Countersigned.pdf',         type:'PDF',  size:'310 KB', date:'3w ago',    tag:'Contract',   status:'completed', category:'Operations', icon:'doc'},
  {id:12, name:'Client_Agreement_NfinityHQ_2026.pdf',       type:'PDF',  size:'1.1 MB', date:'1mo ago',   tag:'Contract',   status:'completed', category:'Legal',      icon:'doc'},
  {id:13, name:'Expense_Statement_Apr2026.pdf',             type:'PDF',  size:'220 KB', date:'1mo ago',   tag:'Finance',    status:'completed', category:'Finance',    icon:'doc'},
];
let files = loadFilesLS();

let fileFilter='all';
function setFileFilter(f,btn){fileFilter=f;document.querySelectorAll('#page-uploads .fpill').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderFiles();}

function renderUploadStats(){
  const el=document.getElementById('upload-stats-row');if(!el)return;
  const active=files;
  const total=active.length;
  const completed=active.filter(f=>f.status==='completed').length;
  const flagged=active.filter(f=>f.status==='flagged').length;
  const uploading=active.filter(f=>f.status==='uploading'||f.status==='processing').length;
  el.innerHTML=`
    <div class="upload-stat"><strong>${total}</strong> Total Files</div>
    <div class="upload-stat"><strong style="color:var(--green)">${completed}</strong> Completed</div>
    ${uploading?`<div class="upload-stat"><strong style="color:var(--blue)">${uploading}</strong> Processing</div>`:''}
    ${flagged?`<div class="upload-stat"><strong style="color:var(--red)">${flagged}</strong> Flagged</div>`:''}`;
}

function renderFiles(){
  const el=document.getElementById('file-list');if(!el)return;
  const q=(document.getElementById('file-search')?.value||'').toLowerCase();
  const filtered=files.filter(f=>{
    const mq=!q||f.name.toLowerCase().includes(q)||f.tag.toLowerCase().includes(q)||f.category.toLowerCase().includes(q)||f.type.toLowerCase().includes(q);
    if(fileFilter==='all')    return mq;
    if(fileFilter==='flagged')return mq&&f.status==='flagged';
    if(fileFilter==='completed')return mq&&f.status==='completed';
    if(['Compliance','Finance','Operations','Legal','HR'].includes(fileFilter)) return mq&&f.category===fileFilter;
    return mq&&(f.type===fileFilter||f.category===fileFilter);
  });

  const typeBadgeClass={PDF:'pdf-badge',Image:'img-badge',Sheet:'sheet-badge',Doc:'doc-badge'};
  const catClass={'Compliance':'cat-compliance','Finance':'cat-finance','Operations':'cat-operations','Legal':'cat-legal','HR':'cat-hr'};

  const statusLabel={
    completed:`<span style="color:var(--green);font-size:.78rem;display:inline-flex;align-items:center;gap:.3rem"><span class="alert-dot green-dot"></span>Completed</span>`,
    uploading:`<span style="color:var(--amber);font-size:.78rem;display:inline-flex;align-items:center;gap:.3rem"><span class="alert-dot amber-dot"></span>Uploading...</span><div class="upload-progress"><div class="upload-progress-bar" style="width:40%"></div></div>`,
    processing:`<span style="color:var(--blue);font-size:.78rem;display:inline-flex;align-items:center;gap:.3rem"><span class="alert-dot" style="background:var(--blue);width:6px;height:6px;border-radius:50%;flex-shrink:0"></span>Processing</span><div class="upload-progress"><div class="upload-progress-bar" style="width:75%;background:var(--blue)"></div></div>`,
    flagged:`<span style="color:var(--red);font-size:.78rem;display:inline-flex;align-items:center;gap:.3rem"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Flagged — review required</span>`
  };

  el.innerHTML=filtered.length?filtered.map(f=>`
    <div class="file-card-enhanced ${f.status==='flagged'?'flagged-card':''}" onclick="previewFile(${Number(f.id)})">
      <div class="file-type-badge ${typeBadgeClass[f.type]||'doc-badge'}">${FILE_TYPE_SVG[f.type]||FILE_TYPE_SVG.Doc}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
          <div class="file-name" style="font-size:.875rem;font-weight:600;color:var(--heading)">${esc(f.name)}</div>
          <div style="display:flex;gap:.375rem;align-items:center;flex-shrink:0">
            <span class="tag ${f.status==='flagged'?'red':f.status==='completed'?'green':'blue'}" style="font-size:.65rem">${esc(f.status)}</span>
          </div>
        </div>
        <div style="font-size:.75rem;color:var(--dim);margin-top:.2rem;display:flex;gap:.75rem;flex-wrap:wrap">
          <span>${esc(f.type)} &middot; ${esc(f.size)}</span>
          <span>Uploaded ${esc(f.date)}</span>
          <span style="color:var(--amber)">${esc(f.tag)}</span>
          <span class="upload-cat-badge ${catClass[f.category]||''}">${esc(f.category)}</span>
        </div>
        <div style="margin-top:.35rem">${statusLabel[f.status]||esc(f.status)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:.375rem;align-items:flex-end;flex-shrink:0">
        <button class="file-btn" onclick="event.stopPropagation();previewFile(${Number(f.id)})">Preview</button>
        <button class="file-btn" onclick="event.stopPropagation();downloadFileById(${Number(f.id)})">Download</button>
        ${f.status==='flagged'?`<button class="file-btn" style="color:var(--red);border-color:rgba(239,68,68,.4)" onclick="event.stopPropagation();resolveFlag(${Number(f.id)})">Resolve</button>`:''}
        <button class="file-btn" style="color:var(--dim);border-color:var(--border)" onclick="event.stopPropagation();deleteFile(${Number(f.id)})">Remove</button>
      </div>
    </div>`).join('')
    :`<div class="empty-state"><div class="empty-state-icon"><svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M4 10a3 3 0 013-3h5l2 3h10a3 3 0 013 3v10a3 3 0 01-3 3H7a3 3 0 01-3-3V10z" stroke="currentColor" stroke-width="1.5"/></svg></div><div class="empty-state-title">No files found</div><div class="empty-state-desc">Try a different filter or category, or upload a file using the drop zone above.</div></div>`;
  renderUploadStats();
}

function deleteFile(id){files=files.filter(x=>x.id!==id);saveFilesLS();renderFiles();toast('File removed');}

function previewFile(id){
  const f=files.find(x=>x.id===id);if(!f)return;
  const catClass={'Compliance':'cat-compliance','Finance':'cat-finance','Operations':'cat-operations','Legal':'cat-legal','HR':'cat-hr'};
  const typeColor={PDF:'rgba(239,68,68,.12)',Image:'rgba(59,130,246,.12)',Sheet:'rgba(16,185,129,.12)',Doc:'rgba(139,92,246,.12)'};
  _t('modal-title', f.name);
  const safeType = typeColor[f.type] ? typeColor[f.type] : 'var(--surface)';
  document.getElementById('modal-body').innerHTML=`
    <div class="file-preview-area" style="background:${safeType}">
      <div class="file-preview-icon" style="font-size:unset">${FILE_TYPE_SVG[f.type]||FILE_TYPE_SVG.Doc}</div>
      <div class="file-preview-name">${esc(f.name)}</div>
      <div style="font-size:.72rem;color:var(--muted)">${esc(f.type)} document &mdash; demo metadata preview</div>
    </div>
    <div class="file-meta-grid">
      <div class="file-meta-item"><div class="file-meta-key">Type</div><div class="file-meta-val">${esc(f.type)}</div></div>
      <div class="file-meta-item"><div class="file-meta-key">Size</div><div class="file-meta-val">${esc(f.size)}</div></div>
      <div class="file-meta-item"><div class="file-meta-key">Uploaded</div><div class="file-meta-val">${esc(f.date)}</div></div>
      <div class="file-meta-item"><div class="file-meta-key">Status</div><div class="file-meta-val"><span class="tag ${f.status==='flagged'?'red':f.status==='completed'?'green':'blue'}">${esc(f.status)}</span></div></div>
      <div class="file-meta-item"><div class="file-meta-key">Category</div><div class="file-meta-val"><span class="upload-cat-badge ${catClass[f.category]||''}">${esc(f.category)}</span></div></div>
      <div class="file-meta-item"><div class="file-meta-key">Tag</div><div class="file-meta-val">${esc(f.tag)}</div></div>
    </div>
    <div style="font-size:.75rem;color:var(--dim);text-align:center">Demo path: /uploads/${esc(String(f.category||'').toLowerCase())}/${esc(f.name)}</div>`;
  document.querySelector('#modal .modal-actions').innerHTML=`
    <button class="btn-primary" id="modal-download-btn">Download</button>
    ${f.status==='flagged'?`<button class="btn-outline" onclick="resolveFlag(${Number(f.id)});closeModal()">Resolve Flag</button>`:''}
    <button class="btn-outline" onclick="closeModal()">Close</button>`;
  // Wire the download handler via JS rather than interpolating filename into inline JS.
  const dlBtn = document.getElementById('modal-download-btn');
  if (dlBtn) dlBtn.addEventListener('click', () => { toast('Demo file preview: ' + f.name + '. No downloadable file is stored.'); closeModal(); });
  currentModal='info';
  modalEl.classList.add('open');
}

function downloadFileById(id){
  const f=files.find(x=>x.id===id);if(!f)return;
  toast('Demo file preview: ' + f.name + '. No downloadable file is stored.');
}

function resolveFlag(id){const f=files.find(x=>x.id===id);if(f){f.status='completed';saveFilesLS();renderFiles();addActivity('green','<strong>Flagged file resolved</strong> — '+f.name+' marked completed.');toast('Flag resolved: '+f.name);}}

const uploadZone=document.getElementById('upload-zone');
if(uploadZone){
  uploadZone.addEventListener('click',triggerUpload);
  uploadZone.addEventListener('dragover',e=>{
    e.preventDefault();
    uploadZone.classList.add('drag-over');
    document.getElementById('upload-zone-icon').innerHTML='<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M4 10a3 3 0 013-3h5l2 3h10a3 3 0 013 3v10a3 3 0 01-3 3H7a3 3 0 01-3-3V10z" stroke="currentColor" stroke-width="1.5"/></svg>';
    document.getElementById('upload-zone-text').textContent='Drop to upload';
  });
  uploadZone.addEventListener('dragleave',()=>{
    uploadZone.classList.remove('drag-over');
    document.getElementById('upload-zone-icon').innerHTML='<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M4 10a3 3 0 013-3h5l2 3h10a3 3 0 013 3v10a3 3 0 01-3 3H7a3 3 0 01-3-3V10z" stroke="currentColor" stroke-width="1.5"/><path d="M16 14v7M13 17l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    document.getElementById('upload-zone-text').textContent='Drag & drop files here';
  });
  uploadZone.addEventListener('drop',e=>{
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    document.getElementById('upload-zone-icon').innerHTML='<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M4 10a3 3 0 013-3h5l2 3h10a3 3 0 013 3v10a3 3 0 01-3 3H7a3 3 0 01-3-3V10z" stroke="currentColor" stroke-width="1.5"/><path d="M16 14v7M13 17l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    document.getElementById('upload-zone-text').textContent='Drag & drop files here';
    [...e.dataTransfer.files].forEach(addUploadedFile);
  });
}
function triggerUpload(){document.getElementById('file-input').click();}
function handleFileInput(input){[...input.files].forEach(addUploadedFile);input.value='';}

function addUploadedFile(f){
  // SECURITY: sanitize filename — strip directory separators and control chars,
  // cap length, and reject empty names. The filename is later rendered into
  // multiple innerHTML templates, so even with esc() this keeps storage clean
  // and prevents path-traversal-looking strings ending up in audit logs.
  const rawName = String(f && f.name || '').replace(/[\\/\x00-\x1f\x7f]/g, '_').trim();
  const safeName = rawName.slice(0, 255) || 'unnamed';
  const allowed = /^[A-Z]{2,5}$/;
  const extRaw = (safeName.split('.').pop() || '').toUpperCase();
  const ext = allowed.test(extRaw) ? extRaw : '';
  const type=['PDF'].includes(ext)?'PDF':['JPG','JPEG','PNG','WEBP'].includes(ext)?'Image':['XLS','XLSX','CSV'].includes(ext)?'Sheet':'Doc';
  const iconMap={'PDF':'PDF','Image':'IMG','Sheet':'XLS','Doc':'DOC'}; const icon=iconMap[type]||type;
  const id=Date.now();
  const category=document.getElementById('upload-cat-default')?.value||'Operations';
  const size = Math.max(0, Number(f && f.size) || 0);
  const newFile={id,name:safeName,type,size:(size/1024).toFixed(0)+' KB',date:'Just now',tag:'Untagged',status:'uploading',category,icon};
  files.unshift(newFile);saveFilesLS();renderFiles();updateDashMetrics({docs:1});
  const zone=document.getElementById('upload-zone');
  if(zone){zone.classList.add('processing-active');setTimeout(()=>zone.classList.remove('processing-active'),3000);}
  setTimeout(()=>{const x=files.find(x=>x.id===id);if(x){x.status='processing';saveFilesLS();renderFiles();}},1200);
  setTimeout(()=>{const x=files.find(x=>x.id===id);if(x){x.status='completed';saveFilesLS();renderFiles();addActivity('blue','<strong>Document uploaded</strong> — '+esc(safeName)+' processed and ready.');}},2800);
  toast('Uploading: '+safeName);
}
renderFiles();

/* ══════════════════════════════════════════════
   STEP 6: NOTIFICATIONS MODULE
══════════════════════════════════════════════ */
let notifications=[
  {id:1,unread:true, cat:'compliance',icon:'alert',title:'Certification Expired — Jordan Reyes',          desc:'Certification expired 148 days ago. Renewal required immediately. Immediate action required.',  time:'2 min ago',  steps:['Rule triggered: Certification expiry detected','Task auto-created: Renew Certification — Jordan Reyes','Dashboard alert count updated (+1)','Notification pushed to assigned user']},
  {id:2,unread:true, cat:'finance',   icon:'finance',title:'Invoice Overdue — INV-2231 · $2,650',desc:'Echo Global invoice 18 days outstanding. Follow-up task created automatically.',         time:'14 min ago', steps:['Rule triggered: Invoice age > 14 days','Follow-up task created for Demo User','Finance alert raised on dashboard','Overdue flag added to invoice record']},
  {id:3,unread:true, cat:'compliance',icon:'warning',title:'License Renewal Due — Tony Marsh',  desc:'License expires in 22 days. Renewal must be scheduled immediately.',    time:'1h ago',     steps:['Rule triggered: 30-day expiry window','Reminder task created: License renewal','Compliance score flagged for review','Notification sent to operations manager']},
  {id:4,unread:false,cat:'upload',    icon:'upload',title:'Document Uploaded — Rate Confirmation',desc:'Rate Confirmation LD-4824 uploaded by Sandra Liu. File processed and categorized.',    time:'1h ago',     steps:['File received: Rate_Confirmation_LD4824.pdf','Automated review: PASSED','Category assigned: Operations','Document indexed and searchable']},
  {id:5,unread:false,cat:'system',    icon:'done',title:'Task Completed — Annual Registration Renewal',        desc:'Admin User marked "Annual Registration Renewal" complete. Compliance record updated.',        time:'3h ago',     steps:['Task status updated to Done','Compliance record updated','Assigned user notified','Activity feed updated']},
  {id:6,unread:false,cat:'system',    icon:'trend',title:'Deal Moved — Apex Solutions LLC',       desc:'Apex Solutions moved to Meeting Booked stage. Demo call Thu 2pm.',                        time:'5h ago',     steps:['Pipeline card updated: Meeting Booked','CRM interaction logged','Follow-up reminder set for post-demo','Outreach status synced']},
  {id:7,unread:false,cat:'compliance',icon:'task',title:'Q2 Regulatory Filing Reminder',             desc:'Q2 regulatory filing due July 31. 76 days remaining. Begin preparation.',                     time:'8h ago',     steps:['Rule triggered: 90-day filing reminder','Reminder task created: Q2 filing prep','Assigned to Admin User','Due date set: Jul 31']},
  {id:8,unread:false,cat:'finance',   icon:'payment',title:'Invoice Paid — INV-2220',             desc:'Blue Ridge Logistics paid INV-2220 · $3,400. Payment received and recorded.',           time:'Yesterday',  steps:['Payment received: $3,400','Invoice marked as paid','Revenue metrics updated','Client payment history logged']},
  {id:10,unread:false,cat:'upload',   icon:'warning', title:'File Flagged — IFTA_Q1_Filing.pdf',  desc:'Automated review flagged file for missing signature. Manual review required.',           time:'2d ago',     steps:['File received: IFTA_Q1_Filing.pdf','Automated review: FAILED — missing signature','File status set to Flagged','Alert sent to uploader for resolution']},
];

const NOTIF_CAT_ACTIONS = {
  compliance: ['<button class="btn-primary btn-sm" onclick="closeNotifDetail();navigate(\'tasks\')">View Tasks →</button>','<button class="btn-outline btn-sm" onclick="closeNotifDetail();navigate(\'uploads\')">Upload Document</button>'],
  finance:    ['<button class="btn-primary btn-sm" onclick="closeNotifDetail();navigate(\'tasks\')">Create Follow-up Task</button>','<button class="btn-outline btn-sm" onclick="closeNotifDetail();navigate(\'analytics\')">View Finance Analytics</button>'],
  upload:     ['<button class="btn-primary btn-sm" onclick="closeNotifDetail();navigate(\'uploads\')">Go to Uploads →</button>'],
  system:     ['<button class="btn-outline btn-sm" onclick="closeNotifDetail();navigate(\'simulator\')">View Automation Log</button>','<button class="btn-outline btn-sm" onclick="closeNotifDetail();navigate(\'analytics\')">View Analytics</button>'],
};

let notifFilter='all';
function setNotifFilter(f,btn){
  notifFilter=f;
  document.querySelectorAll('#page-notifications .fpill').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderNotifications();
}

function renderNotifSummary(){
  const active=notifications.filter(n=>!n.dismissed);
  const cats={compliance:0,finance:0,upload:0,system:0};
  active.forEach(n=>{if(cats[n.cat]!==undefined)cats[n.cat]++;});
  const unread=active.filter(n=>n.unread).length;
  _t('nsc-compliance',cats.compliance);
  _t('nsc-finance',cats.finance);
  _t('nsc-upload',cats.upload);
  _t('nsc-system',cats.system);
  _t('nsc-total',active.length);
  _t('nsc-unread',unread);
}

function renderNotifications(){
  const el=document.getElementById('notif-list');if(!el)return;
  const filtered=notifications.filter(n=>{
    if(n.dismissed)return false;
    if(notifFilter==='all')   return true;
    if(notifFilter==='unread')return n.unread;
    return n.cat===notifFilter;
  });
  const catColor={compliance:'red',finance:'amber',upload:'blue',system:'slate'};
  el.innerHTML=filtered.length?filtered.map(n=>`
    <div class="notif-card ${n.unread?'unread':''}" id="nc-${Number(n.id)}" onclick="openNotifDetail(${Number(n.id)})">
      <span class="notif-icon">${NOTIF_ICONS[n.icon]||NOTIF_ICONS.system}</span>
      <div class="notif-body">
        <div class="notif-title">${esc(n.title)}${n.unread?' <span style="font-size:.7rem;color:var(--amber)">●</span>':''}</div>
        <div class="notif-desc">${esc(n.desc)}</div>
        <div style="display:flex;align-items:center;gap:.375rem;margin-top:.375rem">
          <span class="tag ${catColor[n.cat]||'slate'}" style="font-size:.65rem">${esc(n.cat)}</span>
          ${n.steps?`<span style="font-size:.68rem;color:var(--dim)">${Number(n.steps.length)||0} automation steps logged</span>`:''}
        </div>
        <div class="notif-actions" onclick="event.stopPropagation()">
          ${n.unread?`<button class="btn-outline btn-sm" onclick="readNotif(${Number(n.id)})">Mark read</button>`:''}
          <button class="btn-danger btn-sm" onclick="dismissNotif(${Number(n.id)})">Dismiss</button>
          <button class="btn-outline btn-sm" onclick="openNotifDetail(${Number(n.id)})">Details →</button>
        </div>
      </div>
      <div class="notif-time">${esc(n.time)}</div>
    </div>`).join('')
    : '<div class="empty-state"><div class="empty-state-icon"><svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M16 3a8 8 0 018 8v6l2 4H6l2-4v-6a8 8 0 018-8z" stroke="currentColor" stroke-width="1.5"/><path d="M13 25a3 3 0 006 0" stroke="currentColor" stroke-width="1.5"/></svg></div><div class="empty-state-title">All caught up</div><div class="empty-state-desc">No notifications in this category. Fire a simulation to generate new alerts.</div></div>';

  const unread=notifications.filter(n=>n.unread&&!n.dismissed).length;
  _t('nb-notif',unread);
  _t('unread-count',unread);
  const dot=document.getElementById('notif-dot');if(dot)dot.style.display=unread>0?'block':'none';
  renderNotifSummary();
}

function readNotif(id){const n=notifications.find(n=>n.id===id);if(n){n.unread=false;renderNotifications();}}
function dismissNotif(id){const n=notifications.find(n=>n.id===id);if(n){n.dismissed=true;renderNotifications();toast('Notification dismissed');}}
function markAllRead(){notifications.forEach(n=>n.unread=false);renderNotifications();toast('All notifications marked as read');}
function clearAllNotifs(){notifications.forEach(n=>n.dismissed=true);renderNotifications();toast('All notifications cleared');}

function openNotifDetail(id){
  const n=notifications.find(n=>n.id===id);if(!n)return;
  readNotif(id);
  const catLabels={compliance:'Compliance',finance:'Finance',upload:'Upload',system:'System'};
  const catColors={compliance:'compliance',finance:'finance',upload:'upload',system:'system'};
  document.getElementById('ndm-icon').innerHTML=NOTIF_ICONS[n.icon]||NOTIF_ICONS.system;
  document.getElementById('ndm-title').textContent=n.title;
  document.getElementById('ndm-meta').textContent=n.time+' · '+catLabels[n.cat];
  document.getElementById('ndm-badge').innerHTML=`<span class="notif-detail-badge ${catColors[n.cat]||'system'}">${esc(catLabels[n.cat]||n.cat)}</span>`;
  document.getElementById('ndm-desc').textContent=String(n.desc||'');
  const stepsEl=document.getElementById('ndm-steps');
  if(stepsEl){
    if(n.steps&&n.steps.length){
      stepsEl.innerHTML='<div style="font-size:.72rem;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.5rem">Automation Chain</div>'+
        n.steps.map((s,i)=>`<div style="display:flex;align-items:center;gap:.625rem;padding:.3rem 0;font-size:.82rem;color:var(--subtle)"><div style="width:20px;height:20px;border-radius:50%;background:var(--green);color:var(--bg);display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;flex-shrink:0">${i+1}</div>${esc(s)}</div>`).join('<div style="width:1px;height:6px;background:var(--border);margin-left:9px"></div>');
    } else stepsEl.innerHTML='';
  }
  const actions=NOTIF_CAT_ACTIONS[n.cat]||[];
  document.getElementById('ndm-actions').innerHTML=actions.join('')+`<button class="btn-danger btn-sm" onclick="dismissNotif(${Number(id)});closeNotifDetail()">Dismiss</button>`;
  document.getElementById('notif-detail-modal').classList.add('open');
}
function closeNotifDetail(){document.getElementById('notif-detail-modal').classList.remove('open');}
document.getElementById('notif-detail-modal').addEventListener('click',function(e){if(e.target===this)closeNotifDetail();});

function pushNotification(cat,icon,title,desc,steps){
  const allowedCats = ['compliance','finance','upload','system'];
  const safeCat = allowedCats.includes(cat) ? cat : 'system';
  const safeIcon = sanitizeText(icon, _FIELD_CAPS.ident);
  const safeTitle = sanitizeText(title, _FIELD_CAPS.short);
  const safeDesc = sanitizeText(desc, _FIELD_CAPS.long);
  const safeSteps = Array.isArray(steps)
    ? steps.slice(0, 20).map(s => sanitizeText(s, _FIELD_CAPS.short))
    : [];
  const id=Date.now();
  notifications.unshift({id,unread:true,cat:safeCat,icon:safeIcon,title:safeTitle,desc:safeDesc,time:'Just now',dismissed:false,steps:safeSteps});
  renderNotifications();
  updateNotifBadge();
}
renderNotifications();

/* ══════════════════════════════════════════════
   STEP 7+8: AUTOMATION SIMULATOR + ROI LIVE UPDATES
══════════════════════════════════════════════ */
let simRunCount=0;
let simSessionStats={tasks:0,alerts:0,notifs:0,workflows:0};
let roiLive={hours:38,tasks:21,revenue:4.2,issues:0,alerts:3,workflows:21};

function updateROILive(delta={}){
  if(delta.tasks){roiLive.tasks+=delta.tasks;roiLive.hours+=delta.tasks*1.5;roiLive.workflows+=delta.tasks;}
  if(delta.alerts){roiLive.alerts+=delta.alerts;roiLive.issues+=delta.alerts;}
  if(delta.revenue){roiLive.revenue+=delta.revenue;}
  _t('roi-hours-live',Math.round(roiLive.hours)+'h');
  _t('roi-tasks-live',roiLive.tasks);
  _t('roi-revenue-live','$'+roiLive.revenue.toFixed(1)+'k');
  _t('roi-issues-live',roiLive.issues);
  _t('roi-alerts-live',roiLive.alerts);
  _t('roi-workflows-live',roiLive.workflows);
  // Update analytics live stats
  _t('an-workflows',roiLive.workflows);
  _t('an-hours',Math.round(roiLive.hours)+'h');
  // Pulse ROI cards
  ['roi-hours-live','roi-tasks-live','roi-issues-live','roi-alerts-live','roi-workflows-live'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){el.classList.remove('flashing');void el.offsetWidth;el.classList.add('flashing');setTimeout(()=>el.classList.remove('flashing'),800);}
  });
}

function resetROI(){
  roiLive={hours:38,tasks:21,revenue:4.2,issues:0,alerts:3,workflows:21};
  updateROILive();
  resetSimMetrics();
}

function flashMetric(id){
  const el=document.getElementById(id);if(!el)return;
  el.classList.remove('flashing');void el.offsetWidth;
  el.classList.add('flashing');
  setTimeout(()=>el.classList.remove('flashing'),600);
}

function flashStatCard(metricKey){
  const map={alerts:'red',tasks:'amber',docs:'blue',workflows:'violet'};
  const cls=map[metricKey];if(!cls)return;
  const card=document.querySelector(`.stat.${cls}`);
  if(!card)return;
  card.classList.remove('flashing');void card.offsetWidth;
  card.classList.add('flashing');
  setTimeout(()=>card.classList.remove('flashing'),800);
}

function updateSimPreview(delta){
  if(delta.tasks){simSessionStats.tasks+=delta.tasks||0;_t('sp-tasks',simSessionStats.tasks);flashMetric('sp-tasks');}
  if(delta.alerts){simSessionStats.alerts+=delta.alerts||0;_t('sp-alerts',simSessionStats.alerts);flashMetric('sp-alerts');}
  simSessionStats.notifs++;_t('sp-notifs',simSessionStats.notifs);flashMetric('sp-notifs');
  if(delta.workflows){simSessionStats.workflows+=delta.workflows||0;_t('sp-workflows',simSessionStats.workflows);flashMetric('sp-workflows');}
}

const SIM_SCENARIOS=[
  {id:'cert',color:'red',title:'Expired Certification Alert',
   desc:'Simulates a certification expiry detection. Fires compliance alert, auto-creates task, pushes notification, updates dashboard counts, and increments ROI counters.',
   trigger:'Simulate Expired Certification',
   chain:['Scan: Certification expiry detected','Task auto-created: Renew Certification — High Priority','Dashboard: +1 compliance alert','Notification pushed to operations manager','ROI: +1.5h saved vs manual tracking'],
   run(){
     const certContacts=['Marcus Webb','Karen Okonkwo','Darnell King','Tony Marsh'];
     const certName=certContacts[Math.floor(Math.random()*certContacts.length)];
     const t={title:`Renew certification — ${certName} (expired)`,priority:'high',status:'open',assigned_to:'Admin User',client_id:'demo',due_date:new Date().toISOString().split('T')[0],tag:'Compliance',notes:'Auto-created by automation engine. Certification expired. Immediate renewal required.'};
     addTask(t);
     updateDashMetrics({alerts:1,workflows:1});
     flashStatCard('alerts');flashStatCard('tasks');
     pushNotification('compliance','alert',`Certification Expired — ${certName}`,'Automation engine detected expired certification. Renewal task auto-created.',['Rule triggered: Certification expiry detected','Task auto-created: Renew Certification','Dashboard alert +1','Notification pushed to assigned user']);
     addActivity('red',`<strong>Compliance alert</strong> — ${certName} certification expired. Renewal task auto-created by workflow engine.`);
     simLog('red',`[COMPLIANCE] Certification expiry rule → ${certName} → task created → notification pushed → dashboard updated`);
     updateSimPreview({tasks:1,alerts:1,workflows:1});
     updateROILive({tasks:1,alerts:1});
     toast('Certification expiry simulated — check Tasks and Notifications');
   }},
  {id:'invoice',color:'amber',title:'Missed Invoice Alert',
   desc:'Simulates an overdue invoice detection. Creates follow-up task, flags in finance, pushes notification, recovers revenue visibility.',
   trigger:'Simulate Missed Invoice',
   chain:['Scan: Invoice age > 14 days detected','Follow-up task auto-created for assigned user','Finance alert raised on dashboard','Notification pushed: Invoice overdue','ROI: $800 revenue at-risk surfaced'],
   run(){
     const invoiceCos=['Echo Global','Blue Ridge Logistics','River City HVAC','Precision Auto Repair','Atlas Mechanical'];
     const invCo=invoiceCos[Math.floor(Math.random()*invoiceCos.length)];
     const invAmt=['$2,800','$3,650','$4,100','$1,950','$5,200'][Math.floor(Math.random()*5)];
     const t={title:`Follow up — ${invCo} · ${invAmt} overdue invoice`,priority:'high',status:'open',assigned_to:'Demo User',client_id:'demo',due_date:new Date().toISOString().split('T')[0],tag:'Finance',notes:'Auto-created by automation engine. Invoice 21 days outstanding.'};
     addTask(t);
     updateDashMetrics({workflows:1});
     flashStatCard('tasks');
     pushNotification('finance','finance',`Invoice Overdue — ${invCo} · ${invAmt}`,`${invCo} invoice 21 days outstanding. Follow-up task auto-created.`,['Rule: Invoice age > 14d','Follow-up task created','Finance dashboard updated','Notification sent to assignee']);
     addActivity('amber',`<strong>Invoice overdue</strong> — ${invCo} · ${invAmt} · 21 days outstanding. Follow-up task created.`);
     simLog('amber',`[FINANCE] Invoice overdue rule → ${invCo} · ${invAmt} → follow-up task created → finance alert pushed`);
     updateSimPreview({tasks:1,workflows:1});
     updateROILive({tasks:1,revenue:0.8});
     toast('Invoice overdue simulated');
   }},
  {id:'task',color:'amber',title:'Overdue Task Escalation',
   desc:'Simulates a task passing its due date. Escalates priority automatically, notifies assigned user, updates task board.',
   trigger:'Simulate Overdue Task',
   chain:['Scan: Task deadline passed','Priority escalated: medium → HIGH','Assignee notification sent','Escalation logged to activity feed','ROI: prevented missed deadline'],
   run(){
     const t={title:'ESCALATED: Task overdue — deadline passed, immediate action needed',priority:'high',status:'open',assigned_to:'Admin User',client_id:'demo',due_date:'2026-05-10',tag:'Escalated',notes:'Auto-escalated by automation engine. Original due date passed.'};
     addTask(t);
     updateDashMetrics({tasks:1,workflows:1});
     flashStatCard('tasks');flashStatCard('workflows');
     pushNotification('system','task','Task Overdue (Simulated)','A task deadline has passed. Priority escalated to HIGH. Assigned user notified.',['Rule: Due date exceeded','Priority escalated to HIGH','Task re-assigned to Admin User','Escalation notification sent']);
     addActivity('amber','<strong>Task escalated</strong> — Overdue task auto-escalated to high priority by workflow engine.');
     simLog('amber','[TASKS] Due-date rule → priority escalated → user notification → dashboard updated');
     updateSimPreview({tasks:1,workflows:1});
     updateROILive({tasks:1,alerts:1});
     toast('Overdue task escalation simulated');
   }},
  {id:'upload',color:'blue',title:'Upload Issue Flagged',
   desc:'Simulates a document failing automated review. Flags the file, notifies uploader, blocks processing until resolved.',
   trigger:'Simulate Upload Issue',
   chain:['File received and scanned','Automated review: FAILED — missing signature','File status set to Flagged','Alert sent to uploader','Processing blocked pending resolution'],
   run(){
     files.unshift({id:Date.now(),name:'SIMULATED_Document_Missing_Signature.pdf',type:'PDF',size:'220 KB',date:'Just now',tag:'Legal',status:'flagged',category:'Legal',icon:'doc',notes:'Auto-flagged by document review engine.'});
     renderFiles();updateDashMetrics({docs:1});
     flashStatCard('docs');
     pushNotification('upload','warning','Document Flagged (Simulated)','Automated review detected missing signature on uploaded document. Manual review required.',['File received: SIMULATED_Document.pdf','Automated review: FAILED','File status: Flagged','Alert sent to uploader']);
     addActivity('red','<strong>Upload flagged</strong> — Document failed automated review. Missing signature detected.');
     simLog('blue','[UPLOADS] Document review rule → file flagged → uploader notified → processing blocked');
     updateSimPreview({});
     updateROILive({alerts:1});
     toast('Upload issue simulated — check Uploads');
   }},
  {id:'compliance',color:'amber',title:'30-Day Compliance Warning',
   desc:'Simulates a 30-day pre-expiry compliance warning. Creates reminder task, shows dashboard alert, starts renewal countdown.',
   trigger:'Simulate Compliance Warning',
   chain:['Scan: Expiry date within 30 days','30-day warning threshold crossed','Reminder task auto-created','Compliance score pre-flagged','Dashboard compliance alert +1'],
   run(){
     const t={title:'REMINDER: License expiring in 30 days — schedule renewal',priority:'medium',status:'open',assigned_to:'Demo User',client_id:'demo',due_date:new Date(Date.now()+30*86400000).toISOString().split('T')[0],tag:'Compliance',notes:'Auto-created by automation engine. 30-day compliance reminder.'};
     addTask(t);
     updateDashMetrics({alerts:1,workflows:1});
     flashStatCard('alerts');flashStatCard('workflows');
     pushNotification('compliance','warning','30-Day Compliance Warning (Simulated)','Medical card expiring in 30 days. Renewal reminder task created and assigned.',['Rule: 30-day expiry window triggered','Reminder task auto-created','Assigned to Demo User','Compliance dashboard pre-flagged']);
     addActivity('amber','<strong>Compliance warning</strong> — 30-day reminder fired. Task created for medical card renewal.');
     simLog('amber','[COMPLIANCE] 30-day warning rule → reminder task created → compliance alert raised → ROI tracked');
     updateSimPreview({tasks:1,alerts:1,workflows:1});
     updateROILive({tasks:1,alerts:1});
     toast('Compliance warning simulated');
   }},
  {id:'opportunity',color:'blue',title:'New Lead Detected',
   desc:'Simulates inbound lead detection. Auto-creates a follow-up task, adds prospect to Outreach, notifies the team, and logs to the activity feed.',
   trigger:'Simulate New Lead',
   chain:['Inbound lead signal detected','Prospect added to Outreach pipeline','Follow-up task auto-created: High Priority','Notification pushed to sales team','ROI: 1.5h saved vs manual entry'],
   run(){
     const LEAD_COS=[
       {company:'Pinnacle Enterprises',contact:'Rachel Foster',method:'LinkedIn'},
       {company:'Summit Tech Group',  contact:'Devon Marsh',  method:'Email'},
       {company:'Vertex Solutions',   contact:'Nina Okafor',  method:'Phone'},
       {company:'Keystone Industries',contact:'Aaron Blaine', method:'Email'},
       {company:'Horizon Consulting', contact:'Clara Nguyen', method:'LinkedIn'},
       {company:'Catalyst Partners',  contact:'Marcus Webb',  method:'Referral'},
     ];
     const lead=LEAD_COS[Math.floor(Math.random()*LEAD_COS.length)];
     const followDate=new Date(Date.now()+2*86400000).toLocaleDateString('en-US',{month:'short',day:'numeric'});
     prospects.unshift({
       id: Date.now(),
       company:   lead.company,
       contact:   lead.contact,
       method:    lead.method,
       status:    'not_contacted',
       lastTouch: 'Just now',
       followUp:  followDate,
       notes:     'Auto-detected by NFINITY HQ. Inbound lead — schedule discovery call.',
     });
     const t={title:`Follow up with ${lead.company} — new inbound lead`,priority:'high',status:'open',assigned_to:'Demo User',client_id:'demo',due_date:new Date(Date.now()+2*86400000).toISOString().split('T')[0],tag:'Outreach',notes:'Auto-created by automation engine. New inbound lead detected.'};
     addTask(t);
     updateDashMetrics({tasks:1,workflows:1});
     flashStatCard('tasks');
     pushNotification('system','task',`New Lead: ${lead.company}`,`${lead.contact} via ${lead.method}. Follow-up task created. Added to Outreach pipeline.`,['Lead signal detected','Prospect added to Outreach','Task auto-created: high priority','Team notification sent','ROI: +1.5h saved']);
     addActivity('blue',`<strong>New lead detected</strong> — ${lead.company} (${lead.contact}) added to Outreach pipeline. Follow-up scheduled.`);
     simLog('blue','[OUTREACH] Lead signal → prospect created → task auto-assigned → notification pushed → Outreach updated');
     updateSimPreview({tasks:1,workflows:1});
     updateROILive({tasks:1});
     if(document.getElementById('page-outreach').classList.contains('active')){renderOutreachStats();renderOutreach();}
     toast(`New lead detected: ${lead.company} — check Outreach`);
   }},
];

function buildSimGrid(){
  const grid=document.getElementById('sim-grid');if(!grid)return;
  grid.innerHTML=SIM_SCENARIOS.map(s=>`
    <div class="sim-card" id="sc-${s.id}">
      <div class="sim-card-title">${s.trigger.split(' ').slice(1).join(' ')}</div>
      <div class="sim-card-desc">${s.desc}</div>
      <div style="margin-bottom:.75rem">
        <div style="font-size:.68rem;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.35rem">Automation Chain</div>
        ${s.chain.map((c,i)=>`<div style="display:flex;align-items:center;gap:.375rem;font-size:.72rem;color:var(--subtle);padding:.15rem 0"><span style="font-size:.65rem;color:var(--amber);font-weight:700;width:14px;text-align:center">${i+1}</span>${c}</div>`).join('')}
      </div>
      <button class="sim-trigger ${s.color||''}" id="st-${s.id}" onclick="runScenario('${s.id}')">${s.trigger}</button>
    </div>`).join('');
}

const simLogEntries=[];
function simLog(color,msg){
  // Cap log length to avoid memory blowup if a scenario somehow loops.
  if (simLogEntries.length >= 500) simLogEntries.length = 500;
  const allowedColors = ['red','amber','green','blue','violet','muted','slate'];
  const safeColor = allowedColors.includes(color) ? color : 'slate';
  simLogEntries.unshift({time:new Date().toLocaleTimeString(),color:safeColor,msg:String(msg||'')});
  const el=document.getElementById('sim-log');if(!el)return;
  el.innerHTML=simLogEntries.map(e=>`<div class="sim-log-entry"><span class="sim-log-time">${esc(e.time)}</span><span class="sim-log-msg ${e.color}">${esc(e.msg)}</span></div>`).join('');
}
function clearSimLog(){simLogEntries.length=0;const el=document.getElementById('sim-log');if(el)el.innerHTML='<div style="color:var(--dim);font-size:.78rem">Log cleared.</div>';}

function runScenario(id){
  const s=SIM_SCENARIOS.find(s=>s.id===id);if(!s)return;
  const btn=document.getElementById('st-'+id);
  const card=document.getElementById('sc-'+id);
  if(btn){btn.classList.add('firing');setTimeout(()=>btn.classList.remove('firing'),500);}
  if(card){card.classList.add('ran');setTimeout(()=>card.classList.remove('ran'),1500);}
  simRunCount++;
  const rc=document.getElementById('sim-run-count');
  if(rc)rc.textContent=simRunCount+' scenario'+(simRunCount!==1?'s':'')+' fired this session';
  s.run();
  // Also update analytics task stats live
  renderAnalyticsTasks();
}

function resetSimMetrics(){
  simRunCount=0;simSessionStats={tasks:0,alerts:0,notifs:0,workflows:0};
  ['sp-tasks','sp-alerts','sp-notifs','sp-workflows'].forEach(id=>_t(id,'0'));
  const rc=document.getElementById('sim-run-count');if(rc)rc.textContent='0 scenarios fired this session';
  clearSimLog();toast('Simulator metrics reset');
}

function simulateIssue(type){
  if(type==='compliance')runScenario('cert');
  else if(type==='invoice')runScenario('invoice');
  else if(type==='task')runScenario('task');
}
buildSimGrid();



/* ══════════════════════════════════════════════
   STEP 9+10: ANALYTICS + ROI ENGINE
══════════════════════════════════════════════ */
function buildBars(id,data,cls,showVal){
  const el=document.getElementById(id);if(!el)return;
  const max=Math.max(...data.map(d=>d.v),1);
  el.innerHTML=data.map(d=>`<div class="bar-grp"><div class="bar ${cls||'amber'}" style="height:${Math.round((Number(d.v)/max)*88)}px" title="${escAttr(d.v)}">${''}</div>${showVal?`<div style="font-size:.6rem;color:var(--dim);text-align:center;margin-bottom:.15rem">${esc(d.v)}</div>`:''}<div class="bar-label">${esc(d.l)}</div></div>`).join('');
}

let analyticsTab = 'overview';
function setAnalyticsTab(tab, btn){
  analyticsTab = tab;
  document.querySelectorAll('#page-analytics .vtab').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  ['overview','tasks','compliance','uploads'].forEach(t=>{
    const el=document.getElementById('analytics-'+t);
    if(el) el.style.display=t===tab?'block':'none';
  });
  if(tab==='tasks') renderAnalyticsTasks();
  if(tab==='uploads') renderAnalyticsUploads();
  if(tab==='compliance') renderAnalyticsCompliance();
}

function renderTaskDonut(){
  const el=document.getElementById('task-donut-wrap');if(!el)return;
  const done=tasks.filter(t=>t.status==='done').length;
  const inprog=tasks.filter(t=>t.status==='in_progress').length;
  const review=tasks.filter(t=>t.status==='review').length;
  const open=tasks.filter(t=>t.status==='open').length;
  const total=Math.max(tasks.length,1);
  const circ=2*Math.PI*35; // circumference
  function seg(v){return Math.round((v/total)*circ);}
  const dSeg=seg(done), iSeg=seg(inprog), rSeg=seg(review), oSeg=seg(open);
  el.innerHTML=`
    <svg width="90" height="90" viewBox="0 0 90 90">
      <circle cx="45" cy="45" r="35" fill="none" stroke="#334155" stroke-width="12"/>
      <circle cx="45" cy="45" r="35" fill="none" stroke="#10b981" stroke-width="12" stroke-dasharray="${dSeg} ${circ-dSeg}" stroke-dashoffset="0"/>
      <circle cx="45" cy="45" r="35" fill="none" stroke="#3b82f6" stroke-width="12" stroke-dasharray="${iSeg} ${circ-iSeg}" stroke-dashoffset="${-dSeg}"/>
      <circle cx="45" cy="45" r="35" fill="none" stroke="#fbbf24" stroke-width="12" stroke-dasharray="${rSeg} ${circ-rSeg}" stroke-dashoffset="${-(dSeg+iSeg)}"/>
      <circle cx="45" cy="45" r="35" fill="none" stroke="#475569" stroke-width="12" stroke-dasharray="${oSeg} ${circ-oSeg}" stroke-dashoffset="${-(dSeg+iSeg+rSeg)}"/>
    </svg>
    <div class="donut-legend">
      <div class="legend-row"><div class="legend-dot" style="background:var(--green)"></div>Done (${done})</div>
      <div class="legend-row"><div class="legend-dot" style="background:var(--blue)"></div>In Progress (${inprog})</div>
      <div class="legend-row"><div class="legend-dot" style="background:var(--amber)"></div>Review (${review})</div>
      <div class="legend-row"><div class="legend-dot" style="background:var(--border)"></div>Open (${open})</div>
    </div>`;
}

function renderAnalyticsTasks(){
  const total=tasks.length;
  const done=tasks.filter(t=>t.status==='done').length;
  const open=tasks.filter(t=>t.status!=='done').length;
  const high=tasks.filter(t=>t.priority==='high'&&t.status!=='done').length;
  const auto=tasks.filter(t=>t.notes&&t.notes.includes('Auto-created')).length;
  const rate=total>0?Math.round((done/total)*100):0;
  _t('an-total-tasks',total);
  _t('an-done-tasks',done);
  _t('an-open-tasks',open);
  _t('an-high-tasks',high);
  _t('an-auto-tasks',auto);
  _t('an-complete-rate',rate+'%');

  buildBars('bar-task-priority',[
    {l:'High',v:tasks.filter(t=>t.priority==='high').length},
    {l:'Medium',v:tasks.filter(t=>t.priority==='medium').length},
    {l:'Low',v:tasks.filter(t=>t.priority==='low').length}
  ],'red',true);

  const tagCounts={};
  tasks.forEach(t=>{tagCounts[t.tag]=(tagCounts[t.tag]||0)+1;});
  const topTags=Object.entries(tagCounts).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([l,v])=>({l,v}));
  buildBars('bar-task-tags',topTags,'violet',true);

  buildBars('bar-task-timeline',[
    {l:'Wk1',v:3},{l:'Wk2',v:5},{l:'Wk3',v:4},{l:'Wk4',v:7},{l:'Now',v:done}
  ],'green',true);

  const assignees={};
  tasks.forEach(t=>{if(!assignees[t.assigned_to])assignees[t.assigned_to]={total:0,done:0,open:0};assignees[t.assigned_to].total++;if(t.status==='done')assignees[t.assigned_to].done++;else assignees[t.assigned_to].open++;});
  const tbl=document.getElementById('task-assignee-table');
  if(tbl){
    tbl.innerHTML='<thead><tr><th>Assignee</th><th>Total</th><th>Done</th><th>Open</th><th>Rate</th></tr></thead><tbody>'+
      Object.entries(assignees).map(([name,s])=>`<tr><td><strong style="color:var(--heading)">${name}</strong></td><td>${s.total}</td><td style="color:var(--green)">${s.done}</td><td style="color:var(--amber)">${s.open}</td><td><span class="tag ${Math.round(s.done/s.total*100)>=50?'green':'amber'}">${Math.round(s.done/s.total*100)}%</span></td></tr>`).join('')+'</tbody>';
  }
}

function renderAnalyticsUploads(){
  const total=files.length;
  const processed=files.filter(f=>f.status==='completed').length;
  const flagged=files.filter(f=>f.status==='flagged').length;
  const recent=files.filter(f=>['Today','Just now','Yesterday'].includes(f.date)).length;
  _t('an-total-docs',total);
  _t('an-processed-docs',processed);
  _t('an-flagged-docs',flagged);
  _t('an-recent-docs',recent);

  const catCounts={};
  files.forEach(f=>{catCounts[f.category]=(catCounts[f.category]||0)+1;});
  buildBars('bar-uploads2',Object.entries(catCounts).map(([l,v])=>({l,v})),'blue',true);

  const typeCounts={};
  files.forEach(f=>{typeCounts[f.type]=(typeCounts[f.type]||0)+1;});
  buildBars('bar-file-types',Object.entries(typeCounts).map(([l,v])=>({l,v})),'violet',true);

  buildBars('bar-upload-timeline',[{l:'Wk1',v:2},{l:'Wk2',v:4},{l:'Wk3',v:3},{l:'Wk4',v:total}],'amber',true);
}

function renderAnalyticsCompliance(){
  const alerts=notifications.filter(n=>n.cat==='compliance'&&!n.dismissed).length;
  _t('an-comp-alerts',alerts);
  buildBars('bar-compliance2',[{l:'Jan',v:62},{l:'Feb',v:68},{l:'Mar',v:71},{l:'Apr',v:82},{l:'May',v:87}],'violet',true);
  buildBars('bar-comp-cats',[{l:'Certs',v:3},{l:'Licenses',v:2},{l:'Filings',v:1},{l:'Insur.',v:0},{l:'Renewals',v:1}],'red',true);
  buildBars('bar-resolution',[{l:'Certs',v:5},{l:'Licenses',v:3},{l:'Invoice',v:2},{l:'Filing',v:7}],'amber',true);
}

function initCharts(){
  buildBars('bar-revenue',   [{l:'W1',v:3.8},{l:'W2',v:4.2},{l:'W3',v:5.1},{l:'W4',v:5.0},{l:'W5',v:4.9}]);
  buildBars('bar-hours',     [{l:'Jan',v:14},{l:'Feb',v:19},{l:'Mar',v:22},{l:'Apr',v:31},{l:'May',v:38}],'green');
  buildBars('bar-uploads',   [{l:'Compliance',v:12},{l:'Finance',v:8},{l:'Ops',v:15},{l:'Legal',v:4}],'blue');
  buildBars('bar-loads',     [{l:'W1',v:8},{l:'W2',v:11},{l:'W3',v:9},{l:'W4',v:13},{l:'W5',v:10}],'blue');
  buildBars('bar-compliance',[{l:'Jan',v:62},{l:'Feb',v:68},{l:'Mar',v:71},{l:'Apr',v:82},{l:'May',v:87}],'violet');
  buildBars('roi-hours-chart',     [{l:'Mo1',v:14},{l:'Mo2',v:19},{l:'Mo3',v:22},{l:'Mo4',v:31},{l:'Mo5',v:38}],'green');
  buildBars('roi-workflows-chart', [{l:'Mo1',v:6},{l:'Mo2',v:9},{l:'Mo3',v:13},{l:'Mo4',v:18},{l:'Mo5',v:21}],'violet');
  buildBars('roi-issues-chart',    [{l:'Mo1',v:2},{l:'Mo2',v:4},{l:'Mo3',v:5},{l:'Mo4',v:8},{l:'Mo5',v:11}],'red');
  buildBars('roi-manual-chart',    [{l:'Mo1',v:15},{l:'Mo2',v:28},{l:'Mo3',v:41},{l:'Mo4',v:55},{l:'Mo5',v:68}],'amber');
  renderTaskDonut();
  renderAnalyticsTasks();
  // Pre-render hidden tab charts so they appear instantly on tab switch
  renderAnalyticsCompliance();
  renderAnalyticsUploads();
}


/* ══════════════════════════════════════════════
   STEP 11+12: BEFORE/AFTER + WALKTHROUGH
══════════════════════════════════════════════ */

// The before/after content is rendered in the ROI Dashboard HTML above.


/* ══════════════════════════════════════════════
   MODAL SYSTEM
══════════════════════════════════════════════ */
let currentModal=null;
const modalEl=document.getElementById('modal');

const MODALS={
  task:{title:'+ Add Task',body:`
    <div class="field"><label class="field-label">Title</label><input class="field-input" id="mf-title" placeholder="e.g. Renew certification for contact"></div>
    <div class="field"><label class="field-label">Priority</label><select class="field-select" id="mf-priority"><option>high</option><option selected>medium</option><option>low</option></select></div>
    <div class="field"><label class="field-label">Due Date</label><input class="field-input" type="date" id="mf-due"></div>
    <div class="field"><label class="field-label">Assigned To</label><input class="field-input" id="mf-assignee" placeholder="e.g. Admin User"></div>
    <div class="field"><label class="field-label">Tag / Category</label><input class="field-input" id="mf-tag" placeholder="Compliance, Finance, Operations..."></div>`},
  contact:{title:'+ Add Contact',body:`
    <div class="field"><label class="field-label">Full Name</label><input class="field-input" id="mf-name" placeholder="John Smith"></div>
    <div class="field"><label class="field-label">Company</label><input class="field-input" id="mf-company" placeholder="Company Name"></div>
    <div class="field"><label class="field-label">Email</label><input class="field-input" id="mf-email" type="email" placeholder="email@example.test"></div>
    <div class="field"><label class="field-label">Phone</label><input class="field-input" id="mf-phone" placeholder="(555) 000-0000"></div>
    <div class="field"><label class="field-label">Role</label><input class="field-input" id="mf-role" placeholder="Operations, Manager, Specialist..."></div>
    <div class="field"><label class="field-label">Notes</label><textarea class="field-textarea" id="mf-notes" placeholder="Any relevant notes..."></textarea></div>`},
  company:{title:'+ Add Company',body:`
    <div class="field"><label class="field-label">Company Name</label><input class="field-input" id="mf-company" placeholder="Company Name"></div>
    <div class="field"><label class="field-label">Type</label><select class="field-select" id="mf-type"><option>Active Client</option><option selected>Prospect</option><option>Lead</option></select></div>
    <div class="field"><label class="field-label">Contacts</label><input class="field-input" id="mf-contacts" type="number" min="0" value="1"></div>
    <div class="field"><label class="field-label">MRR</label><input class="field-input" id="mf-mrr" placeholder="$4,500/mo"></div>
    <div class="field"><label class="field-label">Status</label><select class="field-select" id="mf-status"><option>Active</option><option selected>Prospect</option><option>Lead</option></select></div>`},
  prospect:{title:'+ Add Prospect',body:`
    <div class="field"><label class="field-label">Company</label><input class="field-input" id="mf-company" placeholder="Company name"></div>
    <div class="field"><label class="field-label">Contact Name</label><input class="field-input" id="mf-contact" placeholder="Tom Diaz"></div>
    <div class="field"><label class="field-label">Contact Method</label><select class="field-select" id="mf-method"><option>Email</option><option>LinkedIn</option><option>Phone</option><option>Referral</option><option>Cold Outreach</option></select></div>
    <div class="field"><label class="field-label">Estimated Value</label><input class="field-input" id="mf-value" placeholder="$5,000/mo"></div>
    <div class="field"><label class="field-label">Status</label><select class="field-select" id="mf-status"><option value="not_contacted">Not Contacted</option><option value="contacted" selected>Contacted</option><option value="interested">Interested</option><option value="meeting_booked">Meeting Booked</option></select></div>
    <div class="field"><label class="field-label">Follow-Up Date</label><input class="field-input" type="date" id="mf-followup"></div>
    <div class="field"><label class="field-label">Notes</label><textarea class="field-textarea" id="mf-notes" placeholder="How they found us, pain points, next steps..."></textarea></div>`},
  deal:{title:'+ Add Deal',body:`
    <div class="field"><label class="field-label">Company</label><input class="field-input" id="mf-company" placeholder="Company Name"></div>
    <div class="field"><label class="field-label">Contact Name</label><input class="field-input" id="mf-contact" placeholder="Contact Name"></div>
    <div class="field"><label class="field-label">Est. Monthly Value</label><input class="field-input" id="mf-value" placeholder="$5,000/mo"></div>
    <div class="field"><label class="field-label">Pipeline Stage</label><select class="field-select" id="mf-col"><option value="new">New</option><option value="contacted">Contacted</option><option value="interested">Interested</option><option value="meeting_booked">Meeting Booked</option><option value="proposal_sent">Proposal Sent</option></select></div>
    <div class="field"><label class="field-label">Notes</label><input class="field-input" id="mf-notes" placeholder="Source, context, next steps..."></div>`},
  proposal:{title:'+ Add Proposal',body:`
    <div class="field"><label class="field-label">Company</label><input class="field-input" id="mf-company" placeholder="Company Name"></div>
    <div class="field"><label class="field-label">Contact Name</label><input class="field-input" id="mf-contact" placeholder="Contact Name"></div>
    <div class="field"><label class="field-label">Monthly Value</label><input class="field-input" id="mf-value" placeholder="$5,000/mo"></div>
    <div class="field"><label class="field-label">Stage</label><select class="field-select" id="mf-stage"><option>Qualified</option><option selected>Sent</option><option>Demo Scheduled</option><option>Under Review</option><option>Accepted</option></select></div>
    <div class="field"><label class="field-label">Probability</label><input class="field-input" id="mf-probability" type="number" min="0" max="100" value="50"></div>
    <div class="field"><label class="field-label">Notes</label><textarea class="field-textarea" id="mf-notes" placeholder="Decision process, terms, next step..."></textarea></div>`},
  meeting:{title:'+ Add Meeting',body:`
    <div class="field"><label class="field-label">Company</label><input class="field-input" id="mf-company" placeholder="Company Name"></div>
    <div class="field"><label class="field-label">Contact Name</label><input class="field-input" id="mf-contact" placeholder="Contact Name"></div>
    <div class="field"><label class="field-label">Date / Time</label><input class="field-input" id="mf-date" placeholder="Fri May 23, 10:00 AM"></div>
    <div class="field"><label class="field-label">Type</label><select class="field-select" id="mf-type"><option>Discovery Call</option><option>Demo Call</option><option>Proposal Review</option><option>QBR</option><option>Check-In</option></select></div>
    <div class="field"><label class="field-label">Status</label><select class="field-select" id="mf-status"><option selected>Scheduled</option><option>Completed</option></select></div>
    <div class="field"><label class="field-label">Notes</label><textarea class="field-textarea" id="mf-notes" placeholder="Agenda, prep notes, outcome..."></textarea></div>`},
  interaction:{title:'+ Add Activity',body:`
    <div class="field"><label class="field-label">Company</label><input class="field-input" id="mf-company" placeholder="Company Name"></div>
    <div class="field"><label class="field-label">Type</label><select class="field-select" id="mf-type"><option value="email">Email sent</option><option value="call">Call logged</option><option value="task">Task created</option><option value="doc">Proposal sent</option><option value="meeting">Meeting held</option><option value="finance">Invoice created</option></select></div>
    <div class="field"><label class="field-label">Detail</label><textarea class="field-textarea" id="mf-detail" placeholder="What happened?"></textarea></div>`},
};

function openModal(type){
  const m=MODALS[type];if(!m)return;
  currentModal=type;
  _t('modal-title',m.title);
  document.getElementById('modal-body').innerHTML=m.body;
  // Restore the default Cancel/Save footer — info/preview modals overwrite it
  // with a single "Close" button, so a create-modal opened afterward would
  // otherwise have no Save button.
  document.querySelector('#modal .modal-actions').innerHTML=
    '<button class="btn-outline" onclick="closeModal()">Cancel</button>'+
    '<button class="btn-primary" onclick="submitModal()">Save</button>';
  modalEl.classList.add('open');
  setTimeout(()=>modalEl.querySelector('.field-input')?.focus(),50);
}
function closeModal(){modalEl.classList.remove('open');currentModal=null;}
modalEl.addEventListener('click',e=>{if(e.target===modalEl)closeModal();});

// SECURITY: per-field length caps. Anything user-typed is run through
// sanitizeText with these caps before it's written into the in-memory store.
const _FIELD_CAPS = {
  short: 120,   // names, single-line fields
  long:  2000,  // notes / free-form text
  ident: 40,    // values used as identifiers / status / tag
};

function vSafe(id, cap){
  return sanitizeText(document.getElementById(id)?.value || '', cap || _FIELD_CAPS.short);
}

function submitModal(){
  if(currentModal==='task'){
    const title=vSafe('mf-title')||'New Task';
    const priority=vSafe('mf-priority', _FIELD_CAPS.ident)||'medium';
    const rawDue=vSafe('mf-due', _FIELD_CAPS.ident);
    const assignee=vSafe('mf-assignee')||SESSION?.displayName||'Unassigned';
    const tag=vSafe('mf-tag', _FIELD_CAPS.ident)||'General';
    addTask({title,priority,status:'open',assigned_to:assignee,client_id:SESSION?.clientId||'demo',due_date:rawDue||new Date().toISOString().split('T')[0],tag});
    addActivity('blue', '"'+title+'" assigned to '+assignee+'.', 'Task created');
    updateDashMetrics({tasks:1});
    toast('Task created');
  } else if(currentModal==='contact'){
    const name=vSafe('mf-name')||'New Contact';
    contacts.unshift({
      id:Date.now(),
      name,
      company:vSafe('mf-company')||'—',
      email:vSafe('mf-email')||'—',
      phone:vSafe('mf-phone', _FIELD_CAPS.ident)||'—',
      role:vSafe('mf-role')||'Contact',
      status:'Active',
      deals:[],
      notes:vSafe('mf-notes', _FIELD_CAPS.long)
    });
    renderContacts();
    toast('Contact added: '+name);
  } else if(currentModal==='company'){
    const name=vSafe('mf-company')||'New Company';
    const type=vSafe('mf-type', _FIELD_CAPS.ident)||'Prospect';
    const contactsCount=Number(vSafe('mf-contacts', _FIELD_CAPS.ident))||0;
    const mrr=vSafe('mf-mrr', _FIELD_CAPS.ident)||'â€”';
    const status=vSafe('mf-status', _FIELD_CAPS.ident)||'Prospect';
    companies.unshift({name,type,contacts:contactsCount,mrr,since:status==='Active'?'Today':'â€”',status});
    renderCrmTab();
    toast('Company added: '+name);
  } else if(currentModal==='prospect'){
    const company=vSafe('mf-company')||'New Prospect';
    const contact=vSafe('mf-contact')||'—';
    const method=vSafe('mf-method', _FIELD_CAPS.ident)||'Email';
    const value=vSafe('mf-value', _FIELD_CAPS.ident)||'—';
    const statusRaw=vSafe('mf-status', _FIELD_CAPS.ident)||'contacted';
    const status = Object.prototype.hasOwnProperty.call(OUTREACH_STATUSES, statusRaw) ? statusRaw : 'contacted';
    const rawFollow = vSafe('mf-followup', _FIELD_CAPS.ident);
    const followUp = rawFollow ? new Date(rawFollow+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}) : 'TBD';
    const notes=vSafe('mf-notes', _FIELD_CAPS.long);
    prospects.unshift({id:Date.now(),company,contact,method,status,lastTouch:'Today',followUp,notes,value});
    pipelineCards.unshift({id:Date.now()+1,name:company,value,col:'new',contact,notes:'Via '+method});
    renderOutreach();renderPipeline();
    addActivity('violet', '"'+company+'" via '+method+'. Stage: '+OUTREACH_STATUSES[status]+'.', 'Prospect added');
    toast('Prospect added: '+company);
  } else if(currentModal==='deal'){
    const company=vSafe('mf-company')||'New Deal';
    const contact=vSafe('mf-contact')||'—';
    const value=vSafe('mf-value', _FIELD_CAPS.ident)||'—';
    const col=vSafe('mf-col', _FIELD_CAPS.ident)||'new';
    const notes=vSafe('mf-notes', _FIELD_CAPS.long)||'—';
    pipelineCards.unshift({id:Date.now(),name:company,value,col,contact,notes});
    renderPipeline();
    toast('Deal added: '+company);
  } else if(currentModal==='proposal'){
    const company=vSafe('mf-company')||'New Proposal';
    const contact=vSafe('mf-contact')||'â€”';
    const value=vSafe('mf-value', _FIELD_CAPS.ident)||'â€”';
    const stage=vSafe('mf-stage', _FIELD_CAPS.ident)||'Sent';
    const probability=Math.max(0,Math.min(100,Number(vSafe('mf-probability', _FIELD_CAPS.ident))||50));
    const notes=vSafe('mf-notes', _FIELD_CAPS.long)||'â€”';
    proposals.unshift({id:Date.now(),company,contact,value,sent:new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),stage,probability,status:stage==='Accepted'?'won':'active',notes});
    renderCrmTab();
    toast('Proposal added: '+company);
  } else if(currentModal==='meeting'){
    const company=vSafe('mf-company')||'New Meeting';
    const contact=vSafe('mf-contact')||'â€”';
    const date=vSafe('mf-date')||'TBD';
    const type=vSafe('mf-type', _FIELD_CAPS.ident)||'Discovery Call';
    const status=vSafe('mf-status', _FIELD_CAPS.ident)||'Scheduled';
    const notes=vSafe('mf-notes', _FIELD_CAPS.long)||'â€”';
    meetings.unshift({company,contact,date,type,status,notes});
    renderCrmTab();
    toast('Meeting added: '+company);
  } else if(currentModal==='interaction'){
    const company=vSafe('mf-company')||'New Activity';
    const icon=vSafe('mf-type', _FIELD_CAPS.ident)||'email';
    const selected=document.getElementById('mf-type')?.selectedOptions?.[0]?.textContent || 'Activity logged';
    const detail=vSafe('mf-detail', _FIELD_CAPS.long)||'Activity logged.';
    interactions.unshift({icon,company,type:selected,detail,time:'Just now'});
    renderCrmTab();
    toast('Activity added: '+company);
  }
  closeModal();
}

// Legacy untrimmed accessor — kept for places that read non-user-controlled IDs.
function v(id){return document.getElementById(id)?.value.trim()||'';}

/* ══════════════════════════════════════════════
   INFO MODAL (for file preview etc)
══════════════════════════════════════════════ */
function showInfoModal(icon,title,bodyHtml){
  _t('modal-title', icon+' '+title);
  document.getElementById('modal-body').innerHTML=bodyHtml;
  document.querySelector('#modal .modal-actions').innerHTML=`<button class="btn-primary" onclick="closeModal()">Close</button>`;
  currentModal='info';
  modalEl.classList.add('open');
}

/* ══════════════════════════════════════════════
   ACTIVITY FEED
══════════════════════════════════════════════ */
// SECURITY: The activity feed used to accept arbitrary HTML strings, which made
// every caller a potential XSS sink. Build the DOM by hand using textContent so
// interpolated user data (task titles, filenames, etc.) cannot inject markup.
// The optional `boldPrefix` argument lets callers emphasise a leading label
// without taking an HTML escape hatch.
function addActivity(color, text, boldPrefix){
  const feed=document.getElementById('activity-feed');if(!feed)return;
  const allowedColors = ['red','amber','green','blue','violet','muted','slate'];
  const safeColor = allowedColors.includes(color) ? color : 'muted';

  const wrapper = document.createElement('div');
  wrapper.className='act-item';

  const dot = document.createElement('div');
  dot.className = 'act-dot ' + safeColor;

  const txtEl = document.createElement('div');
  txtEl.className = 'act-text';
  if (boldPrefix) {
    const b = document.createElement('strong');
    b.textContent = String(boldPrefix);
    txtEl.appendChild(b);
    txtEl.appendChild(document.createTextNode(' ' + String(text || '')));
  } else {
    // Backwards-compatible path: if callers still pass HTML, strip tags rather
    // than render them. textContent does the safe thing automatically.
    txtEl.textContent = String(text || '').replace(/<[^>]*>/g, '');
  }

  const time = document.createElement('div');
  time.className = 'act-time';
  time.textContent = 'Just now';

  wrapper.appendChild(dot);
  wrapper.appendChild(txtEl);
  wrapper.appendChild(time);
  feed.prepend(wrapper);
}
function clearFeed(){const f=document.getElementById('activity-feed');if(f)f.innerHTML=`<div style="text-align:center;color:var(--dim);padding:1.5rem">Feed cleared.</div>`;}

/* ══════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════ */
let toastTimer;
function toast(msg,type){
  const el=document.getElementById('toast');
  el.textContent=msg;
  el.className='show'+(type?' '+type:'');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),3200);
}

/* ══════════════════════════════════════════════
   DATE HELPERS
══════════════════════════════════════════════ */
function fmtDate(d){
  if(!d||d==='TBD')return d||'TBD';
  try{return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});}catch{return d;}
}

/* ══════════════════════════════════════════════
   SETTINGS TOGGLES
══════════════════════════════════════════════ */
const SETTINGS_KEY = 'nfinity_settings';
function loadSettings(){
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch{ return {}; }
}
function saveSettings(k,v){
  const s=loadSettings(); s[k]=v; localStorage.setItem(SETTINGS_KEY,JSON.stringify(s));
}
function tog(btn){
  btn.classList.toggle('on'); btn.classList.toggle('off');
  const isOn = btn.classList.contains('on');
  const row = btn.closest('[data-setting]') || btn.parentElement.closest('[data-setting]');
  const key = row ? row.dataset.setting : null;
  if(key) saveSettings(key, isOn);
}
function initSettingsToggles(){
  const saved = loadSettings();
  document.querySelectorAll('[data-setting]').forEach(row=>{
    const key = row.dataset.setting;
    if(key in saved){
      const btn = row.querySelector('.toggle');
      if(btn){
        btn.classList.toggle('on',  saved[key]);
        btn.classList.toggle('off', !saved[key]);
      }
    }
  });
}
function populateSettingsAccount(){
  try {
    const s = JSON.parse(localStorage.getItem('nfinity_auth_session')||'{}');
    const el = (id,v)=>{ const e=document.getElementById(id); if(e&&v) e.textContent=v; };
    el('set-name',    s.displayName);
    el('set-email',   s.email);
    el('set-company', s.companyName);
    el('set-role',    s.role ? s.role.charAt(0).toUpperCase()+s.role.slice(1) : null);
  } catch{}
}
initSettingsToggles();
populateSettingsAccount();

/* ══════════════════════════════════════════════
   NOTIFICATION BADGE + DASH NOTIF PANEL
══════════════════════════════════════════════ */
function updateNotifBadge(){
  const unread=notifications.filter(n=>n.unread&&!n.dismissed).length;
  const dot=document.getElementById('notif-dot');
  if(dot) dot.style.display=unread>0?'block':'none';
  const nb=document.getElementById('nb-notif');
  if(nb) nb.textContent=unread;
  _t('unread-count',unread);
}


/* ══════════════════════════════════════════════
   METRIC MODALS
══════════════════════════════════════════════ */
function openMetricModal(metric){
  const info={
    tasks:{icon:'📋',title:'Active Tasks',body:`<p style="margin-bottom:.75rem;color:var(--subtle)">You have <strong style="color:var(--heading)">${dashMetrics.tasks}</strong> active tasks across your workspace.</p>
      <div style="display:flex;flex-direction:column;gap:.5rem">
        <div style="display:flex;justify-content:space-between;padding:.5rem;background:var(--surface);border-radius:5px"><span>High Priority</span><span style="color:var(--red);font-weight:700">${tasks.filter(t=>t.priority==='high'&&t.status!=='done').length}</span></div>
        <div style="display:flex;justify-content:space-between;padding:.5rem;background:var(--surface);border-radius:5px"><span>In Progress</span><span style="color:var(--blue);font-weight:700">${tasks.filter(t=>t.status==='in_progress').length}</span></div>
        <div style="display:flex;justify-content:space-between;padding:.5rem;background:var(--surface);border-radius:5px"><span>Completed</span><span style="color:var(--green);font-weight:700">${tasks.filter(t=>t.status==='done').length}</span></div>
      </div>`},
    alerts:{icon:'⚠️',title:'Compliance Alerts',body:`<p style="margin-bottom:.75rem;color:var(--subtle)"><strong style="color:var(--heading)">${dashMetrics.alerts}</strong> compliance issues require attention.</p>
      <div style="display:flex;flex-direction:column;gap:.5rem">
        <div style="padding:.5rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:5px;font-size:.85rem;color:#fca5a5">Certification Expired — Jordan Reyes (148 days)</div>
        <div style="padding:.5rem;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);border-radius:5px;font-size:.85rem;color:#fcd34d">License Renewal — Tony Marsh (22 days remaining)</div>
        <div style="padding:.5rem;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.3);border-radius:5px;font-size:.85rem;color:#93c5fd">Q2 Regulatory Filing — Due Jul 31</div>
      </div>`},
    docs:{icon:'📁',title:'Documents Pending',body:`<p style="margin-bottom:.75rem;color:var(--subtle)"><strong style="color:var(--heading)">${dashMetrics.docs}</strong> documents uploaded and being processed.</p>
      <div style="display:flex;flex-direction:column;gap:.5rem">
        <div style="display:flex;justify-content:space-between;padding:.5rem;background:var(--surface);border-radius:5px"><span>Completed</span><span style="color:var(--green);font-weight:700">${files.filter(f=>f.status==='completed').length}</span></div>
        <div style="display:flex;justify-content:space-between;padding:.5rem;background:var(--surface);border-radius:5px"><span>Processing</span><span style="color:var(--blue);font-weight:700">${files.filter(f=>f.status==='processing'||f.status==='uploading').length}</span></div>
        <div style="display:flex;justify-content:space-between;padding:.5rem;background:var(--surface);border-radius:5px"><span>Flagged</span><span style="color:var(--red);font-weight:700">${files.filter(f=>f.status==='flagged').length}</span></div>
      </div>`},
    hours:{icon:'⏱',title:'Hours Saved',body:`<p style="margin-bottom:.75rem;color:var(--subtle)">NFINITY HQ has saved your team <strong style="color:var(--heading)">${dashMetrics.hours} hours</strong> this month through automation.</p>
      <div style="display:flex;flex-direction:column;gap:.5rem">
        <div style="display:flex;justify-content:space-between;padding:.5rem;background:var(--surface);border-radius:5px"><span>Compliance Tracking</span><span style="color:var(--green);font-weight:700">6h</span></div>
        <div style="display:flex;justify-content:space-between;padding:.5rem;background:var(--surface);border-radius:5px"><span>Invoice Follow-Up</span><span style="color:var(--green);font-weight:700">8h</span></div>
        <div style="display:flex;justify-content:space-between;padding:.5rem;background:var(--surface);border-radius:5px"><span>Document Filing</span><span style="color:var(--green);font-weight:700">5h</span></div>
        <div style="display:flex;justify-content:space-between;padding:.5rem;background:var(--surface);border-radius:5px"><span>Task Assignment</span><span style="color:var(--green);font-weight:700">4h</span></div>
      </div><div style="margin-top:.75rem;font-size:.78rem;color:var(--dim)">@ $35/hr avg = <strong style="color:var(--amber)">$${(dashMetrics.hours*35).toLocaleString()} saved</strong> this month</div>`},
    workflows:{icon:'⚡',title:'Workflows Run',body:`<p style="margin-bottom:.75rem;color:var(--subtle)"><strong style="color:var(--heading)">${dashMetrics.workflows}</strong> automation workflows executed.</p>
      <div style="display:flex;flex-direction:column;gap:.5rem">
        <div style="display:flex;justify-content:space-between;padding:.5rem;background:var(--surface);border-radius:5px"><span>Compliance Monitor</span><span style="color:var(--violet);font-weight:700">8 runs</span></div>
        <div style="display:flex;justify-content:space-between;padding:.5rem;background:var(--surface);border-radius:5px"><span>Invoice Watcher</span><span style="color:var(--violet);font-weight:700">6 runs</span></div>
        <div style="display:flex;justify-content:space-between;padding:.5rem;background:var(--surface);border-radius:5px"><span>Task Generator</span><span style="color:var(--violet);font-weight:700">7 runs</span></div>
      </div>`},
    revenue:{icon:'💰',title:'Revenue Recovered',body:`<p style="margin-bottom:.75rem;color:var(--subtle)"><strong style="color:var(--heading)">$4.2k</strong> in revenue recovered from overdue invoices this month.</p>
      <div style="display:flex;flex-direction:column;gap:.5rem">
        <div style="padding:.5rem;background:var(--surface);border-radius:5px;font-size:.85rem"><div style="color:var(--heading);font-weight:600">INV-2231 — Echo Global</div><div style="color:var(--red);font-size:.78rem">$2,650 · 18 days overdue</div></div>
        <div style="padding:.5rem;background:var(--surface);border-radius:5px;font-size:.85rem"><div style="color:var(--heading);font-weight:600">INV-2220 — Total Quality</div><div style="color:var(--green);font-size:.78rem">$3,400 · Paid</div></div>
      </div><div style="margin-top:.75rem;font-size:.78rem;color:var(--dim)">Go to <button class="btn-outline btn-sm" onclick="closeModal();navigate('analytics')">Analytics</button> for full invoice tracking.</div>`},
  };
  const m=info[metric];if(!m)return;
  showInfoModal(m.icon,m.title,m.body);
}

function openROIModal(metric){
  const info={
    hours:{title:'Hours Saved',body:'Hours saved is calculated based on workflows executed × average manual time per task (1.5h). This month: '+Math.round(roiLive.hours)+' hours automated. At $35/hr, that\'s $'+Math.round(roiLive.hours*35).toLocaleString()+' in labor savings.'},
    tasks:{title:'Tasks Automated',body:'Every automation that creates, escalates, or closes a task without human intervention counts here. Current session: '+roiLive.tasks+' tasks automated. Each prevents ~1.5 hours of manual coordination.'},
    revenue:{title:'Revenue Recovered',body:'Revenue recovered tracks invoices that were flagged as overdue and subsequently followed up — preventing write-offs. Current: $'+roiLive.revenue.toFixed(1)+'k surfaced this period.'},
    issues:{title:'Issues Prevented',body:'Issues prevented counts compliance failures, missed invoices, and overdue tasks that were caught by the automation engine before they became costly problems. Current: '+roiLive.issues+' issues caught.'},
    alerts:{title:'Alerts Fired',body:'Total compliance and finance alerts generated by automation rules. Each alert represents a real risk caught automatically. Current: '+roiLive.alerts+' alerts fired.'},
    workflows:{title:'Workflows Run',body:'Total automation rule executions across all engines (compliance, invoice, task, document). Current: '+roiLive.workflows+' workflow runs this period.'},
  };
  const m=info[metric]||{title:metric,body:'This metric tracks automated activity across NFINITY HQ.'};
  showInfoModal('📊',m.title,`<p style="color:var(--subtle);line-height:1.7">${m.body}</p>`);
}

/* ══════════════════════════════════════════════
   INIT — all module data is ready by this point
══════════════════════════════════════════════ */

const AI_OPERATOR_PERIODS = {
  day: { label: 'Day', multiplier: 1 },
  week: { label: 'Week', multiplier: 7 },
  month: { label: 'Month', multiplier: 30 },
  six: { label: '6 Months', multiplier: 180 },
  year: { label: 'Year', multiplier: 365 },
};

const AI_OPERATORS = [
  { id:'ruby', name:'Ruby', role:'Finance Operator', scenario:'invoice', active:true, jobs:'3 of 5 jobs', progress:78, desc:'Finance and proposal operator monitoring invoice age, broker reminders, and proposal packets.', work:['Auditing invoices','Reviewing Echo Logistics proposal','Generating proposal summary','Escalating compliance issue'], feed:['Completed proposal generation','Reviewed invoice discrepancies','Escalated compliance issue','Queued broker reminder'], report:{tasks:9,hours:13,wins:4,recent:['Generated Echo Logistics proposal','Audited 14 invoice line items','Escalated 2 payment risks']} },
  { id:'quinn', name:'Quinn', role:'Growth Operator', scenario:'opportunity', active:true, jobs:'4 of 6 jobs', progress:64, desc:'Growth and support operator handling lead follow-up, support triage, and pipeline updates.', work:['Reviewing lead pipeline','Generating lead follow-up','Responding to support request','Updating outreach queue'], feed:['Reviewed lead pipeline','Generated follow-up sequence','Responded to support request','Logged CRM touchpoint'], report:{tasks:11,hours:10,wins:5,recent:['Qualified 3 new prospects','Sent follow-up sequence','Updated CRM notes']} },
  { id:'atlas', name:'Atlas', role:'Invoice Operator', scenario:'invoice', active:true, jobs:'2 of 4 jobs', progress:72, desc:'Monitors unpaid invoices, sends broker reminders, and escalates balances past threshold.', work:['Reviewing overdue invoices','Sending broker reminder','Checking payment status','Preparing escalation note'], feed:['Flagged INV-2231 overdue','Queued payment reminder','Recovered invoice status','Updated finance alert'], report:{tasks:8,hours:9,wins:3,recent:['Recovered $2.6k at-risk invoice','Sent 5 broker reminders','Closed 2 finance alerts']} },
  { id:'sage', name:'Sage', role:'Compliance Operator', scenario:'cert', active:true, jobs:'5 of 7 jobs', progress:86, desc:'Tracks certifications, licenses, and regulatory deadlines with renewal alerts and task creation.', work:['Checking certification dates','Preparing renewal task','Reviewing filing calendar','Auditing compliance queue'], feed:['Created renewal task','Updated compliance score','Flagged license window','Cleared filing reminder'], report:{tasks:13,hours:15,wins:6,recent:['Prevented expired certification','Created 4 renewal tasks','Resolved 3 compliance warnings']} },
  { id:'nova', name:'Nova', role:'Lead Follow-Up Operator', scenario:'opportunity', active:true, jobs:'3 of 6 jobs', progress:69, desc:'Follows up on leads, logs CRM touch activity, and escalates stale prospects after no response.', work:['Drafting lead follow-up','Scoring prospect fit','Logging CRM touchpoint','Checking stale prospects'], feed:['Generated follow-up sequence','Logged call summary','Escalated stale lead','Ranked prospect priority'], report:{tasks:12,hours:11,wins:5,recent:['Booked 2 follow-up tasks','Scored 7 prospects','Updated outreach pipeline']} },
  { id:'mira', name:'Mira', role:'Document Operator', scenario:'document', active:false, jobs:'0 of 3 jobs', progress:34, desc:'Classifies uploaded files into Compliance, Finance, Operations, Legal, or HR and tags them for search.', work:['Paused - waiting for upload queue','Classifying uploaded files','Checking missing signatures','Tagging searchable documents'], feed:['Classified invoice packet','Flagged missing signature','Tagged compliance file','Indexed policy document'], report:{tasks:6,hours:7,wins:2,recent:['Classified 18 documents','Flagged 2 missing signatures','Indexed compliance folder']} },
  { id:'orion', name:'Orion', role:'Task Escalation Operator', scenario:'task', active:true, jobs:'2 of 5 jobs', progress:74, desc:'Monitors task due dates, escalates overdue work, and notifies assigned team members.', work:['Scanning overdue tasks','Escalating due date risk','Notifying assignee','Updating priority queue'], feed:['Escalated overdue task','Notified assigned owner','Raised priority level','Closed stale reminder'], report:{tasks:10,hours:8,wins:4,recent:['Escalated 3 overdue tasks','Notified 4 owners','Reduced missed deadlines']} },
];

function initAiEmployees(){
  const grid = document.querySelector('#page-virtual .sim-grid');
  if (!grid) return;
  grid.id = 'ai-operator-grid';
  renderAiOperators();
  if (!window.__aiOperatorTimer) window.__aiOperatorTimer = setInterval(() => { if (!document.hidden && document.getElementById('page-virtual')?.classList.contains('active')) tickAiOperators(); }, 5600);
}

function renderAiOperators(){
  const grid = document.getElementById('ai-operator-grid');
  if (!grid) return;
  grid.innerHTML = AI_OPERATORS.map(aiOperatorCard).join('');
}

function aiOperatorCard(op){
  const status = op.active ? 'Active' : 'Paused';
  const dot = op.active ? 'green-dot' : 'amber-dot';
  const action = op.active ? 'Pause' : 'Resume';
  return `<div class="sim-card ai-card ${op.active ? '' : 'paused'} ${op.running ? 'running' : ''}" data-ai-id="${escAttr(op.id)}" onclick="openAiReport('${escAttr(op.id)}','week')">
    <div class="ai-head"><div class="ai-id"><div class="ai-avatar ${escAttr(op.id)}" aria-hidden="true"></div><div><div class="sim-card-title">${esc(op.name)}</div><div class="ai-working"><strong>${esc(op.role)}</strong><span>${esc(op.work[0])}</span>${op.active ? '<span class="ai-dots"></span>' : ''}</div></div></div><span class="ai-status"><span class="alert-dot ${dot}"></span>${status}</span></div>
    <div class="sim-card-desc">${esc(op.desc)}</div>
    <div class="ai-progress"><div class="ai-progress-row"><span>Task Queue</span><span>${esc(op.jobs)} - ${Number(op.progress)}%</span></div><div class="ai-progress-track"><div class="ai-progress-fill" style="width:${Number(op.progress)}%"></div></div></div>
    <div class="ai-feed">${op.feed.slice(0,3).map(f=>`<div class="ai-feed-item">${esc(f)}</div>`).join('')}</div>
    <div class="ai-card-actions"><button class="btn-outline btn-sm" onclick="event.stopPropagation();runAiOperator('${escAttr(op.id)}')">Run Now</button><button class="btn-outline btn-sm" onclick="event.stopPropagation();toggleAiOperator('${escAttr(op.id)}')">${action}</button><button class="btn-outline btn-sm" onclick="event.stopPropagation();configureAiOperator('${escAttr(op.id)}')">Configure</button></div>
  </div>`;
}

function getAiOperator(id){ return AI_OPERATORS.find(op => op.id === id); }
function toggleAiOperator(id){ const op=getAiOperator(id); if(!op)return; op.active=!op.active; renderAiOperators(); toast(op.name+(op.active?' resumed':' paused'),op.active?null:'warn'); }
function runAiOperator(id){ const op=getAiOperator(id); if(!op)return; if(!op.active)op.active=true; op.running=true; op.progress=Math.min(96,op.progress+4); op.feed.unshift('Manual run started'); renderAiOperators(); setTimeout(()=>{op.running=false;op.feed.unshift('Manual run completed');if(op.scenario)runScenario(op.scenario);renderAiOperators();toast(op.name+' completed a manual run');},700); }
function configureAiOperator(id){ const op=getAiOperator(id); if(!op)return; showInfoModal('',op.name+' Configuration',`<div class="field"><label class="field-label">Operator</label><input class="field-input" value="${escAttr(op.name)}" readonly></div><div class="field"><label class="field-label">Mode</label><select class="field-select" id="ai-config-mode"><option value="active" ${op.active?'selected':''}>Active</option><option value="paused" ${!op.active?'selected':''}>Paused</option></select></div><div class="field"><label class="field-label">Current Focus</label><input class="field-input" id="ai-config-focus" value="${escAttr(op.work[0])}"></div><div class="field"><label class="field-label">Queue Target</label><input class="field-input" id="ai-config-jobs" value="${escAttr(op.jobs)}"></div>`); document.querySelector('#modal .modal-actions').innerHTML=`<button class="btn-outline" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="saveAiConfig('${escAttr(op.id)}')">Save</button>`; }
function saveAiConfig(id){ const op=getAiOperator(id); if(!op)return; op.active=document.getElementById('ai-config-mode')?.value==='active'; const focus=document.getElementById('ai-config-focus')?.value.trim(); const jobs=document.getElementById('ai-config-jobs')?.value.trim(); if(focus)op.work[0]=focus; if(jobs)op.jobs=jobs; closeModal(); renderAiOperators(); toast(op.name+' configuration saved'); }
function openAiReport(id,period){ const op=getAiOperator(id); if(!op)return; const p=AI_OPERATOR_PERIODS[period]||AI_OPERATOR_PERIODS.week; const tasks=Math.round(op.report.tasks*p.multiplier); const hours=Math.round(op.report.hours*p.multiplier); const wins=Math.round(op.report.wins*p.multiplier); showInfoModal('',op.name+' Progress Report',`<div class="ai-report-head"><div class="ai-avatar ai-report-avatar ${escAttr(op.id)}"></div><div><div style="font-weight:700;color:var(--heading)">${esc(op.role)}</div><div style="font-size:.78rem;color:var(--dim)">${op.active?'Active':'Paused'} - ${esc(op.jobs)}</div></div></div><div class="ai-filter-row">${Object.keys(AI_OPERATOR_PERIODS).map(k=>`<button class="ai-filter ${k===period?'active':''}" onclick="openAiReport('${escAttr(op.id)}','${k}')">${AI_OPERATOR_PERIODS[k].label}</button>`).join('')}</div><div class="ai-report-grid"><div class="ai-report-stat"><strong>${tasks}</strong><span>Tasks Completed</span></div><div class="ai-report-stat"><strong>${hours}</strong><span>Hours Saved</span></div><div class="ai-report-stat"><strong>${wins}</strong><span>Risks Resolved</span></div></div><div class="ai-report-list">${op.report.recent.map(item=>`<div>${esc(item)} - ${esc(p.label)}</div>`).join('')}</div>`); }
function tickAiOperators(){ AI_OPERATORS.forEach(op=>{ if(!op.active)return; op.work.push(op.work.shift()); op.feed.unshift(op.feed.pop()); op.progress=Math.max(48,Math.min(96,op.progress+(Math.random()>.5?3:-2))); }); renderAiOperators(); }

// Route to initial page NOW that all let-variables are initialized
/* ══════════════════════════════════════════════
   TEAM MEMBERS
   Auto-detects mode:
     • LIVE  — a real server-issued session token is present
               (SESSION.sessionToken, set by public/app.js after a real login).
               All actions hit the backend /api/team routes.
     • DEMO  — public/guest demo. Fully functional but 100% client-side
               (localStorage), exactly like the rest of the public demo.
               Never touches PostgreSQL.
══════════════════════════════════════════════ */
const TEAM_ROLES = ['owner','admin','manager','dispatcher','driver','employee','viewer'];
const TEAM_DEMO_KEY = 'nfinity_demo_team';
const TEAM_API_BASE = (window.NFINITY_API_BASE_URL || '').replace(/\/+$/, '') + '/api/team';

function teamIsLive(){ return !!(SESSION && typeof SESSION.sessionToken === 'string' && SESSION.sessionToken.length > 10); }
function teamEsc(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

function teamDemoTempPassword(){
  const cs='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*?-_';
  let out=''; const a=new Uint32Array(16); (window.crypto||window.msCrypto).getRandomValues(a);
  for(let i=0;i<16;i++) out+=cs[a[i]%cs.length];
  return out;
}

function teamDemoSeed(){
  return [
    {id:'demo-1', display_name:'Demo User',    email:'owner@example.test',      role:'owner',      status:'active',   phone:'(704) 555-0100', department:'Executive',  must_change_password:false},
    {id:'demo-2', display_name:'Jordan Reyes',  email:'jordan@example.test',     role:'admin',      status:'active',   phone:'(704) 555-0112', department:'Operations', must_change_password:false},
    {id:'demo-3', display_name:'Tony Marsh',    email:'tony@example.test',       role:'dispatcher', status:'active',   phone:'(704) 555-0143', department:'Dispatch',   must_change_password:true},
    {id:'demo-4', display_name:'Casey Lin',     email:'casey@example.test',      role:'driver',     status:'disabled', phone:'(704) 555-0188', department:'Fleet',      must_change_password:false},
  ];
}
function teamDemoLoad(){
  try{ const v=JSON.parse(localStorage.getItem(TEAM_DEMO_KEY)); if(Array.isArray(v)) return v; }catch{}
  const seed=teamDemoSeed(); teamDemoSave(seed); return seed;
}
function teamDemoSave(list){ try{ localStorage.setItem(TEAM_DEMO_KEY, JSON.stringify(list)); }catch{} }

// LIVE backend calls (only used when teamIsLive()).
async function teamApiFetch(path, method, body){
  const res = await fetch(TEAM_API_BASE + path, {
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
    method,
    headers: { 'Content-Type':'application/json', 'Accept':'application/json', 'Authorization':'Bearer '+SESSION.sessionToken },
    credentials: TEAM_API_BASE.startsWith('http') ? 'omit' : 'same-origin',
    cache: 'no-store',
    ...(body!==undefined ? { body: JSON.stringify(body) } : {}),
  });
  let data=null; try{ data=await res.json(); }catch{}
  if(!res.ok){ const err=new Error((data&&data.error)||('Request failed ('+res.status+')')); err.status=res.status; throw err; }
  return data;
}

let TEAM_CACHE = [];

async function renderTeam(){
  const note=document.getElementById('team-mode-note');
  const list=document.getElementById('team-list');
  if(!list) return;
  const live=teamIsLive();
  const addButton = document.getElementById('team-add-btn');
  if (addButton) addButton.hidden = live && !['owner', 'admin', 'platform_owner'].includes(SESSION.role);
  if(note) note.textContent = live
    ? 'Connected to your company workspace. Changes are saved to your account.'
    : 'Demo mode — changes are stored locally in your browser only and are not saved to any database.';

  if (list.dataset.loading === 'true') return;
  if(live){
    list.dataset.loading = 'true';
    list.innerHTML='<div style="padding:1.2rem;color:var(--dim)">Loading team…</div>';
    try{
      const data=await teamApiFetch('','GET');
      TEAM_CACHE=(data&&data.users)||[];
      list.dataset.loading = 'false';
    }catch(e){
      list.dataset.loading = 'false';
      if(e.status===403){ list.innerHTML='<div style="padding:1.2rem;color:var(--dim)">You don\'t have permission to view team members.</div>'; return; }
      list.innerHTML='<div style="padding:1.2rem;color:var(--danger,#ef4444)">Could not load team members: '+teamEsc(e.message)+'</div>'; return;
    }
  } else {
    TEAM_CACHE=teamDemoLoad();
  }
  teamPaint();
}

function teamPaint(){
  const list=document.getElementById('team-list');
  if(!list) return;
  const q=(document.getElementById('team-search')?.value||'').trim().toLowerCase();
  const rows=TEAM_CACHE.filter(u=>!q || [u.display_name,u.email,u.role,u.department].some(f=>String(f||'').toLowerCase().includes(q)));
  if(!rows.length){ list.innerHTML='<div style="padding:1.2rem;color:var(--dim)">No team members found.</div>'; return; }

  const head='<div style="display:grid;grid-template-columns:1.6fr 1.6fr 1fr .9fr 1.4fr;gap:.5rem;padding:.6rem .8rem;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--dim);border-bottom:1px solid var(--border)"><div>Name</div><div>Email</div><div>Role</div><div>Status</div><div style="text-align:right">Actions</div></div>';
  const body=rows.map(u=>{
    const disabled=u.status==='disabled';
    const badge=disabled
      ? '<span style="font-size:.7rem;font-weight:600;padding:.15rem .5rem;border-radius:999px;background:rgba(239,68,68,.15);color:#ef4444">Disabled</span>'
      : '<span style="font-size:.7rem;font-weight:600;padding:.15rem .5rem;border-radius:999px;background:rgba(34,197,94,.15);color:#22c55e">Active</span>';
    const dept=u.department?'<div style="font-size:.7rem;color:var(--dim)">'+teamEsc(u.department)+'</div>':'';
    const mayManage = !teamIsLive() || ['owner', 'admin', 'platform_owner'].includes(SESSION.role);
    const actions = disabled || !mayManage
      ? '<span style="font-size:.72rem;color:var(--dim)">—</span>'
      : '<button class="btn-outline btn-sm" onclick="teamResetPassword(\''+teamEsc(u.id)+'\')">Reset Password</button> '
       +'<button class="btn-outline btn-sm" onclick="teamDisable(\''+teamEsc(u.id)+'\')" style="border-color:rgba(239,68,68,.4);color:#ef4444">Disable</button>';
    return '<div style="display:grid;grid-template-columns:1.6fr 1.6fr 1fr .9fr 1.4fr;gap:.5rem;align-items:center;padding:.7rem .8rem;border-bottom:1px solid var(--border)">'
      +'<div><div style="font-weight:600;color:var(--heading)">'+teamEsc(u.display_name)+'</div>'+dept+'</div>'
      +'<div style="font-size:.82rem;color:var(--subtle);word-break:break-all">'+teamEsc(u.email)+'</div>'
      +'<div style="font-size:.82rem;text-transform:capitalize">'+teamEsc(u.role)+'</div>'
      +'<div>'+badge+'</div>'
      +'<div style="text-align:right">'+actions+'</div>'
      +'</div>';
  }).join('');
  list.innerHTML='<div class="panel" style="padding:0;overflow:hidden">'+head+body+'</div>';
}

function teamOpenNew(){
  const opts=TEAM_ROLES.map(r=>'<option value="'+r+'">'+r.charAt(0).toUpperCase()+r.slice(1)+'</option>').join('');
  document.getElementById('modal-title').textContent='New Employee';
  document.getElementById('modal-body').innerHTML=
     '<div class="field"><label class="field-label">Display Name</label><input class="field-input" id="team-f-name" placeholder="e.g. Jamie Rivera"></div>'
    +'<div class="field"><label class="field-label">Email</label><input class="field-input" id="team-f-email" type="email" placeholder="name@example.test"></div>'
    +'<div class="field"><label class="field-label">Role</label><select class="field-select" id="team-f-role">'+opts+'</select></div>'
    +'<div class="field"><label class="field-label">Phone (optional)</label><input class="field-input" id="team-f-phone" placeholder="(555) 555-5555"></div>'
    +'<div class="field"><label class="field-label">Department (optional)</label><input class="field-input" id="team-f-dept" placeholder="e.g. Operations"></div>';
  document.querySelector('#modal .modal-actions').innerHTML=
     '<button class="btn-outline" onclick="closeModal()">Cancel</button>'
    +'<button class="btn-primary" onclick="teamSubmitNew()">Create</button>';
  modalEl.classList.add('open');
  setTimeout(()=>document.getElementById('team-f-name')?.focus(),50);
}

async function teamSubmitNew(){
  const name=sanitizeText(document.getElementById('team-f-name')?.value||'',120);
  const email=sanitizeText(document.getElementById('team-f-email')?.value||'',254).toLowerCase();
  const role=document.getElementById('team-f-role')?.value||'employee';
  const phone=sanitizeText(document.getElementById('team-f-phone')?.value||'',40);
  const dept=sanitizeText(document.getElementById('team-f-dept')?.value||'',100);
  if(!name){ toast('Display name is required','error'); return; }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ toast('A valid email is required','error'); return; }
  if(!TEAM_ROLES.includes(role)){ toast('Invalid role','error'); return; }

  if(teamIsLive()){
    try{
      const data=await teamApiFetch('','POST',{display_name:name,email,role,phone,department:dept});
      closeModal(); await renderTeam();
      teamShowCredential(name, data&&data.tempPassword, data&&data.emailStatus);
    }catch(e){ toast(e.message||'Could not create employee','error'); }
    return;
  }
  // DEMO
  const list=teamDemoLoad();
  if(list.some(u=>String(u.email).toLowerCase()===email)){ toast('A user with that email already exists','error'); return; }
  const tmp=teamDemoTempPassword();
  list.push({id:'demo-'+Date.now(), display_name:name, email, role, status:'active', phone, department:dept, must_change_password:true});
  teamDemoSave(list); closeModal(); renderTeam();
  teamShowCredential(name, tmp, 'skipped');
}

async function teamResetPassword(id){
  if(teamIsLive()){
    try{ const data=await teamApiFetch('/'+encodeURIComponent(id)+'/reset-password','POST');
      const u=TEAM_CACHE.find(x=>String(x.id)===String(id));
      teamShowCredential(u?u.display_name:'User', data&&data.tempPassword, data&&data.emailStatus);
    }catch(e){ toast(e.message||'Could not reset password','error'); }
    return;
  }
  const list=teamDemoLoad(); const u=list.find(x=>String(x.id)===String(id)); if(!u) return;
  u.must_change_password=true; teamDemoSave(list);
  teamShowCredential(u.display_name, teamDemoTempPassword(), 'skipped');
}

async function teamDisable(id){
  if(!confirm('Disable this user? They will no longer be able to sign in. This does not delete their account.')) return;
  if(teamIsLive()){
    try{ await teamApiFetch('/'+encodeURIComponent(id)+'/disable','POST'); await renderTeam(); toast('User disabled'); }
    catch(e){ toast(e.message||'Could not disable user','error'); }
    return;
  }
  const list=teamDemoLoad(); const u=list.find(x=>String(x.id)===String(id)); if(!u) return;
  u.status='disabled'; teamDemoSave(list); renderTeam(); toast('User disabled');
}

// One-time display of a temporary password using the shared modal shell.
function teamShowCredential(name, tempPassword, emailStatus){
  if(!tempPassword){ toast('Done'); return; }
  const sent = emailStatus==='sent';
  const note = sent
    ? 'An email with these credentials was sent to the user.'
    : 'Copy and deliver these credentials securely — they are shown only once.';
  document.getElementById('modal-title').textContent='Temporary Password';
  document.getElementById('modal-body').innerHTML=
     '<p style="line-height:1.6;margin:0 0 .8rem;color:var(--subtle)">Account for <strong>'+teamEsc(name)+'</strong>. The user must change this password on first sign in.</p>'
    +'<div style="font-size:1.05rem;font-weight:700;letter-spacing:.04em;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:.8rem 1rem;color:var(--heading);user-select:all;word-break:break-all">'+teamEsc(tempPassword)+'</div>'
    +'<p style="font-size:.78rem;color:var(--dim);margin:.8rem 0 0">'+teamEsc(note)+'</p>';
  document.querySelector('#modal .modal-actions').innerHTML='<button class="btn-primary" onclick="closeModal()">Done</button>';
  modalEl.classList.add('open');
}

/* ══════════════════════════════════════════════
   FORCED PASSWORD CHANGE (first login / admin reset)
   Only fires for a real logged-in user (server token) whose account is
   flagged must_change_password. Never fires in the public demo.
══════════════════════════════════════════════ */
function forcePasswordChange(){
  document.getElementById('modal-title').textContent='Set a New Password';
  document.getElementById('modal-body').innerHTML=
     '<p style="line-height:1.6;margin:0 0 .8rem;color:var(--subtle)">For your security, please choose a new password before continuing.</p>'
    +'<div class="field"><label class="field-label">New Password</label><input class="field-input" id="fpc-new" type="password" autocomplete="new-password" placeholder="At least 8 characters"></div>'
    +'<div class="field"><label class="field-label">Confirm Password</label><input class="field-input" id="fpc-confirm" type="password" autocomplete="new-password"></div>';
  document.querySelector('#modal .modal-actions').innerHTML='<button class="btn-primary" onclick="submitForcedPassword()">Update Password</button>';
  modalEl.classList.add('open');
  setTimeout(()=>document.getElementById('fpc-new')?.focus(),50);
}

async function submitForcedPassword(){
  const pw=document.getElementById('fpc-new')?.value||'';
  const pw2=document.getElementById('fpc-confirm')?.value||'';
  if(pw.length<8){ toast('Password must be at least 8 characters','error'); return; }
  if(pw!==pw2){ toast('Passwords do not match','error'); return; }
  const base=(window.NFINITY_API_BASE_URL||'').replace(/\/+$/,'');
  try{
    const res=await fetch(base+'/api/auth/users/'+encodeURIComponent(SESSION.userId)+'/password',{
      method:'PATCH',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+SESSION.sessionToken},
      body:JSON.stringify({password:pw}),
    });
    if(!res.ok) throw new Error('Could not update password');
    SESSION.mustChangePassword=false;
    try{ const s=JSON.parse(localStorage.getItem('nfinity_auth_session')||'{}'); s.mustChangePassword=false; localStorage.setItem('nfinity_auth_session',JSON.stringify(s)); }catch{}
    closeModal();
    toast('Password updated');
  }catch(e){ toast(e.message||'Could not update password','error'); }
}

(function(){ navigate(ROUTES.includes(initH) ? initH : 'dashboard'); })();
(function(){ if(SESSION && SESSION.sessionToken && SESSION.mustChangePassword){ forcePasswordChange(); } })();

initCharts();
initAiEmployees();
updateDashMetrics({});
updateROILive();
renderAnalyticsTasks();

// Initialize notification dot on page load
updateNotifBadge();
