// 대시보드: 오늘 근무, 기록 현황(근무자) 또는 오픈/마감 상태(관리자), 재생 상태, 금주 스케줄.
import { api } from '../api.js';
import { $view, esc, fmtTime, elapsedSince, todayStr, DAY_LABELS } from '../ui.js';
import { selectedEmployee } from '../session.js';
import { missedHours } from './worklog.js';

export async function renderDashboard() {
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
