// 대타 신청: 본인 근무를 대신할 동료를 지정해 등록한다.
import { api } from '../api.js';
import { $view, esc, ok, todayStr, showError } from '../ui.js';
import { selectedEmployee } from '../session.js';

// 근무자용 대타 신청: 본인 근무를 대신할 동료를 지정해 등록한다 (동료와 합의 후).
export async function renderSubRequest() {
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
