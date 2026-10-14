// Invoice Service - Payment & Cash Flow Tracking
// DATABASE INTEGRATION POINT: Replace localStorage with POST /api/v1/invoices
// Current: stores in localStorage under 'nfinity_invoices'
// Future: POST /api/v1/invoices with auth header
// Schema: { id, invoice_number, amount, client_name, days_overdue, status, created_at, updated_at }

const invoiceService = {
  // Get all invoices from storage
  getInvoices() {
    const stored = localStorage.getItem('nfinity_invoices');
    return stored ? JSON.parse(stored) : [];
  },

  // Save invoices to storage
  saveInvoices(invoices) {
    localStorage.setItem('nfinity_invoices', JSON.stringify(invoices));
  },

  // Mark invoice as overdue (simulate receivable)
  markInvoiceOverdue(invoiceNumber, amount, clientName = 'Unknown Client', daysOverdue = 5) {
    const invoices = this.getInvoices();

    const invoice = {
      id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      invoice_number: invoiceNumber || `INV-${Math.floor(Math.random() * 10000)}`,
      amount: amount || 1500,
      client_name: clientName,
      days_overdue: daysOverdue,
      status: daysOverdue > 30 ? 'critical' : 'overdue',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    invoices.push(invoice);
    this.saveInvoices(invoices);

    return invoice;
  },

  // Mark invoice as paid
  markInvoicePaid(id) {
    return this.updateInvoice(id, { status: 'paid' });
  },

  // Get invoices by status
  getInvoicesByStatus(status) {
    const invoices = this.getInvoices();
    return invoices.filter(inv => inv.status === status);
  },

  // Get overdue invoices
  getOverdueInvoices() {
    const invoices = this.getInvoices();
    return invoices.filter(inv => inv.status === 'overdue' || inv.status === 'critical');
  },

  // Get invoice by ID
  getInvoiceById(id) {
    const invoices = this.getInvoices();
    return invoices.find(inv => inv.id === id);
  },

  // Update invoice
  updateInvoice(id, updates) {
    const invoices = this.getInvoices();
    const index = invoices.findIndex(inv => inv.id === id);

    if (index !== -1) {
      invoices[index] = {
        ...invoices[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      this.saveInvoices(invoices);
      return invoices[index];
    }

    return null;
  },

  // Delete invoice
  deleteInvoice(id) {
    const invoices = this.getInvoices().filter(inv => inv.id !== id);
    this.saveInvoices(invoices);
  },

  // Calculate total outstanding amount
  getTotalOutstanding() {
    const invoices = this.getInvoices();
    return invoices
      .filter(inv => inv.status !== 'paid')
      .reduce((sum, inv) => sum + (inv.amount || 0), 0);
  },

  // Get recent invoices
  getRecentInvoices(limit = 5) {
    const invoices = this.getInvoices();
    return invoices.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
  },

  // Get total invoices count
  getTotalCount() {
    return this.getInvoices().length;
  },

  // Calculate aging summary (0-30, 31-60, 60+ days)
  getAgingSummary() {
    const invoices = this.getInvoicesByStatus('overdue').concat(this.getInvoicesByStatus('critical'));

    return {
      current: invoices.filter(inv => inv.days_overdue <= 30).length,
      thirtyPlus: invoices.filter(inv => inv.days_overdue > 30 && inv.days_overdue <= 60).length,
      sixtyPlus: invoices.filter(inv => inv.days_overdue > 60).length
    };
  }
};
