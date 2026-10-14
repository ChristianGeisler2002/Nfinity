// Opportunity Service - Lead/CRM Management
// DATABASE INTEGRATION POINT: Replace localStorage with POST /api/v1/opportunities
// Current: stores in localStorage under 'nfinity_opportunities'
// Future: POST /api/v1/opportunities with auth header
// Schema: { id, name, company, status, value, assigned_to, created_at, updated_at }

const opportunityService = {
  // Get all opportunities from storage
  getOpportunities() {
    const stored = localStorage.getItem('nfinity_opportunities');
    return stored ? JSON.parse(stored) : [];
  },

  // Save opportunities to storage
  saveOpportunities(opportunities) {
    localStorage.setItem('nfinity_opportunities', JSON.stringify(opportunities));
  },

  // Create new opportunity
  createOpportunity(name, company, value, assignedTo = null) {
    const opportunities = this.getOpportunities();

    const opportunity = {
      id: `opp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name || 'New Opportunity',
      company: company || 'Unknown Company',
      status: 'new',
      value: value || 0,
      assigned_to: assignedTo || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    opportunities.push(opportunity);
    this.saveOpportunities(opportunities);

    return opportunity;
  },

  // Update opportunity
  updateOpportunity(id, updates) {
    const opportunities = this.getOpportunities();
    const index = opportunities.findIndex(o => o.id === id);

    if (index !== -1) {
      opportunities[index] = {
        ...opportunities[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      this.saveOpportunities(opportunities);
      return opportunities[index];
    }

    return null;
  },

  // Get opportunity by ID
  getOpportunityById(id) {
    const opportunities = this.getOpportunities();
    return opportunities.find(o => o.id === id);
  },

  // Get opportunities by status
  getOpportunitiesByStatus(status) {
    const opportunities = this.getOpportunities();
    return opportunities.filter(o => o.status === status);
  },

  // Get recent opportunities
  getRecentOpportunities(limit = 5) {
    const opportunities = this.getOpportunities();
    return opportunities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
  },

  // Delete opportunity
  deleteOpportunity(id) {
    const opportunities = this.getOpportunities().filter(o => o.id !== id);
    this.saveOpportunities(opportunities);
  },

  // Get total opportunities count
  getTotalCount() {
    return this.getOpportunities().length;
  },

  // Get opportunities pending follow-up
  getPendingFollowUps() {
    return this.getOpportunitiesByStatus('new');
  }
};
