// HOLMZ 프론트엔드. Wails 런타임이 주입하는 window.go.main.App 바인딩을 직접 호출한다.
const api = () => window.go.main.App;

const $view = document.getElementById('view');
let currentView = 'dashboard';
let employees = [];

const todayStr = () => new Date().toISOString().slice(0, 10);
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

function showError(err) {
  const el = document.createElement('p');
  el.className = 'error';
  el.textContent = typeof err === 'string' ? err : (err?.message || String(err));
  $view.appendChild(el);
}

// --- 화면 렌더러 ---

async function renderDashboard() {
  const emp = selectedEmployee();
  let shiftHtml = '<p>근무자를 선택하세요.</p>';
  if (emp) {
    const cur = await api().CurrentShift(emp.id);
    shiftHtml = cur
      ? `<p><b>${esc(emp.name)}</b> 근무 중 — 출근 ${fmtTime(cur.clockIn)}</p>`
      : `<p><b>${esc(emp.name)}</b> 근무 전 (출근 기록 없음)</p>`;
  }
  const [open, close] = await Promise.all([api().TodayChecklist('open'), api().TodayChecklist('close')]);
  const clStatus = (v, label) => v.completed
    ? `<p>${label}: ✅ 완료 (${fmtTime(v.completedAt)}, ${esc(v.completedBy)})</p>`
    : `<p>${label}: ⬜ 미완료 (${v.entries.filter(e => e.checked).length}/${v.entries.length} 항목)</p>`;
  $view.innerHTML = `
    <h2>대시보드</h2>
    <div class="card"><h3>오늘 근무</h3>${shiftHtml}</div>
    <div class="card"><h3>오픈/마감 상태</h3>${clStatus(open, '오픈')}${clStatus(close, '마감')}</div>`;
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

  document.getElementById('btn-in').onclick = () => api().ClockIn(emp.id).then(renderWorklog, showError);
  document.getElementById('btn-out').onclick = () => api().ClockOut(emp.id).then(renderWorklog, showError);
  document.getElementById('btn-note').onclick = () => {
    const v = document.getElementById('note-input').value.trim();
    if (v) api().AddNote(emp.id, v).then(renderWorklog, showError);
  };

  const from = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10);
  const logs = (await api().WorkLogHistory(from, todayStr(), emp.id)) || [];
  document.getElementById('my-history').innerHTML = historyTable(logs);
}

function historyTable(logs) {
  if (!logs.length) return '<p>기록이 없습니다.</p>';
  return `<table><tr><th>날짜</th><th>직원</th><th>출근</th><th>퇴근</th><th>근무시간</th><th>업무내용</th><th>동기화</th></tr>
    ${logs.map(w => `<tr><td>${w.date}</td><td>${esc(w.employeeName)}</td><td>${fmtTime(w.clockIn)}</td>
      <td>${fmtTime(w.clockOut)}</td><td>${w.totalHours || '-'}</td><td>${esc(w.taskNotes)}</td>
      <td><span class="status-badge">${w.syncStatus}</span></td></tr>`).join('')}</table>`;
}

async function renderChecklist(type) {
  const label = type === 'open' ? '오픈' : '마감';
  const emp = selectedEmployee();
  const view = await api().TodayChecklist(type);
  $view.innerHTML = `
    <h2>${label} 체크리스트 — ${view.date}</h2>
    ${view.completed ? `<div class="done-banner">✅ ${label} 완료 — ${fmtTime(view.completedAt)} (${esc(view.completedBy)})</div>` : ''}
    <div id="cl-items"></div>
    <button id="btn-complete" class="big-btn in" ${view.completed ? 'disabled' : ''}>${label} 완료 처리</button>`;
  const wrap = document.getElementById('cl-items');
  wrap.innerHTML = view.entries.map(e => `
    <label class="check-item">
      <input type="checkbox" data-id="${e.id}" ${e.checked ? 'checked' : ''} ${view.completed ? 'disabled' : ''}>
      <span>${esc(e.name)}</span>
      ${e.required ? '<span class="req">필수</span>' : ''}
      <span class="meta">${e.checked ? `${fmtTime(e.checkedAt)} · ${esc(e.checkedBy)}` : ''}</span>
    </label>`).join('') || '<p>등록된 항목이 없습니다. 관리자 메뉴에서 항목을 추가하세요.</p>';

  wrap.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.onchange = () => {
      if (!emp) { alert('근무자를 먼저 선택하세요.'); cb.checked = !cb.checked; return; }
      api().CheckItem(Number(cb.dataset.id), cb.checked, emp.name).then(() => renderChecklist(type), showError);
    };
  });
  document.getElementById('btn-complete').onclick = () => {
    if (!emp) { alert('근무자를 먼저 선택하세요.'); return; }
    api().CompleteChecklist(type, emp.name).then(() => renderChecklist(type), showError);
  };
}

async function renderAdminWorklog() {
  $view.innerHTML = `
    <h2>근로기록 관리</h2>
    <div class="card row">
      <input type="date" id="f-from" value="${new Date(Date.now() - 7 * 86400e3).toISOString().slice(0, 10)}">
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
        <table><tr><th>순서</th><th>항목명</th><th>필수</th><th></th></tr>
        ${(list || []).map(t => `<tr><td>${t.sortOrder}</td><td>${esc(t.name)}</td>
          <td>${t.required ? '필수' : '선택'}</td>
          <td><button class="small" data-del="${t.id}">삭제</button></td></tr>`).join('')}</table>
        <div class="row" style="margin-top:10px">
          <input type="number" id="ord-${typ}" placeholder="순서" style="width:70px" value="${(list?.length || 0) + 1}">
          <input type="text" id="name-${typ}" placeholder="항목명" style="flex:1">
          <label><input type="checkbox" id="req-${typ}"> 필수</label>
          <button class="small primary" data-add="${typ}">추가</button>
        </div>
      </div>`;
    $view.innerHTML = `<h2>체크리스트 관리</h2>${section('open', '오픈', open)}${section('close', '마감', close)}`;
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
        <table><tr><th>이름</th><th>상태</th><th></th></tr>
        ${all.map(e => `<tr><td>${esc(e.name)}</td><td>${e.active ? '재직' : '비활성'}</td>
          <td><button class="small" data-toggle="${e.id}">${e.active ? '비활성화' : '활성화'}</button></td></tr>`).join('')}</table>
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
  };
  await render();
}

async function renderAdminSettings() {
  const authorized = await api().GoogleAuthorized();
  $view.innerHTML = `
    <h2>설정 — Google 연동</h2>
    <div class="card">
      <h3>Google 계정 연동</h3>
      <p style="margin:8px 0">상태:
        <span class="status-badge">${authorized ? '연동됨' : '미연동'}</span></p>
      <p style="margin:8px 0; color:#718096; font-size:13px">
        Google Cloud Console에서 "데스크톱 앱" OAuth 클라이언트를 만들고,
        내려받은 credentials.json 을 <b>%APPDATA%\\HOLMZ\\credentials.json</b> 에 두세요.</p>
      <div class="row">
        <button id="btn-auth" class="small primary">Google 계정 인증</button>
      </div>
      <div id="auth-result"></div>
    </div>
    <div class="card">
      <h3>근로기록 동기화</h3>
      <p style="margin:8px 0; color:#718096; font-size:13px">퇴근 완료된 미동기화 기록을 날짜별 스프레드시트로 업로드합니다. (마감 스케줄에서도 자동 실행)</p>
      <button id="btn-sync" class="small primary" ${authorized ? '' : 'disabled'}>지금 동기화</button>
      <div id="sync-result"></div>
    </div>`;
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
  'admin-checklist': renderAdminChecklist,
  'admin-employees': renderAdminEmployees,
  'admin-settings': renderAdminSettings,
};

async function navigate(name) {
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
  await navigate('dashboard');
})();
