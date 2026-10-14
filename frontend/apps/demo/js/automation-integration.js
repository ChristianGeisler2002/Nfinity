// Automation Integration - Connects AutomationSimulator to Dashboard
// Handles trigger button, notifications, and dashboard refreshes

// Ensure services are available
if (typeof notificationService === 'undefined') {
  console.warn('notificationService not loaded');
}

// Dashboard refresh function
function refreshDashboard() {
  // Update stat cards
  const metrics = analyticsService.getMetrics();

  const taskEl = document.getElementById('dc-tasks');
  const alertEl = document.getElementById('dc-alerts');
  const docsEl = document.getElementById('dc-docs');
  const hoursEl = document.getElementById('dc-hours');
  const workflowEl = document.getElementById('dc-workflows');
  const revenueEl = document.getElementById('dc-revenue');

  if (taskEl) taskEl.textContent = metrics.tasks || 4;
  if (alertEl) alertEl.textContent = metrics.alerts || 3;
  if (docsEl) docsEl.textContent = metrics.docs || 7;
  if (hoursEl) hoursEl.textContent = metrics.hours || 38;
  if (workflowEl) workflowEl.textContent = metrics.workflows || 21;
  if (revenueEl) revenueEl.textContent = '$' + (metrics.revenue || '4.2k');

  // Update notification badge
  updateNotificationBell();
}

// Update notification bell badge
function updateNotificationBell() {
  const badge = document.getElementById('notif-dot');
  const unreadCount = notificationService.getUnreadCount();

  if (badge) {
    if (unreadCount > 0) {
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }

  // Update sidebar badge
  const nbNotif = document.getElementById('nb-notif');
  if (nbNotif) {
    nbNotif.textContent = unreadCount;
    nbNotif.style.display = unreadCount > 0 ? 'inline-block' : 'none';
  }
}

// Simulate issue button - trigger random automation scenario
function simulateIssue() {
  const result = AutomationSimulator.runRandomSimulation();

  if (result) {
    // Show toast notification
    const messages = {
      opportunity: `New opportunity: ${result.data.name}`,
      compliance_warning: `Compliance alert: ${result.data.owner_name}'s ${result.data.type.toUpperCase()} expiring`,
      invoice_overdue: `Invoice overdue: $${result.data.amount.toLocaleString()} from ${result.data.client_name}`,
      task_escalation: `Task overdue: ${result.data.title}`,
      document_upload: `Document uploaded: ${result.data.file_name}`
    };

    const message = messages[result.scenario] || `New ${result.scenario} detected - check your notifications`;
    toast(message, 'success');

    // Refresh dashboard after a short delay to show visual feedback
    setTimeout(() => {
      refreshDashboard();
    }, 500);
  } else {
    toast('Simulation failed. Please try again.', 'warn');
  }
}

// Add trigger button to dashboard
function addSimulationButton() {
  const dashboardSection = document.getElementById('page-dashboard');
  if (!dashboardSection) return;

  // Check if button already exists
  if (document.getElementById('simulate-issue-btn')) return;

  // Find the page header
  const header = dashboardSection.querySelector('.ph');
  if (header) {
    // Create and add the button
    const btn = document.createElement('button');
    btn.id = 'simulate-issue-btn';
    btn.className = 'btn-primary';
    btn.textContent = 'Simulate Issue';
    btn.onclick = simulateIssue;
    btn.style.marginLeft = 'auto';

    // Insert button into the page header
    const dateSpan = header.querySelector('[id="dash-date"]');
    if (dateSpan) {
      dateSpan.parentElement.insertBefore(btn, dateSpan);
    } else {
      header.appendChild(btn);
    }
  }
}

// Show notification dropdown
function showNotificationDropdown() {
  const notifs = notificationService.getNotifications();
  const recent = notifs.slice(-7).reverse();

  let html = `
    <div id="notif-dropdown" style="position:absolute;top:100%;right:0;background:var(--card);border:1px solid var(--border);border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,0.3);min-width:320px;max-width:400px;max-height:400px;overflow-y:auto;z-index:300;margin-top:0.5rem">
      <div style="padding:1rem;border-bottom:1px solid var(--border)"><div style="font-weight:700;color:var(--heading);margin-bottom:0.5rem">Notifications</div><div style="font-size:0.78rem;color:var(--dim)">You have ${notificationService.getUnreadCount()} unread</div></div>
      <div style="max-height:300px;overflow-y:auto">
        ${recent.length > 0 ? recent.map(n => `
          <div style="padding:0.75rem 1rem;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;transition:background 0.15s" onmouseover="this.style.background='var(--card2)'" onmouseout="this.style.background='transparent'" onclick="markNotificationRead('${n.id}')">
            <div style="font-weight:600;color:${n.read ? 'var(--subtle)' : 'var(--heading)'};font-size:0.85rem">${n.title}</div>
            <div style="font-size:0.75rem;color:var(--dim);margin-top:0.25rem">${n.description}</div>
            ${!n.read ? '<div style="margin-top:0.5rem"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--amber);margin-right:0.5rem"></span><span style="font-size:0.7rem;color:var(--amber)">Unread</span></div>' : ''}
          </div>
        `).join('') : '<div style="padding:1.5rem;text-align:center;color:var(--dim);font-size:0.85rem">No notifications</div>'}
      </div>
      <div style="padding:0.75rem 1rem;border-top:1px solid var(--border);text-align:center">
        <button class="btn-outline btn-sm" onclick="navigate('notifications')">View all</button>
      </div>
    </div>
  `;

  const btn = document.getElementById('notif-btn');
  if (btn) {
    // Remove existing dropdown if present
    const existing = document.getElementById('notif-dropdown');
    if (existing) existing.remove();

    // Insert new dropdown
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.innerHTML = html;
    btn.parentElement.insertBefore(wrapper, btn.nextSibling);
  }
}

// Mark notification as read
function markNotificationRead(id) {
  notificationService.markRead(id);
  updateNotificationBell();
  const dropdown = document.getElementById('notif-dropdown');
  if (dropdown) dropdown.remove();
  showNotificationDropdown();
}

// Wire up notification bell button
function setupNotificationBell() {
  const notifBtn = document.getElementById('notif-btn');
  if (notifBtn) {
    notifBtn.onclick = function(e) {
      e.stopPropagation();
      const existing = document.getElementById('notif-dropdown');
      if (existing) {
        existing.remove();
      } else {
        showNotificationDropdown();
      }
    };
  }

  // Close dropdown when clicking elsewhere
  document.addEventListener('click', function() {
    const dropdown = document.getElementById('notif-dropdown');
    if (dropdown) dropdown.remove();
  });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    addSimulationButton();
    setupNotificationBell();
    updateNotificationBell();
    refreshDashboard();
  }, 100);
});

// Also initialize after page navigation
const originalNavigate = window.navigate;
if (originalNavigate) {
  window.navigate = function(page) {
    originalNavigate(page);
    setTimeout(() => {
      if (page === 'dashboard') {
        addSimulationButton();
        refreshDashboard();
      }
      setupNotificationBell();
    }, 100);
  };
}
