// Task Escalation Service - Overdue Task Alerts
// DATABASE INTEGRATION POINT: Uses taskService for creation, adds escalation logic
// Current: reads/writes to existing nfinity_tasks via taskService
// Future: POST /api/v1/tasks with escalation flag

const taskEscalationService = {
  // Get all escalated tasks
  getEscalatedTasks() {
    const stored = localStorage.getItem('nfinity_task_escalations');
    return stored ? JSON.parse(stored) : [];
  },

  // Save escalations
  saveEscalations(escalations) {
    localStorage.setItem('nfinity_task_escalations', JSON.stringify(escalations));
  },

  // Mark task as escalated (overdue)
  escalateOverdueTask(title, daysOverdue = 2, assignedTo = null) {
    const escalations = this.getEscalatedTasks();

    const escalation = {
      id: `esc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: title || 'Overdue Task',
      days_overdue: daysOverdue,
      priority: daysOverdue > 7 ? 'critical' : 'high',
      assigned_to: assignedTo || null,
      status: 'escalated',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    escalations.push(escalation);
    this.saveEscalations(escalations);

    return escalation;
  },

  // Get escalated tasks by status
  getEscalationsByStatus(status) {
    const escalations = this.getEscalatedTasks();
    return escalations.filter(e => e.status === status);
  },

  // Get all active escalations
  getActiveEscalations() {
    return this.getEscalationsByStatus('escalated');
  },

  // Get escalation by ID
  getEscalationById(id) {
    const escalations = this.getEscalatedTasks();
    return escalations.find(e => e.id === id);
  },

  // Update escalation status
  updateEscalation(id, updates) {
    const escalations = this.getEscalatedTasks();
    const index = escalations.findIndex(e => e.id === id);

    if (index !== -1) {
      escalations[index] = {
        ...escalations[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      this.saveEscalations(escalations);
      return escalations[index];
    }

    return null;
  },

  // Resolve escalation (mark as resolved)
  resolveEscalation(id) {
    return this.updateEscalation(id, { status: 'resolved' });
  },

  // Delete escalation
  deleteEscalation(id) {
    const escalations = this.getEscalatedTasks().filter(e => e.id !== id);
    this.saveEscalations(escalations);
  },

  // Get count of active escalations
  getActiveCount() {
    return this.getActiveEscalations().length;
  },

  // Get count of critical priority tasks
  getCriticalCount() {
    return this.getEscalatedTasks().filter(e => e.priority === 'critical').length;
  },

  // Get recent escalations
  getRecentEscalations(limit = 5) {
    const escalations = this.getEscalatedTasks();
    return escalations.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
  }
};
