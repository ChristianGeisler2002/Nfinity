// DASHBOARD MODULE — Main dashboard with stats and activity feed

export const DASHBOARD_DATA = {
  stats: [
    {
      label: 'Active Tasks',
      value: 12,
      icon: 'check',
      color: 'blue',
      trend: '+3 this week'
    },
    {
      label: 'Compliance Alerts',
      value: 3,
      icon: 'warning',
      color: 'red',
      trend: 'Urgent action needed'
    },
    {
      label: 'Pending Uploads',
      value: 8,
      icon: 'folder',
      color: 'amber',
      trend: '2 awaiting review'
    },
    {
      label: 'Hours Saved',
      value: '142',
      icon: '⏱',
      color: 'emerald',
      trend: 'This month'
    },
    {
      label: 'Workflows Automated',
      value: 7,
      icon: 'settings',
      color: 'blue',
      trend: 'Active daily'
    },
    {
      label: 'Revenue Recovered',
      value: '$8,400',
      icon: 'finance',
      color: 'emerald',
      trend: 'From automation'
    }
  ],

  activityFeed: [
    {
      id: 1,
      type: 'compliance',
      icon: 'warning',
      title: 'Certification Expiring Soon',
      description: 'Marcus Webb certification expires in 14 days',
      time: '2 hours ago',
      severity: 'red'
    },
    {
      id: 2,
      type: 'invoice',
      icon: 'finance',
      title: 'Invoice Overdue',
      description: 'Invoice INV-2231 is 18 days overdue',
      time: '4 hours ago',
      severity: 'red'
    },
    {
      id: 3,
      type: 'upload',
      icon: 'doc',
      title: 'Document Uploaded',
      description: 'new_ops_manual.pdf uploaded by Admin User',
      time: '1 day ago',
      severity: 'green'
    },
    {
      id: 4,
      type: 'task',
      icon: 'check',
      title: 'Task Assigned',
      description: 'Follow up with client assigned to you',
      time: '2 days ago',
      severity: 'blue'
    },
    {
      id: 5,
      type: 'automation',
      icon: 'settings',
      title: 'Workflow Triggered',
      description: 'Auto-created task: Review Q2 regulatory filing',
      time: '3 days ago',
      severity: 'blue'
    },
    {
      id: 6,
      type: 'notification',
      icon: 'bell',
      title: 'Risk Alert',
      description: 'Insurance expiration risk: 45 days until renewal',
      time: '5 days ago',
      severity: 'amber'
    }
  ]
};

/**
 * Render dashboard HTML
 */
export function renderDashboard() {
  const statsHTML = DASHBOARD_DATA.stats
    .map(stat => `
      <div class="dashboard-card stat-card stat-card-${stat.color}">
        <div class="stat-icon">${stat.icon}</div>
        <div class="stat-content">
          <div class="stat-label">${stat.label}</div>
          <div class="stat-value">${stat.value}</div>
          <div class="stat-trend">${stat.trend}</div>
        </div>
      </div>
    `)
    .join('');

  const activityHTML = DASHBOARD_DATA.activityFeed
    .map(activity => `
      <div class="activity-item activity-${activity.severity}">
        <div class="activity-icon">${activity.icon}</div>
        <div class="activity-content">
          <div class="activity-title">${activity.title}</div>
          <div class="activity-description">${activity.description}</div>
          <div class="activity-time">${activity.time}</div>
        </div>
      </div>
    `)
    .join('');

  return `
    <div class="dashboard-container">
      <div class="dashboard-header">
        <h2 class="dashboard-title">Overview</h2>
        <div class="dashboard-subtitle">Last updated just now</div>
      </div>

      <div class="stats-grid">
        ${statsHTML}
      </div>

      <div class="dashboard-section">
        <h3 class="section-heading">Recent Activity</h3>
        <div class="activity-feed">
          ${activityHTML}
        </div>
      </div>
    </div>
  `;
}

/**
 * Initialize dashboard interactions
 */
export function initializeDashboard() {
  // Add click handlers for stat cards
  document.querySelectorAll('.stat-card').forEach(card => {
    card.addEventListener('click', function() {
      const label = this.querySelector('.stat-label').textContent;
      // Can add navigation here
    });
  });

  // Add click handlers for activity items
  document.querySelectorAll('.activity-item').forEach(item => {
    item.addEventListener('click', function() {
      const title = this.querySelector('.activity-title').textContent;
      // Can add modal/detail view here
    });
  });
}
