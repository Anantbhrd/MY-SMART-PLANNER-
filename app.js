/* ============================
   ULTIMATE STUDENT PLANNER - JS v2
   Features: Assignments, Exams, Courses, Planner,
             Habits, Workout (Gym+Badminton+Plans+Machines),
             Budget (₹), Notes, Semester Progress
============================ */

// ==================== STATE ====================
const STATE = {
  assignments: [],
  exams: [],
  courses: [],
  sessions: [],
  habits: [],
  habitLogs: {},
  budget: { limit: 0, expenses: [] },
  notes: [],
  categories: {
    budget: ['Food', 'Study', 'Transport', 'Entertainment', 'Other'],
    machines: ['Strength', 'Cardio', 'Flexibility', 'Free Weights', 'Other']
  },
  semester: { startDate: '', endDate: '', name: 'Semester 1', marksLastInternals: '', marksLastSemester: '' },
  workout: {
    machines: [],
    plans: [],
    activePlanId: null,
    gymLogs: [],      // { id, date, duration, exercises:[{machineId,machineName,sets,reps,weight,done}], notes }
    badmintonLogs: [], // { id, date, duration, partner, setsWon, setsLost, notes }
  },
  currentView: 'dashboard',
  weekOffset: 0,
  habitMonthOffset: 0,
  theme: 'dark',
  workoutSubTab: 'today',
  machineFilter: 'all',
  historyFilter: 'all',
  todos: [],
  completedExams: [],
  completedAssignments: [],
  lastTodoResetDate: '',
  todoNotificationInterval: 6
};

// ==================== FIREBASE CONFIG ====================
const firebaseConfig = {
  apiKey: "AIzaSyBV909j9ypRynF2ZO7BMXp90r6gPRfGUQk",
  authDomain: "my-study-planner-98e4d.firebaseapp.com",
  projectId: "my-study-planner-98e4d",
  storageBucket: "my-study-planner-98e4d.firebasestorage.app",
  messagingSenderId: "848797377236",
  appId: "1:848797377236:web:7d641a2a083594a1bb5141",
  measurementId: "G-BHB986PSP6"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();
const provider = new firebase.auth.GoogleAuthProvider();

async function uploadFile(file) {
  if (!currentUser) throw new Error("You must sign in to upload files.");
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
  const ref = storage.ref(`user_uploads/${currentUser.uid}/${Date.now()}_${safeName}`);
  await ref.put(file);
  return await ref.getDownloadURL();
}

let currentUser = null;
let unsubscribeSnapshot = null;

// ==================== PERSISTENCE ====================
function save() {
  try { localStorage.setItem('studentPlanner_v3', JSON.stringify(STATE)); } catch(e) {}
  if (currentUser) {
    db.collection('users').doc(currentUser.uid).set(STATE)
      .catch(err => console.error("Firebase save error:", err));
  }
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem('studentPlanner_v3'));
    if (d) {
      if (d.workout) STATE.workout = Object.assign({}, STATE.workout, d.workout);
      if (d.semester) STATE.semester = Object.assign({}, STATE.semester, d.semester);
      if (d.categories) STATE.categories = Object.assign({}, STATE.categories, d.categories);
      Object.assign(STATE, d);
      STATE.workout = d.workout || STATE.workout;
      STATE.semester = d.semester || STATE.semester;
      STATE.categories = d.categories || STATE.categories;
      STATE.todos = d.todos || [];
      STATE.completedExams = d.completedExams || [];
      STATE.completedAssignments = d.completedAssignments || [];
      if (d.lastTodoResetDate) STATE.lastTodoResetDate = d.lastTodoResetDate;
      if (d.todoNotificationInterval) STATE.todoNotificationInterval = d.todoNotificationInterval;
      checkTodoReset();
    }
  } catch(e) {}
}

function genId() { return `id_${Date.now()}_${Math.random().toString(36).slice(2,7)}`; }

function categoryMatch(cat1, cat2) {
  if (!cat1 || !cat2) return false;
  if (cat1 === cat2) return true;
  const c1 = String(cat1).toLowerCase();
  const c2 = String(cat2).toLowerCase();
  return c1.includes(c2) || c2.includes(c1);
}

// ==================== COLORS ====================
const COURSE_COLORS = ['#7c5cbf','#4a90e2','#4caf7d','#f0965a','#e05c5c','#e8c44a','#20b2aa','#9b59b6'];
function getCourseColor(name) {
  const c = STATE.courses.find(c => c.name === name);
  return c ? c.color : '#7c5cbf';
}

// ==================== TOAST ====================
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ==================== DATE UTILS ====================
function today() { return new Date().toISOString().split('T')[0]; }
function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}
function daysUntil(d) {
  if (!d) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  const target = new Date(d + 'T00:00:00');
  return Math.round((target - now) / 86400000);
}
function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((day === 0 ? 7 : day) - 1) + offset * 7);
  return Array.from({length:7}, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}
function getMonthDays(offset = 0) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const days = [];
  const targetMonth = d.getMonth();
  while (d.getMonth() === targetMonth) {
    days.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return days;
}
function monthLabel(offset) {
  const d = new Date(); d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString('en-IN', { month:'long', year:'numeric' });
}
function dayOfWeek(dateStr) {
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(dateStr + 'T00:00:00').getDay()];
}

// ==================== SEMESTER PROGRESS ====================
function calcSemesterProgress() {
  const { startDate, endDate } = STATE.semester;
  if (!startDate || !endDate) return null;
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const now = new Date(); now.setHours(0,0,0,0);
  if (now < start) return 0;
  if (now > end) return 100;
  return Math.round((now - start) / (end - start) * 100);
}

function updateSemesterUI() {
  const pct = calcSemesterProgress();
  const pctEl = document.getElementById('semesterPct');
  const fillEl = document.getElementById('semesterProgress');
  const bannerEl = document.getElementById('semesterBanner');

  if (pct === null) {
    pctEl.textContent = '—';
    fillEl.style.width = '0%';
    if (bannerEl) bannerEl.style.display = 'none';
  } else {
    pctEl.textContent = `${pct}%`;
    fillEl.style.width = `${pct}%`;
    if (bannerEl) {
      bannerEl.style.display = 'flex';
      document.getElementById('sbLabel').textContent = STATE.semester.name || 'Semester';
      document.getElementById('sbDates').textContent = `${formatDate(STATE.semester.startDate)} → ${formatDate(STATE.semester.endDate)}`;
      document.getElementById('sbFill').style.width = `${pct}%`;
      document.getElementById('sbPct').textContent = `${pct}%`;
    }
  }
  const labelEl = document.getElementById('semesterLabel');
  if (labelEl && STATE.semester.name) labelEl.textContent = STATE.semester.name;
}

function openSemesterSettings() {
  openModal('⚙️ Semester Settings', `
    <div class="form-group">
      <label class="form-label">Semester Name</label>
      <input class="form-input" id="f_semName" placeholder="e.g. Semester 1 2025-26" value="${escHtml(STATE.semester.name||'')}"/>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Start Date</label>
        <input class="form-input" type="date" id="f_semStart" value="${STATE.semester.startDate||''}"/>
      </div>
      <div class="form-group">
        <label class="form-label">End Date</label>
        <input class="form-input" type="date" id="f_semEnd" value="${STATE.semester.endDate||''}"/>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveSemesterSettings()">Save</button>
    </div>
  `);
}
function saveSemesterSettings() {
  STATE.semester.name = document.getElementById('f_semName')?.value?.trim() || 'Semester';
  STATE.semester.startDate = document.getElementById('f_semStart')?.value || '';
  STATE.semester.endDate = document.getElementById('f_semEnd')?.value || '';
  save(); closeModal(); updateSemesterUI();
  showToast('Semester settings saved!', 'success');
}

// ==================== NAVIGATION ====================
function navigate(view, e) {
  if (e) e.preventDefault();
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const target = document.getElementById(`view-${view}`);
  const navItem = document.querySelector(`.nav-item[data-view="${view}"]`);
  if (target) target.classList.add('active');
  if (navItem) navItem.classList.add('active');
  STATE.currentView = view;
  const labels = {
    dashboard:'🏠 Dashboard', assignments:'📝 Assignments', exams:'📋 Exams',
    courses:'📚 Courses', planner:'🗓️ Weekly Planner', habits:'🎯 Habit Tracker',
    workout:'💪 Workout', budget:'💰 Budget Tracker', notes:'🗒️ Notes',
    completed:'✅ Completed',
  };
  document.getElementById('topbarBreadcrumb').textContent = labels[view] || view;

  // Auto-close sidebar on mobile
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar')?.classList.remove('mobile-open');
    document.getElementById('sidebarOverlay')?.classList.remove('show');
  }

  renderView(view);
}

function renderView(view) {
  switch(view) {
    case 'dashboard': renderDashboard(); break;
    case 'assignments': renderAssignments(); break;
    case 'exams': renderExams(); break;
    case 'courses': renderCourses(); break;
    case 'planner': renderPlanner(); renderTodos(); break;
    case 'habits': renderHabits(); break;
    case 'workout': renderWorkout(); break;
    case 'budget': renderBudget(); break;
    case 'notes': renderNotes(); break;
    case 'completed': renderCompleted(); break;
  }
}

// ==================== DASHBOARD ====================
function renderDashboard() {
  const td = today();
  const pending = STATE.assignments.filter(a => a.status !== 'done').length;
  const totalTodos = (STATE.todos || []).length;
  const doneTodos = (STATE.todos || []).filter(t => t.done).length;
  const todoPct = totalTodos ? Math.round((doneTodos / totalTodos) * 100) : 0;
  const upcomingExams = STATE.exams.filter(e => daysUntil(e.date) >= 0).length;
  document.getElementById('stat-pending').textContent = pending;
  document.getElementById('stat-exams').textContent = upcomingExams;
  document.getElementById('stat-done').textContent = `${todoPct}%`;
  const habitsDone = STATE.habits.filter(h => STATE.habitLogs[`${h.id}_${td}`]).length;
  const habitPct = STATE.habits.length ? Math.round(habitsDone / STATE.habits.length * 100) : 0;
  document.getElementById('stat-habits').textContent = `${habitPct}%`;

  // Next Exam Logic — show the absolute closest upcoming exam regardless of type
  const futureExams = STATE.exams.filter(e => daysUntil(e.date) >= 0).sort((a,b) => new Date(a.date) - new Date(b.date));
  const nextExamBanner = document.getElementById('nextExamBanner');
  if (futureExams.length > 0) {
    const nextExam = futureExams[0];
    const typeLabel = nextExam.type === 'external' ? '🔴 External' : nextExam.type === 'practical' ? '🧪 Practical' : '🟠 Internal';
    document.getElementById('nextExamName').textContent = `${nextExam.name || 'Exam'}`;
    document.getElementById('nextExamType').textContent = typeLabel;
    document.getElementById('nextExamDays').textContent = daysUntil(nextExam.date);
    const gradients = {
      external: 'linear-gradient(135deg, var(--danger) 0%, #ff4d4d 100%)',
      internal: 'linear-gradient(135deg, var(--warning) 0%, #ffb74d 100%)',
      practical: 'linear-gradient(135deg, var(--accent) 0%, #64b5f6 100%)'
    };
    nextExamBanner.style.background = gradients[nextExam.type] || gradients.internal;
    nextExamBanner.style.display = 'flex';
  } else {
    nextExamBanner.style.display = 'none';
  }

  const pb = document.getElementById('badge-assignments');
  pb.textContent = pending > 0 ? pending : ''; pb.style.display = pending > 0 ? 'block' : 'none';
  const eb = document.getElementById('badge-exams');
  eb.textContent = upcomingExams > 0 ? upcomingExams : ''; eb.style.display = upcomingExams > 0 ? 'block' : 'none';

  // Daily Quote
  const quotes = [
    "“The secret of getting ahead is getting started.” – Mark Twain",
    "“It always seems impossible until it's done.” – Nelson Mandela",
    "“Don't watch the clock; do what it does. Keep going.” – Sam Levenson",
    "“The future depends on what you do today.” – Mahatma Gandhi",
    "“Believe you can and you're halfway there.” – Theodore Roosevelt",
    "“Success is the sum of small efforts, repeated day-in and day-out.” – Robert Collier",
    "“You don't have to be great to start, but you have to start to be great.” – Zig Ziglar",
    "“The expert in anything was once a beginner.” – Helen Hayes",
    "“Focus on being productive instead of busy.” – Tim Ferriss",
    "“Push yourself, because no one else is going to do it for you.”"
  ];
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
  const weekOfYear = Math.floor(dayOfYear / 7);
  const weeklyQuote = quotes[weekOfYear % quotes.length];
  const qEl = document.getElementById('dailyQuote');
  if (qEl) qEl.textContent = weeklyQuote;

  updateSemesterUI();

  // Deadlines
  const dlList = document.getElementById('deadlineList');
  const upcoming = STATE.assignments.filter(a => a.status !== 'done' && a.dueDate).sort((a,b) => a.dueDate.localeCompare(b.dueDate)).slice(0,5);
  dlList.innerHTML = upcoming.length === 0
    ? `<div class="empty-state"><span>📭</span><p>No upcoming deadlines.</p></div>`
    : upcoming.map(a => {
        const days = daysUntil(a.dueDate);
        const color = getCourseColor(a.course);
        const daysLabel = days === null ? '' : days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`;
        const cls = days !== null && days <= 2 ? 'overdue' : '';
        return `<div class="deadline-item"><div class="deadline-dot" style="background:${color}"></div><div class="dl-info"><div class="dl-title">${escHtml(a.title)}</div><div class="dl-course">${escHtml(a.course||'No course')}</div></div><div class="dl-date ${cls}">${daysLabel}</div></div>`;
      }).join('');

  // Exam countdown
  const ecList = document.getElementById('examCountdownList');
  const upExams = STATE.exams.filter(e => daysUntil(e.date) >= 0).sort((a,b) => a.date.localeCompare(b.date)).slice(0,4);
  ecList.innerHTML = upExams.length === 0
    ? `<div class="empty-state"><span>📭</span><p>No exams scheduled.</p></div>`
    : upExams.map(e => {
        const days = daysUntil(e.date);
        return `<div class="exam-item"><div class="exam-info"><div class="exam-name">${escHtml(e.name)}</div><div class="exam-course">${escHtml(e.course||'')}</div></div><div class="exam-countdown ${days<=3?'soon':''}">${days===0?'Today!':days+'d'}</div></div>`;
      }).join('');

  // Today's To-Dos (only show incomplete ones)
  const tl = document.getElementById('dashboardTodoList');
  if (tl) {
    const pendingTodos = (STATE.todos || []).filter(t => !t.done);
    if (pendingTodos.length === 0) {
      tl.innerHTML = `<div class="empty-state"><span>✅</span><p>All to-dos completed!</p></div>`;
    } else {
      tl.innerHTML = pendingTodos.map(t => `
        <div class="exercise-row" style="margin-bottom:8px;">
          <div class="ex-name">${escHtml(t.text)}</div>
          <div style="flex-grow:1;"></div>
          <div class="exercise-done-check" onclick="toggleTodo('${t.id}')"></div>
        </div>
      `).join('');
    }
  }

  // Workout today
  const dws = document.getElementById('dashWorkoutSummary');
  const gymToday = STATE.workout.gymLogs.filter(g => g.date === td);
  const badToday = STATE.workout.badmintonLogs.filter(b => b.date === td);
  if (gymToday.length === 0 && badToday.length === 0) {
    dws.innerHTML = `<div class="empty-state"><span>🏋️</span><p>No workout logged today.</p></div>`;
  } else {
    const items = [];
    gymToday.forEach(g => items.push(`<div class="deadline-item"><div class="deadline-dot" style="background:#4a90e2"></div><div class="dl-info"><div class="dl-title">🏋️ Gym Session</div><div class="dl-course">${g.exercises?.length||0} exercises</div></div><div class="dl-date">${g.duration||'?'} min</div></div>`));
    badToday.forEach(b => items.push(`<div class="deadline-item"><div class="deadline-dot" style="background:#4caf7d"></div><div class="dl-info"><div class="dl-title">🏸 Badminton</div><div class="dl-course">${b.partner?`vs ${escHtml(b.partner)}`:''}</div></div><div class="dl-date">${b.duration||'?'} min</div></div>`));
    dws.innerHTML = items.join('');
  }

  // Habits mini
  const hm = document.getElementById('habitMiniGrid');
  hm.innerHTML = STATE.habits.length === 0
    ? `<div class="empty-state"><span>🌱</span><p>No habits added yet.</p></div>`
    : STATE.habits.map(h => {
        const checked = !!STATE.habitLogs[`${h.id}_${td}`];
        return `<div class="habit-mini-item"><span style="font-size:18px">${h.emoji||'✅'}</span><span class="habit-mini-name">${escHtml(h.name)}</span><div class="habit-mini-check ${checked?'checked':''}" onclick="toggleHabitLog('${h.id}','${td}')">${checked?'✓':''}</div></div>`;
      }).join('');

  // Quick note
  document.getElementById('quickNote').value = localStorage.getItem('quickNote') || '';
}

function toggleHabitLog(hid, date) {
  const key = `${hid}_${date}`;
  STATE.habitLogs[key] = !STATE.habitLogs[key];
  save();
  if (STATE.currentView === 'dashboard') renderDashboard();
  if (STATE.currentView === 'habits') renderHabits();
}

// ==================== ASSIGNMENTS ====================
let assignmentFilter = 'all', assignmentCourseFilter = '';

function renderAssignments() {
  const sel = document.getElementById('filterCourse');
  const prev = sel.value;
  sel.innerHTML = '<option value="">All Courses</option>' + STATE.courses.map(c => `<option value="${escHtml(c.name)}">${escHtml(c.name)}</option>`).join('');
  sel.value = prev;
  let rows = STATE.assignments;
  if (assignmentFilter !== 'all') rows = rows.filter(a => a.status === assignmentFilter);
  if (assignmentCourseFilter) rows = rows.filter(a => a.course === assignmentCourseFilter);
  rows = rows.sort((a,b) => (!a.dueDate?1:!b.dueDate?-1:a.dueDate.localeCompare(b.dueDate)));
  const tbody = document.getElementById('assignmentTbody');
  if (!rows.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="6"><div class="empty-state"><span>📭</span><p>No assignments found.</p></div></td></tr>`; return; }
  tbody.innerHTML = rows.map(a => {
    const days = daysUntil(a.dueDate);
    const dueTxt = a.dueDate ? formatDate(a.dueDate) : '—';
    const extra = days !== null ? (days < 0 ? `<span class="overdue">(${Math.abs(days)}d ago)</span>` : days === 0 ? '<span style="color:var(--orange)">(today)</span>' : '') : '';
    const sc = {'not-started':'tag-not-started','in-progress':'tag-in-progress','done':'tag-done'}[a.status]||'tag-not-started';
    const pc = {'high':'tag-high','medium':'tag-medium','low':'tag-low'}[a.priority]||'tag-low';
    const color = getCourseColor(a.course);
    return `<tr><td><span style="display:flex;align-items:center;gap:8px"><span class="color-dot" style="background:${color}"></span>${escHtml(a.title)}</span></td><td>${escHtml(a.course||'—')}</td><td>${dueTxt} ${extra}</td><td><span class="tag ${pc}">${capitalize(a.priority||'low')}</span></td><td><select class="filter-select" style="padding:2px 6px;font-size:11px;" onchange="changeAssignmentStatus('${a.id}',this.value)"><option value="not-started" ${a.status==='not-started'?'selected':''}>Not Started</option><option value="in-progress" ${a.status==='in-progress'?'selected':''}>In Progress</option><option value="done" ${a.status==='done'?'selected':''}>Done</option></select></td><td><div class="table-actions"><button class="icon-btn" onclick="editAssignment('${a.id}')">✏️</button><button class="icon-btn del" onclick="deleteAssignment('${a.id}')">🗑️</button></div></td></tr>`;
  }).join('');
}

function changeAssignmentStatus(id, status) {
  const a = STATE.assignments.find(x => x.id === id);
  if (a) {
    if (status === 'done') {
      // Remove completed assignment from active list, archive it
      if (!STATE.completedAssignments) STATE.completedAssignments = [];
      a.status = 'done';
      a.completedAt = new Date().toISOString();
      STATE.completedAssignments.push(a);
      STATE.assignments = STATE.assignments.filter(x => x.id !== id);
      save(); renderDashboard(); renderAssignments();
      showToast('Assignment completed & archived! 🎉', 'success');
    } else {
      a.status = status; save(); renderDashboard(); renderAssignments(); showToast('Status updated','success');
    }
  }
}
function deleteAssignment(id) {
  STATE.assignments = STATE.assignments.filter(a => a.id !== id);
  save(); renderDashboard(); renderAssignments(); showToast('Deleted','info');
}
function editAssignment(id) {
  const a = STATE.assignments.find(x => x.id === id);
  openModal('Edit Assignment', buildAssignmentForm(a), () => saveAssignment(id));
}
function buildAssignmentForm(a = {}) {
  const co = STATE.courses.map(c => `<option value="${escHtml(c.name)}" ${a.course===c.name?'selected':''}>${escHtml(c.name)}</option>`).join('');
  return `<div class="form-group"><label class="form-label">Title *</label><input class="form-input" id="f_title" value="${escHtml(a.title||'')}" placeholder="Assignment title"/></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Course</label><select class="form-select" id="f_course"><option value="">No course</option>${co}</select></div>
      <div class="form-group"><label class="form-label">Due Date</label><input class="form-input" type="date" id="f_due" value="${a.dueDate||''}"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Priority</label><select class="form-select" id="f_priority"><option value="low" ${a.priority==='low'?'selected':''}>Low</option><option value="medium" ${a.priority==='medium'?'selected':''}>Medium</option><option value="high" ${a.priority==='high'?'selected':''}>High</option></select></div>
      <div class="form-group"><label class="form-label">Status</label><select class="form-select" id="f_status"><option value="not-started" ${a.status==='not-started'?'selected':''}>Not Started</option><option value="in-progress" ${a.status==='in-progress'?'selected':''}>In Progress</option><option value="done" ${a.status==='done'?'selected':''}>Done</option></select></div>
    </div>
    <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" id="f_notes">${escHtml(a.notes||'')}</textarea></div>
    <div class="form-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveAssignment('${a.id||''}')">Save</button></div>`;
}
function saveAssignment(id = '') {
  const title = document.getElementById('f_title')?.value?.trim();
  if (!title) { showToast('Title required','error'); return; }
  const data = { id: id||genId(), title, course: document.getElementById('f_course')?.value||'', dueDate: document.getElementById('f_due')?.value||'', priority: document.getElementById('f_priority')?.value||'low', status: document.getElementById('f_status')?.value||'not-started', notes: document.getElementById('f_notes')?.value||'' };
  if (data.status === 'done') {
    // Archive completed assignment
    if (!STATE.completedAssignments) STATE.completedAssignments = [];
    data.completedAt = new Date().toISOString();
    STATE.completedAssignments.push(data);
    if (id) STATE.assignments = STATE.assignments.filter(a => a.id !== id);
    save(); closeModal(); renderDashboard(); renderAssignments();
    showToast('Assignment completed & archived! 🎉', 'success');
  } else {
    if (id) { const idx = STATE.assignments.findIndex(a => a.id===id); if (idx>=0) STATE.assignments[idx]=data; } else STATE.assignments.push(data);
    save(); closeModal(); renderDashboard(); renderAssignments(); showToast(id?'Updated!':'Added!','success');
  }
}

// ==================== EXAMS ====================
let examFilter = 'all';
function renderExams() {
  const externalGrid = document.getElementById('externalExamsGrid');
  const internalGrid = document.getElementById('internalExamsGrid');
  const practicalGrid = document.getElementById('practicalExamsGrid');
  
  let exams = STATE.exams;
  if (examFilter==='upcoming') exams=exams.filter(e=>daysUntil(e.date)>=0);
  if (examFilter==='passed') exams=exams.filter(e=>daysUntil(e.date)<0);
  exams=exams.sort((a,b)=>a.date.localeCompare(b.date));
  
  const externals = exams.filter(e => e.type === 'external');
  const practicals = exams.filter(e => e.type === 'practical');
  const internals = exams.filter(e => e.type !== 'external' && e.type !== 'practical'); // Default to internal if unset
  
  const renderList = (list, grid, emptyMsg) => {
    if (!grid) return;
    if (!list.length) { grid.innerHTML=`<div class="empty-state full-empty"><span>📭</span><p>${emptyMsg}</p></div>`; return; }
    grid.innerHTML=list.map(e=>{
      const days=daysUntil(e.date);
      const cc=days!=null?(days<=1?'urgent':days<=5?'soon':''):'';
      const cl=days===null?'':days<0?'Passed':days===0?'Today!':String(days);
      const sl=days>0?'days to go':'';
      const completeBtn = days !== null && days <= 0 ? `<button class="btn btn-sm btn-success" onclick="openExamCompletionPopup('${e.id}')">✅ Complete</button>` : '';
      return `<div class="exam-card"><div class="exam-card-header"><div><div class="exam-card-name">${escHtml(e.name)}</div><div class="exam-card-course">${escHtml(e.course||'—')}</div></div></div><div><div class="exam-card-countdown ${cc}">${cl}</div><div class="exam-card-countdown-label">${sl}</div><div class="exam-card-date">📅 ${formatDate(e.date)}${e.time?` at ${e.time}`:''}</div>${e.location?`<div class="exam-card-date">📍 ${escHtml(e.location)}</div>`:''}</div><div class="exam-card-actions">${completeBtn}<button class="btn btn-sm btn-outline" onclick="editExam('${e.id}')">✏️ Edit</button><button class="btn btn-sm btn-danger" onclick="deleteExam('${e.id}')">🗑️ Delete</button></div></div>`;
    }).join('');
  };
  
  renderList(externals, externalGrid, 'No external exams.');
  renderList(internals, internalGrid, 'No internal exams.');
  renderList(practicals, practicalGrid, 'No practical exams.');
}
function deleteExam(id) { STATE.exams=STATE.exams.filter(e=>e.id!==id); save(); renderDashboard(); renderExams(); showToast('Deleted','info'); }
function editExam(id) { const e=STATE.exams.find(x=>x.id===id); openModal('Edit Exam',buildExamForm(e),()=>saveExam(id)); }

// Exam Completion Popup — notes about how the exam went + improvement areas
function openExamCompletionPopup(id) {
  const exam = STATE.exams.find(e => e.id === id);
  if (!exam) return;
  const typeEmoji = exam.type === 'external' ? '🔴' : exam.type === 'practical' ? '🧪' : '🟠';
  openModal('✅ Exam Completed!', `
    <div style="text-align:center; margin-bottom:20px;">
      <div style="font-size:48px; margin-bottom:8px;">🎉</div>
      <div style="font-size:18px; font-weight:600; color:var(--text-primary);">${escHtml(exam.name)}</div>
      <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">${typeEmoji} ${capitalize(exam.type||'internal')} • ${escHtml(exam.course||'No course')} • ${formatDate(exam.date)}</div>
    </div>
    <div class="form-group">
      <label class="form-label">📝 How was the exam? (Overall experience)</label>
      <textarea class="form-textarea" id="f_examReview" rows="3" placeholder="How did the exam go? What topics were covered? How well did you perform?"></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">🎯 What should you improve for future exams?</label>
      <textarea class="form-textarea" id="f_examImprovement" rows="3" placeholder="Areas to improve, topics to revise more, time management tips, etc."></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">⭐ Self Rating</label>
      <div class="exam-rating-bar" id="examRatingBar">
        <button type="button" class="rating-star" onclick="setExamRating(1)">⭐</button>
        <button type="button" class="rating-star" onclick="setExamRating(2)">⭐</button>
        <button type="button" class="rating-star" onclick="setExamRating(3)">⭐</button>
        <button type="button" class="rating-star" onclick="setExamRating(4)">⭐</button>
        <button type="button" class="rating-star" onclick="setExamRating(5)">⭐</button>
      </div>
      <input type="hidden" id="f_examRating" value="0" />
    </div>
    <div class="form-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="completeExam('${exam.id}')">Save & Complete</button>
    </div>
  `);
}

window._examRating = 0;
function setExamRating(rating) {
  window._examRating = rating;
  document.getElementById('f_examRating').value = rating;
  const stars = document.querySelectorAll('#examRatingBar .rating-star');
  stars.forEach((s, i) => {
    s.style.opacity = i < rating ? '1' : '0.3';
    s.style.transform = i < rating ? 'scale(1.2)' : 'scale(1)';
  });
}

function completeExam(id) {
  const exam = STATE.exams.find(e => e.id === id);
  if (!exam) return;
  const review = document.getElementById('f_examReview')?.value?.trim() || '';
  const improvement = document.getElementById('f_examImprovement')?.value?.trim() || '';
  const rating = window._examRating || 0;

  // Archive the exam with feedback
  if (!STATE.completedExams) STATE.completedExams = [];
  STATE.completedExams.push({
    ...exam,
    completedAt: new Date().toISOString(),
    review,
    improvement,
    rating
  });

  // Remove from active exams
  STATE.exams = STATE.exams.filter(e => e.id !== id);
  window._examRating = 0;
  save(); closeModal(); renderDashboard(); renderExams();
  showToast(`${exam.name} completed & archived! 🎉`, 'success');
}

function buildExamForm(e={}) {
  const co=STATE.courses.map(c=>`<option value="${escHtml(c.name)}" ${e.course===c.name?'selected':''}>${escHtml(c.name)}</option>`).join('');
  return `<div class="form-row"><div class="form-group"><label class="form-label">Exam Name *</label><input class="form-input" id="f_name" value="${escHtml(e.name||'')}"/></div>
    <div class="form-group"><label class="form-label">Exam Type</label><select class="form-select" id="f_type"><option value="internal" ${e.type==='internal'?'selected':''}>Internal (Mid Priority)</option><option value="external" ${e.type==='external'?'selected':''}>External (High Priority)</option><option value="practical" ${e.type==='practical'?'selected':''}>Practical (Skill/Lab)</option></select></div></div>
    <div class="form-row"><div class="form-group"><label class="form-label">Course</label><select class="form-select" id="f_course"><option value="">No course</option>${co}</select></div><div class="form-group"><label class="form-label">Date *</label><input class="form-input" type="date" id="f_date" value="${e.date||''}"/></div></div>
    <div class="form-row"><div class="form-group"><label class="form-label">Time</label><input class="form-input" type="time" id="f_time" value="${e.time||''}"/></div><div class="form-group"><label class="form-label">Location</label><input class="form-input" id="f_location" value="${escHtml(e.location||'')}"/></div></div>
    <div class="form-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveExam('${e.id||''}')">Save</button></div>`;
}
function saveExam(id='') {
  const name=document.getElementById('f_name')?.value?.trim(), date=document.getElementById('f_date')?.value;
  if (!name||!date) { showToast('Name & Date required','error'); return; }
  const data={id:id||genId(),name,type:document.getElementById('f_type')?.value||'internal',course:document.getElementById('f_course')?.value||'',date,time:document.getElementById('f_time')?.value||'',location:document.getElementById('f_location')?.value||''};
  if (id) { const idx=STATE.exams.findIndex(e=>e.id===id); if(idx>=0) STATE.exams[idx]=data; } else STATE.exams.push(data);
  save(); closeModal(); renderDashboard(); renderExams(); showToast(id?'Updated!':'Added!','success');
}

// ==================== COURSES ====================
function renderCourses() {
  const grid=document.getElementById('coursesGrid');
  if (!STATE.courses.length) { grid.innerHTML=`<div class="empty-state full-empty"><span>📭</span><p>No courses added yet.</p></div>`; return; }
  grid.innerHTML=STATE.courses.map(c=>{
    const ta=STATE.assignments.filter(a=>a.course===c.name).length;
    const da=STATE.assignments.filter(a=>a.course===c.name&&a.status==='done').length;
    return `<div class="course-card" style="border-top:3px solid ${c.color}">
      <div class="course-code">${escHtml(c.code||'')}</div>
      <div class="course-name">${escHtml(c.name)}</div>
      <div class="course-prof">${escHtml(c.prof||'')}</div>
      ${c.attachment ? `<div style="margin-top:8px;"><a href="${escHtml(c.attachment)}" target="_blank" style="font-size:12px; color:var(--accent);">🔗 View Material</a></div>` : ''}
      <div class="course-card-stats"><div class="course-stat"><div class="course-stat-val" style="color:${c.color}">${ta}</div><div class="course-stat-label">Tasks</div></div><div class="course-stat"><div class="course-stat-val" style="color:var(--green)">${da}</div><div class="course-stat-label">Done</div></div>${c.grade?`<div class="course-stat"><div class="course-stat-val">${escHtml(c.grade)}</div><div class="course-stat-label">Grade</div></div>`:''}</div><div class="course-card-actions"><button class="btn btn-sm btn-outline" onclick="editCourse('${c.id}')">✏️ Edit</button><button class="btn btn-sm btn-danger" onclick="deleteCourse('${c.id}')">🗑️ Delete</button></div></div>`;
  }).join('');
}
function deleteCourse(id) { STATE.courses=STATE.courses.filter(c=>c.id!==id); save(); renderCourses(); showToast('Deleted','info'); }
function editCourse(id) { const c=STATE.courses.find(x=>x.id===id); openModal('Edit Course', buildCourseForm(c)); }
function buildCourseForm(c={}) {
  const attHtml = c.attachment ? `<div style="margin-top:8px;"><a href="${escHtml(c.attachment)}" target="_blank" style="font-size:12px; color:var(--accent);">🔗 View current attachment</a></div>` : '';
  return `
    <div class="form-group"><label class="form-label">Course Code</label><input type="text" id="f_courseCode" class="form-input" value="${escHtml(c.code||'')}" placeholder="e.g. CS101"/></div>
    <div class="form-group"><label class="form-label">Course Name</label><input type="text" id="f_courseName" class="form-input" value="${escHtml(c.name||'')}" placeholder="e.g. Intro to Computer Science"/></div>
    <div class="form-group"><label class="form-label">Professor/Instructor</label><input type="text" id="f_courseProf" class="form-input" value="${escHtml(c.prof||'')}" placeholder="e.g. Dr. Smith"/></div>
    <div class="form-group"><label class="form-label">Color</label><input type="color" id="f_courseColor" class="form-input" value="${c.color||'#3b82f6'}" style="height:40px;padding:2px;"/></div>
    <div class="form-group">
      <label class="form-label">Course Syllabus / Material (PDF)</label>
      <input type="file" id="f_courseFile" accept=".pdf,.ppt,.pptx" class="form-input" style="padding: 6px;" />
      ${attHtml}
    </div>
    <div class="form-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="saveCourseBtn" onclick="handleSaveCourse('${c.id||''}')">Save Course</button></div>`;
}
async function handleSaveCourse(id) {
  const btn = document.getElementById('saveCourseBtn');
  btn.disabled = true; btn.textContent = "Saving...";
  try {
    const fileInput = document.getElementById('f_courseFile');
    let attachment = null;
    if (fileInput && fileInput.files.length > 0) attachment = await uploadFile(fileInput.files[0]);
    
    const code=document.getElementById('f_courseCode')?.value||'';
    const name=document.getElementById('f_courseName')?.value||'';
    const prof=document.getElementById('f_courseProf')?.value||'';
    const color=document.getElementById('f_courseColor')?.value||'#3b82f6';
    if (!id) STATE.courses.push({ id: genId(), code, name, prof, color, attachment });
    else { const c=STATE.courses.find(x=>x.id===id); if(c) { c.code=code; c.name=name; c.prof=prof; c.color=color; if(attachment) c.attachment=attachment; } }
    save(); renderCourses(); closeModal(); showToast('Course saved','success');
  } catch(e) {
    showToast('Failed: ' + e.message, 'error');
    btn.disabled = false; btn.textContent = "Save Course";
  }
}
// ==================== TO-DO LIST ====================
function renderTodos() {
  const list = document.getElementById('todoList');
  if (!list) return;
  if (!STATE.todos) STATE.todos = [];
  const pendingTodos = STATE.todos.filter(t => !t.done);
  if (pendingTodos.length === 0) {
    list.innerHTML = STATE.todos.length > 0 
      ? '<div class="empty-state"><span>✅</span><p>All to-dos completed! Great job!</p></div>'
      : '<div class="empty-state"><span>📝</span><p>No to-dos yet. Add one above!</p></div>';
    return;
  }
  list.innerHTML = pendingTodos.map(t => `
    <div class="exercise-row todo-item" id="todo-${t.id}">
      <div class="ex-name">${escHtml(t.text)}</div>
      <div style="flex-grow:1;"></div>
      <div class="exercise-done-check" onclick="toggleTodo('${t.id}')"></div>
      <button class="btn btn-sm btn-danger" style="margin-left:12px; padding:4px 8px; font-size:14px;" onclick="deleteTodo('${t.id}')">🗑️</button>
    </div>
  `).join('');
}

function addTodo(text) {
  text = text.trim();
  if (!text) return;
  if (!STATE.todos) STATE.todos = [];
  STATE.todos.push({ id: genId(), text, done: false, dateCreated: new Date().toISOString() });
  save();
  renderTodos();
  renderDashboard();
}

function toggleTodo(id) {
  const todo = STATE.todos.find(t => t.id === id);
  if (todo) {
    // Animate removal then delete
    const el = document.getElementById(`todo-${id}`);
    if (el) {
      el.classList.add('todo-completing');
      setTimeout(() => {
        STATE.todos = STATE.todos.filter(t => t.id !== id);
        save();
        renderTodos();
        renderDashboard();
        showToast('To-do completed! ✅', 'success');
      }, 400);
    } else {
      STATE.todos = STATE.todos.filter(t => t.id !== id);
      save();
      renderTodos();
      renderDashboard();
    }
  }
}

function deleteTodo(id) {
  STATE.todos = STATE.todos.filter(t => t.id !== id);
  save();
  renderTodos();
  renderDashboard();
}

function checkTodoNotifications() {
  if (!STATE.todos) return;
  const pendingTodos = STATE.todos.filter(t => !t.done).length;
  if (pendingTodos === 0) return;

  const intervalMins = STATE.todoNotificationInterval || 360;
  const intervalMs = intervalMins * 60 * 1000;
  
  const lastNotification = localStorage.getItem('lastTodoNotification');
  const now = Date.now();
  
  if (!lastNotification || (now - parseInt(lastNotification) >= intervalMs)) {
    const text = `You have ${pendingTodos} pending To-Do items left to complete!`;
    document.getElementById('reminderModalText').textContent = text;
    // Set timestamp
    const tsEl = document.getElementById('reminderTimestamp');
    if (tsEl) {
      tsEl.textContent = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) + ' IST';
    }
    document.getElementById('reminderOverlay').classList.add('open');
    const audio = document.getElementById('notificationSound');
    if (audio) {
      audio.volume = STATE.notificationVolume !== undefined ? STATE.notificationVolume : 1.0;
      audio.currentTime = 0;
      audio.play().catch(e => console.log('Audio play prevented', e));
    }
    
    // Fallback to browser notification if tab is in background (optional, but requested windowed popup so we skip browser notifications for now to avoid double notifications if they don't work well anyway)
    
    localStorage.setItem('lastTodoNotification', now.toString());
  }
}

function checkTodoReset() {
  const td = today();
  if (STATE.lastTodoResetDate && STATE.lastTodoResetDate !== td) {
    STATE.todos = STATE.todos.filter(t => !t.done);
    STATE.lastTodoResetDate = td;
    save();
    return true;
  } else if (!STATE.lastTodoResetDate) {
    STATE.lastTodoResetDate = td;
    save();
  }
  return false;
}

// ==================== WEEKLY PLANNER ====================
function renderPlanner() {
  const dates=getWeekDates(STATE.weekOffset);
  document.getElementById('weekLabel').textContent=`${formatDate(dates[0])} – ${formatDate(dates[6])}`;
  const td=today();
  const dayNames=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  document.getElementById('weeklyGrid').innerHTML=dates.map((date,i)=>{
    const isToday=date===td;
    const dayNum=new Date(date+'T00:00:00').getDate();
    const sessions=STATE.sessions.filter(s=>s.date===date);
    return `<div class="day-col ${isToday?'today':''}"><div class="day-header"><div class="day-name">${dayNames[i]}</div><div class="day-date">${dayNum}</div></div><div class="day-sessions">${sessions.map(s=>`<div class="session-block" style="background:${s.color||'#7c5cbf'}22;color:${s.color||'#7c5cbf'};border:1px solid ${s.color||'#7c5cbf'}44;">${escHtml(s.title)}<div class="session-time">${escHtml(s.time||'')}</div><button class="session-del" onclick="deleteSession('${s.id}')">✕</button></div>`).join('')}<button class="nav-item-btn" style="font-size:11px;color:var(--text-muted);padding:4px 6px;" onclick="addSessionForDate('${date}')">+ Add</button></div></div>`;
  }).join('');
}
function deleteSession(id) { STATE.sessions=STATE.sessions.filter(s=>s.id!==id); save(); renderPlanner(); renderDashboard(); showToast('Removed','info'); }
function addSessionForDate(date) { openModal('Add Study Session',buildSessionForm({date}),()=>saveSession('')); }
function buildSessionForm(s={}) {
  const co=STATE.courses.map(c=>`<option value="${escHtml(c.name)}" ${s.subject===c.name?'selected':''}>${escHtml(c.name)}</option>`).join('');
  return `<div class="form-group"><label class="form-label">Title *</label><input class="form-input" id="f_title" value="${escHtml(s.title||'')}" placeholder="e.g. Study Calculus"/></div>
    <div class="form-row"><div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" id="f_date" value="${s.date||today()}"/></div><div class="form-group"><label class="form-label">Time</label><input class="form-input" type="time" id="f_time" value="${s.time||''}"/></div></div>
    <div class="form-row"><div class="form-group"><label class="form-label">Subject</label><select class="form-select" id="f_subject"><option value="">No subject</option>${co}</select></div><div class="form-group"><label class="form-label">Color</label><input class="form-input" type="color" id="f_color" value="${s.color||'#7c5cbf'}"/></div></div>
    <div class="form-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveSession('${s.id||''}')">Save</button></div>`;
}
function saveSession(id='') {
  const title=document.getElementById('f_title')?.value?.trim(), date=document.getElementById('f_date')?.value;
  if (!title||!date) { showToast('Title & date required','error'); return; }
  const data={id:id||genId(),title,date,time:document.getElementById('f_time')?.value||'',subject:document.getElementById('f_subject')?.value||'',color:document.getElementById('f_color')?.value||'#7c5cbf'};
  if (id) { const idx=STATE.sessions.findIndex(s=>s.id===id); if(idx>=0) STATE.sessions[idx]=data; } else STATE.sessions.push(data);
  save(); closeModal(); renderPlanner(); renderDashboard(); showToast('Saved!','success');
}

// ==================== HABITS ====================
function calculateHabitStreak(habitId) {
  let streak = 0;
  let d = new Date();
  const td = d.toISOString().split('T')[0];
  
  if (STATE.habitLogs[`${habitId}_${td}`]) {
    streak++;
  }
  
  d.setDate(d.getDate() - 1);
  let yd = d.toISOString().split('T')[0];
  
  if (!STATE.habitLogs[`${habitId}_${td}`] && !STATE.habitLogs[`${habitId}_${yd}`]) {
    return 0;
  }
  
  while (true) {
    let currStr = d.toISOString().split('T')[0];
    if (STATE.habitLogs[`${habitId}_${currStr}`]) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  
  return streak;
}

function renderHabits() {
  const days=getMonthDays(STATE.habitMonthOffset);
  document.getElementById('habitMonthLabel').textContent=monthLabel(STATE.habitMonthOffset);
  const td=today();
  const container=document.getElementById('habitTrackerTable');
  if (!STATE.habits.length) { container.innerHTML=`<div class="empty-state"><span>🌱</span><p>No habits added yet.</p></div>`; return; }
  const dayHeaders=days.map(d=>{const dt=new Date(d+'T00:00:00');const n=dt.getDate();const isT=d===td;return `<th style="${isT?'color:var(--accent-light);':''}">${n}</th>`;}).join('');
  const rows=STATE.habits.map(h=>{
    const streak = calculateHabitStreak(h.id);
    const dayCells=days.map(d=>{
      const key=`${h.id}_${d}`;const checked=!!STATE.habitLogs[key];const future=d>td;
      return `<td><div class="habit-check ${checked?'checked':''} ${future?'future':''}" ${future?'':'onclick="toggleHabitLog(\''+h.id+'\',\''+d+'\')"'}>${checked?'✓':''}</div></td>`;
    }).join('');
    return `<tr><td class="habit-name-cell"><span style="font-size:16px;margin-right:6px">${h.emoji||'✅'}</span>${escHtml(h.name)}</td>${dayCells}<td class="habit-streak-cell">🔥 ${streak}</td><td><div class="habit-actions"><button class="icon-btn" onclick="editHabit('${h.id}')">✏️</button><button class="icon-btn" onclick="deleteHabit('${h.id}')">🗑️</button></div></td></tr>`;
  }).join('');
  container.innerHTML=`<table class="habit-table"><thead><tr><th style="text-align:left;padding-left:14px;">Habit</th>${dayHeaders}<th>Streak</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}
function deleteHabit(id) {
  STATE.habits=STATE.habits.filter(h=>h.id!==id);
  Object.keys(STATE.habitLogs).filter(k=>k.startsWith(id+'_')).forEach(k=>delete STATE.habitLogs[k]);
  save(); renderHabits(); renderDashboard(); showToast('Removed','info');
}
function editHabit(id) {
  const h = STATE.habits.find(x => x.id === id);
  if (h) openModal('Edit Habit', buildHabitForm(h));
}
function buildHabitForm(h={}) {
  if (!STATE.customEmojis) STATE.customEmojis = ['✅','📚','💪','🧘','💧','🏃','🥗','😴','✍️','🎯','🧠','🎵','🌿','☀️','🚴','🍔','🚌','🎮','📦','🏋️','❤️','🏸','✈️','👗','🛒','💊','🎉','💸'];
  
  const emojiHtml = STATE.customEmojis.map((e,i)=>`<button type="button" style="font-size:20px;padding:4px;border-radius:6px;border:2px solid ${h.emoji===e?'var(--accent)':'transparent'};background:var(--bg-tertiary);cursor:pointer;" onclick="selectEmoji(this,'${e}')" oncontextmenu="removeHabitEmoji(${i}, '${h.id||''}'); return false;" data-emoji="${e}" title="Right-click to remove">${e}</button>`).join('');

  return `<div class="form-group"><label class="form-label">Habit Name *</label><input class="form-input" id="f_name" value="${escHtml(h.name||'')}" placeholder="e.g. Read for 30 mins"/></div>
    <div class="form-group"><label class="form-label">Emoji</label>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;font-size:12px;color:var(--text-muted);">
        <span>Select an emoji (Right-click to remove):</span>
        <div style="display:flex;gap:4px;">
          <input type="text" id="f_newHabitEmoji" placeholder="😀" style="width:36px;padding:2px;font-size:14px;border:1px solid var(--border);border-radius:4px;background:var(--bg-primary);color:var(--text-primary);text-align:center;" />
          <button type="button" class="btn btn-sm btn-outline" style="padding:2px 8px;" onclick="addHabitEmoji('${h.id||''}')">+</button>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;" id="emojiPicker">${emojiHtml}</div>
      <input type="hidden" id="f_emoji" value="${h.emoji||'✅'}"/>
    </div>
    <div class="form-actions" style="justify-content: ${h.id ? 'space-between' : 'flex-end'}">
      ${h.id ? `<button type="button" class="btn btn-danger" onclick="deleteHabit('${h.id}'); closeModal();">🗑️ Delete</button>` : ''}
      <div style="display:flex;gap:8px;">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button type="button" class="btn btn-primary" onclick="saveHabit('${h.id||''}')">Save</button>
      </div>
    </div>`;
}

function addHabitEmoji(hid) {
  const input = document.getElementById('f_newHabitEmoji');
  if (!input) return;
  const val = input.value.trim();
  if (val) {
    if (!STATE.customEmojis) STATE.customEmojis = [];
    if (!STATE.customEmojis.includes(val)) {
      STATE.customEmojis.push(val);
      save();
    }
    const h = { id: hid, name: document.getElementById('f_name').value, emoji: document.getElementById('f_emoji').value };
    openModal(hid ? 'Edit Habit' : 'Add Habit', buildHabitForm(h));
  }
}

function removeHabitEmoji(index, hid) {
  if (STATE.customEmojis && STATE.customEmojis.length > index) {
    STATE.customEmojis.splice(index, 1);
    save();
    const h = { id: hid, name: document.getElementById('f_name').value, emoji: document.getElementById('f_emoji').value };
    openModal(hid ? 'Edit Habit' : 'Add Habit', buildHabitForm(h));
  }
}
function selectEmoji(btn,emoji) {
  document.querySelectorAll('#emojiPicker button').forEach(b=>b.style.borderColor='transparent');
  btn.style.borderColor='var(--accent)';
  document.getElementById('f_emoji').value=emoji;
}
function saveHabit(id='') {
  const name=document.getElementById('f_name')?.value?.trim();
  if (!name) { showToast('Name required','error'); return; }
  const data={id:id||genId(),name,emoji:document.getElementById('f_emoji')?.value||'✅'};
  if (id) { const idx=STATE.habits.findIndex(h=>h.id===id); if(idx>=0) STATE.habits[idx]=data; } else STATE.habits.push(data);
  save(); closeModal(); renderHabits(); renderDashboard(); showToast('Saved!','success');
}

// ==================== WORKOUT ====================
let workoutSubTab = 'today';

function renderWorkout() {
  renderWorkoutSubTab(STATE.workoutSubTab || 'today');
}

function setWorkoutSubTab(tab) {
  STATE.workoutSubTab = tab;
  document.querySelectorAll('.sub-tab').forEach(b => b.classList.toggle('active', b.dataset.subtab === tab));
  document.querySelectorAll('.subtab-panel').forEach(p => p.classList.toggle('active', p.id === `subtab-${tab}`));
  renderWorkoutSubTab(tab);
}

function renderWorkoutSubTab(tab) {
  switch(tab) {
    case 'today': renderWorkoutToday(); break;
    case 'plan': renderWorkoutPlan(); break;
    case 'machines': renderMachines(); break;
    case 'badminton': renderBadminton(); break;
    case 'history': renderWorkoutHistory(); break;
  }
}

// ---- TODAY ----
function renderWorkoutToday() {
  const td = today();
  const dow = dayOfWeek(td);

  // Gym log today
  const gymEl = document.getElementById('todayGymLog');
  const gymLog = STATE.workout.gymLogs.filter(g => g.date === td);
  if (gymLog.length === 0) {
    gymEl.innerHTML = `<div class="empty-state"><span>🏋️</span><p>No gym session logged today.</p></div>`;
  } else {
    gymEl.innerHTML = gymLog.map(g => `
      <div class="gym-log-entry">
        <div class="gym-log-header">
          <div class="gym-log-title">🏋️ Gym Session</div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm btn-outline" onclick="editGymLog('${g.id}')">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteGymLog('${g.id}')">🗑️</button>
          </div>
        </div>
        <div class="gym-log-meta">
          <span>⏱️ ${g.duration||'?'} min</span>
          ${g.notes ? `<span>📝 ${escHtml(g.notes)}</span>` : ''}
        </div>
        <div class="exercise-list">
          ${(g.exercises||[]).map((ex,idx) => `
            <div class="exercise-row ${ex.done?'done-row':''}">
              <div class="ex-name">${escHtml(ex.machineName||ex.name||'Exercise')}</div>
              <div>${ex.sets||'?'} sets</div>
              <div>${ex.reps||'?'} reps</div>
              <div>${ex.weight||'—'} kg</div>
              <div class="exercise-done-check ${ex.done?'done':''}" onclick="toggleExDone('${g.id}',${idx})">${ex.done?'✓':''}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  // Badminton log today
  const badEl = document.getElementById('todayBadmintonLog');
  const badLog = STATE.workout.badmintonLogs.filter(b => b.date === td);
  if (badLog.length === 0) {
    badEl.innerHTML = `<div class="empty-state"><span>🏸</span><p>No badminton session logged today.</p></div>`;
  } else {
    badEl.innerHTML = badLog.map(b => `
      <div class="gym-log-entry">
        <div class="gym-log-header">
          <div class="gym-log-title">🏸 Badminton</div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm btn-danger" onclick="deleteBadmintonLog('${b.id}')">🗑️</button>
          </div>
        </div>
        <div class="gym-log-meta">
          <span>⏱️ ${b.duration||'?'} min</span>
          ${b.partner ? `<span>👤 vs ${escHtml(b.partner)}</span>` : ''}
          ${(b.setsWon||b.setsLost) ? `<span>🏆 ${b.setsWon||0}–${b.setsLost||0}</span>` : ''}
        </div>
        ${b.notes ? `<div style="font-size:12px;color:var(--text-muted)">${escHtml(b.notes)}</div>` : ''}
      </div>
    `).join('');
  }

  // Today's planned exercises from active plan
  const planEl = document.getElementById('todayPlanExercises');
  const labelEl = document.getElementById('todayPlanDayLabel');
  labelEl.textContent = `Today is ${dow}`;

  const activePlan = STATE.workout.plans.find(p => p.id === STATE.workout.activePlanId);
  if (!activePlan) {
    planEl.innerHTML = `<div class="empty-state"><span>📋</span><p>No active workout plan. Go to "Workout Plan" tab to create one.</p></div>`;
    return;
  }

  const todayExercises = activePlan.days[dow] || [];
  if (todayExercises.length === 0) {
    planEl.innerHTML = `<div class="empty-state"><span>😴</span><p>Rest day! No exercises planned for ${dow}.</p></div>`;
    return;
  }

  // Check which exercises are done in today's gym log
  const todayGym = STATE.workout.gymLogs.find(g => g.date === td);
  planEl.innerHTML = todayExercises.map((ex, idx) => {
    const loggedEx = todayGym?.exercises?.find(e => e.machineName === ex.machineName || e.name === ex.name);
    const done = loggedEx?.done || false;
    return `<div class="plan-today-exercise ${done?'done-ex':''}">
      <div class="exercise-done-check ${done?'done':''}" onclick="markPlanExerciseDone('${activePlan.id}','${dow}',${idx})">
        ${done?'✓':''}
      </div>
      <div style="flex:1;">
        <div class="plan-today-ex-name">${escHtml(ex.machineName||ex.name||'Exercise')}</div>
        <div class="plan-today-ex-machine">${ex.targetSets||'?'} sets × ${ex.targetReps||'?'} reps ${ex.targetWeight?`@ ${ex.targetWeight}kg`:''}</div>
      </div>
    </div>`;
  }).join('');
}

function toggleExDone(gymLogId, exIdx) {
  const g = STATE.workout.gymLogs.find(x => x.id === gymLogId);
  if (g && g.exercises[exIdx]) { g.exercises[exIdx].done = !g.exercises[exIdx].done; save(); renderWorkoutToday(); renderDashboard(); }
}

function markPlanExerciseDone(planId, dow, exIdx) {
  const td = today();
  const plan = STATE.workout.plans.find(p => p.id === planId);
  if (!plan) return;
  const ex = plan.days[dow]?.[exIdx];
  if (!ex) return;

  let gymLog = STATE.workout.gymLogs.find(g => g.date === td);
  if (!gymLog) {
    gymLog = { id: genId(), date: td, duration: 0, exercises: [], notes: '' };
    STATE.workout.gymLogs.push(gymLog);
  }
  const existing = gymLog.exercises.findIndex(e => (e.machineName||e.name) === (ex.machineName||ex.name));
  if (existing >= 0) {
    gymLog.exercises[existing].done = !gymLog.exercises[existing].done;
  } else {
    gymLog.exercises.push({ machineName: ex.machineName||ex.name||'Exercise', sets: ex.targetSets||0, reps: ex.targetReps||0, weight: ex.targetWeight||0, done: true });
  }
  save(); renderWorkoutToday(); renderDashboard();
  showToast('Exercise marked!', 'success');
}

function deleteGymLog(id) { STATE.workout.gymLogs=STATE.workout.gymLogs.filter(g=>g.id!==id); save(); renderWorkoutToday(); renderDashboard(); showToast('Deleted','info'); }
function deleteBadmintonLog(id) { STATE.workout.badmintonLogs=STATE.workout.badmintonLogs.filter(b=>b.id!==id); save(); renderWorkoutToday(); renderBadminton(); renderDashboard(); showToast('Deleted','info'); }

function openLogGym(existingId = '') {
  const existing = existingId ? STATE.workout.gymLogs.find(g => g.id === existingId) : null;
  const machineOpts = STATE.workout.machines.map(m => `<option value="${m.id}" data-name="${escHtml(m.name)}">${escHtml(m.name)} (${m.category})</option>`).join('');
  const exRows = (existing?.exercises || []).map((ex, i) => buildExerciseInputRow(i, ex)).join('');

  openModal(existingId ? 'Edit Gym Log' : '🏋️ Log Gym Session', `
    <div class="form-row">
      <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" id="f_gymDate" value="${existing?.date||today()}"/></div>
      <div class="form-group"><label class="form-label">Duration (min)</label><input class="form-input" type="number" min="1" id="f_gymDuration" value="${existing?.duration||''}"/></div>
    </div>
    <div class="form-group"><label class="form-label">Exercises</label>
      <div id="exerciseInputList" style="display:flex;flex-direction:column;gap:8px;">${exRows}</div>
      <button class="btn btn-sm btn-outline" style="margin-top:8px;width:100%;" onclick="addExerciseInputRow()">+ Add Exercise</button>
    </div>
    <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" id="f_gymNotes" style="min-height:60px;">${escHtml(existing?.notes||'')}</textarea></div>
    <div class="form-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveGymLog('${existingId}')">Save Log</button></div>
  `);
}
function editGymLog(id) { openLogGym(id); }

function buildExerciseInputRow(i, ex = {}) {
  const machineOpts = STATE.workout.machines.map(m => `<option value="${m.id}" data-name="${escHtml(m.name)}" ${ex.machineName===m.name?'selected':''}>${escHtml(m.name)}</option>`).join('');
  return `<div class="exercise-input-row" style="background:var(--bg-tertiary);padding:10px;border-radius:8px;display:grid;grid-template-columns:2fr 1fr 1fr 1fr 28px;gap:6px;align-items:center;">
    <select class="form-select" name="ex_machine" style="padding:5px;font-size:12px;"><option value="">Select machine/exercise</option>${machineOpts}</select>
    <input class="form-input" name="ex_sets" type="number" min="1" placeholder="Sets" value="${ex.sets||''}" style="padding:5px;font-size:12px;"/>
    <input class="form-input" name="ex_reps" type="number" min="1" placeholder="Reps" value="${ex.reps||''}" style="padding:5px;font-size:12px;"/>
    <input class="form-input" name="ex_weight" type="number" min="0" step="0.5" placeholder="kg" value="${ex.weight||''}" style="padding:5px;font-size:12px;"/>
    <button onclick="this.closest('.exercise-input-row').remove()" style="color:var(--red);font-size:16px;padding:2px;">✕</button>
  </div>`;
}

function addExerciseInputRow() {
  const list = document.getElementById('exerciseInputList');
  if (!list) return;
  const i = list.children.length;
  const div = document.createElement('div');
  div.innerHTML = buildExerciseInputRow(i);
  list.appendChild(div.firstElementChild);
}

function saveGymLog(id = '') {
  const date = document.getElementById('f_gymDate')?.value || today();
  const duration = parseInt(document.getElementById('f_gymDuration')?.value) || 0;
  const notes = document.getElementById('f_gymNotes')?.value || '';
  const rows = document.querySelectorAll('.exercise-input-row');
  const exercises = [];
  rows.forEach(row => {
    const sel = row.querySelector('select[name="ex_machine"]');
    const sets = parseInt(row.querySelector('input[name="ex_sets"]')?.value) || 0;
    const reps = parseInt(row.querySelector('input[name="ex_reps"]')?.value) || 0;
    const weight = parseFloat(row.querySelector('input[name="ex_weight"]')?.value) || 0;
    const opt = sel?.selectedOptions?.[0];
    const machineName = opt?.dataset?.name || sel?.value || '';
    if (machineName || sets || reps) exercises.push({ machineName, sets, reps, weight, done: false });
  });
  const data = { id: id||genId(), date, duration, exercises, notes };
  if (id) { const idx = STATE.workout.gymLogs.findIndex(g=>g.id===id); if(idx>=0) STATE.workout.gymLogs[idx]=data; } else STATE.workout.gymLogs.push(data);
  save(); closeModal(); renderWorkoutToday(); renderWorkoutHistory(); renderDashboard();
  showToast('Gym session saved!', 'success');
}

// ---- WORKOUT PLAN ----
function renderWorkoutPlan() {
  const sel = document.getElementById('activePlanSelect');
  const prev = sel.value;
  sel.innerHTML = '<option value="">— Select plan —</option>' + STATE.workout.plans.map(p => `<option value="${p.id}" ${p.id===STATE.workout.activePlanId?'selected':''}>${escHtml(p.name)}</option>`).join('');
  sel.value = prev || (STATE.workout.activePlanId || '');

  const planId = sel.value;
  const plan = STATE.workout.plans.find(p => p.id === planId);
  const editor = document.getElementById('planEditor');

  if (!plan) {
    editor.innerHTML = `<div class="empty-state full-empty"><span>📋</span><p>No plan selected. Create a new plan or select one.</p></div>`;
    return;
  }

  const dows = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const cols = dows.map(dow => {
    const exs = plan.days[dow] || [];
    const exHtml = exs.map((ex, i) => `<div class="plan-exercise-tag">${escHtml(ex.machineName||ex.name||'')}<button class="del-ex" onclick="removePlanExercise('${plan.id}','${dow}',${i})">✕</button></div>`).join('');
    return `<div class="plan-day-col">
      <div class="plan-day-name">${dow}</div>
      ${exHtml}
      <div class="plan-add-ex" onclick="addExToPlanDay('${plan.id}','${dow}')">+ Add</div>
    </div>`;
  }).join('');

  editor.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <h3 style="font-size:16px;font-weight:700;">${escHtml(plan.name)}</h3>
      <button class="btn btn-sm btn-danger" onclick="deleteWorkoutPlan('${plan.id}')">🗑️ Delete Plan</button>
    </div>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Click "+ Add" on a day to add exercises. This plan ${plan.id===STATE.workout.activePlanId?'<strong style="color:var(--green)">is currently ACTIVE ✅</strong>':'is not active'}.</p>
    <div class="plan-days-scroll"><div class="plan-days-grid">${cols}</div></div>
  `;
}

function addExToPlanDay(planId, dow) {
  const plan = STATE.workout.plans.find(p => p.id === planId);
  if (!plan) return;
  const machineOpts = STATE.workout.machines.map(m => `<option value="${m.id}" data-name="${escHtml(m.name)}">${escHtml(m.name)} (${m.category})</option>`).join('');
  openModal(`Add Exercise — ${dow}`, `
    <div class="form-group">
      <label class="form-label">Machine / Exercise *</label>
      <select class="form-select" id="f_planMachine"><option value="">Select...</option>${machineOpts}<option value="_custom">✏️ Custom exercise name</option></select>
    </div>
    <div class="form-group" id="customExWrap" style="display:none;">
      <label class="form-label">Custom Exercise Name</label>
      <input class="form-input" id="f_customEx" placeholder="e.g. Push-ups"/>
    </div>
    <div class="form-row-3">
      <div class="form-group"><label class="form-label">Target Sets</label><input class="form-input" type="number" min="1" id="f_planSets" placeholder="3"/></div>
      <div class="form-group"><label class="form-label">Target Reps</label><input class="form-input" type="number" min="1" id="f_planReps" placeholder="12"/></div>
      <div class="form-group"><label class="form-label">Target Weight (kg)</label><input class="form-input" type="number" min="0" step="0.5" id="f_planWeight" placeholder="0"/></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="savePlanExercise('${planId}','${dow}')">Add</button>
    </div>
  `);
  document.getElementById('f_planMachine').addEventListener('change', function() {
    document.getElementById('customExWrap').style.display = this.value === '_custom' ? 'flex' : 'none';
  });
}

function savePlanExercise(planId, dow) {
  const plan = STATE.workout.plans.find(p => p.id === planId);
  if (!plan) return;
  const sel = document.getElementById('f_planMachine');
  let machineName = '';
  if (sel.value === '_custom') machineName = document.getElementById('f_customEx')?.value?.trim();
  else machineName = sel.selectedOptions[0]?.dataset?.name || '';
  if (!machineName) { showToast('Select or enter an exercise','error'); return; }
  if (!plan.days[dow]) plan.days[dow] = [];
  plan.days[dow].push({
    machineName,
    targetSets: parseInt(document.getElementById('f_planSets')?.value) || 3,
    targetReps: parseInt(document.getElementById('f_planReps')?.value) || 12,
    targetWeight: parseFloat(document.getElementById('f_planWeight')?.value) || 0,
  });
  save(); closeModal(); renderWorkoutPlan();
  showToast('Exercise added to plan!', 'success');
}

function removePlanExercise(planId, dow, idx) {
  const plan = STATE.workout.plans.find(p => p.id === planId);
  if (plan?.days[dow]) { plan.days[dow].splice(idx, 1); save(); renderWorkoutPlan(); }
}

function deleteWorkoutPlan(id) {
  STATE.workout.plans = STATE.workout.plans.filter(p => p.id !== id);
  if (STATE.workout.activePlanId === id) STATE.workout.activePlanId = null;
  save(); renderWorkoutPlan(); renderWorkoutToday();
  showToast('Plan deleted', 'info');
}

function addWorkoutPlan() {
  openModal('New Workout Plan', `
    <div class="form-group"><label class="form-label">Plan Name *</label><input class="form-input" id="f_planName" placeholder="e.g. Push-Pull-Legs, 5-Day Split"/></div>
    <div class="form-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveNewPlan()">Create Plan</button></div>
  `);
}
function saveNewPlan() {
  const name = document.getElementById('f_planName')?.value?.trim();
  if (!name) { showToast('Name required','error'); return; }
  const plan = { id: genId(), name, days: {Mon:[],Tue:[],Wed:[],Thu:[],Fri:[],Sat:[],Sun:[]} };
  STATE.workout.plans.push(plan);
  save(); closeModal();
  document.getElementById('activePlanSelect').value = plan.id;
  renderWorkoutPlan();
  showToast('Plan created!', 'success');
}

function setActivePlan() {
  const id = document.getElementById('activePlanSelect').value;
  if (!id) { showToast('Select a plan first','error'); return; }
  STATE.workout.activePlanId = id;
  save(); renderWorkoutPlan(); renderWorkoutToday();
  showToast('Active plan set!', 'success');
}

// ---- MACHINES ----
function renderMachines() {
  const mFilterGroup = document.getElementById('machineFilterGroup');
  if (mFilterGroup) {
    mFilterGroup.innerHTML = `<button class="filter-btn ${STATE.machineFilter==='all'?'active':''}" data-machine-filter="all">All</button>` +
      STATE.categories.machines.map(c => `<button class="filter-btn ${STATE.machineFilter===c?'active':''}" data-machine-filter="${escHtml(c)}">${escHtml(c)}</button>`).join('');
  }
  const grid = document.getElementById('machinesGrid');
  let machines = STATE.workout.machines;
  if (STATE.machineFilter !== 'all') machines = machines.filter(m => categoryMatch(m.category, STATE.machineFilter));
  if (!machines.length) { grid.innerHTML = `<div class="empty-state full-empty"><span>🏋️</span><p>No machines found. Add one!</p></div>`; return; }
  const catColor = { Cardio:'var(--red)', Strength:'var(--blue)', Flexibility:'var(--teal)', 'Free Weights':'var(--orange)', Other:'var(--text-muted)' };
  grid.innerHTML = machines.map(m => `
    <div class="machine-card" style="border-left:3px solid ${catColor[m.category]||'var(--accent)'}">
      <div class="machine-card-name">${escHtml(m.name)}</div>
      <div class="machine-card-cat"><span class="tag" style="background:${catColor[m.category]||'var(--accent)'}22;color:${catColor[m.category]||'var(--accent)'}">${m.category}</span></div>
      ${m.muscles ? `<div class="machine-card-muscles">💪 ${escHtml(m.muscles)}</div>` : ''}
      ${m.notes ? `<div class="machine-card-notes">"${escHtml(m.notes)}"</div>` : ''}
      <div class="machine-card-actions">
        <button class="btn btn-sm btn-outline" onclick="editMachine('${m.id}')">✏️ Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteMachine('${m.id}')">🗑️</button>
      </div>
    </div>`).join('');
}
function deleteMachine(id) { STATE.workout.machines=STATE.workout.machines.filter(m=>m.id!==id); save(); renderMachines(); showToast('Removed','info'); }
function editMachine(id) { const m=STATE.workout.machines.find(x=>x.id===id); openModal('Edit Machine',buildMachineForm(m)); }
function buildMachineForm(m={}) {
  const catOpts = STATE.categories.machines.map(c => `<option value="${escHtml(c)}" ${m.category===c?'selected':''}>${escHtml(c)}</option>`).join('');
  return `
    <div class="form-group"><label class="form-label">Machine / Exercise Name *</label><input class="form-input" id="f_machineName" value="${escHtml(m.name||'')}" placeholder="e.g. Treadmill, Bench Press, Pull-ups"/></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Category</label>
        <select class="form-select" id="f_machCat">${catOpts}</select>
      </div>
      <div class="form-group"><label class="form-label">Muscles Targeted</label><input class="form-input" id="f_muscles" value="${escHtml(m.muscles||'')}" placeholder="e.g. Chest, Biceps"/></div>
    </div>
    <div class="form-group"><label class="form-label">Notes / Instructions</label><textarea class="form-textarea" id="f_machNotes" style="min-height:60px;">${escHtml(m.notes||'')}</textarea></div>
    <div class="form-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveMachine('${m.id||''}')">Save</button></div>`;
}
function saveMachine(id='') {
  const name=document.getElementById('f_machineName')?.value?.trim();
  if (!name) { showToast('Name required','error'); return; }
  const data={id:id||genId(),name,category:document.getElementById('f_machCat')?.value||'Other',muscles:document.getElementById('f_muscles')?.value||'',notes:document.getElementById('f_machNotes')?.value||''};
  if (id) { const idx=STATE.workout.machines.findIndex(m=>m.id===id); if(idx>=0) STATE.workout.machines[idx]=data; } else STATE.workout.machines.push(data);
  save(); closeModal(); renderMachines(); showToast(id?'Updated!':'Machine added!','success');
}

// ---- BADMINTON ----
function renderBadminton() {
  const logs = STATE.workout.badmintonLogs.sort((a,b)=>b.date.localeCompare(a.date));
  const totalMin = logs.reduce((s,b)=>s+(parseInt(b.duration)||0), 0);
  const totalSessions = logs.length;
  const totalWon = logs.reduce((s,b)=>s+(parseInt(b.setsWon)||0),0);
  const totalLost = logs.reduce((s,b)=>s+(parseInt(b.setsLost)||0),0);

  document.getElementById('badmintonStats').innerHTML = `
    <div class="badminton-stat"><div class="badminton-stat-val">${totalSessions}</div><div class="badminton-stat-label">Total Sessions</div></div>
    <div class="badminton-stat"><div class="badminton-stat-val">${Math.round(totalMin/60*10)/10}h</div><div class="badminton-stat-label">Total Duration</div></div>
    <div class="badminton-stat"><div class="badminton-stat-val" style="color:var(--green)">${totalWon}</div><div class="badminton-stat-label">Sets Won</div></div>
    <div class="badminton-stat"><div class="badminton-stat-val" style="color:var(--red)">${totalLost}</div><div class="badminton-stat-label">Sets Lost</div></div>
  `;

  const tbody = document.getElementById('badmintonTbody');
  if (!logs.length) { tbody.innerHTML=`<tr class="empty-row"><td colspan="6"><div class="empty-state"><span>🏸</span><p>No badminton sessions logged yet.</p></div></td></tr>`; return; }
  tbody.innerHTML = logs.map(b => `<tr>
    <td>${formatDate(b.date)}</td>
    <td><strong>${b.duration||'—'}</strong> min</td>
    <td>${escHtml(b.partner||'—')}</td>
    <td><span style="color:var(--green)">${b.setsWon||0}</span> / <span style="color:var(--red)">${b.setsLost||0}</span></td>
    <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(b.notes||'—')}</td>
    <td><button class="icon-btn del" onclick="deleteBadmintonLog('${b.id}')">🗑️</button></td>
  </tr>`).join('');
}

function openLogBadminton() {
  openModal('🏸 Log Badminton Session', `
    <div class="form-row">
      <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" id="f_badDate" value="${today()}"/></div>
      <div class="form-group"><label class="form-label">Duration (min) *</label><input class="form-input" type="number" min="1" id="f_badDuration" placeholder="45"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Partner Name</label><input class="form-input" id="f_badPartner" placeholder="e.g. Rahul"/></div>
      <div class="form-group"><label class="form-label">Your Sets Won / Lost</label>
        <div style="display:flex;gap:6px;">
          <input class="form-input" type="number" min="0" id="f_badWon" placeholder="Won" style="width:50%"/>
          <input class="form-input" type="number" min="0" id="f_badLost" placeholder="Lost" style="width:50%"/>
        </div>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" id="f_badNotes" style="min-height:60px;" placeholder="How did it go?"></textarea></div>
    <div class="form-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveBadmintonLog()">Save</button></div>
  `);
}

function saveBadmintonLog() {
  const duration = document.getElementById('f_badDuration')?.value;
  if (!duration) { showToast('Duration required','error'); return; }
  const data = {
    id: genId(),
    date: document.getElementById('f_badDate')?.value || today(),
    duration: parseInt(duration),
    partner: document.getElementById('f_badPartner')?.value || '',
    setsWon: parseInt(document.getElementById('f_badWon')?.value) || 0,
    setsLost: parseInt(document.getElementById('f_badLost')?.value) || 0,
    notes: document.getElementById('f_badNotes')?.value || '',
  };
  STATE.workout.badmintonLogs.push(data);
  save(); closeModal(); renderWorkoutToday(); renderBadminton(); renderWorkoutHistory(); renderDashboard();
  showToast('Badminton session logged!', 'success');
}

// ---- HISTORY ----
function renderWorkoutHistory() {
  const hFilter = STATE.historyFilter;
  let entries = [];
  STATE.workout.gymLogs.forEach(g => entries.push({type:'gym', date:g.date, data:g}));
  STATE.workout.badmintonLogs.forEach(b => entries.push({type:'badminton', date:b.date, data:b}));
  if (hFilter !== 'all') entries = entries.filter(e => e.type === hFilter);
  entries.sort((a,b) => b.date.localeCompare(a.date));

  const totalGym = STATE.workout.gymLogs.length;
  const totalBad = STATE.workout.badmintonLogs.length;
  document.getElementById('historyStats').textContent = `${totalGym} gym · ${totalBad} badminton sessions total`;

  const container = document.getElementById('workoutHistory');
  if (!entries.length) { container.innerHTML = `<div class="empty-state full-empty"><span>🗂️</span><p>No workout history yet.</p></div>`; return; }
  container.innerHTML = entries.map(e => {
    if (e.type === 'gym') {
      const g = e.data;
      const exStr = (g.exercises||[]).map(ex => ex.machineName||ex.name||'').filter(Boolean).join(', ');
      const doneCnt = (g.exercises||[]).filter(x=>x.done).length;
      return `<div class="history-entry">
        <div class="history-type-badge">🏋️</div>
        <div class="history-info">
          <div class="history-title">Gym Session</div>
          <div class="history-meta">
            <span>📅 ${formatDate(g.date)}</span>
            <span>⏱️ ${g.duration||'?'} min</span>
            <span>✅ ${doneCnt}/${(g.exercises||[]).length} done</span>
          </div>
          ${exStr ? `<div class="history-exercises">💪 ${escHtml(exStr)}</div>` : ''}
        </div>
        <button class="history-del" onclick="deleteGymLog('${g.id}')">🗑️</button>
      </div>`;
    } else {
      const b = e.data;
      return `<div class="history-entry">
        <div class="history-type-badge">🏸</div>
        <div class="history-info">
          <div class="history-title">Badminton Session</div>
          <div class="history-meta">
            <span>📅 ${formatDate(b.date)}</span>
            <span>⏱️ ${b.duration||'?'} min</span>
            ${b.partner ? `<span>👤 vs ${escHtml(b.partner)}</span>` : ''}
            ${(b.setsWon||b.setsLost) ? `<span>🏆 ${b.setsWon||0}–${b.setsLost||0}</span>` : ''}
          </div>
        </div>
        <button class="history-del" onclick="deleteBadmintonLog('${b.id}')">🗑️</button>
      </div>`;
    }
  }).join('');
}

// ==================== BUDGET ====================
let budgetFilter = 'all';
function renderBudget() {
  const bFilterGroup = document.getElementById('budgetFilterGroup');
  if (bFilterGroup) {
    bFilterGroup.innerHTML = `<button class="filter-btn ${budgetFilter==='all'?'active':''}" data-budget-filter="all">All</button>` +
      STATE.categories.budget.map(c => `<button class="filter-btn ${budgetFilter===c?'active':''}" data-budget-filter="${escHtml(c)}">${escHtml(c)}</button>`).join('');
  }
  const expenses = STATE.budget.expenses;
  const total = expenses.reduce((s,e)=>s+parseFloat(e.amount||0),0);
  const limit = parseFloat(STATE.budget.limit||0);
  const remaining = limit - total;
  const pct = limit > 0 ? Math.min(100, Math.round(total/limit*100)) : 0;
  document.getElementById('budgetLimit').textContent = `₹${limit.toFixed(2)}`;
  document.getElementById('budgetSpent').textContent = `₹${total.toFixed(2)}`;
  document.getElementById('budgetRemaining').textContent = `₹${remaining.toFixed(2)}`;
  document.getElementById('budgetRemaining').className = `budget-value ${remaining>=0?'green':'red'}`;
  document.getElementById('budgetProgressFill').style.width = `${pct}%`;
  document.getElementById('budgetPct').textContent = `${pct}% used`;
  let rows = expenses;
  if (budgetFilter !== 'all') rows = rows.filter(e=>categoryMatch(e.category, budgetFilter));
  rows = rows.sort((a,b)=>b.date.localeCompare(a.date));
  const catEmoji = {Food:'🍔',Study:'📚',Transport:'🚌',Entertainment:'🎮',Other:'📦'};
  const tbody = document.getElementById('budgetTbody');
  if (!rows.length) { tbody.innerHTML=`<tr class="empty-row"><td colspan="5"><div class="empty-state"><span>💸</span><p>No expenses found.</p></div></td></tr>`; return; }
  tbody.innerHTML = rows.map(e=>{
    let catText = escHtml(e.category);
    let displayCat = catEmoji[e.category] ? `${catEmoji[e.category]} ${catText}` : catText;
    return `<tr><td>${escHtml(e.desc)}</td><td><span class="tag tag-in-progress">${displayCat}</span></td><td><strong>₹${parseFloat(e.amount).toFixed(2)}</strong></td><td>${formatDate(e.date)}</td><td><button class="icon-btn del" onclick="deleteExpense('${e.id}')">🗑️</button></td></tr>`;
  }).join('');
}
function deleteExpense(id) { STATE.budget.expenses=STATE.budget.expenses.filter(e=>e.id!==id); save(); renderBudget(); showToast('Removed','info'); }
function buildExpenseForm() {
  const catOpts = STATE.categories.budget.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');
  return `
    <div class="form-group"><label class="form-label">Description *</label><input class="form-input" id="f_desc" placeholder="What did you spend on?"/></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Amount (₹) *</label><input class="form-input" type="number" step="0.01" min="0" id="f_amount" placeholder="0.00"/></div>
      <div class="form-group"><label class="form-label">Category</label><select class="form-select" id="f_cat">${catOpts}</select></div>
    </div>
    <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" id="f_date" value="${today()}"/></div>
    <div class="form-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveExpense()">Add Expense</button></div>`;
}
function saveExpense() {
  const desc=document.getElementById('f_desc')?.value?.trim(), amount=parseFloat(document.getElementById('f_amount')?.value);
  if (!desc||isNaN(amount)||amount<=0) { showToast('Description & valid amount required','error'); return; }
  STATE.budget.expenses.push({id:genId(),desc,amount:amount.toFixed(2),category:document.getElementById('f_cat')?.value||'Other',date:document.getElementById('f_date')?.value||today()});
  save(); closeModal(); renderBudget(); showToast('Expense added!','success');
}
function buildBudgetLimitForm() {
  return `<div class="form-group"><label class="form-label">Monthly Budget (₹)</label><input class="form-input" type="number" step="100" min="0" id="f_limit" placeholder="e.g. 15000" value="${STATE.budget.limit||''}"/></div>
    <div class="form-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveBudgetLimit()">Save</button></div>`;
}
function saveBudgetLimit() {
  const val=parseFloat(document.getElementById('f_limit')?.value);
  if (!isNaN(val)&&val>=0) { STATE.budget.limit=val; save(); closeModal(); renderBudget(); showToast('Budget set!','success'); }
  else showToast('Enter valid amount','error');
}

// ==================== NOTES ====================
function renderNotes(search='') {
  const grid=document.getElementById('notesGrid');
  let notes=STATE.notes;
  if (search) notes=notes.filter(n=>n.title.toLowerCase().includes(search.toLowerCase())||n.content.toLowerCase().includes(search.toLowerCase()));
  notes=notes.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  const colors=['#7c5cbf22','#4a90e222','#4caf7d22','#f0965a22','#e8c44a22'];
  grid.innerHTML = !notes.length
    ? `<div class="empty-state full-empty"><span>📭</span><p>${search?'No matching notes.':'No notes yet.'}</p></div>`
    : notes.map((n,i)=>`<div class="note-card" style="background:${colors[i%colors.length]}" onclick="editNote('${n.id}')">
      <div class="note-card-title">${escHtml(n.title||'Untitled')}</div>
      <div style="font-size:12px; color:var(--text-muted); margin-bottom: 8px;">${formatDate(n.date)}</div>
      <p style="white-space:pre-wrap; font-size:13px;">${escHtml(n.content)}</p>
      ${n.attachment ? `<div style="margin-top:12px;"><a href="${escHtml(n.attachment)}" target="_blank" style="font-size:12px; color:var(--accent); background:var(--accent-alpha); padding:4px 8px; border-radius:4px; text-decoration:none;">🔗 View Attachment</a></div>` : ''}
      <div class="note-card-footer"><span class="note-card-del" onclick="event.stopPropagation();deleteNote('${n.id}')">🗑️</span></div>
    </div>`).join('');
}
function deleteNote(id) { STATE.notes=STATE.notes.filter(x=>x.id!==id); save(); renderNotes(); showToast('Removed','info'); }
function editNote(id) { const n=STATE.notes.find(x=>x.id===id); openModal('Edit Note', buildNoteForm(n)); }
function buildNoteForm(n={}) {
  const attHtml = n.attachment ? `<div style="margin-top:8px;"><a href="${escHtml(n.attachment)}" target="_blank" style="font-size:12px; color:var(--accent);">🔗 View current attachment</a></div>` : '';
  return `
    <div class="form-group"><label class="form-label">Title</label><input class="form-input" id="f_noteTitle" value="${escHtml(n.title||'')}"/></div>
    <div class="form-group"><label class="form-label">Content</label><textarea class="form-input" id="f_noteContent" rows="5">${escHtml(n.content||'')}</textarea></div>
    <div class="form-group">
      <label class="form-label">Attachment (PDF/PPT)</label>
      <input type="file" id="f_noteFile" accept=".pdf,.ppt,.pptx" class="form-input" style="padding: 6px;" />
      ${attHtml}
    </div>
    <div class="form-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="saveNoteBtn" onclick="handleSaveNote('${n.id||''}')">Save Note</button></div>`;
}
async function handleSaveNote(id) {
  const btn = document.getElementById('saveNoteBtn');
  btn.disabled = true; btn.textContent = "Saving...";
  try {
    const fileInput = document.getElementById('f_noteFile');
    let attachment = null;
    if (fileInput && fileInput.files.length > 0) attachment = await uploadFile(fileInput.files[0]);
    
    const title=document.getElementById('f_noteTitle')?.value||'Untitled';
    const content=document.getElementById('f_noteContent')?.value||'';
    if (!id) STATE.notes.push({ id: genId(), title, content, attachment, date: today() });
    else { const n=STATE.notes.find(x=>x.id===id); if(n) { n.title=title; n.content=content; if(attachment) n.attachment=attachment; } }
    save(); renderNotes(); closeModal(); showToast('Note saved','success');
  } catch(e) {
    showToast('Failed: ' + e.message, 'error');
    btn.disabled = false; btn.textContent = "Save Note";
  }
}


// ==================== COMPLETED TAB ====================
function renderCompleted() {
  if (!STATE.completedAssignments) STATE.completedAssignments = [];
  if (!STATE.completedExams) STATE.completedExams = [];

  // Badge
  const totalCompleted = STATE.completedAssignments.length + STATE.completedExams.length;
  const cb = document.getElementById('badge-completed');
  if (cb) {
    cb.textContent = totalCompleted > 0 ? totalCompleted : '';
    cb.style.display = totalCompleted > 0 ? 'block' : 'none';
  }

  // Completed Assignments Table
  const tbody = document.getElementById('completedAssignmentsTbody');
  if (tbody) {
    if (STATE.completedAssignments.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="6"><div class="empty-state"><span>📭</span><p>No completed assignments yet. Complete assignments to see them here!</p></div></td></tr>`;
    } else {
      const sorted = [...STATE.completedAssignments].sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
      tbody.innerHTML = sorted.map(a => {
        const pc = {'high':'tag-high','medium':'tag-medium','low':'tag-low'}[a.priority] || 'tag-low';
        const color = getCourseColor(a.course);
        const completedDate = a.completedAt ? formatDate(a.completedAt.split('T')[0]) : '—';
        return `<tr>
          <td><span style="display:flex;align-items:center;gap:8px"><span class="color-dot" style="background:${color}"></span>${escHtml(a.title)}</span></td>
          <td>${escHtml(a.course || '—')}</td>
          <td>${a.dueDate ? formatDate(a.dueDate) : '—'}</td>
          <td><span class="tag ${pc}">${capitalize(a.priority || 'low')}</span></td>
          <td><span class="tag tag-done">✅ ${completedDate}</span></td>
          <td><div class="table-actions">
            <button class="icon-btn" onclick="restoreAssignment('${a.id}')" title="Restore">♻️</button>
            <button class="icon-btn del" onclick="deleteCompletedAssignment('${a.id}')" title="Delete permanently">🗑️</button>
          </div></td>
        </tr>`;
      }).join('');
    }
  }

  // Completed Exams Grid
  const grid = document.getElementById('completedExamsGrid');
  if (grid) {
    if (STATE.completedExams.length === 0) {
      grid.innerHTML = `<div class="empty-state full-empty"><span>📭</span><p>No completed exams yet. Complete exams to see your review notes here!</p></div>`;
    } else {
      const sorted = [...STATE.completedExams].sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
      grid.innerHTML = sorted.map(e => {
        const typeEmoji = e.type === 'external' ? '🔴' : e.type === 'practical' ? '🧪' : '🟠';
        const typeLabel = capitalize(e.type || 'internal');
        const stars = e.rating ? '⭐'.repeat(e.rating) + '☆'.repeat(5 - e.rating) : 'No rating';
        const completedDate = e.completedAt ? formatDate(e.completedAt.split('T')[0]) : '—';
        return `<div class="exam-card completed-exam-card">
          <div class="exam-card-header">
            <div>
              <div class="exam-card-name">${escHtml(e.name)}</div>
              <div class="exam-card-course">${typeEmoji} ${typeLabel} • ${escHtml(e.course || '—')}</div>
            </div>
            <div class="tag tag-done" style="font-size:11px;">✅ Done</div>
          </div>
          <div style="padding:0 16px;">
            <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">📅 ${formatDate(e.date)} • Completed ${completedDate}</div>
            <div style="margin-bottom:6px; font-size:13px;">${stars}</div>
            ${e.review ? `<div style="background:var(--bg-tertiary); padding:10px; border-radius:8px; margin-bottom:8px; font-size:13px;">
              <div style="font-weight:600; font-size:11px; color:var(--accent); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">📝 Review</div>
              <div style="color:var(--text-secondary); white-space:pre-wrap;">${escHtml(e.review)}</div>
            </div>` : ''}
            ${e.improvement ? `<div style="background:var(--orange-bg); padding:10px; border-radius:8px; margin-bottom:8px; font-size:13px;">
              <div style="font-weight:600; font-size:11px; color:var(--orange); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">🎯 Improvement Notes</div>
              <div style="color:var(--text-secondary); white-space:pre-wrap;">${escHtml(e.improvement)}</div>
            </div>` : ''}
          </div>
          <div class="exam-card-actions">
            <button class="btn btn-sm btn-outline" onclick="restoreExam('${e.id}')">♻️ Restore</button>
            <button class="btn btn-sm btn-danger" onclick="deleteCompletedExam('${e.id}')">🗑️ Delete</button>
          </div>
        </div>`;
      }).join('');
    }
  }
}

function restoreAssignment(id) {
  const idx = STATE.completedAssignments.findIndex(a => a.id === id);
  if (idx >= 0) {
    const a = STATE.completedAssignments.splice(idx, 1)[0];
    a.status = 'in-progress';
    delete a.completedAt;
    STATE.assignments.push(a);
    save(); renderCompleted(); renderAssignments(); renderDashboard();
    showToast('Assignment restored!', 'success');
  }
}

function deleteCompletedAssignment(id) {
  STATE.completedAssignments = STATE.completedAssignments.filter(a => a.id !== id);
  save(); renderCompleted();
  showToast('Permanently deleted', 'info');
}

function restoreExam(id) {
  const idx = STATE.completedExams.findIndex(e => e.id === id);
  if (idx >= 0) {
    const e = STATE.completedExams.splice(idx, 1)[0];
    delete e.completedAt; delete e.review; delete e.improvement; delete e.rating;
    STATE.exams.push(e);
    save(); renderCompleted(); renderExams(); renderDashboard();
    showToast('Exam restored!', 'success');
  }
}

function deleteCompletedExam(id) {
  STATE.completedExams = STATE.completedExams.filter(e => e.id !== id);
  save(); renderCompleted();
  showToast('Permanently deleted', 'info');
}

// ==================== MODAL ====================
function openModal(title, bodyHtml) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalOverlay').classList.add('open');
  setTimeout(() => { const f=document.querySelector('#modalBody input,#modalBody textarea'); if(f) f.focus(); }, 80);
}
function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }

// ==================== HELPERS ====================
// ==================== PROFILE ====================
function openProfileModal() {
  const isGuest = !currentUser;
  const authAction = isGuest 
    ? `<button class="btn btn-primary" style="width:100%;" onclick="logIn()">Sign In</button>`
    : `<button class="btn btn-danger" style="width:100%;" onclick="logOut()">Log Out</button>`;
    
  const html = `
    <div class="form-group" style="margin-bottom:16px;">
      <label class="form-label">Profile Name</label>
      <input type="text" id="f_profileName" class="form-input" value="${escHtml(currentUser?.displayName || 'Guest')}" ${isGuest ? 'disabled' : ''} />
    </div>
    ${isGuest ? `<p style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">You must sign in to change your profile name.</p>` : `
    <div class="form-actions" style="justify-content: flex-start; gap: 8px; margin-bottom: 24px;">
      <button class="btn btn-primary" onclick="saveProfile()">Save Changes</button>
    </div>`}
    
    <div class="divider"></div>
    <div class="form-group" style="margin-top:16px; margin-bottom: 16px;">
      <label class="form-label">Data Management</label>
      <div style="display:flex;gap:8px;margin-top:4px;">
        <button class="btn btn-outline" style="flex:1" onclick="exportData()">📤 Export Data</button>
        <button class="btn btn-outline" style="flex:1" onclick="importData()">📥 Import Data</button>
      </div>
      <button class="btn btn-outline" style="width:100%; margin-top:8px;" onclick="openCategoriesModal()">🏷️ Manage Categories</button>
      <button class="btn btn-outline" style="width:100%; margin-top:8px;" onclick="openModal('Add Course', buildCourseForm())">📚 Add Course</button>
    </div>

    <div class="divider"></div>
    <div class="form-group" style="margin-top:16px; margin-bottom: 16px;">
      <label class="form-label">Preferences</label>
      <div style="display:flex; align-items:center; gap:12px; margin-top:8px;">
        <span style="font-size:14px; color:var(--text-secondary);">Notification Volume:</span>
        <input type="range" min="0" max="1" step="0.1" value="${STATE.notificationVolume !== undefined ? STATE.notificationVolume : 1.0}" 
               oninput="updateNotificationVolume(this.value)" style="flex-grow:1; cursor:pointer;" />
      </div>
    </div>

    <div class="divider"></div>
    <div style="margin-top:16px;">
      ${authAction}
    </div>
  `;
  openModal('My Profile', html);
}

function updateNotificationVolume(val) {
  STATE.notificationVolume = parseFloat(val);
  save();
}

function saveProfile() {
  const newName = document.getElementById('f_profileName')?.value.trim();
  if (newName && currentUser) {
    currentUser.updateProfile({ displayName: newName }).then(() => {
      document.getElementById('userName').textContent = newName;
      showToast('Profile updated!', 'success');
      closeModal();
    }).catch(err => {
      showToast('Failed to update profile: ' + err.message, 'error');
    });
  }
}

function logOut() {
  if (confirm("Sign out of Student Planner?")) {
    closeModal();
    auth.signOut();
  }
}

function logIn() {
  closeModal();
  document.getElementById('loginOverlay').style.display = 'flex';
}

function openCategoriesModal() {
  if (!STATE.customEmojis) {
    STATE.customEmojis = ['🍔','📚','🚌','🎮','📦','🏋️','❤️','💪','🧘','🏸','✈️','👗','🛒','💊','🎉','💸'];
  }
  const emojiHtml = STATE.customEmojis.map((e, index) => `<button type="button" style="font-size:20px;padding:4px;border-radius:6px;border:none;background:transparent;cursor:pointer;" onclick="insertEmojiCategory('${e}')" title="Add ${e}" oncontextmenu="removeCustomEmoji(${index}); return false;">${e}</button>`).join('');
  
  const html = `
    <div style="margin-bottom:12px;display:flex;gap:4px;flex-wrap:wrap;background:var(--bg-tertiary);padding:8px;border-radius:8px;">
      <div style="width:100%;font-size:12px;color:var(--text-muted);margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;">
        <span>Click to insert (Right-click to remove):</span>
        <div style="display:flex;gap:4px;">
          <input type="text" id="f_newEmoji" placeholder="😀" style="width:36px;padding:2px;font-size:14px;border:1px solid var(--border);border-radius:4px;background:var(--bg-primary);color:var(--text-primary);text-align:center;" />
          <button type="button" class="btn btn-sm btn-outline" style="padding:2px 8px;" onclick="addCustomEmoji()">+</button>
        </div>
      </div>
      ${emojiHtml}
    </div>
    <div class="form-group">
      <label class="form-label">Budget Categories (Comma separated)</label>
      <input type="text" id="f_catBudget" class="form-input" value="${escHtml(STATE.categories.budget.join(', '))}" onfocus="window.lastFocusedCategoryInput = this" />
    </div>
    <div class="form-group" style="margin-top:12px;">
      <label class="form-label">Machine Categories (Comma separated)</label>
      <input type="text" id="f_catMachines" class="form-input" value="${escHtml(STATE.categories.machines.join(', '))}" onfocus="window.lastFocusedCategoryInput = this" />
    </div>
    <div class="form-actions" style="margin-top:20px;">
      <button class="btn btn-outline" onclick="openProfileModal()">Back</button>
      <button class="btn btn-primary" onclick="saveCategories()">Save Categories</button>
    </div>
  `;
  openModal('Manage Categories', html);
}

function insertEmojiCategory(e) {
  const input = window.lastFocusedCategoryInput || document.getElementById('f_catBudget');
  if (input) {
    const start = input.selectionStart || input.value.length;
    const end = input.selectionEnd || input.value.length;
    input.value = input.value.substring(0, start) + e + input.value.substring(end);
    input.focus();
    input.selectionStart = input.selectionEnd = start + e.length;
  }
}

window.addCustomEmoji = function() {
  const input = document.getElementById('f_newEmoji');
  if (!input) return;
  const val = input.value.trim();
  if (val) {
    if (!STATE.customEmojis) STATE.customEmojis = [];
    if (!STATE.customEmojis.includes(val)) {
      STATE.customEmojis.push(val);
      save();
    }
    openCategoriesModal();
  }
}

window.removeCustomEmoji = function(index) {
  if (STATE.customEmojis && STATE.customEmojis.length > index) {
    STATE.customEmojis.splice(index, 1);
    save();
    openCategoriesModal();
  }
}

function saveCategories() {
  const b = document.getElementById('f_catBudget')?.value.split(',').map(s=>s.trim()).filter(Boolean) || [];
  const m = document.getElementById('f_catMachines')?.value.split(',').map(s=>s.trim()).filter(Boolean) || [];
  STATE.categories.budget = b.length ? b : STATE.categories.budget;
  STATE.categories.machines = m.length ? m : STATE.categories.machines;
  save();
  renderAll();
  showToast('Categories saved!', 'success');
  openProfileModal();
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function capitalize(s) { return s ? s.charAt(0).toUpperCase()+s.slice(1) : ''; }

// ==================== DATA MIGRATION ====================
function exportData() {
  const data = localStorage.getItem('studentPlanner_v3') || JSON.stringify(STATE);
  navigator.clipboard.writeText(data).then(() => {
    showToast('Data copied to clipboard! Now open Vercel and click Import.', 'success');
  }).catch(() => {
    const res = prompt("Copy this data manually:", data);
  });
}
function importData() {
  const input = prompt("Paste your exported data here:");
  if (!input) return;
  try {
    const d = JSON.parse(input);
    if (d && typeof d === 'object') {
      if (d.workout) STATE.workout = Object.assign({}, STATE.workout, d.workout);
      if (d.semester) STATE.semester = Object.assign({}, STATE.semester, d.semester);
      if (d.categories) STATE.categories = Object.assign({}, STATE.categories, d.categories);
      Object.assign(STATE, d);
      STATE.workout = d.workout || STATE.workout;
      STATE.semester = d.semester || STATE.semester;
      STATE.categories = d.categories || STATE.categories;
      localStorage.setItem('studentPlanner_v3', JSON.stringify(STATE));
      save(); // Push to Firebase if logged in
      renderAll();
      showToast('Data imported successfully!', 'success');
    }
  } catch(e) {
    showToast('Invalid data format', 'error');
  }
}

// ==================== FIREBASE SYNC & AUTH ====================
function renderAll() {
  renderDashboard();
  renderAssignments();
  renderExams();
  renderCourses();
  renderPlanner();
  renderHabits();
  renderWorkoutToday();
  renderWorkoutPlan();
  renderMachines();
  renderBadminton();
  renderWorkoutHistory();
  renderBudget();
  renderNotes();
  renderCompleted();
  updateSemesterUI();
  if (STATE.theme==='light') document.body.classList.add('light'); else document.body.classList.remove('light');
}

function initAuth() {
  auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      document.getElementById('loginOverlay').style.display = 'none';
      document.getElementById('userBadge').style.display = 'flex';
      document.getElementById('userAvatar').src = user.photoURL || '';
      document.getElementById('userName').textContent = user.displayName?.split(' ')[0] || 'User';
      
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      unsubscribeSnapshot = db.collection('users').doc(user.uid).onSnapshot(doc => {
        if (doc.exists) {
          const d = doc.data();
          if (d.workout) STATE.workout = Object.assign({}, STATE.workout, d.workout);
          if (d.semester) STATE.semester = Object.assign({}, STATE.semester, d.semester);
          if (d.categories) STATE.categories = Object.assign({}, STATE.categories, d.categories);
          Object.assign(STATE, d);
          STATE.workout = d.workout || STATE.workout;
          STATE.semester = d.semester || STATE.semester;
          STATE.categories = d.categories || STATE.categories;
          localStorage.setItem('studentPlanner_v3', JSON.stringify(STATE));
          renderAll();
        } else {
          save(); // Push local state up if new cloud doc
          renderAll();
        }
      });
    } else {
      currentUser = null;
      if (!window.isOfflineMode) {
        document.getElementById('loginOverlay').style.display = 'flex';
      }
      document.getElementById('userBadge').style.display = 'flex';
      document.getElementById('userName').textContent = 'Guest';
      document.getElementById('userAvatar').src = 'https://ui-avatars.com/api/?name=G&background=ff9800&color=fff';
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      load();
      renderAll();
    }
  });

  document.getElementById('loginBtn')?.addEventListener('click', () => {
    auth.signInWithPopup(provider).catch(err => {
      console.error(err);
      showToast("Login failed: " + err.message, 'error');
    });
  });

  // Open Profile Menu on badge click instead of direct logout
  document.getElementById('userBadge')?.addEventListener('click', openProfileModal);
}

// ==================== INIT ====================
function init() {
  load();
  if (STATE.theme==='light') document.body.classList.add('light');

  // Current date — IST (Delhi)
  function updateISTClock() {
    const now = new Date();
    document.getElementById('currentDate').textContent = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    document.getElementById('liveClock').textContent = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  }
  updateISTClock();
  setInterval(updateISTClock, 1000);

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click',()=>{
    document.body.classList.toggle('light');
    STATE.theme = document.body.classList.contains('light')?'light':'dark';
    document.getElementById('themeToggle').textContent = STATE.theme==='light'?'🌙':'☀️';
    save();
  });
  document.getElementById('themeToggle').textContent = STATE.theme==='light'?'🌙':'☀️';

  // Sidebar toggle
  document.getElementById('sidebarToggle').addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('collapsed'));
  document.getElementById('menuBtn').addEventListener('click',()=>{
    const sb=document.getElementById('sidebar');
    if (window.innerWidth<=768) {
      sb.classList.toggle('mobile-open');
      document.getElementById('sidebarOverlay')?.classList.toggle('show');
    } else sb.classList.toggle('collapsed');
  });

  // Sidebar overlay click
  document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('mobile-open');
    document.getElementById('sidebarOverlay')?.classList.remove('show');
  });

  // Nav items
  document.querySelectorAll('.nav-item[data-view]').forEach(item=>item.addEventListener('click',e=>navigate(item.dataset.view,e)));

  // Card action buttons
  document.querySelectorAll('.card-action[data-view]').forEach(btn=>btn.addEventListener('click',()=>navigate(btn.dataset.view)));

  // Modal close
  document.getElementById('modalClose').addEventListener('click',closeModal);
  document.getElementById('modalOverlay').addEventListener('click',e=>{if(e.target===document.getElementById('modalOverlay'))closeModal();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});

  // Semester settings
  document.getElementById('semesterSettingsBtn').addEventListener('click',openSemesterSettings);

  // Quick note
  document.getElementById('clearNote').addEventListener('click',()=>{document.getElementById('quickNote').value='';localStorage.removeItem('quickNote');});
  document.getElementById('saveNote').addEventListener('click',()=>{
    const txt=document.getElementById('quickNote').value.trim();
    if (!txt) return;
    STATE.notes.push({id:genId(),title:'Quick Note',content:txt,updatedAt:new Date().toISOString(),createdAt:new Date().toISOString()});
    localStorage.setItem('quickNote',txt); save(); showToast('Saved to Notes!','success');
  });
  document.getElementById('quickNote').addEventListener('input',()=>localStorage.setItem('quickNote',document.getElementById('quickNote').value));

  // Top Add Btn
  document.getElementById('topAddBtn').addEventListener('click',()=>{
    const v=STATE.currentView;
    if (v==='assignments') openModal('Add Assignment',buildAssignmentForm(),()=>saveAssignment(''));
    else if (v==='exams') openModal('Add Exam',buildExamForm(),()=>saveExam(''));
    else if (v==='courses') openModal('Add Course',buildCourseForm(),()=>saveCourse(''));
    else if (v==='habits') openModal('Add Habit',buildHabitForm(),()=>saveHabit(''));
    else if (v==='budget') openModal('Add Expense',buildExpenseForm(),()=>saveExpense());
    else if (v==='notes') openModal('New Note',buildNoteForm(),()=>saveNote(''));
    else if (v==='planner') openModal('Add Study Session',buildSessionForm(),()=>saveSession(''));
    else if (v==='workout') {
      if (STATE.workoutSubTab==='machines') openModal('Add Machine',buildMachineForm(),()=>saveMachine(''));
      else if (STATE.workoutSubTab==='badminton') openLogBadminton();
      else if (STATE.workoutSubTab==='plan') addWorkoutPlan();
      else openLogGym('');
    } else openModal('Add Assignment',buildAssignmentForm(),()=>saveAssignment(''));
  });

  // Quick add
  document.getElementById('quickAddAssignment').addEventListener('click',()=>openModal('Add Assignment',buildAssignmentForm(),()=>saveAssignment('')));
  document.getElementById('quickAddExam').addEventListener('click',()=>openModal('Add Exam',buildExamForm(),()=>saveExam('')));

  // Assignment filters
  document.getElementById('addAssignmentBtn').addEventListener('click',()=>openModal('Add Assignment',buildAssignmentForm(),()=>saveAssignment('')));
  document.getElementById('assignmentFilterGroup').addEventListener('click',e=>{
    const btn=e.target.closest('.filter-btn'); if (!btn) return;
    document.querySelectorAll('#assignmentFilterGroup .filter-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); assignmentFilter=btn.dataset.filter; renderAssignments();
  });
  document.getElementById('filterCourse').addEventListener('change',e=>{assignmentCourseFilter=e.target.value; renderAssignments();});

  // Exams
  document.getElementById('addExamBtn').addEventListener('click',()=>openModal('Add Exam',buildExamForm(),()=>saveExam('')));
  document.getElementById('examFilterGroup').addEventListener('click',e=>{
    const btn=e.target.closest('.filter-btn'); if (!btn||!btn.dataset.examFilter) return;
    document.querySelectorAll('#examFilterGroup .filter-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); examFilter=btn.dataset.examFilter; renderExams();
  });

  // Courses
  document.getElementById('addCourseBtn').addEventListener('click',()=>openModal('Add Course',buildCourseForm(),()=>saveCourse('')));

  // Planner
  document.getElementById('prevWeek').addEventListener('click',()=>{STATE.weekOffset--; renderPlanner();});
  document.getElementById('nextWeek').addEventListener('click',()=>{STATE.weekOffset++; renderPlanner();});
  document.getElementById('addSessionBtn').addEventListener('click',()=>openModal('Add Session',buildSessionForm(),()=>saveSession('')));

  // Planner Tabs
  const plannerTabs = document.getElementById('plannerSubTabs');
  if (plannerTabs) {
    plannerTabs.addEventListener('click', e => {
      const btn = e.target.closest('.sub-tab');
      if (!btn) return;
      plannerTabs.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.subtab;
      document.querySelectorAll('#view-planner .subtab-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(`subtab-${tabId}`);
      if (panel) panel.classList.add('active');
    });
  }

  // Completed Tabs
  const completedTabs = document.getElementById('completedSubTabs');
  if (completedTabs) {
    completedTabs.addEventListener('click', e => {
      const btn = e.target.closest('.sub-tab');
      if (!btn) return;
      completedTabs.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.subtab;
      document.querySelectorAll('#view-completed .subtab-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(`subtab-${tabId}`);
      if (panel) panel.classList.add('active');
    });
  }

  // To-Do List
  document.getElementById('addTodoBtn')?.addEventListener('click', () => {
    const input = document.getElementById('todoInput');
    addTodo(input.value);
    input.value = '';
  });
  document.getElementById('todoInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addTodo(e.target.value);
      e.target.value = '';
    }
  });
  const hrInput = document.getElementById('todoIntervalHours');
  const minInput = document.getElementById('todoIntervalMins');
  const saveIntervalBtn = document.getElementById('saveTodoIntervalBtn');
  if (hrInput && minInput && saveIntervalBtn) {
    const totalMins = STATE.todoNotificationInterval || 360; // default 6 hrs
    hrInput.value = Math.floor(totalMins / 60);
    minInput.value = totalMins % 60;
    saveIntervalBtn.addEventListener('click', () => {
      const h = parseInt(hrInput.value) || 0;
      const m = parseInt(minInput.value) || 0;
      if (h === 0 && m === 0) {
        showToast('Interval must be > 0', 'error');
        return;
      }
      STATE.todoNotificationInterval = (h * 60) + m;
      save();
      showToast(`Reminder set to ${h}h ${m}m`, 'success');
    });
  }

  // To-Do Notifications logic
  const testBtn = document.getElementById('testReminderBtn');
  if (testBtn) {
    testBtn.addEventListener('click', () => {
      document.getElementById('reminderModalText').textContent = 'This is a test reminder!';
      document.getElementById('reminderOverlay').classList.add('open');
      const audio = document.getElementById('notificationSound');
      if (audio) {
        audio.volume = STATE.notificationVolume !== undefined ? STATE.notificationVolume : 1.0;
        audio.currentTime = 0;
        audio.play().catch(e => console.log('Audio play prevented', e));
      }
    });
  }

  setInterval(() => {
    checkTodoNotifications();
    if (checkTodoReset()) {
      if (STATE.currentView === 'dashboard') renderDashboard();
      if (STATE.currentView === 'planner') { renderTodos(); renderDashboard(); }
    }
  }, 60000); // Check every minute
  checkTodoNotifications(); // Check immediately on load

  // Habits
  document.getElementById('prevHabitMonth').addEventListener('click',()=>{STATE.habitMonthOffset--; renderHabits();});
  document.getElementById('nextHabitMonth').addEventListener('click',()=>{STATE.habitMonthOffset++; renderHabits();});
  document.getElementById('addHabitBtn').addEventListener('click',()=>openModal('Add Habit',buildHabitForm(),()=>saveHabit('')));

  // WORKOUT sub-tabs
  document.getElementById('workoutSubTabs').addEventListener('click',e=>{
    const btn=e.target.closest('.sub-tab'); if (!btn) return;
    setWorkoutSubTab(btn.dataset.subtab);
  });
  document.getElementById('logGymBtn').addEventListener('click',()=>openLogGym(''));
  document.getElementById('logBadmintonBtn').addEventListener('click',openLogBadminton);
  document.getElementById('addMachineBtn').addEventListener('click',()=>openModal('Add Machine',buildMachineForm(),()=>saveMachine('')));
  document.getElementById('addBadmintonBtn').addEventListener('click',openLogBadminton);
  document.getElementById('addPlanBtn').addEventListener('click',addWorkoutPlan);
  document.getElementById('setActivePlanBtn').addEventListener('click',setActivePlan);
  document.getElementById('activePlanSelect').addEventListener('change',()=>renderWorkoutPlan());

  document.getElementById('machineFilterGroup').addEventListener('click',e=>{
    const btn=e.target.closest('.filter-btn[data-machine-filter]'); if (!btn) return;
    document.querySelectorAll('#machineFilterGroup .filter-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); STATE.machineFilter=btn.dataset.machineFilter; renderMachines();
  });
  document.getElementById('historyFilterGroup').addEventListener('click',e=>{
    const btn=e.target.closest('.filter-btn[data-history-filter]'); if (!btn) return;
    document.querySelectorAll('#historyFilterGroup .filter-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); STATE.historyFilter=btn.dataset.historyFilter; renderWorkoutHistory();
  });

  // Budget
  document.getElementById('addExpenseBtn').addEventListener('click',()=>openModal('Add Expense',buildExpenseForm(),()=>saveExpense()));
  document.getElementById('setBudgetBtn').addEventListener('click',()=>openModal('Set Monthly Budget',buildBudgetLimitForm(),()=>saveBudgetLimit()));
  document.getElementById('budgetFilterGroup').addEventListener('click',e=>{
    const btn=e.target.closest('.filter-btn[data-budget-filter]'); if (!btn) return;
    document.querySelectorAll('#budgetFilterGroup .filter-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); budgetFilter=btn.dataset.budgetFilter; renderBudget();
  });

  // Notes
  document.getElementById('addNoteBtn').addEventListener('click',()=>openModal('New Note',buildNoteForm(),()=>saveNote('')));
  document.getElementById('notesSearch').addEventListener('input',e=>renderNotes(e.target.value));

  // Export / Import
  document.getElementById('exportDataBtn')?.addEventListener('click', exportData);
  document.getElementById('importDataBtn')?.addEventListener('click', importData);
  document.getElementById('offlineBtn')?.addEventListener('click', () => {
    window.isOfflineMode = true; // Prevent auth listener from re-opening
    document.getElementById('loginOverlay').style.display = 'none';
  });

  // Semester Stats Click
  document.getElementById('semesterStatsCard')?.addEventListener('click', openSemesterStatsModal);

  // Init Auth & Render
  initAuth();
}

// ==================== SEMESTER STATS ====================
function openSemesterStatsModal() {
  const completedAssignments = STATE.assignments.filter(a => a.completed).length;
  const totalAssignments = STATE.assignments.length;
  const html = `
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="font-size: 32px; font-weight: 700; color: var(--accent);">${completedAssignments} <span style="font-size:16px;color:var(--text-muted)">/ ${totalAssignments}</span></div>
      <div style="font-size: 14px; color: var(--text-muted);">Assignments Completed</div>
    </div>
    
    <div class="form-group">
      <label class="form-label">Marks/Grade in Last Internals</label>
      <input type="text" id="f_marksInternals" class="form-input" placeholder="e.g. 85% or A-" value="${escHtml(STATE.semester.marksLastInternals || '')}" />
    </div>
    
    <div class="form-group" style="margin-top: 12px;">
      <label class="form-label">Marks/Grade in Last Semester</label>
      <input type="text" id="f_marksSemester" class="form-input" placeholder="e.g. 9.2 CGPA" value="${escHtml(STATE.semester.marksLastSemester || '')}" />
    </div>

    <div class="form-actions" style="margin-top: 24px;">
      <button class="btn btn-primary" style="width: 100%;" onclick="saveSemesterStats()">Save Stats</button>
    </div>
  `;
  openModal('Semester Statistics', html);
}

function saveSemesterStats() {
  STATE.semester.marksLastInternals = document.getElementById('f_marksInternals')?.value || '';
  STATE.semester.marksLastSemester = document.getElementById('f_marksSemester')?.value || '';
  save();
  showToast('Stats saved!', 'success');
  closeModal();
}

document.addEventListener('DOMContentLoaded', init);
