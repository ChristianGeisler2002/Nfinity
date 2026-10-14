// Integration note: Replace with GET /api/analytics/summary, /api/analytics/roi
const METRICS_KEY = 'nfinity_metrics';

export function getMetrics() {
  try { return JSON.parse(localStorage.getItem(METRICS_KEY)) || defaultMetrics(); }
  catch { return defaultMetrics(); }
}

export function saveMetrics(metrics) {
  localStorage.setItem(METRICS_KEY, JSON.stringify(metrics));
}

export function incrementMetric(key, delta = 1) {
  const m = getMetrics();
  if (key in m) { m[key] += delta; saveMetrics(m); }
  return m;
}

function defaultMetrics() {
  return { tasks: 4, alerts: 3, docs: 7, hours: 38, workflows: 21 };
}

export function getROISummary() {
  // Integration note: GET /api/analytics/roi
  const m = getMetrics();
  const hourlyRate = 35;
  const monthlySavings = m.hours * hourlyRate;
  return {
    hoursSaved:       m.hours,
    monthlySavings,
    annualSavings:    monthlySavings * 12,
    workflowsRun:     m.workflows,
    documentsHandled: m.docs,
  };
}
