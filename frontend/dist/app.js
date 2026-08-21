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
  const sel = document.getElementById('employee-select');
  const id = Number(sel.value || 0);
  return employees.find(e => e.id === id) || null;
}

async function refreshEmployees() {
  employees = (await api().ListEmployees(true)) || [];
  const sel = document.getElementById('employee-select');
  const prev = sel.value;
  sel.innerHTML = employees.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
  if (prev && employees.some(e => String(e.id) === prev)) sel.value = prev;
}

// --- PIN 인증 ---
// 세션 동안 검증된 근무자·관리자 상태를 기억한다.
const verifiedEmployees = new Set();
let adminVerified = false;

async function ensureEmployeeVerified() {
  const emp = selectedEmployee();
  if (!emp) { alert('근무자를 선택하세요.'); return null; }
  if (verifiedEmployees.has(emp.id)) return emp;
  if (!(await api().EmployeeNeedsPIN(emp.id))) { verifiedEmployees.add(emp.id); return emp; }
  const pin = prompt(`${emp.name} 님의 PIN을 입력하세요.`);
  if (pin === null) return null;
  if (!(await api().VerifyEmployeePIN(emp.id, pin))) { alert('PIN이 일치하지 않습니다.'); return null; }
  verifiedEmployees.add(emp.id);
  return emp;
}

async function ensureAdminVerified() {
  if (adminVerified) return true;
  if (!(await api().HasAdminPIN())) { adminVerified = true; return true; }
  const pin = prompt('관리자 PIN을 입력하세요.');
  if (pin === null) return false;
  if (!(await api().VerifyAdminPIN(pin))) { alert('PIN이 일치하지 않습니다.'); return false; }
  adminVerified = true;
  return true;
}

function showError(err) {
  const el = document.createElement('p');
  el.className = 'error';
  el.textContent = typeof err === 'string' ? err : (err?.message || String(err));
  $view.appendChild(el);
}

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
    ? '<p class="hint">근무자를 선택하세요.</p>'
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
    <div class="card">
      <div class="card-head"><h3>오늘 근무</h3>
        ${cur ? '<span class="pill ok">근무중</span>' : '<span class="pill neu">근무 전</span>'}</div>
      ${shiftHtml}
    </div>
    <div class="card">
      <div class="card-head"><h3>오픈 / 마감 상태</h3></div>
      ${clLine(open, '오픈')}${clLine(close, '마감')}
    </div>
    <div class="card">
      <div class="card-head"><h3>영상 재생</h3>
        ${playing ? '<span class="pill acc">▶ 재생 중</span>' : '<span class="pill neu">■ 정지됨</span>'}</div>
    </div>
    ${weekCard(week)}`;
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

async function renderWorklog() {
  const emp = selectedEmployee();
  if (!emp) { $view.innerHTML = '<h2>근로기록</h2><p>근무자를 선택하세요.</p>'; return; }
  const cur = await api().CurrentShift(emp.id);
  $view.innerHTML = `
    <h2>근로기록 — ${esc(emp.name)}</h2>
    <div class="card">
      <button id="btn-in" class="big-btn in" ${cur ? 'disabled' : ''}>출근</button>
      <button id="btn-out" class="big-btn out" ${cur ? '' : 'disabled'}>퇴근</button>
      ${cur ? `<p style="margin-top:12px">출근 시각: ${fmtTime(cur.clockIn)}</p>` : ''}
    </div>
    <div class="card">
      <h3>업무 기록</h3>
      <div class="row">
        <input type="text" id="note-input" placeholder="수행한 업무 입력" style="flex:1" ${cur ? '' : 'disabled'}>
        <button id="btn-note" class="small primary" ${cur ? '' : 'disabled'}>기록</button>
      </div>
      <pre style="white-space:pre-wrap">${esc(cur?.taskNotes || '')}</pre>
    </div>
    <div class="card"><h3>내 근로 이력 (최근 30일)</h3><div id="my-history"></div></div>`;

  document.getElementById('btn-in').onclick = async () => {
    if (await ensureEmployeeVerified()) api().ClockIn(emp.id).then(renderWorklog, showError);
  };
  document.getElementById('btn-out').onclick = async () => {
    if (await ensureEmployeeVerified()) api().ClockOut(emp.id).then(renderWorklog, showError);
  };
  document.getElementById('btn-note').onclick = async () => {
    const v = document.getElementById('note-input').value.trim();
    if (v && await ensureEmployeeVerified()) api().AddNote(emp.id, v).then(renderWorklog, showError);
  };

  const from = localDateStr(new Date(Date.now() - 30 * 86400e3));
  const logs = (await api().WorkLogHistory(from, todayStr(), emp.id)) || [];
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
      ${e.photoPath && !view.completed ? `<button class="small" data-photo-del="${e.id}" data-path="${esc(e.photoPath)}">사진 삭제</button>` : ''}
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
      .then(path => { if (path) renderChecklist(type); }, showError);
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
        .then(() => renderChecklist(type), showError);
    }
  });
  document.getElementById('btn-complete').onclick = async () => {
    const verified = await ensureEmployeeVerified();
    if (!verified) return;
    api().CompleteChecklist(type, verified.name).then(() => renderChecklist(type), showError);
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
        <table><tr><th style="width:70px">순서</th><th>항목명</th><th style="width:70px">필수</th><th style="width:130px"></th></tr>
        ${(list || []).map(t => `<tr data-tpl="${t.id}" data-type="${typ}">
          <td><input type="number" data-field="order" value="${t.sortOrder}" style="width:60px"></td>
          <td><input type="text" data-field="name" value="${esc(t.name)}" style="width:100%"></td>
          <td><input type="checkbox" data-field="required" ${t.required ? 'checked' : ''}></td>
          <td><button class="small primary" data-save="${t.id}">저장</button>
              <button class="small" data-del="${t.id}">삭제</button></td></tr>`).join('')}</table>
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
      }).then(render, showError);
    });
    $view.querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
      const typ = b.dataset.add;
      const name = document.getElementById(`name-${typ}`).value.trim();
      if (!name) return;
      api().AddChecklistTemplate(typ, name,
        Number(document.getElementById(`ord-${typ}`).value || 0),
        document.getElementById(`req-${typ}`).checked).then(render, showError);
    });
    $view.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      if (confirm('이 항목을 삭제할까요?')) api().RemoveChecklistTemplate(Number(b.dataset.del)).then(render, showError);
    });
  };
  await render();
}

async function renderAdminEmployees() {
  const render = async () => {
    const all = (await api().ListEmployees(false)) || [];
    $view.innerHTML = `
      <h2>직원 관리</h2>
      <div class="card">
        <table><tr><th>이름</th><th>PIN</th><th>상태</th><th></th></tr>
        ${all.map(e => `<tr><td>${esc(e.name)}</td><td>${e.hasPin ? '설정됨' : '없음'}</td>
          <td>${e.active ? '재직' : '비활성'}</td>
          <td><button class="small" data-pin="${e.id}">PIN 변경</button>
              <button class="small" data-toggle="${e.id}">${e.active ? '비활성화' : '활성화'}</button></td></tr>`).join('')}</table>
        <div class="row" style="margin-top:10px">
          <input type="text" id="emp-name" placeholder="이름">
          <input type="password" id="emp-pin" placeholder="PIN (선택)">
          <button id="emp-add" class="small primary">직원 추가</button>
        </div>
      </div>`;
    document.getElementById('emp-add').onclick = () => {
      const name = document.getElementById('emp-name').value.trim();
      if (!name) return;
      api().AddEmployee(name, document.getElementById('emp-pin').value)
        .then(async () => { await refreshEmployees(); await render(); }, showError);
    };
    $view.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => {
      const e = all.find(x => x.id === Number(b.dataset.toggle));
      e.active = !e.active;
      api().UpdateEmployee(e).then(async () => { await refreshEmployees(); await render(); }, showError);
    });
    $view.querySelectorAll('[data-pin]').forEach(b => b.onclick = () => {
      const e = all.find(x => x.id === Number(b.dataset.pin));
      const pin = prompt(`${e.name} 님의 새 PIN을 입력하세요. (비우면 PIN 해제)`);
      if (pin === null) return;
      verifiedEmployees.delete(e.id);
      api().SetEmployeePIN(e.id, pin).then(render, showError);
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

async function renderAdminShifts() {
  const render = async () => {
    const [week, emps, totals, overrides] = await Promise.all([
      api().ShiftWeek(), api().ListEmployees(true), api().ShiftWeekTotals(), api().ShiftOverrides()]);
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
        <h3>배치 추가</h3>
        <div class="row" style="margin-top:12px">
          <select id="sh-emp">${emps.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select>
          <span id="sh-days">${Object.entries(DAY_LABELS).map(([v, l]) =>
            `<label style="margin-right:4px"><input type="checkbox" value="${v}">${l}</label>`).join('')}</span>
          <input type="text" id="sh-start" placeholder="09:00" style="width:80px">
          <span class="hint">–</span>
          <input type="text" id="sh-end" placeholder="18:00" style="width:80px">
          <button id="sh-add" class="small primary">추가</button>
        </div>
        <p class="hint" style="margin-top:8px">요일을 여러 개 선택하면 같은 시간으로 한 번에 등록됩니다.</p>
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
        <div class="card-head"><h3>예외 (휴가 · 대타)</h3><span class="hint">향후 90일</span></div>
        ${overrides.length ? `<table style="margin-bottom:12px">
          <tr><th>날짜</th><th>직원</th><th>유형</th><th>시간</th><th>메모</th><th></th></tr>
          ${overrides.map(o => `<tr>
            <td class="mono">${o.date}</td><td>${esc(o.employeeName)}</td>
            <td>${o.type === 'off' ? '<span class="pill warn">휴가</span>' : '<span class="pill acc">대타</span>'}</td>
            <td class="mono">${o.type === 'work' ? `${o.start}–${o.end}` : '—'}</td>
            <td class="hint">${esc(o.note)}</td>
            <td><button class="small" data-del-ov="${o.id}">삭제</button></td></tr>`).join('')}</table>`
        : '<p class="hint" style="margin-bottom:12px">등록된 예외가 없습니다.</p>'}
        <div class="row">
          <input type="date" id="ov-date" value="${todayStr()}">
          <select id="ov-emp">${emps.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select>
          <select id="ov-type"><option value="off">휴가 (해당일 근무 제외)</option><option value="work">대타/추가 근무</option></select>
          <input type="text" id="ov-start" placeholder="10:00" style="width:80px" disabled>
          <span class="hint">–</span>
          <input type="text" id="ov-end" placeholder="16:00" style="width:80px" disabled>
          <input type="text" id="ov-note" placeholder="메모 (선택)" style="flex:1">
          <button id="ov-add" class="small primary">추가</button>
        </div>
      </div>`;
    document.getElementById('sh-add').onclick = async () => {
      const empId = Number(document.getElementById('sh-emp').value || 0);
      const days = [...document.querySelectorAll('#sh-days input:checked')].map(c => c.value);
      const start = document.getElementById('sh-start').value.trim();
      const end = document.getElementById('sh-end').value.trim();
      if (!empId || !days.length) { alert('직원과 요일을 선택하세요.'); return; }
      try {
        for (const d of days) await api().AddShift(empId, d, start, end);
        await render();
      } catch (err) { showError(err); }
    };
    $view.querySelectorAll('[data-del-shift]').forEach(b => b.onclick = () => {
      api().DeleteShift(Number(b.dataset.delShift)).then(render, showError);
    });
    const ovType = document.getElementById('ov-type');
    const syncOvTimeInputs = () => {
      const isWork = ovType.value === 'work';
      document.getElementById('ov-start').disabled = !isWork;
      document.getElementById('ov-end').disabled = !isWork;
    };
    ovType.onchange = syncOvTimeInputs;
    document.getElementById('ov-add').onclick = () => {
      api().AddShiftOverride(
        Number(document.getElementById('ov-emp').value || 0),
        document.getElementById('ov-date').value,
        ovType.value,
        document.getElementById('ov-start').value.trim(),
        document.getElementById('ov-end').value.trim(),
        document.getElementById('ov-note').value.trim(),
      ).then(render, showError);
    };
    $view.querySelectorAll('[data-del-ov]').forEach(b => b.onclick = () => {
      api().DeleteShiftOverride(Number(b.dataset.delOv)).then(render, showError);
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
            ? `<div class="hint">${esc(fileBaseName(s.payload))}</div>` : ''}</td>
          <td><input type="checkbox" data-toggle="${s.id}" ${s.active ? 'checked' : ''}></td>
          <td>${s.actionType === 'play-audio'
            ? `<button class="small" data-test-audio="${esc(s.payload)}" title="미리듣기">▶ 테스트</button> ` : ''}
            <button class="small" data-del="${s.id}">삭제</button></td></tr>`).join('')}</table>
        <div class="row" style="margin-top:10px">
          <input type="text" id="sc-name" placeholder="작업명">
          <input type="text" id="sc-time" placeholder="HH:MM" style="width:80px">
          <select id="sc-action">${Object.entries(ACTION_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
          <span id="sc-audio-wrap" style="display:none">
            <button id="sc-audio-pick" class="small">🔊 음성 파일 선택</button>
            <span id="sc-audio-name" class="hint"></span>
          </span>
          <span id="sc-days">${Object.entries(DAY_LABELS).map(([v, l]) =>
            `<label style="margin-right:4px"><input type="checkbox" value="${v}">${l}</label>`).join('')}</span>
          <button id="sc-add" class="small primary">추가</button>
        </div>
        <p class="hint" style="margin-top:8px">요일 미선택 시 매일 실행. Windows 작업 스케줄러 등록에는 관리자 권한이 필요할 수 있습니다.</p>
      </div>`;
    document.getElementById('tpl-apply').onclick = () =>
      api().ApplyScheduleTemplate(document.getElementById('tpl-open').value, document.getElementById('tpl-close').value)
        .then(render, showError);
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
      const payload = scAction.value === 'play-audio' ? audioPayload : '';
      api().AddSchedule(name, time, days, scAction.value, payload).then(render, showError);
    };
    $view.querySelectorAll('[data-test-audio]').forEach(b => b.onclick = () => playAudioPath(b.dataset.testAudio));
    $view.querySelectorAll('[data-toggle]').forEach(cb => cb.onchange = () =>
      api().ToggleSchedule(Number(cb.dataset.toggle), cb.checked).then(render, showError));
    $view.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      if (confirm('이 스케줄을 삭제할까요?')) api().DeleteSchedule(Number(b.dataset.del)).then(render, showError);
    });
  };
  await render();
}

// --- 영상 재생 (YouTube IFrame Player + 워치독 연동) ---
let ytPlayer = null, ytApiPromise = null, playerPlaylist = [], playerIdx = 0, hbTimer = null, playerFatalMsg = '';

function loadYTApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (!ytApiPromise) {
    ytApiPromise = new Promise(resolve => {
      window.onYouTubeIframeAPIReady = resolve;
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    });
  }
  return ytApiPromise;
}

function destroyLocalPlayer() {
  clearInterval(hbTimer);
  hbTimer = null;
  if (ytPlayer) { try { ytPlayer.destroy(); } catch (e) { } ytPlayer = null; }
  const wrap = document.getElementById('player-wrap');
  if (wrap) wrap.innerHTML = '<div id="yt-player"></div>';
}

function playNext() {
  if (!ytPlayer || !playerPlaylist.length) return;
  playerIdx = (playerIdx + 1) % playerPlaylist.length;
  ytPlayer.loadVideoById(playerPlaylist[playerIdx].videoId);
}

function reloadCurrentVideo() {
  if (ytPlayer && playerPlaylist.length) {
    ytPlayer.loadVideoById(playerPlaylist[playerIdx].videoId);
  } else if (currentView === 'admin-player') {
    beginPlayback();
  }
}

async function beginPlayback() {
  playerPlaylist = (await api().ActivePlaylist()) || [];
  if (!playerPlaylist.length) {
    alert('재생목록이 비어 있습니다. 영상을 먼저 등록하세요.');
    await api().StopPlayback();
    return;
  }
  await loadYTApi();
  if (!document.getElementById('yt-player')) return; // 재생 화면이 아니면 보류
  destroyLocalPlayer();
  playerIdx = 0;
  playerFatalMsg = '';
  ytPlayer = new YT.Player('yt-player', {
    videoId: playerPlaylist[0].videoId,
    playerVars: { autoplay: 1, controls: 1, rel: 0 },
    events: {
      onReady: e => e.target.playVideo(),
      onStateChange: e => {
        if (e.data === YT.PlayerState.ENDED) playNext();
        else if (e.data === YT.PlayerState.PLAYING) api().PlayerHeartbeat('playing');
      },
      onError: () => api().PlayerHeartbeat('error'),
    },
  });
  hbTimer = setInterval(() => {
    if (ytPlayer && ytPlayer.getPlayerState && ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
      api().PlayerHeartbeat('playing');
    }
  }, 10000);
}

async function renderAdminPlayer() {
  const [items, playing] = await Promise.all([api().PlaylistItems(), api().PlayerStatus()]);
  $view.innerHTML = `
    <h2>영상 재생</h2>
    ${playerFatalMsg ? `<div class="fatal-banner">⚠️ ${esc(playerFatalMsg)}</div>` : ''}
    <div class="card">
      <div class="row">
        <button id="pl-start" class="big-btn in" ${playing ? 'disabled' : ''}>재생 시작</button>
        <button id="pl-stop" class="big-btn out" ${playing ? '' : 'disabled'}>재생 종료</button>
        <button id="pl-full" class="small">전체화면</button>
        <button id="pl-mute" class="small">음소거 전환</button>
        <label>음량 <input type="range" id="pl-vol" min="0" max="100" value="60"></label>
      </div>
      <div id="player-wrap"><div id="yt-player"></div></div>
      <p class="hint" style="margin-top:8px">
        재생 중에는 이 화면을 유지하세요. 오류·끊김은 워치독이 자동으로 재시작합니다.
        스케줄 자동 재생 시 이 화면으로 자동 전환됩니다.</p>
    </div>
    <div class="card">
      <h3>재생목록</h3>
      <table><tr><th>순서</th><th>제목</th><th>영상 ID</th><th></th></tr>
      ${(items || []).map(p => `<tr><td>${p.sortOrder}</td><td>${esc(p.title)}</td>
        <td>${esc(p.videoId)}</td><td><button class="small" data-del="${p.id}">삭제</button></td></tr>`).join('')}</table>
      <div class="row" style="margin-top:10px">
        <input type="text" id="pl-url" placeholder="YouTube 영상 URL" style="flex:1">
        <input type="text" id="pl-title" placeholder="제목(선택)">
        <button id="pl-add" class="small primary">추가</button>
      </div>
    </div>`;
  document.getElementById('pl-start').onclick = () => api().StartPlayback();
  document.getElementById('pl-stop').onclick = () => api().StopPlayback();
  document.getElementById('pl-full').onclick = () => document.getElementById('player-wrap').requestFullscreen();
  document.getElementById('pl-mute').onclick = () => {
    if (ytPlayer) ytPlayer.isMuted() ? ytPlayer.unMute() : ytPlayer.mute();
  };
  document.getElementById('pl-vol').oninput = e => { if (ytPlayer) ytPlayer.setVolume(Number(e.target.value)); };
  document.getElementById('pl-add').onclick = () => {
    const url = document.getElementById('pl-url').value.trim();
    if (!url) return;
    api().AddPlaylistItem(url, document.getElementById('pl-title').value.trim())
      .then(renderAdminPlayer, showError);
  };
  $view.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    if (confirm('재생목록에서 삭제할까요?')) api().RemovePlaylistItem(Number(b.dataset.del)).then(renderAdminPlayer, showError);
  });
  if (playing && !ytPlayer) await beginPlayback();
}

async function renderAdminSettings() {
  const authorized = await api().GoogleAuthorized();
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
      <h3>관리자 PIN</h3>
      <p class="hint" style="margin:8px 0">
        설정하면 관리자 메뉴 진입 시 PIN을 요구합니다. 새 PIN을 비워두고 저장하면 잠금이 해제됩니다.</p>
      <div class="row">
        <input type="password" id="pin-cur" placeholder="현재 PIN (처음 설정 시 비움)">
        <input type="password" id="pin-new" placeholder="새 PIN">
        <button id="pin-save" class="small primary">저장</button>
      </div>
      <div id="pin-result"></div>
    </div>`;
  document.getElementById('pin-save').onclick = () => {
    api().SetAdminPIN(document.getElementById('pin-cur').value, document.getElementById('pin-new').value)
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
        `<p style="margin-top:8px">✅ ${res.uploaded}건 업로드 완료</p>` +
        (res.sheets || []).map(u => `<p style="font-size:12px"><a href="${u}" target="_blank">${u}</a></p>`).join('');
    }, err => {
      document.getElementById('sync-result').innerHTML = '';
      showError(err);
    });
  };
}

const views = {
  'dashboard': renderDashboard,
  'worklog': renderWorklog,
  'checklist-open': () => renderChecklist('open'),
  'checklist-close': () => renderChecklist('close'),
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
  if (currentView === 'admin-player' && name !== 'admin-player' && ytPlayer) {
    if (!confirm('영상 재생 중입니다. 화면을 이동하면 재생이 중지됩니다. 이동할까요?')) return;
    await api().StopPlayback();
    destroyLocalPlayer();
  }
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

(async function init() {
  await refreshEmployees();
  if (window.runtime) {
    window.runtime.EventsOn('schedule:action', handleScheduleAction);
    window.runtime.EventsOn('player:start', async () => {
      if (currentView !== 'admin-player') await navigate('admin-player', { skipAdminGate: true });
      await beginPlayback();
    });
    window.runtime.EventsOn('player:stop', () => {
      destroyLocalPlayer();
      if (currentView === 'admin-player') renderAdminPlayer();
    });
    window.runtime.EventsOn('player:reload', reloadCurrentVideo);
    window.runtime.EventsOn('player:fatal', msg => {
      playerFatalMsg = msg || '영상 재생을 복구하지 못했습니다.';
      destroyLocalPlayer();
      if (currentView === 'admin-player') renderAdminPlayer();
    });
  }
  const startupAction = await api().GetStartupAction();
  await navigate('dashboard');
  if (startupAction) handleScheduleAction(startupAction);
})();
