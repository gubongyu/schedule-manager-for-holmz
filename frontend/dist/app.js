// HOLMZ 프론트엔드. Wails 런타임이 주입하는 window.go.main.App 바인딩을 직접 호출한다.
const api = () => window.go.main.App;

const $view = document.getElementById('view');
let currentView = 'dashboard';
let employees = [];

// --- 테마 / 사이드바 토글 (localStorage 유지) ---
function applyTheme() {
  const dark = localStorage.getItem('holmz-theme') === 'dark';
  if (dark) document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  document.getElementById('theme-toggle').textContent = dark ? '◑ 라이트' : '◐ 다크';
}
function applySidebar() {
  document.body.classList.toggle('side-hidden', localStorage.getItem('holmz-side') === 'hidden');
}
document.getElementById('theme-toggle').onclick = () => {
  localStorage.setItem('holmz-theme',
    localStorage.getItem('holmz-theme') === 'dark' ? 'light' : 'dark');
  applyTheme();
};
document.getElementById('side-toggle').onclick = () => {
  localStorage.setItem('holmz-side',
    localStorage.getItem('holmz-side') === 'hidden' ? 'shown' : 'hidden');
  applySidebar();
};
applyTheme();
applySidebar();

// 로컬(매장) 시간대 기준 YYYY-MM-DD. toISOString은 UTC라 자정~오전 9시(KST)에 전날이 나온다.
const localDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayStr = () => localDateStr(new Date());
const fmtTime = (rfc3339) => rfc3339 ? new Date(rfc3339).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function selectedEmployee() {
  if (session?.role !== 'employee') return null;
  return employees.find(e => e.id === session.employeeId)
    || { id: session.employeeId, name: session.employeeName };
}

async function refreshEmployees() {
  employees = (await api().ListEmployees(true)) || [];
  const sel = document.getElementById('employee-select');
  const prev = sel.value;
  sel.innerHTML = employees.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
  if (prev && employees.some(e => String(e.id) === prev)) sel.value = prev;
}

// --- 공통 모달 ---
function showModal(html) {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(ov);
  return ov;
}

// --- 접속 세션 ---
// 앱 시작 시 이름+학번(직원) 또는 이름+PIN(관리자)으로 로그인한다.
let session = null; // {role: 'admin'|'employee', employeeId, employeeName}
const verifiedEmployees = new Set();
let adminVerified = false;

function applySession() {
  document.body.classList.add('authed');
  const isAdmin = session.role === 'admin';
  // 관리자: 근무자용 메뉴 숨김 / 근무자: 관리자 메뉴 숨김
  document.querySelectorAll('#nav [data-view^="admin-"], #nav .nav-sep')
    .forEach(el => { el.style.display = isAdmin ? '' : 'none'; });
  document.querySelectorAll('#nav [data-view="worklog"], #nav [data-view="checklist-open"], #nav [data-view="checklist-close"], #nav [data-view="sub-request"], #nav [data-view="player"]')
    .forEach(el => { el.style.display = isAdmin ? 'none' : ''; });
  if (!isAdmin) updateChecklistMenus();
  // 근무자 선택은 접속 정보로 대체되므로 항상 숨긴다
  document.querySelector('#topbar label.emp').style.display = 'none';
  document.getElementById('whoami').textContent =
    isAdmin ? '관리자' : `${session.employeeName} 님`;
  if (isAdmin) {
    adminVerified = true;
  } else {
    adminVerified = false;
    verifiedEmployees.add(session.employeeId);
  }
}

async function ensureEmployeeVerified() {
  const emp = selectedEmployee();
  if (!emp) { alert('근무자를 선택하세요.'); return null; }
  // 직원 접속이면 본인만 조작 가능하고 접속 시 이미 검증되었다.
  if (session?.role === 'employee') {
    return emp.id === session.employeeId ? emp : null;
  }
  // 관리자가 다른 근무자를 대신 조작할 때는 해당 직원의 학번을 확인한다.
  if (verifiedEmployees.has(emp.id)) return emp;
  if (!(await api().EmployeeNeedsVerify(emp.id))) { verifiedEmployees.add(emp.id); return emp; }
  const sid = prompt(`${emp.name} 님의 학번을 입력하세요.`);
  if (sid === null) return null;
  if (!(await api().VerifyEmployee(emp.id, sid))) { alert('학번이 일치하지 않습니다.'); return null; }
  verifiedEmployees.add(emp.id);
  return emp;
}

// 오픈/마감 체크리스트 메뉴는 관리자가 지정한 당일 오픈/마감 시각이 있을 때만,
// 각 시각 3시간 전부터 표시한다 (요일별로 지정이 없으면 그날은 숨김).
let todayOC = null;
async function updateChecklistMenus() {
  if (session?.role !== 'employee') return;
  try { todayOC = await api().TodayOpenClose(); } catch (e) { todayOC = null; }
  const nowHM = new Date().toTimeString().slice(0, 5);
  const visibleFrom = (hm) => {
    if (!hm) return false;
    const from = (Number(hm.slice(0, 2)) - 3 + 24) % 24;
    return nowHM >= `${String(from).padStart(2, '0')}:${hm.slice(3)}` || from > Number(hm.slice(0, 2));
  };
  const openVisible = todayOC?.open ? visibleFrom(todayOC.open) : false;
  const closeVisible = todayOC?.close ? visibleFrom(todayOC.close) : false;
  const openBtn = document.querySelector('#nav [data-view="checklist-open"]');
  const closeBtn = document.querySelector('#nav [data-view="checklist-close"]');
  if (openBtn) openBtn.style.display = openVisible ? '' : 'none';
  if (closeBtn) closeBtn.style.display = closeVisible ? '' : 'none';
}
setInterval(() => { if (session?.role === 'employee') updateChecklistMenus(); }, 60 * 1000);

async function ensureAdminVerified() {
  // 접속 시 역할이 정해지므로 별도 PIN 재입력은 없다.
  return session?.role === 'admin';
}

// --- 동작 피드백 토스트 (Apple HUD 스타일: 하단 중앙, 자동 사라짐) ---
let toastTimer = null;
function toast(msg, type = 'ok', ms = 2200) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = (type === 'ok' ? '✓ ' : '✕ ') + msg;
  el.classList.toggle('err', type === 'err');
  el.classList.remove('show');
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ok(msg, next)는 성공 토스트를 띄운 뒤 화면을 갱신하는 then 핸들러를 만든다.
const ok = (msg, next) => () => { toast(msg); return next(); };

function showError(err) {
  const msg = typeof err === 'string' ? err : (err?.message || String(err));
  toast(msg, 'err');
  const el = document.createElement('p');
  el.className = 'error';
  el.textContent = msg;
  $view.appendChild(el);
}

// --- 공지사항 팝업 (근무 시작 시) ---
async function showNoticeIfAny() {
  let text = '';
  try { text = await api().GetNotice(); } catch (e) { }
  if (!text || !text.trim()) return;
  const ov = showModal(`
    <h3>📢 공지사항</h3>
    <pre>${esc(text)}</pre>
    <div class="actions"><button class="small primary" id="notice-ok">확인</button></div>`);
  ov.querySelector('#notice-ok').onclick = () => ov.remove();
}

// --- 정각 업무 기록 알림 ---
// 근무 중(출근 상태)이면 매 정각에 작은 알림을 띄워 해당 시간의 업무를 선택하게 한다.
let lastHourKey = '';


setInterval(async () => {
  const now = new Date();
  if (now.getMinutes() !== 0) return;
  const key = `${todayStr()}-${now.getHours()}`;
  if (key === lastHourKey) return;
  const emp = selectedEmployee();
  if (!emp) return;
  let cur = null;
  try { cur = await api().CurrentShift(emp.id); } catch (e) { return; }
  if (!cur) return;
  lastHourKey = key;
  api().ShowWindow();
  const hh = String(now.getHours()).padStart(2, '0');
  toast(`${hh}:00 입니다. 근무 내용을 기록해주세요.`, 'ok', 8000);
  if (currentView === 'worklog') renderWorklog();
}, 20 * 1000);

// --- 화면 렌더러 ---

function elapsedSince(rfc3339) {
  const ms = Date.now() - new Date(rfc3339).getTime();
  if (ms < 0) return '0:00';
  const h = Math.floor(ms / 3600e3), m = Math.floor(ms % 3600e3 / 60e3);
  return `${h}:${String(m).padStart(2, '0')}`;
}

async function renderDashboard() {
  const emp = selectedEmployee();
  let cur = null;
  if (emp) cur = await api().CurrentShift(emp.id);
  const [open, close, playing, week] = await Promise.all([
    api().TodayChecklist('open'), api().TodayChecklist('close'), api().PlayerStatus(), api().WeekRoster()]);

  const shiftHtml = !emp
    ? ''
    : cur
      ? `<div style="display:flex;align-items:flex-end;gap:16px">
           <span class="big-num mono">${elapsedSince(cur.clockIn)}</span>
           <span class="hint" style="padding-bottom:4px">${esc(emp.name)} · ${fmtTime(cur.clockIn)} 출근</span>
         </div>`
      : `<p class="hint"><b style="color:var(--text)">${esc(emp.name)}</b> — 근무 전 (출근 기록 없음)</p>`;

  const clLine = (v, label) => {
    const done = v.entries.filter(e => e.checked).length, total = v.entries.length;
    const pct = total ? Math.round(done / total * 100) : 0;
    return `<div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:500;margin-bottom:7px">
        <span>${label} 체크리스트</span>
        <span class="mono" style="color:${v.completed ? 'var(--ok-text)' : 'var(--muted2)'}">${done} / ${total}</span>
      </div>
      <div class="progress"><i class="${v.completed ? 'fill-ok' : ''}" style="width:${Math.max(pct, 2)}%"></i></div>
    </div>`;
  };

  $view.innerHTML = `
    <h2>대시보드</h2>
    ${emp ? `<div class="card">
      <div class="card-head"><h3>오늘 근무</h3>
        ${cur ? '<span class="pill ok">근무중</span>' : '<span class="pill neu">근무 전</span>'}</div>
      ${shiftHtml}
    </div>` : ''}
    ${emp ? hourlyCard(cur) : `<div class="card">
      <div class="card-head"><h3>오픈 / 마감 상태</h3></div>
      ${clLine(open, '오픈')}${clLine(close, '마감')}
    </div>`}
    <div class="card">
      <div class="card-head"><h3>영상 재생</h3>
        ${playing ? '<span class="pill acc">▶ 재생 중</span>' : '<span class="pill neu">■ 정지됨</span>'}</div>
    </div>
    ${weekCard(week)}`;
}

// 근무자 대시보드: 본인 정각 업무 기록 진행 카드 (지나간 정각 중 기록한 비율)
function hourlyCard(cur) {
  if (!cur) {
    return `<div class="card">
      <div class="card-head"><h3>근무 기록 현황</h3><span class="pill neu">근무 전</span></div>
      <p class="hint">출근하면 시간대별 업무 기록 현황이 표시됩니다.</p>
    </div>`;
  }
  const missing = missedHours(cur);
  const start = new Date(cur.clockIn);
  const first = start.getHours() + (start.getMinutes() > 0 ? 1 : 0);
  const total = Math.max(new Date().getHours() - first + 1, 0);
  const done = total - missing.length;
  const pct = total ? Math.round(done / total * 100) : 100;
  return `<div class="card">
    <div class="card-head"><h3>근무 기록 현황</h3>
      <span class="mono" style="color:${missing.length ? 'var(--warn-text)' : 'var(--ok-text)'}">${done} / ${total}</span></div>
    <div class="progress"><i class="${missing.length ? '' : 'fill-ok'}" style="width:${Math.max(pct, 2)}%"></i></div>
    ${missing.length
      ? `<p class="hint" style="margin-top:10px">미기록: ${missing.map(h => `${String(h).padStart(2, '0')}:00`).join(', ')} — 근로기록 화면에서 기입하세요.</p>`
      : '<p class="hint" style="margin-top:10px">모든 시간대가 기록되었습니다. 👍</p>'}
  </div>`;
}

// 대시보드 "금주 근무 스케줄" 카드: 휴가·대타가 반영된 요일별 인원 + 오늘 근무 명단
function weekCard(week) {
  const todayDate = todayStr();
  const today = week.find(d => d.date === todayDate) || { entries: [], off: [] };
  return `<div class="card">
    <div class="card-head"><h3>금주 근무 스케줄</h3><span class="hint">휴가·대타 반영</span></div>
    <div class="day-cells">
      ${week.map(d => `
        <div class="day-cell ${d.date === todayDate ? 'today' : ''}">
          <div class="d">${DAY_LABELS[d.weekday]}</div>
          <div class="n mono">${d.entries.length ? d.entries.length + '명' : '—'}</div>
        </div>`).join('')}
    </div>
    ${today.entries.length || today.off.length ? `<div style="margin-top:12px;font-size:12px">
      ${today.entries.length ? `오늘: ${today.entries.map(s =>
        `<b>${esc(s.employeeName)}</b>${s.cover ? ' <span class="pill acc">대타</span>' : ''} <span class="mono hint">${s.start}–${s.end}</span>`).join(' · ')}` : ''}
      ${today.off.length ? `<div class="hint" style="margin-top:6px">휴가: ${today.off.map(esc).join(', ')}</div>` : ''}
    </div>` : ''}
  </div>`;
}

// 출근 이후 지나간 정각들 중 아직 기록([HH:00])이 없는 시각을 반환한다.
function missedHours(cur) {
  if (!cur) return [];
  const start = new Date(cur.clockIn);
  const now = new Date();
  const firstHour = start.getHours() + (start.getMinutes() > 0 ? 1 : 0);
  const out = [];
  for (let h = firstHour; h <= now.getHours(); h++) {
    const tag = `[${String(h).padStart(2, '0')}:00]`;
    if (!(cur.taskNotes || '').includes(tag)) out.push(h);
  }
  return out;
}

async function renderWorklog() {
  const emp = selectedEmployee();
  if (!emp) { $view.innerHTML = '<h2>근로기록</h2><p class="hint">근무자 계정으로 접속하세요.</p>'; return; }
  const cur = await api().CurrentShift(emp.id);
  let taskOptions = [];
  if (cur) { try { taskOptions = (await api().GetTaskOptions()) || []; } catch (e) { } }
  const missed = missedHours(cur);
  const nowHH = String(new Date().getHours()).padStart(2, '0');

  $view.innerHTML = `
    <h2>근로기록 — ${esc(emp.name)}</h2>
    <div class="card">
      <button id="btn-in" class="big-btn in" ${cur ? 'disabled' : ''}>출근</button>
      <button id="btn-out" class="big-btn out" ${cur ? '' : 'disabled'}>퇴근</button>
      ${cur ? `<p style="margin-top:12px">출근 시각: ${fmtTime(cur.clockIn)}</p>` : ''}
    </div>
    ${cur ? `
    <div class="card">
      <h3>업무 기록</h3>
      <p class="hint" style="margin:8px 0">업무 내용을 버튼으로 선택하고, 필요하면 비고를 적은 뒤 기록하세요.</p>
      ${taskOptions.length
        ? `<div class="chips" id="task-chips">${taskOptions.map(o =>
            `<button class="chip" data-task="${esc(o)}">${esc(o)}</button>`).join('')}</div>`
        : '<p class="hint">등록된 업무 항목이 없습니다. 관리자에게 설정(업무 항목) 등록을 요청하세요.</p>'}
      <div class="row" style="margin-top:12px">
        <input type="text" id="note-remark" placeholder="비고 (선택)" style="flex:1">
        <button id="btn-note" class="small primary" ${taskOptions.length ? '' : 'disabled'}>${nowHH}:00 기록</button>
      </div>
      ${missed.length ? `
      <div class="row" style="margin-top:6px">
        <span class="hint">놓친 정각 기록</span>
        <select id="missed-hour">${missed.map(h =>
          `<option value="${h}">${String(h).padStart(2, '0')}:00</option>`).join('')}</select>
        <button id="btn-missed" class="small" ${taskOptions.length ? '' : 'disabled'}>선택한 업무로 기입</button>
      </div>` : ''}
      <pre style="white-space:pre-wrap;margin-top:12px">${esc(cur.taskNotes || '')}</pre>
    </div>` : ''}
    <div class="card"><h3>전체 근로 이력 (최근 24시간)</h3><div id="my-history"></div></div>`;

  document.getElementById('btn-in').onclick = async () => {
    if (await ensureEmployeeVerified()) {
      api().ClockIn(emp.id).then(async () => {
        toast('출근이 기록되었습니다');
        await showNoticeIfAny();
        renderWorklog();
      }, showError);
    }
  };
  document.getElementById('btn-out').onclick = async () => {
    if (!confirm('퇴근 처리할까요? 총 근무시간이 확정됩니다.')) return;
    if (await ensureEmployeeVerified()) api().ClockOut(emp.id).then(ok('퇴근이 기록되었습니다', renderWorklog), showError);
  };

  // 업무 버튼: 하나만 선택
  let selectedTask = '';
  document.querySelectorAll('#task-chips .chip').forEach(c => c.onclick = () => {
    selectedTask = c.dataset.task;
    document.querySelectorAll('#task-chips .chip').forEach(x => x.classList.toggle('active', x === c));
  });

  // 선택한 업무를 [HH:00] 행으로 기록하고, 비고는 같은 행의 비고로 붙는다.
  const recordAt = async (hh) => {
    if (!selectedTask) { toast('업무 내용을 먼저 선택하세요.', 'err'); return; }
    if (!(await ensureEmployeeVerified())) return;
    try {
      await api().AddNote(emp.id, `[${hh}:00] ${selectedTask}`);
      const remark = document.getElementById('note-remark').value.trim();
      if (remark) await api().AddNote(emp.id, remark);
      toast(`${hh}:00 ${selectedTask} 기록되었습니다`);
      renderWorklog();
    } catch (err) { showError(err); }
  };
  const btnNote = document.getElementById('btn-note');
  if (btnNote) btnNote.onclick = () => recordAt(nowHH);
  const btnMissed = document.getElementById('btn-missed');
  if (btnMissed) btnMissed.onclick = () =>
    recordAt(String(document.getElementById('missed-hour').value).padStart(2, '0'));

  // 전체 근무자의 최근 24시간 이력
  const from = localDateStr(new Date(Date.now() - 86400e3));
  const logs = ((await api().WorkLogHistory(from, todayStr(), 0)) || [])
    .filter(w => new Date(w.clockIn).getTime() >= Date.now() - 86400e3);
  document.getElementById('my-history').innerHTML = historyTable(logs);
}

function historyTable(logs) {
  if (!logs.length) return '<p>기록이 없습니다.</p>';
  return `<table><tr><th>날짜</th><th>직원</th><th>출근</th><th>퇴근</th><th>근무시간</th><th>업무내용</th><th>동기화</th></tr>
    ${logs.map(w => `<tr><td>${w.date}</td><td>${esc(w.employeeName)}</td><td>${fmtTime(w.clockIn)}</td>
      <td>${fmtTime(w.clockOut)}</td><td>${w.totalHours || '-'}</td><td>${esc(w.taskNotes)}</td>
      <td><span class="status-badge ${w.syncStatus === 'synced' ? 'synced' : ''}">${w.syncStatus === 'synced' ? '동기화됨' : '대기'}</span></td></tr>`).join('')}</table>`;
}

async function renderChecklist(type) {
  const label = type === 'open' ? '오픈' : '마감';
  const view = await api().TodayChecklist(type);
  $view.innerHTML = `
    <h2>${label} 체크리스트 — ${view.date}</h2>
    ${view.completed ? `<div class="done-banner">✅ ${label} 완료 — ${fmtTime(view.completedAt)} (${esc(view.completedBy)})</div>` : ''}
    <div id="cl-items"></div>
    <button id="btn-complete" class="big-btn in" ${view.completed ? 'disabled' : ''}>${label} 완료 처리</button>`;
  const wrap = document.getElementById('cl-items');
  wrap.innerHTML = view.entries.map(e => `
    <div class="check-item" data-entry="${e.id}">
      <input type="checkbox" data-id="${e.id}" ${e.checked ? 'checked' : ''} ${view.completed ? 'disabled' : ''}>
      <span>${esc(e.name)}</span>
      ${e.required ? '<span class="req">필수</span>' : ''}
      <span class="meta">${e.checked ? `${fmtTime(e.checkedAt)} · ${esc(e.checkedBy)}` : ''}</span>
      ${view.completed ? '' : `<button class="small" data-photo-attach="${e.id}">📷 사진</button>`}
      ${e.photoPath ? `<button class="small" data-photo-view="${e.id}" data-path="${esc(e.photoPath)}">보기</button>` : ''}
      ${e.photoPath && !view.completed ? `<button class="small danger" data-photo-del="${e.id}" data-path="${esc(e.photoPath)}">사진 삭제</button>` : ''}
    </div>
    <div class="photo-box" id="photo-${e.id}"></div>`).join('') ||
    '<p>등록된 항목이 없습니다. 관리자 메뉴에서 항목을 추가하세요.</p>';

  wrap.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.onchange = async () => {
      const verified = await ensureEmployeeVerified();
      if (!verified) { cb.checked = !cb.checked; return; }
      api().CheckItem(Number(cb.dataset.id), cb.checked, verified.name).then(() => renderChecklist(type), showError);
    };
  });
  wrap.querySelectorAll('[data-photo-attach]').forEach(b => b.onclick = async () => {
    if (!(await ensureEmployeeVerified())) return;
    api().AttachChecklistPhoto(Number(b.dataset.photoAttach))
      .then(path => { if (path) { toast('사진이 첨부되었습니다'); renderChecklist(type); } }, showError);
  });
  wrap.querySelectorAll('[data-photo-view]').forEach(b => b.onclick = () => {
    const box = document.getElementById(`photo-${b.dataset.photoView}`);
    if (box.innerHTML) { box.innerHTML = ''; return; }
    api().PhotoDataURL(b.dataset.path)
      .then(url => { box.innerHTML = `<img src="${url}" alt="첨부 사진">`; }, showError);
  });
  wrap.querySelectorAll('[data-photo-del]').forEach(b => b.onclick = async () => {
    if (!(await ensureEmployeeVerified())) return;
    if (confirm('첨부 사진을 삭제할까요?')) {
      api().RemoveChecklistPhoto(Number(b.dataset.photoDel), b.dataset.path)
        .then(ok('사진이 삭제되었습니다', () => renderChecklist(type)), showError);
    }
  });
  document.getElementById('btn-complete').onclick = async () => {
    const verified = await ensureEmployeeVerified();
    if (!verified) return;
    api().CompleteChecklist(type, verified.name).then(ok(label + ' 완료 처리되었습니다', () => renderChecklist(type)), showError);
  };
}

async function renderAdminWorklog() {
  $view.innerHTML = `
    <h2>근로기록 관리</h2>
    <div class="card row">
      <input type="date" id="f-from" value="${localDateStr(new Date(Date.now() - 7 * 86400e3))}">
      <input type="date" id="f-to" value="${todayStr()}">
      <select id="f-emp"><option value="0">전체 직원</option>
        ${employees.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select>
      <button id="f-go" class="small primary">조회</button>
    </div>
    <div id="admin-history"></div>`;
  const load = async () => {
    const logs = (await api().WorkLogHistory(
      document.getElementById('f-from').value,
      document.getElementById('f-to').value,
      Number(document.getElementById('f-emp').value))) || [];
    document.getElementById('admin-history').innerHTML = historyTable(logs);
  };
  document.getElementById('f-go').onclick = load;
  await load();
}

async function renderAdminChecklist() {
  const render = async () => {
    const [open, close] = await Promise.all([api().ChecklistTemplates('open'), api().ChecklistTemplates('close')]);
    const section = (typ, label, list) => `
      <div class="card">
        <h3>${label} 항목</h3>
        <table><tr><th style="width:70px">순서</th><th>항목명</th><th style="width:70px">필수</th><th style="width:175px"></th></tr>
        ${(list || []).map(t => `<tr data-tpl="${t.id}" data-type="${typ}">
          <td><input type="number" data-field="order" value="${t.sortOrder}" style="width:60px"></td>
          <td><input type="text" data-field="name" value="${esc(t.name)}" style="width:100%"></td>
          <td><input type="checkbox" data-field="required" ${t.required ? 'checked' : ''}></td>
          <td><button class="small primary" data-save="${t.id}">저장</button>
              <button class="small danger" data-del="${t.id}">삭제</button></td></tr>`).join('')}</table>
        <div class="row" style="margin-top:10px">
          <input type="number" id="ord-${typ}" placeholder="순서" style="width:70px" value="${(list?.length || 0) + 1}">
          <input type="text" id="name-${typ}" placeholder="항목명" style="flex:1">
          <label><input type="checkbox" id="req-${typ}"> 필수</label>
          <button class="small primary" data-add="${typ}">추가</button>
        </div>
      </div>`;
    $view.innerHTML = `<h2>체크리스트 관리</h2>
      <p class="hint" style="margin-bottom:12px">
        항목명·순서·필수 여부를 고친 뒤 [저장]을 누르세요. 변경은 다음에 생성되는 체크리스트부터 적용됩니다(이미 만들어진 오늘 체크리스트는 유지).</p>
      ${section('open', '오픈', open)}${section('close', '마감', close)}`;
    $view.querySelectorAll('[data-save]').forEach(b => b.onclick = () => {
      const row = b.closest('tr');
      const name = row.querySelector('[data-field=name]').value.trim();
      if (!name) { alert('항목명을 입력하세요.'); return; }
      api().UpdateChecklistTemplate({
        id: Number(row.dataset.tpl),
        type: row.dataset.type,
        name,
        sortOrder: Number(row.querySelector('[data-field=order]').value || 0),
        required: row.querySelector('[data-field=required]').checked,
        active: true,
      }).then(ok('저장되었습니다', render), showError);
    });
    $view.querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
      const typ = b.dataset.add;
      const name = document.getElementById(`name-${typ}`).value.trim();
      if (!name) return;
      api().AddChecklistTemplate(typ, name,
        Number(document.getElementById(`ord-${typ}`).value || 0),
        document.getElementById(`req-${typ}`).checked).then(ok('추가되었습니다', render), showError);
    });
    $view.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      if (confirm('이 항목을 삭제할까요?')) api().RemoveChecklistTemplate(Number(b.dataset.del)).then(ok('삭제되었습니다', render), showError);
    });
  };
  await render();
}

async function renderAdminEmployees() {
  const render = async () => {
    const all = (await api().ListEmployees(true)) || [];
    $view.innerHTML = `
      <h2>직원 관리</h2>
      <div class="card">
        <table><tr><th>이름</th><th>학번</th><th>학과</th><th style="width:175px"></th></tr>
        ${all.map(e => `<tr data-emp="${e.id}">
          <td><input type="text" data-f="name" value="${esc(e.name)}" style="width:100%"></td>
          <td><input type="text" data-f="sid" value="${esc(e.studentId)}" style="width:100%"></td>
          <td><input type="text" data-f="dept" value="${esc(e.department)}" style="width:100%"></td>
          <td><button class="small primary" data-save="${e.id}">저장</button>
              <button class="small danger" data-del="${e.id}">삭제</button></td></tr>`).join('')}</table>
        <div class="row" style="margin-top:10px">
          <input type="text" id="emp-name" placeholder="이름">
          <input type="text" id="emp-sid" placeholder="학번">
          <input type="text" id="emp-dept" placeholder="학과">
          <button id="emp-add" class="small primary">직원 추가</button>
        </div>
        <p class="hint" style="margin-top:8px">학번은 출퇴근·체크리스트 작성 시 본인 확인에 사용됩니다.</p>
      </div>`;
    document.getElementById('emp-add').onclick = () => {
      const name = document.getElementById('emp-name').value.trim();
      if (!name) { alert('이름을 입력하세요.'); return; }
      api().AddEmployee(name,
        document.getElementById('emp-sid').value.trim(),
        document.getElementById('emp-dept').value.trim())
        .then(async () => { toast('직원이 추가되었습니다'); await refreshEmployees(); await render(); }, showError);
    };
    $view.querySelectorAll('[data-save]').forEach(b => b.onclick = () => {
      const row = b.closest('tr');
      const id = Number(row.dataset.emp);
      verifiedEmployees.delete(id);
      api().UpdateEmployee({
        id,
        name: row.querySelector('[data-f=name]').value.trim(),
        studentId: row.querySelector('[data-f=sid]').value.trim(),
        department: row.querySelector('[data-f=dept]').value.trim(),
        active: true,
      }).then(async () => { toast('저장되었습니다'); await refreshEmployees(); await render(); }, showError);
    });
    $view.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      if (!confirm('이 직원을 목록에서 삭제할까요? (기존 근로기록은 보존됩니다)')) return;
      api().DeleteEmployee(Number(b.dataset.del))
        .then(async () => { toast('삭제되었습니다'); await refreshEmployees(); await render(); }, showError);
    });
  };
  await render();
}

const ACTION_LABELS = {
  'notify-open': '오픈 체크리스트 알림',
  'notify-close': '마감 체크리스트 알림',
  'upload': '근로기록 업로드',
  'play-start': '영상 재생 시작',
  'play-stop': '영상 재생 종료',
  'play-audio': '음성 재생 (안내방송)',
};

// --- 안내방송 재생 ---
let announceAudio = null;
async function playAudioPath(path) {
  if (!path) return;
  try {
    const url = await api().AudioDataURL(path);
    if (announceAudio) announceAudio.pause();
    announceAudio = new Audio(url);
    await announceAudio.play();
  } catch (err) {
    console.error('안내방송 재생 실패', err);
  }
}
const fileBaseName = (p) => String(p || '').split(/[\\/]/).pop();
const DAY_LABELS = { MON: '월', TUE: '화', WED: '수', THU: '목', FRI: '금', SAT: '토', SUN: '일' };

const todayWeekday = () => ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date().getDay()];

// 정시 단위(00~23시) 시간 선택 옵션
const hourOptions = (selected) => Array.from({ length: 24 }, (_, h) => {
  const v = `${String(h).padStart(2, '0')}:00`;
  return `<option value="${v}" ${v === selected ? 'selected' : ''}>${h}시</option>`;
}).join('');

async function renderAdminShifts() {
  const render = async () => {
    const [week, emps, totals, overrides] = (await Promise.all([
      api().ShiftWeek(), api().ListEmployees(true), api().ShiftWeekTotals(), api().ShiftOverrides()]))
      .map(v => v || []);
    const today = todayWeekday();
    const maxHours = Math.max(...totals.map(t => t.hours), 1);
    $view.innerHTML = `
      <h2>근로 스케줄</h2>
      <p class="hint" style="margin-bottom:12px">직원별 주간 근무 배치입니다. 자동화 작업(스케줄 관리)과는 별개입니다.</p>
      <div class="week-grid" style="margin-bottom:16px">
        ${week.map(d => `
          <div class="day-col ${d.weekday === today ? 'today' : ''}">
            <div class="day-head">${DAY_LABELS[d.weekday]}</div>
            ${d.shifts.map(s => `
              <div class="shift-chip">
                <span><b>${esc(s.employeeName)}</b><br><span class="mono">${s.start}–${s.end}</span></span>
                <button class="del" data-del-shift="${s.id}" title="삭제">✕</button>
              </div>`).join('')}
          </div>`).join('')}
      </div>
      <div class="card">
        <h3>배치 목록 (수정·삭제)</h3>
        ${week.some(d => d.shifts.length) ? `
        <table><tr><th>직원</th><th>요일</th><th>시작</th><th>종료</th><th style="width:175px"></th></tr>
        ${week.flatMap(d => d.shifts).map(sh => `<tr data-shift="${sh.id}">
          <td><select data-f="emp">${emps.map(e =>
            `<option value="${e.id}" ${e.id === sh.employeeId ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></td>
          <td><select data-f="day">${Object.entries(DAY_LABELS).map(([v, l]) =>
            `<option value="${v}" ${v === sh.weekday ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
          <td><input type="text" data-f="start" value="${sh.start}" style="width:76px"></td>
          <td><input type="text" data-f="end" value="${sh.end}" style="width:76px"></td>
          <td><button class="small primary" data-save-shift="${sh.id}">저장</button>
              <button class="small danger" data-del-shift2="${sh.id}">삭제</button></td></tr>`).join('')}</table>`
        : '<p class="hint">등록된 배치가 없습니다.</p>'}
      </div>
      <div class="card">
        <h3>배치 추가</h3>
        <div class="row" style="margin-top:12px">
          <select id="sh-emp">${emps.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select>
          <span id="sh-days">${Object.entries(DAY_LABELS).map(([v, l]) =>
            `<label style="margin-right:4px"><input type="checkbox" value="${v}">${l}</label>`).join('')}</span>
          <select id="sh-start">${hourOptions('09:00')}</select>
          <span class="hint">–</span>
          <select id="sh-end">${hourOptions('18:00')}</select>
          <button id="sh-add" class="small primary">추가</button>
        </div>
        <p class="hint" style="margin-top:8px">시간은 정시 단위로 지정합니다. 요일을 여러 개 선택하면 같은 시간으로 한 번에 등록됩니다.</p>
      </div>
      <div class="card">
        <div class="card-head"><h3>이번 주 직원별 배치 시간</h3><span class="hint">휴가·대타 반영</span></div>
        ${totals.length ? totals.map(t => `
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
            <span style="width:64px;font-size:12px">${esc(t.name)}</span>
            <div class="progress" style="flex:1;height:8px"><i style="width:${Math.round(t.hours / maxHours * 100)}%"></i></div>
            <span class="mono hint" style="width:48px;text-align:right">${t.hours}h</span>
          </div>`).join('') : '<p class="hint">배치가 없습니다.</p>'}
      </div>
      <div class="card">
        <div class="card-head"><h3>예외 (휴가 · 대타 · 추가 근무)</h3><span class="hint">향후 90일</span></div>
        ${overrides.length ? `<table style="margin-bottom:12px">
          <tr><th>날짜</th><th>내용</th><th>유형</th><th>시간</th><th>메모</th><th></th></tr>
          ${overrides.map(o => `<tr>
            <td class="mono">${o.date}</td>
            <td>${esc(o.employeeName)}${o.type === 'sub' ? ` → <b>${esc(o.coverName)}</b>` : ''}</td>
            <td>${o.type === 'off' ? '<span class="pill warn">휴가</span>'
              : o.type === 'sub' ? '<span class="pill acc">대타</span>'
              : '<span class="pill neu">추가</span>'}</td>
            <td class="mono">${o.type === 'off' ? '—' : `${o.start}–${o.end}`}</td>
            <td class="hint">${esc(o.note)}</td>
            <td><button class="small danger" data-del-ov="${o.id}">삭제</button></td></tr>`).join('')}</table>`
        : '<p class="hint" style="margin-bottom:12px">등록된 예외가 없습니다.</p>'}
        <div class="row">
          <input type="date" id="ov-date" value="${todayStr()}">
          <select id="ov-emp" title="대상 직원">${emps.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select>
          <select id="ov-type">
            <option value="off">휴가 (해당일 근무 제외)</option>
            <option value="sub">대타 (근무 변경)</option>
            <option value="work">추가 근무</option>
          </select>
          <span id="ov-cover-wrap" style="display:none">→
            <select id="ov-cover" title="대신 근무할 직원">${emps.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select>
          </span>
          <select id="ov-start" disabled>${hourOptions('10:00')}</select>
          <span class="hint">–</span>
          <select id="ov-end" disabled>${hourOptions('16:00')}</select>
          <input type="text" id="ov-note" placeholder="메모 (선택)" style="flex:1">
          <button id="ov-add" class="small primary">추가</button>
        </div>
        <p class="hint" style="margin-top:8px">대타: 해당 시간 구간을 다른 직원이 대신 근무합니다 (원래 근무자의 나머지 시간은 유지).</p>
      </div>`;
    document.getElementById('sh-add').onclick = async () => {
      const empId = Number(document.getElementById('sh-emp').value || 0);
      const days = [...document.querySelectorAll('#sh-days input:checked')].map(c => c.value);
      const start = document.getElementById('sh-start').value.trim();
      const end = document.getElementById('sh-end').value.trim();
      if (!empId || !days.length) { alert('직원과 요일을 선택하세요.'); return; }
      try {
        for (const d of days) await api().AddShift(empId, d, start, end);
        toast('배치가 추가되었습니다');
        await render();
      } catch (err) { showError(err); }
    };
    $view.querySelectorAll('[data-del-shift]').forEach(b => b.onclick = () => {
      api().DeleteShift(Number(b.dataset.delShift)).then(ok('삭제되었습니다', render), showError);
    });
    $view.querySelectorAll('[data-del-shift2]').forEach(b => b.onclick = () => {
      if (confirm('이 배치를 삭제할까요?')) {
        api().DeleteShift(Number(b.dataset.delShift2)).then(ok('삭제되었습니다', render), showError);
      }
    });
    $view.querySelectorAll('[data-save-shift]').forEach(b => b.onclick = () => {
      const row = b.closest('tr');
      api().UpdateShift(
        Number(row.dataset.shift),
        Number(row.querySelector('[data-f=emp]').value),
        row.querySelector('[data-f=day]').value,
        row.querySelector('[data-f=start]').value.trim(),
        row.querySelector('[data-f=end]').value.trim(),
      ).then(ok('저장되었습니다', render), showError);
    });
    const ovType = document.getElementById('ov-type');
    const syncOvTimeInputs = () => {
      const needsTime = ovType.value !== 'off';
      document.getElementById('ov-start').disabled = !needsTime;
      document.getElementById('ov-end').disabled = !needsTime;
      document.getElementById('ov-cover-wrap').style.display =
        ovType.value === 'sub' ? 'inline-flex' : 'none';
    };
    ovType.onchange = syncOvTimeInputs;
    document.getElementById('ov-add').onclick = () => {
      api().AddShiftOverride(
        Number(document.getElementById('ov-emp').value || 0),
        document.getElementById('ov-date').value,
        ovType.value,
        document.getElementById('ov-start').value,
        document.getElementById('ov-end').value,
        document.getElementById('ov-note').value.trim(),
        ovType.value === 'sub' ? Number(document.getElementById('ov-cover').value || 0) : 0,
      ).then(ok('예외가 등록되었습니다', render), showError);
    };
    $view.querySelectorAll('[data-del-ov]').forEach(b => b.onclick = () => {
      api().DeleteShiftOverride(Number(b.dataset.delOv)).then(ok('삭제되었습니다', render), showError);
    });
  };
  await render();
}

async function renderAdminSchedule() {
  const render = async () => {
    const list = (await api().ListSchedules()) || [];
    $view.innerHTML = `
      <h2>스케줄 관리</h2>
      <div class="card">
        <h3>자동화 템플릿</h3>
        <p class="hint" style="margin:8px 0">
          오픈 시각: 체크리스트 알림 + 영상 재생 시작 / 마감 시각: 체크리스트 알림 + 근로기록 업로드 + 영상 재생 종료</p>
        <div class="row">
          <label>오픈 <input type="text" id="tpl-open" value="09:00" style="width:80px"></label>
          <label>마감 <input type="text" id="tpl-close" value="22:00" style="width:80px"></label>
          <button id="tpl-apply" class="small primary">템플릿 적용</button>
        </div>
      </div>
      <div class="card">
        <h3>등록된 스케줄</h3>
        <table><tr><th>작업명</th><th>시각</th><th>요일</th><th>동작</th><th>활성</th><th></th></tr>
        ${list.map(s => `<tr>
          <td>${esc(s.taskName)}</td><td>${s.runTime}</td>
          <td>${(s.repeatDays && s.repeatDays.length) ? s.repeatDays.map(d => DAY_LABELS[d] || d).join(',') : '매일'}</td>
          <td>${ACTION_LABELS[s.actionType] || s.actionType}${s.actionType === 'play-audio'
            ? `<div class="hint">${esc(fileBaseName(s.payload))}${s.repeat > 1 ? ` × ${s.repeat}회` : ''}</div>` : ''}</td>
          <td><input type="checkbox" data-toggle="${s.id}" ${s.active ? 'checked' : ''}></td>
          <td>${s.actionType === 'play-audio'
            ? `<button class="small" data-test-audio="${esc(s.payload)}" title="미리듣기">▶ 테스트</button> ` : ''}
            <button class="small danger" data-del="${s.id}">삭제</button></td></tr>`).join('')}</table>
        <div class="row" style="margin-top:10px">
          <input type="text" id="sc-name" placeholder="작업명">
          <input type="text" id="sc-time" placeholder="HH:MM" style="width:80px">
          <select id="sc-action">${Object.entries(ACTION_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
          <span id="sc-audio-wrap" style="display:none">
            <button id="sc-audio-pick" class="small">🔊 음성 파일 선택</button>
            <span id="sc-audio-name" class="hint"></span>
            <label>재생 <input type="number" id="sc-repeat" min="1" max="5" value="1" style="width:56px">회</label>
          </span>
          <span id="sc-days">${Object.entries(DAY_LABELS).map(([v, l]) =>
            `<label style="margin-right:4px"><input type="checkbox" value="${v}">${l}</label>`).join('')}</span>
          <button id="sc-add" class="small primary">추가</button>
        </div>
        <p class="hint" style="margin-top:8px">요일 미선택 시 매일 실행. Windows 작업 스케줄러 등록에는 관리자 권한이 필요할 수 있습니다.</p>
      </div>`;
    document.getElementById('tpl-apply').onclick = () =>
      api().ApplyScheduleTemplate(document.getElementById('tpl-open').value, document.getElementById('tpl-close').value)
        .then(ok('자동화 템플릿 5건이 등록되었습니다', render), showError);
    let audioPayload = '';
    const scAction = document.getElementById('sc-action');
    scAction.onchange = () => {
      document.getElementById('sc-audio-wrap').style.display =
        scAction.value === 'play-audio' ? 'inline-flex' : 'none';
    };
    document.getElementById('sc-audio-pick').onclick = () => {
      api().PickAudioFile().then(path => {
        if (path) {
          audioPayload = path;
          document.getElementById('sc-audio-name').textContent = fileBaseName(path);
        }
      }, showError);
    };
    document.getElementById('sc-add').onclick = () => {
      const name = document.getElementById('sc-name').value.trim();
      const time = document.getElementById('sc-time').value.trim();
      if (!name || !/^\d{2}:\d{2}$/.test(time)) { alert('작업명과 시각(HH:MM)을 입력하세요.'); return; }
      const days = [...document.querySelectorAll('#sc-days input:checked')].map(c => c.value);
      const isAudio = scAction.value === 'play-audio';
      const payload = isAudio ? audioPayload : '';
      const repeat = isAudio ? Number(document.getElementById('sc-repeat').value || 1) : 1;
      api().AddSchedule(name, time, days, scAction.value, payload, repeat).then(ok('스케줄이 등록되었습니다', render), showError);
    };
    $view.querySelectorAll('[data-test-audio]').forEach(b => b.onclick = () => playAudioPath(b.dataset.testAudio));
    $view.querySelectorAll('[data-toggle]').forEach(cb => cb.onchange = () =>
      api().ToggleSchedule(Number(cb.dataset.toggle), cb.checked).then(() => { toast(cb.checked ? '활성화되었습니다' : '비활성화되었습니다'); return render(); }, showError));
    $view.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      if (confirm('이 스케줄을 삭제할까요?')) api().DeleteSchedule(Number(b.dataset.del)).then(ok('삭제되었습니다', render), showError);
    });
  };
  await render();
}

// --- 영상 재생 (별도 팝업 창에서 재생, 이 화면은 리모컨 역할) ---
let playerFatalMsg = '';

async function renderAdminPlayer() {
  const isAdmin = session?.role === 'admin';
  const [items, playing] = await Promise.all([api().PlaylistItems(), api().PlayerStatus()]);
  $view.innerHTML = `
    <h2>영상 재생</h2>
    ${playerFatalMsg ? `<div class="fatal-banner">⚠️ ${esc(playerFatalMsg)}</div>` : ''}
    <div class="card">
      <div class="card-head"><h3>재생 제어</h3>
        ${playing ? '<span class="pill acc">▶ 재생 중 (팝업 창)</span>' : '<span class="pill neu">■ 정지됨</span>'}</div>
      <div class="row">
        <button id="pl-start" class="big-btn in" ${playing ? 'disabled' : ''}>팝업으로 재생 시작</button>
        <button id="pl-stop" class="big-btn out" ${playing ? '' : 'disabled'}>재생 종료</button>
      </div>
      <p class="hint" style="margin-top:8px">
        영상은 별도 재생 창에서 나옵니다. 창을 TV/보조 모니터로 옮기고 <b>더블클릭</b>하면 전체화면이 됩니다.
        재생 중에도 이 프로그램의 다른 화면을 자유롭게 사용할 수 있으며,
        오류·끊김은 워치독이 자동으로 재시작합니다 (창을 닫아도 다시 열립니다 — 종료는 [재생 종료]로).</p>
    </div>
    <div class="card">
      <h3>재생목록</h3>
      <table><tr><th>순서</th><th>제목</th><th>영상 ID</th><th></th></tr>
      ${(items || []).map(p => `<tr><td>${p.sortOrder}</td><td>${esc(p.title)}</td>
        <td>${esc(p.videoId)}</td><td>${isAdmin ? `<button class="small danger" data-del="${p.id}">삭제</button>` : ''}</td></tr>`).join('')}</table>
      ${isAdmin ? `<div class="row" style="margin-top:10px">
        <input type="text" id="pl-url" placeholder="YouTube 영상 URL" style="flex:1">
        <input type="text" id="pl-title" placeholder="제목(선택)">
        <button id="pl-add" class="small primary">추가</button>
      </div>` : ''}
    </div>`;
  document.getElementById('pl-start').onclick = async () => {
    if (!(items || []).length) { alert('재생목록이 비어 있습니다. 영상을 먼저 등록하세요.'); return; }
    playerFatalMsg = '';
    await api().StartPlayback();
    renderAdminPlayer();
  };
  document.getElementById('pl-stop').onclick = async () => { await api().StopPlayback(); renderAdminPlayer(); };
  const plAdd = document.getElementById('pl-add');
  if (plAdd) plAdd.onclick = () => {
    const url = document.getElementById('pl-url').value.trim();
    if (!url) return;
    api().AddPlaylistItem(url, document.getElementById('pl-title').value.trim())
      .then(ok('추가되었습니다', renderAdminPlayer), showError);
  };
  $view.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    if (confirm('재생목록에서 삭제할까요?')) api().RemovePlaylistItem(Number(b.dataset.del)).then(ok('삭제되었습니다', renderAdminPlayer), showError);
  });
}

async function renderAdminSettings() {
  const [authorized, notice, taskOptions, adminName] = await Promise.all([
    api().GoogleAuthorized(), api().GetNotice(), api().GetTaskOptions(), api().AdminName()]);
  $view.innerHTML = `
    <h2>설정 — Google 연동</h2>
    <div class="card">
      <h3>Google 계정 연동</h3>
      <p style="margin:8px 0">상태:
        <span class="status-badge">${authorized ? '연동됨' : '미연동'}</span></p>
      <p class="hint" style="margin:8px 0">
        Google Cloud Console에서 "데스크톱 앱" OAuth 클라이언트를 만들고,
        내려받은 credentials.json 을 <b>%APPDATA%\\HOLMZ\\credentials.json</b> 에 두세요.</p>
      <div class="row">
        <button id="btn-auth" class="small primary">Google 계정 인증</button>
      </div>
      <div id="auth-result"></div>
    </div>
    <div class="card">
      <h3>근로기록 동기화</h3>
      <p class="hint" style="margin:8px 0">퇴근 완료된 미동기화 기록을 날짜별 스프레드시트로 업로드합니다. (마감 스케줄에서도 자동 실행)</p>
      <button id="btn-sync" class="small primary" ${authorized ? '' : 'disabled'}>지금 동기화</button>
      <div id="sync-result"></div>
    </div>
    <div class="card">
      <h3>관리자 계정</h3>
      <p class="hint" style="margin:8px 0">
        앱 접속 화면에서 이 이름과 PIN으로 관리자 로그인합니다. 초기 계정은 admin / 0000000000이니 반드시 변경하세요.
        비워둔 항목은 그대로 유지됩니다.</p>
      <div class="row">
        <input type="password" id="pin-cur" placeholder="현재 PIN">
        <input type="text" id="admin-name-new" placeholder="관리자 이름" value="${esc(adminName)}">
        <input type="password" id="pin-new" placeholder="새 PIN">
        <button id="pin-save" class="small primary">저장</button>
      </div>
      <div id="pin-result"></div>
    </div>
    <div class="card">
      <h3>공지사항</h3>
      <p class="hint" style="margin:8px 0">근무자가 출근 버튼을 누르면 팝업으로 표시됩니다. 비워두면 표시되지 않습니다.</p>
      <textarea id="notice-text" rows="4">${esc(notice || '')}</textarea>
      <div class="row" style="margin-top:8px">
        <button id="notice-save" class="small primary">공지 저장</button><span id="notice-result" class="hint"></span>
      </div>
    </div>
    <div class="card">
      <h3>업무 항목 (정각 기록용)</h3>
      <p class="hint" style="margin:8px 0">근무 중 매 정각 알림에서 선택하는 업무 목록입니다. 한 줄에 하나씩 입력하세요.</p>
      <textarea id="tasks-text" rows="5">${esc((taskOptions || []).join('\n'))}</textarea>
      <div class="row" style="margin-top:8px">
        <button id="tasks-save" class="small primary">업무 항목 저장</button><span id="tasks-result" class="hint"></span>
      </div>
    </div>`;
  document.getElementById('notice-save').onclick = () => {
    api().SetNotice(document.getElementById('notice-text').value)
      .then(() => { document.getElementById('notice-result').textContent = '✅ 저장됨'; }, showError);
  };
  document.getElementById('tasks-save').onclick = () => {
    const lines = document.getElementById('tasks-text').value.split('\n').map(s => s.trim()).filter(Boolean);
    api().SetTaskOptions(lines)
      .then(() => { document.getElementById('tasks-result').textContent = '✅ 저장됨'; }, showError);
  };
  document.getElementById('pin-save').onclick = () => {
    api().SetAdminAccount(document.getElementById('pin-cur').value,
      document.getElementById('admin-name-new').value.trim(),
      document.getElementById('pin-new').value)
      .then(() => {
        document.getElementById('pin-result').innerHTML = '<p style="margin-top:8px">✅ 저장되었습니다.</p>';
        document.getElementById('pin-cur').value = '';
        document.getElementById('pin-new').value = '';
      }, err => { document.getElementById('pin-result').innerHTML = ''; showError(err); });
  };
  document.getElementById('btn-auth').onclick = () => {
    document.getElementById('auth-result').innerHTML = '<p style="margin-top:8px">브라우저에서 인증을 완료해주세요...</p>';
    api().GoogleAuthorize().then(renderAdminSettings, err => {
      document.getElementById('auth-result').innerHTML = '';
      showError(err);
    });
  };
  document.getElementById('btn-sync').onclick = () => {
    document.getElementById('sync-result').innerHTML = '<p style="margin-top:8px">동기화 중...</p>';
    api().SyncNow().then(res => {
      document.getElementById('sync-result').innerHTML =
        `<p style="margin-top:8px">✅ 근로기록 ${res.uploaded}건 업로드 · 직원/근무스케줄 갱신 완료</p>` +
        (res.master ? `<p style="font-size:12px"><a href="${res.master}" target="_blank">직원·근무스케줄 시트</a></p>` : '') +
        (res.sheets || []).map(u => `<p style="font-size:12px"><a href="${u}" target="_blank">${u}</a></p>`).join('');
    }, err => {
      document.getElementById('sync-result').innerHTML = '';
      showError(err);
    });
  };
}

// 근무자용 대타 신청: 본인 근무를 대신할 동료를 지정해 등록한다 (동료와 합의 후).
async function renderSubRequest() {
  const me = selectedEmployee();
  if (!me) { $view.innerHTML = '<h2>대타 신청</h2><p class="hint">근무자 계정으로 접속하세요.</p>'; return; }
  const render = async () => {
    const [emps, overrides] = (await Promise.all([api().ListEmployees(true), api().ShiftOverrides()])).map(v => v || []);
    const others = emps.filter(e => e.id !== me.id);
    const mine = overrides.filter(o => o.type === 'sub' && (o.employeeId === me.id || o.coverEmployeeId === me.id));
    $view.innerHTML = `
      <h2>대타 신청</h2>
      <div class="card">
        <h3>신청하기</h3>
        <p class="hint" style="margin:8px 0">대신 근무할 동료와 합의한 뒤 등록하세요. 해당 시간은 스케줄에서 동료 근무로 바뀝니다.</p>
        <div class="row">
          <input type="date" id="sub-date" value="${todayStr()}">
          <input type="text" id="sub-start" placeholder="09:00" style="width:80px">
          <span class="hint">–</span>
          <input type="text" id="sub-end" placeholder="13:00" style="width:80px">
          <select id="sub-cover">${others.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select>
          <input type="text" id="sub-note" placeholder="사유 (선택)" style="flex:1">
          <button id="sub-add" class="small primary" ${others.length ? '' : 'disabled'}>신청</button>
        </div>
      </div>
      <div class="card">
        <h3>내 대타 내역</h3>
        ${mine.length ? `<table>
          <tr><th>날짜</th><th>시간</th><th>내용</th><th>사유</th><th style="width:110px"></th></tr>
          ${mine.map(o => `<tr>
            <td class="mono">${o.date}</td><td class="mono">${o.start}–${o.end}</td>
            <td>${esc(o.employeeName)} → <b>${esc(o.coverName)}</b>${o.coverEmployeeId === me.id ? ' <span class="pill acc">내가 대타</span>' : ''}</td>
            <td class="hint">${esc(o.note)}</td>
            <td>${o.employeeId === me.id ? `<button class="small danger" data-cancel-ov="${o.id}">취소</button>` : ''}</td></tr>`).join('')}
        </table>` : '<p class="hint">등록된 대타 내역이 없습니다.</p>'}
      </div>`;
    document.getElementById('sub-add').onclick = () => {
      api().AddShiftOverride(
        me.id,
        document.getElementById('sub-date').value,
        'sub',
        document.getElementById('sub-start').value.trim(),
        document.getElementById('sub-end').value.trim(),
        document.getElementById('sub-note').value.trim(),
        Number(document.getElementById('sub-cover').value || 0),
      ).then(ok('대타 신청이 등록되었습니다', render), showError);
    };
    $view.querySelectorAll('[data-cancel-ov]').forEach(b => b.onclick = () => {
      if (confirm('이 대타 신청을 취소할까요?')) {
        api().DeleteShiftOverride(Number(b.dataset.cancelOv)).then(ok('취소되었습니다', render), showError);
      }
    });
  };
  await render();
}

// 안내 방송: 텍스트를 입력하면 Windows 내장 TTS로 즉시 매장에 송출한다.
const recentAnnounces = [];
async function renderAnnounce() {
  const speaking = await api().AnnounceSpeaking();
  $view.innerHTML = `
    <h2>안내 방송</h2>
    <div class="card">
      <div class="card-head"><h3>방송 문구</h3>
        ${speaking ? '<span class="pill acc">📢 방송 중</span>' : '<span class="pill neu">대기</span>'}</div>
      <textarea id="ann-text" rows="4" placeholder="예) 4층 열람실이 30분 후 마감됩니다. 정리 부탁드립니다." style="width:100%"></textarea>
      <div class="row" style="margin-top:12px">
        <label>속도
          <select id="ann-rate">
            <option value="-2">느리게</option>
            <option value="0" selected>보통</option>
            <option value="2">빠르게</option>
          </select>
        </label>
        <button id="ann-play" class="big-btn in">📢 방송 시작</button>
        <button id="ann-stop" class="big-btn out" ${speaking ? '' : 'disabled'}>중지</button>
      </div>
      <p class="hint" style="margin-top:8px">한국어/영어는 자동 인식됩니다. 새 방송을 시작하면 진행 중인 방송은 중단됩니다.</p>
    </div>
    ${recentAnnounces.length ? `<div class="card">
      <h3>최근 방송</h3>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
        ${recentAnnounces.map((t, i) => `
          <div class="row" style="margin:0">
            <span style="flex:1;font-size:13px">${esc(t)}</span>
            <button class="small" data-replay="${i}">다시 방송</button>
          </div>`).join('')}
      </div>
    </div>` : ''}`;

  const startAnnounce = async (text) => {
    const rate = Number(document.getElementById('ann-rate').value || 0);
    try {
      await api().Announce(text, rate);
      if (!recentAnnounces.includes(text)) {
        recentAnnounces.unshift(text);
        if (recentAnnounces.length > 5) recentAnnounces.pop();
      }
      toast('방송을 시작했습니다');
      renderAnnounce();
    } catch (err) { showError(err); }
  };
  document.getElementById('ann-play').onclick = () => {
    const text = document.getElementById('ann-text').value.trim();
    if (!text) { toast('방송할 내용을 입력하세요.', 'err'); return; }
    startAnnounce(text);
  };
  document.getElementById('ann-stop').onclick = async () => {
    await api().StopAnnounce();
    toast('방송을 중지했습니다');
    renderAnnounce();
  };
  $view.querySelectorAll('[data-replay]').forEach(b => b.onclick = () =>
    startAnnounce(recentAnnounces[Number(b.dataset.replay)]));
}

const views = {
  'dashboard': renderDashboard,
  'worklog': renderWorklog,
  'checklist-open': () => renderChecklist('open'),
  'checklist-close': () => renderChecklist('close'),
  'sub-request': renderSubRequest,
  'player': renderAdminPlayer,
  'announce': renderAnnounce,
  'admin-worklog': renderAdminWorklog,
  'admin-shifts': renderAdminShifts,
  'admin-checklist': renderAdminChecklist,
  'admin-schedule': renderAdminSchedule,
  'admin-player': renderAdminPlayer,
  'admin-employees': renderAdminEmployees,
  'admin-settings': renderAdminSettings,
};

// 스케줄 트리거(--action) 처리: 알림 동작은 해당 체크리스트 화면으로 이동한다.
function handleScheduleAction(action) {
  if (action === 'notify-open') navigate('checklist-open');
  else if (action === 'notify-close') navigate('checklist-close');
}

async function navigate(name, opts = {}) {
  if (name.startsWith('admin-') && !opts.skipAdminGate && !(await ensureAdminVerified())) return;
  currentView = name;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  try {
    await views[name]();
  } catch (err) {
    $view.innerHTML = `<h2>오류</h2>`;
    showError(err);
  }
}

document.querySelectorAll('#nav button[data-view]').forEach(b => b.onclick = () => navigate(b.dataset.view));
document.getElementById('employee-select').onchange = () => navigate(currentView);
document.getElementById('today').textContent = new Date().toLocaleDateString('ko-KR', { dateStyle: 'full' });

async function doLogin() {
  const name = document.getElementById('login-name').value.trim();
  const secret = document.getElementById('login-secret').value.trim();
  const errEl = document.getElementById('login-err');
  if (!name || !secret) return;
  try {
    const res = await api().Login(name, secret);
    if (!res) {
      errEl.textContent = '이름 또는 학번(PIN)이 일치하지 않습니다.';
      errEl.style.display = '';
      return;
    }
    session = res;
    errEl.style.display = 'none';
    document.getElementById('login-secret').value = '';
    await startApp();
  } catch (err) {
    errEl.textContent = err?.message || String(err);
    errEl.style.display = '';
  }
}

document.getElementById('login-btn').onclick = doLogin;
document.getElementById('login-secret').onkeydown = e => { if (e.key === 'Enter') doLogin(); };
document.getElementById('login-name').onkeydown = e => { if (e.key === 'Enter') document.getElementById('login-secret').focus(); };
document.getElementById('logout').onclick = () => location.reload();
document.getElementById('login-name').focus();

let eventsWired = false;
async function startApp() {
  await refreshEmployees();
  applySession();
  if (!eventsWired && window.runtime) {
    eventsWired = true;
    window.runtime.EventsOn('schedule:action', handleScheduleAction);
    // 재생은 팝업 창이 담당. 여기서는 상태 표시만 갱신한다.
    const refreshPlayerView = () => {
      if (currentView === 'admin-player') renderAdminPlayer();
      else if (currentView === 'dashboard') renderDashboard();
    };
    window.runtime.EventsOn('player:start', refreshPlayerView);
    window.runtime.EventsOn('player:stop', refreshPlayerView);
    window.runtime.EventsOn('player:fatal', msg => {
      playerFatalMsg = msg || '영상 재생을 복구하지 못했습니다.';
      refreshPlayerView();
    });
  }
  const startupAction = await api().GetStartupAction();
  await navigate('dashboard');
  if (startupAction) handleScheduleAction(startupAction);
}
