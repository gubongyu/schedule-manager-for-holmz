// 근로기록: 출퇴근, 업무 기록(정각/놓친 정각), 전체 근로 이력.
import { api } from '../api.js';
import { $view, esc, fmtTime, localDateStr, todayStr, ok, toast, showError, showNoticeIfAny } from '../ui.js';
import { selectedEmployee, ensureEmployeeVerified } from '../session.js';

// 출근 이후 지나간 정각들 중 아직 기록([HH:00])이 없는 시각을 반환한다.
export function missedHours(cur) {
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

export async function renderWorklog() {
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

export function historyTable(logs) {
  if (!logs.length) return '<p>기록이 없습니다.</p>';
  return `<table><tr><th>날짜</th><th>직원</th><th>출근</th><th>퇴근</th><th>근무시간</th><th>업무내용</th><th>동기화</th></tr>
    ${logs.map(w => `<tr><td>${w.date}</td><td>${esc(w.employeeName)}</td><td>${fmtTime(w.clockIn)}</td>
      <td>${fmtTime(w.clockOut)}</td><td>${w.totalHours || '-'}</td><td>${esc(w.taskNotes)}</td>
      <td><span class="status-badge ${w.syncStatus === 'synced' ? 'synced' : ''}">${w.syncStatus === 'synced' ? '동기화됨' : '대기'}</span></td></tr>`).join('')}</table>`;
}
