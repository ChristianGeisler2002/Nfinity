// Task changes are saved in this browser; there is no task API in this build.
const TASK_KEY = 'nfinity_tasks';

export function getTasks() {
  try { const d = JSON.parse(localStorage.getItem(TASK_KEY)); return Array.isArray(d) ? d : []; }
  catch { return []; }
}

export function saveTasks(tasks) {
  localStorage.setItem(TASK_KEY, JSON.stringify(tasks));
}

export function createTask(task) {
  const tasks = getTasks();
  const newTask = { id: Date.now(), ...task };
  tasks.unshift(newTask);
  saveTasks(tasks);
  return newTask;
}

export function updateTask(id, patch) {
  const tasks = getTasks();
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return null;
  tasks[idx] = { ...tasks[idx], ...patch };
  saveTasks(tasks);
  return tasks[idx];
}

export function deleteTask(id) {
  const tasks = getTasks().filter(t => t.id !== id);
  saveTasks(tasks);
}
