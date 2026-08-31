// 근로 스케줄: 주간 근무 배치와 예외(휴가·대타) 관리.
import { api } from '../api.js';
import { $view, esc, ok, toast, showError, todayStr, DAY_LABELS, todayWeekday, hourOptions } from '../ui.js';

export async function renderAdminShifts() {
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
