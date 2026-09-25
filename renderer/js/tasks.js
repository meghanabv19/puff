// The task list: add / tick / delete / drag-to-reorder. Ticking celebrates.
// Data persists through the JSON store; day-rollover is handled in runtime.js.

import { $, S, pick, saveData } from './runtime.js';
import { LINES } from './lines.js';
import { say } from './bubble.js';
import { react } from './pet.js';
import { refreshStats } from './timer.js';

let listEl, inputEl;
let onTogglePanel = () => {};
let dragIndex = null;

export function initTasks(togglePanel) {
  onTogglePanel = togglePanel || (() => {});
  listEl = $('#tasks');
  inputEl = $('#newTask');

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      S.data.tasks.push({ id: Date.now() + Math.random(), text: e.target.value.trim(), done: false });
      e.target.value = '';
      saveData(); render();
      say(pick(LINES.taskAdded), { ms: 2000 });
    }
    if (e.key === 'Escape') onTogglePanel();
  });

  render();
}

export function focusInput() { inputEl && inputEl.focus(); }

function celebrate() {
  react('celebrate');
  say(pick(LINES.taskDone));
}

function moveTask(from, to) {
  if (from == null || to == null || from === to) return;
  const arr = S.data.tasks;
  const [item] = arr.splice(from, 1);
  arr.splice(to, 0, item);
  saveData(); render();
}

export function render() {
  listEl.innerHTML = '';
  S.data.tasks.forEach((t, i) => {
    const li = document.createElement('li');
    if (t.done) li.className = 'done';
    li.draggable = true;

    // drag-to-reorder
    li.addEventListener('dragstart', (e) => {
      dragIndex = i; li.classList.add('dragging-task');
      e.dataTransfer.effectAllowed = 'move';
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging-task');
      listEl.querySelectorAll('.drop-target').forEach((x) => x.classList.remove('drop-target'));
    });
    li.addEventListener('dragover', (e) => { e.preventDefault(); li.classList.add('drop-target'); });
    li.addEventListener('dragleave', () => li.classList.remove('drop-target'));
    li.addEventListener('drop', (e) => { e.preventDefault(); li.classList.remove('drop-target'); moveTask(dragIndex, i); });

    const grip = document.createElement('span');
    grip.className = 'grip'; grip.textContent = '⠿'; grip.title = 'Drag to reorder';

    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = t.done; cb.setAttribute('aria-label', 'Mark done');
    cb.onchange = () => {
      t.done = cb.checked;
      if (t.done) { S.data.doneCount = (S.data.doneCount || 0) + 1; celebrate(); }
      saveData(); render(); refreshStats();
    };

    const span = document.createElement('span');
    span.textContent = t.text;

    const del = document.createElement('button');
    del.className = 'del'; del.textContent = '×'; del.setAttribute('aria-label', 'Delete task');
    del.onclick = () => { S.data.tasks = S.data.tasks.filter((x) => x !== t); saveData(); render(); };

    li.append(grip, cb, span, del);
    listEl.appendChild(li);
  });
}
