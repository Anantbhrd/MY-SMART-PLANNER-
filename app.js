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
  semester: { startDate: '', endDate: '', name: 'Semester 1' },
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
const provider = new firebase.auth.GoogleAuthProvider();

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
      Object.assign(STATE, d);
      STATE.workout = d.workout || STATE.workout;
      STATE.semester = d.semester || STATE.semester;
    }
  } catch(e) {}
}

function genId() { return `id_${Date.now()}_${Math.random().toString(36).slice(2,7)}`; }

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
  };
  document.getElementById('topbarBreadcrumb').textContent = labels[view] || view;
  renderView(view);
}

function renderView(view) {
  switch(view) {
    case 'dashboard': renderDashboard(); break;
    case 'assignments': renderAssignments(); break;
    case 'exams': renderExams(); break;
    case 'courses': renderCourses(); break;
    case 'planner': renderPlanner(); break;
    case 'habits': renderHabits(); break;
    case 'workout': renderWorkout(); break;
    case 'budget': renderBudget(); break;
    case 'notes': renderNotes(); break;
  }
}

// ==================== DASHBOARD ====================
function renderDashboard() {
  const td = today();
  const pending = STATE.assignments.filter(a => a.status !== 'done').length;
  const done = STATE.assignments.filter(a => a.status === 'done').length;
  const upcomingExams = STATE.exams.filter(e => daysUntil(e.date) >= 0).length;
  document.getElementById('stat-pending').textContent = pending;
  document.getElementById('stat-exams').textContent = upcomingExams;
  document.getElementById('stat-done').textContent = done;
  const habitsDone = STATE.habits.filter(h => STATE.habitLogs[`${h.id}_${td}`]).length;
  const habitPct = STATE.habits.length ? Math.round(habitsDone / STATE.habits.length * 100) : 0;
  document.getElementById('stat-habits').textContent = `${habitPct}%`;

  const pb = document.getElementById('badge-assignments');
  pb.textContent = pending > 0 ? pending : ''; pb.style.display = pending > 0 ? 'block' : 'none';
  const eb = document.getElementById('badge-exams');
  eb.textContent = upcomingExams > 0 ? upcomingExams : ''; eb.style.display = upcomingExams > 0 ? 'block' : 'none';

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

  // Study sessions today
  const sl = document.getElementById('studySessionList');
  const todaySess = STATE.sessions.filter(s => s.date === td);
  sl.innerHTML = todaySess.length === 0
    ? `<div class="empty-state"><span>🌅</span><p>No sessions planned today.</p></div>`
    : todaySess.map(s => `<div class="deadline-item"><div class="deadline-dot" style="background:${s.color||'#7c5cbf'}"></div><div class="dl-info"><div class="dl-title">${escHtml(s.title)}</div><div class="dl-course">${escHtml(s.subject||'')}</div></div><div class="dl-date">${escHtml(s.time||'')}</div></div>`).join('');

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
  if (a) { a.status = status; save(); renderDashboard(); renderAssignments(); showToast('Status updated','success'); }
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
  if (id) { const idx = STATE.assignments.findIndex(a => a.id===id); if (idx>=0) STATE.assignments[idx]=data; } else STATE.assignments.push(data);
  save(); closeModal(); renderDashboard(); renderAssignments(); showToast(id?'Updated!':'Added!','success');
}

// ==================== EXAMS ====================
let examFilter = 'all';
function renderExams() {
  const grid = document.getElementById('examCardsGrid');
  let exams = STATE.exams;
  if (examFilter==='upcoming') exams=exams.filter(e=>daysUntil(e.date)>=0);
  if (examFilter==='passed') exams=exams.filter(e=>daysUntil(e.date)<0);
  exams=exams.sort((a,b)=>a.date.localeCompare(b.date));
  if (!exams.length) { grid.innerHTML=`<div class="empty-state full-empty"><span>📭</span><p>No exams found.</p></div>`; return; }
  grid.innerHTML=exams.map(e=>{
    const days=daysUntil(e.date);
    const cc=days!=null?(days<=1?'urgent':days<=5?'soon':''):'';
    const cl=days===null?'':days<0?'Passed':days===0?'Today!':String(days);
    const sl=days>0?'days to go':'';
    return `<div class="exam-card"><div class="exam-card-header"><div><div class="exam-card-name">${escHtml(e.name)}</div><div class="exam-card-course">${escHtml(e.course||'—')}</div></div></div><div><div class="exam-card-countdown ${cc}">${cl}</div><div class="exam-card-countdown-label">${sl}</div><div class="exam-card-date">📅 ${formatDate(e.date)}${e.time?` at ${e.time}`:''}</div>${e.location?`<div class="exam-card-date">📍 ${escHtml(e.location)}</div>`:''}</div><div class="exam-card-actions"><button class="btn btn-sm btn-outline" onclick="editExam('${e.id}')">✏️ Edit</button><button class="btn btn-sm btn-danger" onclick="deleteExam('${e.id}')">🗑️ Delete</button></div></div>`;
  }).join('');
}
function deleteExam(id) { STATE.exams=STATE.exams.filter(e=>e.id!==id); save(); renderDashboard(); renderExams(); showToast('Deleted','info'); }
function editExam(id) { const e=STATE.exams.find(x=>x.id===id); openModal('Edit Exam',buildExamForm(e),()=>saveExam(id)); }
function buildExamForm(e={}) {
  const co=STATE.courses.map(c=>`<option value="${escHtml(c.name)}" ${e.course===c.name?'selected':''}>${escHtml(c.name)}</option>`).join('');
  return `<div class="form-group"><label class="form-label">Exam Name *</label><input class="form-input" id="f_name" value="${escHtml(e.name||'')}"/></div>
    <div class="form-row"><div class="form-group"><label class="form-label">Course</label><select class="form-select" id="f_course"><option value="">No course</option>${co}</select></div><div class="form-group"><label class="form-label">Date *</label><input class="form-input" type="date" id="f_date" value="${e.date||''}"/></div></div>
    <div class="form-row"><div class="form-group"><label class="form-label">Time</label><input class="form-input" type="time" id="f_time" value="${e.time||''}"/></div><div class="form-group"><label class="form-label">Location</label><input class="form-input" id="f_location" value="${escHtml(e.location||'')}"/></div></div>
    <div class="form-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveExam('${e.id||''}')">Save</button></div>`;
}
function saveExam(id='') {
  const name=document.getElementById('f_name')?.value?.trim(), date=document.getElementById('f_date')?.value;
  if (!name||!date) { showToast('Name & date required','error'); return; }
  const data={id:id||genId(),name,course:document.getElementById('f_course')?.value||'',date,time:document.getElementById('f_time')?.value||'',location:document.getElementById('f_location')?.value||''};
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
    return `<div class="course-card" style="border-top:3px solid ${c.color}"><div><div class="course-card-name">${escHtml(c.name)}</div><div class="course-card-code">${escHtml(c.code||'')}</div></div>${c.lecturer?`<div style="font-size:12px;color:var(--text-muted)">👨‍🏫 ${escHtml(c.lecturer)}</div>`:''}<div class="course-card-stats"><div class="course-stat"><div class="course-stat-val" style="color:${c.color}">${ta}</div><div class="course-stat-label">Tasks</div></div><div class="course-stat"><div class="course-stat-val" style="color:var(--green)">${da}</div><div class="course-stat-label">Done</div></div>${c.grade?`<div class="course-stat"><div class="course-stat-val">${escHtml(c.grade)}</div><div class="course-stat-label">Grade</div></div>`:''}</div><div class="course-card-actions"><button class="btn btn-sm btn-outline" onclick="editCourse('${c.id}')">✏️ Edit</button><button class="btn btn-sm btn-danger" onclick="deleteCourse('${c.id}')">🗑️ Delete</button></div></div>`;
  }).join('');
}
function deleteCourse(id) { STATE.courses=STATE.courses.filter(c=>c.id!==id); save(); renderCourses(); showToast('Deleted','info'); }
function editCourse(id) { const c=STATE.courses.find(x=>x.id===id); openModal('Edit Course',buildCourseForm(c),()=>saveCourse(id)); }
function buildCourseForm(c={}) {
  return `<div class="form-group"><label class="form-label">Course Name *</label><input class="form-input" id="f_name" value="${escHtml(c.name||'')}" placeholder="e.g. Mathematics"/></div>
    <div class="form-row"><div class="form-group"><label class="form-label">Course Code</label><input class="form-input" id="f_code" value="${escHtml(c.code||'')}"/></div><div class="form-group"><label class="form-label">Color</label><input class="form-input" type="color" id="f_color" value="${c.color||'#7c5cbf'}"/></div></div>
    <div class="form-row"><div class="form-group"><label class="form-label">Lecturer</label><input class="form-input" id="f_lecturer" value="${escHtml(c.lecturer||'')}"/></div><div class="form-group"><label class="form-label">Grade</label><input class="form-input" id="f_grade" value="${escHtml(c.grade||'')}"/></div></div>
    <div class="form-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveCourse('${c.id||''}')">Save</button></div>`;
}
function saveCourse(id='') {
  const name=document.getElementById('f_name')?.value?.trim();
  if (!name) { showToast('Name required','error'); return; }
  const data={id:id||genId(),name,code:document.getElementById('f_code')?.value||'',color:document.getElementById('f_color')?.value||COURSE_COLORS[STATE.courses.length%COURSE_COLORS.length],lecturer:document.getElementById('f_lecturer')?.value||'',grade:document.getElementById('f_grade')?.value||''};
  if (id) { const idx=STATE.courses.findIndex(c=>c.id===id); if(idx>=0) STATE.courses[idx]=data; } else STATE.courses.push(data);
  save(); closeModal(); renderCourses(); showToast(id?'Updated!':'Added!','success');
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
function renderHabits() {
  const days=getMonthDays(STATE.habitMonthOffset);
  document.getElementById('habitMonthLabel').textContent=monthLabel(STATE.habitMonthOffset);
  const td=today();
  const container=document.getElementById('habitTrackerTable');
  if (!STATE.habits.length) { container.innerHTML=`<div class="empty-state"><span>🌱</span><p>No habits added yet.</p></div>`; return; }
  const dayHeaders=days.map(d=>{const dt=new Date(d+'T00:00:00');const n=dt.getDate();const isT=d===td;return `<th style="${isT?'color:var(--accent-light);':''}">${n}</th>`;}).join('');
  const rows=STATE.habits.map(h=>{
    let streak=0;
    const dayCells=days.map(d=>{
      const key=`${h.id}_${d}`;const checked=!!STATE.habitLogs[key];const future=d>td;
      if(checked)streak++;
      return `<td><div class="habit-check ${checked?'checked':''} ${future?'future':''}" ${future?'':'onclick="toggleHabitLog(\''+h.id+'\',\''+d+'\')"'}>${checked?'✓':''}</div></td>`;
    }).join('');
    return `<tr><td class="habit-name-cell"><span style="font-size:16px;margin-right:6px">${h.emoji||'✅'}</span>${escHtml(h.name)}</td>${dayCells}<td class="habit-streak-cell">🔥 ${streak}</td><td><div class="habit-actions"><button class="icon-btn" onclick="deleteHabit('${h.id}')">🗑️</button></div></td></tr>`;
  }).join('');
  container.innerHTML=`<table class="habit-table"><thead><tr><th style="text-align:left;padding-left:14px;">Habit</th>${dayHeaders}<th>Streak</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}
function deleteHabit(id) {
  STATE.habits=STATE.habits.filter(h=>h.id!==id);
  Object.keys(STATE.habitLogs).filter(k=>k.startsWith(id+'_')).forEach(k=>delete STATE.habitLogs[k]);
  save(); renderHabits(); renderDashboard(); showToast('Removed','info');
}
function buildHabitForm(h={}) {
  const emojis=['✅','📚','💪','🧘','💧','🏃','🥗','😴','✍️','🎯','🧠','🎵','🌿','☀️','🚴'];
  return `<div class="form-group"><label class="form-label">Habit Name *</label><input class="form-input" id="f_name" value="${escHtml(h.name||'')}" placeholder="e.g. Read for 30 mins"/></div>
    <div class="form-group"><label class="form-label">Emoji</label><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;" id="emojiPicker">${emojis.map(e=>`<button type="button" style="font-size:20px;padding:4px;border-radius:6px;border:2px solid ${h.emoji===e?'var(--accent)':'transparent'};background:var(--bg-tertiary);cursor:pointer;" onclick="selectEmoji(this,'${e}')" data-emoji="${e}">${e}</button>`).join('')}</div><input type="hidden" id="f_emoji" value="${h.emoji||'✅'}"/></div>
    <div class="form-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveHabit('${h.id||''}')">Save</button></div>`;
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
  const grid = document.getElementById('machinesGrid');
  let machines = STATE.workout.machines;
  if (STATE.machineFilter !== 'all') machines = machines.filter(m => m.category === STATE.machineFilter);
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
    </div>
  `).join('');
}

function deleteMachine(id) { STATE.workout.machines=STATE.workout.machines.filter(m=>m.id!==id); save(); renderMachines(); showToast('Removed','info'); }
function editMachine(id) { const m=STATE.workout.machines.find(x=>x.id===id); openModal('Edit Machine',buildMachineForm(m),()=>saveMachine(id)); }
function buildMachineForm(m={}) {
  return `
    <div class="form-group"><label class="form-label">Machine / Exercise Name *</label><input class="form-input" id="f_machineName" value="${escHtml(m.name||'')}" placeholder="e.g. Treadmill, Bench Press, Pull-ups"/></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Category</label>
        <select class="form-select" id="f_machCat">
          <option value="Strength" ${m.category==='Strength'?'selected':''}>💪 Strength</option>
          <option value="Cardio" ${m.category==='Cardio'?'selected':''}>❤️ Cardio</option>
          <option value="Flexibility" ${m.category==='Flexibility'?'selected':''}>🧘 Flexibility</option>
          <option value="Free Weights" ${m.category==='Free Weights'?'selected':''}>🏋️ Free Weights</option>
          <option value="Other" ${m.category==='Other'?'selected':''}>📦 Other</option>
        </select>
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
  if (budgetFilter !== 'all') rows = rows.filter(e=>e.category===budgetFilter);
  rows = rows.sort((a,b)=>b.date.localeCompare(a.date));
  const catEmoji = {Food:'🍔',Study:'📚',Transport:'🚌',Entertainment:'🎮',Other:'📦'};
  const tbody = document.getElementById('budgetTbody');
  if (!rows.length) { tbody.innerHTML=`<tr class="empty-row"><td colspan="5"><div class="empty-state"><span>💸</span><p>No expenses found.</p></div></td></tr>`; return; }
  tbody.innerHTML = rows.map(e=>`<tr><td>${escHtml(e.desc)}</td><td><span class="tag tag-in-progress">${catEmoji[e.category]||'📦'} ${escHtml(e.category)}</span></td><td><strong>₹${parseFloat(e.amount).toFixed(2)}</strong></td><td>${formatDate(e.date)}</td><td><button class="icon-btn del" onclick="deleteExpense('${e.id}')">🗑️</button></td></tr>`).join('');
}
function deleteExpense(id) { STATE.budget.expenses=STATE.budget.expenses.filter(e=>e.id!==id); save(); renderBudget(); showToast('Removed','info'); }
function buildExpenseForm() {
  return `
    <div class="form-group"><label class="form-label">Description *</label><input class="form-input" id="f_desc" placeholder="What did you spend on?"/></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Amount (₹) *</label><input class="form-input" type="number" step="0.01" min="0" id="f_amount" placeholder="0.00"/></div>
      <div class="form-group"><label class="form-label">Category</label><select class="form-select" id="f_cat"><option value="Food">🍔 Food</option><option value="Study">📚 Study</option><option value="Transport">🚌 Transport</option><option value="Entertainment">🎮 Entertainment</option><option value="Other">📦 Other</option></select></div>
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
    : notes.map((n,i)=>`<div class="note-card" style="background:${colors[i%colors.length]}" onclick="openNote('${n.id}')"><div class="note-card-title">${escHtml(n.title||'Untitled')}</div><div class="note-card-preview">${escHtml(n.content)}</div><div class="note-card-footer"><span class="note-card-date">${formatDate(n.updatedAt?.split('T')[0])}</span><span class="note-card-del" onclick="event.stopPropagation();deleteNote('${n.id}')">🗑️</span></div></div>`).join('');
}
function openNote(id) { const n=STATE.notes.find(x=>x.id===id); openModal('Edit Note',buildNoteForm(n),()=>saveNote(id)); }
function buildNoteForm(n={}) {
  return `<div class="form-group"><label class="form-label">Title</label><input class="form-input" id="f_title" value="${escHtml(n.title||'')}"/></div>
    <div class="form-group"><label class="form-label">Content</label><textarea class="form-textarea" id="f_content" style="min-height:160px;">${escHtml(n.content||'')}</textarea></div>
    <div class="form-actions"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveNote('${n.id||''}')">Save Note</button></div>`;
}
function saveNote(id='') {
  const title=document.getElementById('f_title')?.value?.trim()||'Untitled', content=document.getElementById('f_content')?.value||'';
  const data={id:id||genId(),title,content,updatedAt:new Date().toISOString(),createdAt:id?(STATE.notes.find(n=>n.id===id)?.createdAt||new Date().toISOString()):new Date().toISOString()};
  if (id) { const idx=STATE.notes.findIndex(n=>n.id===id); if(idx>=0) STATE.notes[idx]=data; } else STATE.notes.push(data);
  save(); closeModal(); renderNotes(); showToast('Saved!','success');
}
function deleteNote(id) { STATE.notes=STATE.notes.filter(n=>n.id!==id); save(); renderNotes(); showToast('Deleted','info'); }

// ==================== MODAL ====================
function openModal(title, bodyHtml) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalOverlay').classList.add('open');
  setTimeout(() => { const f=document.querySelector('#modalBody input,#modalBody textarea'); if(f) f.focus(); }, 80);
}
function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }

// ==================== HELPERS ====================
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
      Object.assign(STATE, d);
      STATE.workout = d.workout || STATE.workout;
      STATE.semester = d.semester || STATE.semester;
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
          Object.assign(STATE, d);
          STATE.workout = d.workout || STATE.workout;
          STATE.semester = d.semester || STATE.semester;
          localStorage.setItem('studentPlanner_v3', JSON.stringify(STATE));
          renderAll();
        } else {
          save(); // Push local state up if new cloud doc
          renderAll();
        }
      });
    } else {
      currentUser = null;
      document.getElementById('loginOverlay').style.display = 'flex';
      document.getElementById('userBadge').style.display = 'none';
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

  document.getElementById('userBadge')?.addEventListener('click', () => {
    if (confirm("Sign out of Student Planner?")) {
      auth.signOut();
    }
  });
}

// ==================== INIT ====================
function init() {
  load();
  if (STATE.theme==='light') document.body.classList.add('light');

  // Current date
  document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'});

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
    if (window.innerWidth<=768) sb.classList.toggle('mobile-open'); else sb.classList.toggle('collapsed');
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
    document.getElementById('loginOverlay').style.display = 'none';
  });

  // Init Auth & Render
  initAuth();
}

document.addEventListener('DOMContentLoaded', init);
