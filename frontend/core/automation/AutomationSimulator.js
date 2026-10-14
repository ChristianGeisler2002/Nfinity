// Automation Simulator - Orchestrates multi-domain demo scenarios
// Simulates real business events and demonstrates NFINITY HQ's reactive capabilities
//
// Integration note: Each handler below calls individual scenario services.
// In production, replace these service calls with POST requests to:
//   POST /api/v1/opportunities   (handleNewOpportunity)
//   POST /api/v1/compliance      (handleComplianceWarning)
//   POST /api/v1/invoices        (handleInvoiceOverdue)
//   POST /api/v1/tasks           (handleTaskEscalation)
//   POST /api/v1/documents       (handleDocumentUpload)
// All endpoints should accept a JSON body and return the created entity.
//
// NOTE: In the demo app, business reactions (notifications, tasks, activity) are
// handled by the in-page SIM_SCENARIOS system in apps/demo/index.html.
// This file is loaded for external integration wiring only.

const AutomationSimulator = {
  // Define all available scenarios
  scenarios: [
    {
      id: 'opportunity',
      label: 'Lead Follow-Up Needed',
      description: 'New sales opportunity detected in system'
    },
    {
      id: 'compliance_warning',
      label: 'Compliance Warning',
      description: 'Certificate or compliance item expiring soon'
    },
    {
      id: 'invoice_overdue',
      label: 'Missed Invoice',
      description: 'Outstanding payment overdue from client'
    },
    {
      id: 'task_escalation',
      label: 'Overdue Task',
      description: 'Task deadline passed without completion'
    },
    {
      id: 'document_upload',
      label: 'New Document Upload',
      description: 'Document uploaded requiring filing or review'
    }
  ],

  // Random demo data generators
  demoCompanies: [
    'Acme Corp',
    'TechFlow Inc',
    'Global Solutions',
    'Enterprise Systems',
    'Digital Ventures',
    'Innovation Labs',
    'Future Industries',
    'NextGen Logistics'
  ],

  demoNames: [
    'John Smith',
    'Sarah Johnson',
    'Michael Chen',
    'Emma Davis',
    'David Wilson',
    'Jennifer Brown',
    'Alex Rodriguez',
    'Lisa Anderson'
  ],

  demoCDLOwners: [
    'James Miller',
    'Robert Taylor',
    'Christopher Lee',
    'Daniel Martinez',
    'Andrew White',
    'Thomas Garcia'
  ],

  demoTaskTitles: [
    'Review contract terms',
    'Follow up on proposal',
    'Schedule discovery call',
    'Prepare proposal',
    'Send quote',
    'Verify credentials',
    'Renew insurance',
    'Complete onboarding'
  ],

  demoDocuments: [
    { name: 'contract-2024-001.pdf', type: 'contract' },
    { name: 'invoice-march.pdf', type: 'invoice' },
    { name: 'compliance-cert.pdf', type: 'compliance' },
    { name: 'rate-confirmation.pdf', type: 'ratecon' },
    { name: 'bill-of-lading.pdf', type: 'bol' },
    { name: 'proof-of-delivery.pdf', type: 'pod' }
  ],

  // Get random value from array
  getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
  },

  // Run simulation with specific scenario
  runSimulation(scenarioId) {
    const scenario = this.scenarios.find(s => s.id === scenarioId);

    if (!scenario) {
      console.error('Scenario not found:', scenarioId);
      return null;
    }

    switch (scenarioId) {
      case 'opportunity':
        return this.handleNewOpportunity();
      case 'compliance_warning':
        return this.handleComplianceWarning();
      case 'invoice_overdue':
        return this.handleInvoiceOverdue();
      case 'task_escalation':
        return this.handleTaskEscalation();
      case 'document_upload':
        return this.handleDocumentUpload();
      default:
        console.error('Unknown scenario:', scenarioId);
        return null;
    }
  },

  // Run random simulation
  runRandomSimulation() {
    const randomScenario = this.getRandomItem(this.scenarios);
    return this.runSimulation(randomScenario.id);
  },

  // Handler: New Opportunity
  handleNewOpportunity() {
    const company = this.getRandomItem(this.demoCompanies);
    const value = Math.floor(Math.random() * 50000) + 5000;
    const currentUser = authService.getCurrentUser();
    const assignedTo = currentUser?.id || 'demo-user';

    const opportunity = opportunityService.createOpportunity(
      `${company} Opportunity`,
      company,
      value,
      assignedTo
    );

    // Push notification
    notificationService.pushNotification({
      type: 'opportunity',
      title: `New Opportunity: ${company}`,
      description: `Potential deal worth $${value.toLocaleString()}`,
      severity: 'info',
      action: 'view_opportunity',
      metadata: { opportunity_id: opportunity.id }
    });

    // Create task
    taskService.createTask({
      title: `Follow up with ${company}`,
      workflow: 'opportunity',
      assigned_to: assignedTo,
      priority: 'high',
      due_date: new Date(Date.now() + 86400000).toISOString(),
      description: `Review and qualify opportunity. Potential deal: $${value.toLocaleString()}`,
      impact: { hours_saved: 0.5 }
    });

    // Log to activity
    if (typeof activityFeedService !== 'undefined' && activityFeedService.log) {
      activityFeedService.log(
        'opportunity_created',
        `New opportunity: ${company}`,
        `Potential deal value: $${value.toLocaleString()}`,
        { type: 'opportunity', severity: 'info' }
      );
    }

    // Update metrics
    analyticsService.incrementMetric('opportunities_created', 1);
    analyticsService.incrementMetric('tasks_automated', 1);
    analyticsService.incrementMetric('hours_saved', 0.5);

    return {
      scenario: 'opportunity',
      title: 'New Opportunity',
      data: opportunity,
      message: `New lead: ${company} - $${value.toLocaleString()}`
    };
  },

  // Handler: Compliance Warning
  handleComplianceWarning() {
    const owner = this.getRandomItem(this.demoCDLOwners);
    const types = ['cdl', 'medical', 'ifta', 'insurance'];
    const type = this.getRandomItem(types);
    const daysUntil = Math.floor(Math.random() * 25) + 5;
    const currentUser = authService.getCurrentUser();
    const assignedTo = currentUser?.id || 'demo-user';

    const compliance = complianceService.addComplianceWarning(type, owner, daysUntil, 30);

    // Push notification
    notificationService.pushNotification({
      type: 'compliance',
      title: `Compliance Alert: ${type.toUpperCase()} Expiring`,
      description: `${owner}'s ${type} expires in ${daysUntil} days`,
      severity: daysUntil <= 15 ? 'critical' : 'warning',
      action: 'view_compliance',
      metadata: { compliance_id: compliance.id }
    });

    // Create task
    taskService.createTask({
      title: `Renew ${type.toUpperCase()} - ${owner}`,
      workflow: 'compliance',
      assigned_to: assignedTo,
      priority: daysUntil <= 15 ? 'critical' : 'high',
      due_date: new Date(Date.now() + Math.min(daysUntil, 7) * 86400000).toISOString(),
      description: `${type.toUpperCase()} for ${owner} expires in ${daysUntil} days. Submit renewal immediately.`,
      impact: { issues_prevented: 1 }
    });

    // Log to activity
    if (typeof activityFeedService !== 'undefined' && activityFeedService.log) {
      activityFeedService.log(
        'compliance_alert',
        `Compliance item expiring: ${type.toUpperCase()}`,
        `${owner} - ${daysUntil} days remaining`,
        { type: 'compliance', severity: daysUntil <= 15 ? 'critical' : 'warning' }
      );
    }

    // Update metrics
    analyticsService.incrementMetric('compliance_alerts', 1);
    analyticsService.incrementMetric('tasks_automated', 1);
    analyticsService.incrementMetric('issues_prevented', 1);

    return {
      scenario: 'compliance_warning',
      title: 'Compliance Alert',
      data: compliance,
      message: `${type.toUpperCase()} for ${owner} expiring in ${daysUntil} days`
    };
  },

  // Handler: Invoice Overdue
  handleInvoiceOverdue() {
    const company = this.getRandomItem(this.demoCompanies);
    const amount = Math.floor(Math.random() * 25000) + 2000;
    const daysOverdue = Math.floor(Math.random() * 15) + 3;
    const currentUser = authService.getCurrentUser();
    const assignedTo = currentUser?.id || 'demo-user';

    const invoice = invoiceService.markInvoiceOverdue(
      `INV-${Math.floor(Math.random() * 100000)}`,
      amount,
      company,
      daysOverdue
    );

    // Push notification
    notificationService.pushNotification({
      type: 'invoice',
      title: `Invoice Overdue: ${company}`,
      description: `$${amount.toLocaleString()} overdue for ${daysOverdue} days`,
      severity: daysOverdue > 15 ? 'critical' : 'warning',
      action: 'view_invoice',
      metadata: { invoice_id: invoice.id }
    });

    // Create task
    taskService.createTask({
      title: `Collect payment from ${company}`,
      workflow: 'invoice',
      assigned_to: assignedTo,
      priority: daysOverdue > 15 ? 'critical' : 'high',
      due_date: new Date(Date.now() + 86400000).toISOString(),
      description: `Invoice ${invoice.invoice_number} is ${daysOverdue} days overdue. Amount: $${amount.toLocaleString()}. Contact ${company} immediately.`,
      impact: { revenue_recovered: amount * 0.02 }
    });

    // Log to activity
    if (typeof activityFeedService !== 'undefined' && activityFeedService.log) {
      activityFeedService.log(
        'invoice_overdue',
        `Invoice overdue: ${company}`,
        `$${amount.toLocaleString()} - ${daysOverdue} days past due`,
        { type: 'invoice', severity: daysOverdue > 15 ? 'critical' : 'warning' }
      );
    }

    // Update metrics
    analyticsService.incrementMetric('overdue_invoices', 1);
    analyticsService.incrementMetric('tasks_automated', 1);
    analyticsService.incrementMetric('revenue_at_risk', amount);

    return {
      scenario: 'invoice_overdue',
      title: 'Invoice Overdue',
      data: invoice,
      message: `$${amount.toLocaleString()} overdue from ${company} for ${daysOverdue} days`
    };
  },

  // Handler: Task Escalation
  handleTaskEscalation() {
    const taskTitle = this.getRandomItem(this.demoTaskTitles);
    const daysOverdue = Math.floor(Math.random() * 5) + 1;
    const currentUser = authService.getCurrentUser();
    const assignedTo = currentUser?.id || 'demo-user';

    const escalation = taskEscalationService.escalateOverdueTask(taskTitle, daysOverdue, assignedTo);

    // Push notification
    notificationService.pushNotification({
      type: 'task',
      title: `Task Escalated: ${taskTitle}`,
      description: `Task overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`,
      severity: 'critical',
      action: 'view_task',
      metadata: { escalation_id: escalation.id }
    });

    // Log to activity
    if (typeof activityFeedService !== 'undefined' && activityFeedService.log) {
      activityFeedService.log(
        'task_escalated',
        `Task escalated: ${taskTitle}`,
        `Overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`,
        { type: 'task', severity: 'critical' }
      );
    }

    // Update metrics
    analyticsService.incrementMetric('overdue_tasks', 1);
    analyticsService.incrementMetric('issues_prevented', 1);

    return {
      scenario: 'task_escalation',
      title: 'Task Escalated',
      data: escalation,
      message: `Task "${taskTitle}" is ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue`
    };
  },

  // Handler: Document Upload
  handleDocumentUpload() {
    const doc = this.getRandomItem(this.demoDocuments);
    const currentUser = authService.getCurrentUser();
    const assignedTo = currentUser?.id || 'demo-user';

    const document = documentService.simulateDocumentUpload(doc.name, doc.type, assignedTo);

    // Push notification
    notificationService.pushNotification({
      type: 'document',
      title: `Document Uploaded: ${doc.name}`,
      description: `New ${doc.type} document available for review`,
      severity: 'info',
      action: 'view_document',
      metadata: { document_id: document.id }
    });

    // Create task if compliance or invoice
    if (doc.type === 'compliance' || doc.type === 'invoice' || doc.type === 'pod') {
      taskService.createTask({
        title: `Review & file: ${doc.name}`,
        workflow: 'document',
        assigned_to: assignedTo,
        priority: 'normal',
        due_date: new Date(Date.now() + 86400000).toISOString(),
        description: `${doc.type} document uploaded. Review and file in appropriate category.`,
        impact: { hours_saved: 0.25 }
      });
    }

    // Log to activity
    if (typeof activityFeedService !== 'undefined' && activityFeedService.log) {
      activityFeedService.log(
        'document_uploaded',
        `Document uploaded: ${doc.name}`,
        `Type: ${doc.type}`,
        { type: 'document', severity: 'info' }
      );
    }

    // Update metrics
    analyticsService.incrementMetric('documents_uploaded', 1);
    if (doc.type === 'compliance' || doc.type === 'invoice' || doc.type === 'pod') {
      analyticsService.incrementMetric('tasks_automated', 1);
      analyticsService.incrementMetric('hours_saved', 0.25);
    }

    return {
      scenario: 'document_upload',
      title: 'Document Uploaded',
      data: document,
      message: `Document uploaded: ${doc.name}`
    };
  }
};
