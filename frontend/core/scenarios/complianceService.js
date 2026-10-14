// Compliance Service - CDL, Medical Card, Insurance, IFTA Tracking
// DATABASE INTEGRATION POINT: Replace localStorage with POST /api/v1/compliance
// Current: stores in localStorage under 'nfinity_compliance'
// Future: POST /api/v1/compliance with auth header
// Schema: { id, type, owner_name, expiration_date, days_until, status, alert_threshold, created_at }

const complianceService = {
  // Get all compliance items from storage
  getComplianceItems() {
    const stored = localStorage.getItem('nfinity_compliance');
    return stored ? JSON.parse(stored) : [];
  },

  // Save compliance items to storage
  saveComplianceItems(items) {
    localStorage.setItem('nfinity_compliance', JSON.stringify(items));
  },

  // Add compliance warning/alert
  addComplianceWarning(type, ownerName, daysUntilExpiration, alertThreshold = 30) {
    const items = this.getComplianceItems();

    const expirationDate = new Date(Date.now() + daysUntilExpiration * 24 * 60 * 60 * 1000);

    // Determine status based on days remaining
    let status = 'compliant';
    if (daysUntilExpiration <= 0) {
      status = 'expired';
    } else if (daysUntilExpiration <= alertThreshold) {
      status = 'warning';
    } else if (daysUntilExpiration <= alertThreshold / 2) {
      status = 'critical';
    }

    const item = {
      id: `comp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: type || 'unknown', // cdl, medical, ifta, irp, insurance, eld
      owner_name: ownerName || 'Unknown',
      expiration_date: expirationDate.toISOString(),
      days_until_expiration: daysUntilExpiration,
      status: status,
      alert_threshold_days: alertThreshold,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    items.push(item);
    this.saveComplianceItems(items);

    return item;
  },

  // Get compliance items by status
  getComplianceByStatus(status) {
    const items = this.getComplianceItems();
    return items.filter(item => item.status === status);
  },

  // Get items needing attention (warning or critical)
  getItemsNeedingAttention() {
    const items = this.getComplianceItems();
    return items.filter(item => item.status === 'warning' || item.status === 'critical' || item.status === 'expired');
  },

  // Get compliance item by ID
  getComplianceById(id) {
    const items = this.getComplianceItems();
    return items.find(item => item.id === id);
  },

  // Update compliance item
  updateCompliance(id, updates) {
    const items = this.getComplianceItems();
    const index = items.findIndex(item => item.id === id);

    if (index !== -1) {
      items[index] = {
        ...items[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      this.saveComplianceItems(items);
      return items[index];
    }

    return null;
  },

  // Delete compliance item
  deleteCompliance(id) {
    const items = this.getComplianceItems().filter(item => item.id !== id);
    this.saveComplianceItems(items);
  },

  // Get compliance score (0-100)
  getComplianceScore() {
    const items = this.getComplianceItems();
    if (items.length === 0) return 100;

    const compliant = items.filter(item => item.status === 'compliant').length;
    return Math.round((compliant / items.length) * 100);
  },

  // Get items at risk (count)
  getRiskCount() {
    return this.getItemsNeedingAttention().length;
  },

  // Get total items count
  getTotalCount() {
    return this.getComplianceItems().length;
  }
};
