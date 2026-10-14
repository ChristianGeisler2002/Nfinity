const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Databaseless build ───────────────────────────────────────────────────────
// Append an immutable audit record to a local JSON file. Used for
// team-management actions: user.create | user.role_change | user.password_reset
// | user.disable. Best-effort: failures are logged but never block the request.
const AUDIT_FILE = process.env.AUDIT_FILE || path.join(__dirname, '..', '..', 'data', 'audit-logs.json');

async function writeAudit(entry) {
  try {
    const dir = path.dirname(AUDIT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let rows = [];
    if (fs.existsSync(AUDIT_FILE)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
        rows = Array.isArray(parsed) ? parsed : [];
      } catch {
        rows = [];
      }
    }
    rows.push({
      id: crypto.randomUUID(),
      company_id: entry.company_id || null,
      actor_user_id: entry.actor_user_id || null,
      target_user_id: entry.target_user_id || null,
      action: String(entry.action || 'unknown'),
      detail: entry.detail || {},
      created_at: new Date().toISOString(),
    });
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('[audit] failed to write audit log:', err?.message || err);
  }
}

module.exports = { writeAudit };
