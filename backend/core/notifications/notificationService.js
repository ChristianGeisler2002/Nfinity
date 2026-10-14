// Integration note: Replace localStorage calls with POST/GET /api/notifications
const NOTIF_KEY = 'nfinity_notifications';

export function getNotifications() {
  try { const d = JSON.parse(localStorage.getItem(NOTIF_KEY)); return Array.isArray(d) ? d : []; }
  catch { return []; }
}

export function saveNotifications(notifs) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(notifs));
}

export function pushNotification(notif) {
  const notifs = getNotifications();
  const entry = { id: Date.now(), unread: true, dismissed: false, time: 'Just now', ...notif };
  notifs.unshift(entry);
  saveNotifications(notifs);
  return entry;
}

export function markRead(id) {
  const notifs = getNotifications();
  const n = notifs.find(n => n.id === id);
  if (n) { n.unread = false; saveNotifications(notifs); }
}

export function dismissNotification(id) {
  const notifs = getNotifications();
  const n = notifs.find(n => n.id === id);
  if (n) { n.dismissed = true; saveNotifications(notifs); }
}

export function getUnreadCount() {
  return getNotifications().filter(n => n.unread && !n.dismissed).length;
}
