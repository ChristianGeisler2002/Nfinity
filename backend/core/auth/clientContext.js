// CLIENT CONTEXT — Load client-specific configuration
// Loads branding, permissions, modules, and workflows for each client
// No code duplication — configuration-driven approach

import { getClientId } from './authService.js';

const CONFIG_CACHE = {};

/**
 * Default client configuration (fallback)
 */
const DEFAULT_CLIENT_CONFIG = {
  clientId: 'demo',
  branding: {
    companyName: 'NFINITY HQ',
    logo: 'N',
    primaryColor: '#fbbf24', // amber-400
    secondaryColor: '#334155', // slate-700
    theme: 'dark'
  },
  permissions: {
    canCreateTasks: true,
    canDeleteTasks: true,
    canManageUsers: false,
    canViewAnalytics: true,
    canExportData: false,
    canConfigureWorkflows: true,
    canViewCompliance: true,
    canCreateNotifications: true
  },
  modules: {
    dashboard: true,
    tasks: true,
    crm: true,
    outreach: true,
    pipeline: true,
    uploads: true,
    analytics: true,
    notifications: true,
    automation: true,
    settings: true
  },
  workflows: {
    autoCreateTaskOnCompliance: true,
    autoCreateTaskOnOverdueInvoice: true,
    notifyOnHighRisk: true,
    dailyDigest: true
  }
};

/**
 * Client-specific configs
 */
const CLIENT_CONFIGS = {
  demo: {
    clientId: 'demo',
    branding: {
      companyName: 'NFINITY HQ',
      logo: 'N',
      primaryColor: '#fbbf24',
      secondaryColor: '#334155',
      theme: 'dark'
    },
    permissions: {
      canCreateTasks: true,
      canDeleteTasks: true,
      canManageUsers: true,
      canViewAnalytics: true,
      canExportData: true,
      canConfigureWorkflows: true,
      canViewCompliance: true,
      canCreateNotifications: true
    },
    modules: {
      dashboard: true,
      tasks: true,
      crm: true,
      outreach: true,
      pipeline: true,
      uploads: true,
      analytics: true,
      notifications: true,
      automation: true,
      settings: true
    },
    workflows: {
      autoCreateTaskOnCompliance: true,
      autoCreateTaskOnOverdueInvoice: true,
      notifyOnHighRisk: true,
      dailyDigest: true
    }
  },

};

/**
/**
 * Load client configuration
 * If clientId not provided, uses current user's client
 */
export function loadClientConfig(clientId = null) {
  try {
    const cId = clientId || getClientId();

    if (!cId) {
      return DEFAULT_CLIENT_CONFIG;
    }

    // Return cached config if available
    if (CONFIG_CACHE[cId]) {
      return CONFIG_CACHE[cId];
    }

    // Get config or use default
    const config = CLIENT_CONFIGS[cId] || DEFAULT_CLIENT_CONFIG;
    CONFIG_CACHE[cId] = config;
    return config;
  } catch (error) {
    console.error('Error loading client config:', error);
    return DEFAULT_CLIENT_CONFIG;
  }
}

/**
 * Get specific config section
 */
export function getClientConfig(section) {
  const config = loadClientConfig();
  return config[section] || null;
}

/**
 * Check if module is enabled for client
 */
export function isModuleEnabled(moduleName) {
  const modules = getClientConfig('modules');
  return modules?.[moduleName] ?? true;
}

/**
 * Check if user has permission
 */
export function hasPermission(permissionName) {
  const permissions = getClientConfig('permissions');
  return permissions?.[permissionName] ?? false;
}

/**
 * Check if workflow is enabled
 */
export function isWorkflowEnabled(workflowName) {
  const workflows = getClientConfig('workflows');
  return workflows?.[workflowName] ?? false;
}

/**
 * Get branding config
 */
export function getBranding() {
  return getClientConfig('branding');
}

/**
 * Get all available clients
 */
export function getAvailableClients() {
  return Object.keys(CLIENT_CONFIGS).map(clientId => ({
    clientId,
    company: CLIENT_CONFIGS[clientId].branding.companyName
  }));
}

/**
 * Apply branding to page (CSS variables)
 */
export function applyBranding() {
  const branding = getBranding();
  if (!branding) return;

  const root = document.documentElement;
  root.style.setProperty('--primary-color', branding.primaryColor);
  root.style.setProperty('--secondary-color', branding.secondaryColor);

  // Update document title
  document.title = `${branding.companyName} — NFINITY HQ`;
}
