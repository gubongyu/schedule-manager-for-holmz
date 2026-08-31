// HDMI 대여: 대여 등록과 반납 처리.
import { api } from '../api.js';
import { $view, esc, ok, showError } from '../ui.js';
import { currentSession } from '../session.js';

// staffName 은 기록에 남길 담당자 이름이다 (근무자는 본인, 관리자는 '관리자').
function staffName() {
  const s = currentSession();
  return s?.role === 'employee' ? s.employeeName : '관리자';
}

export async function renderRental() {
  const render = async () => {
    const rentals = (await api().Rentals()) || [];
    const out = rentals.filter(r => !r.returnTime);
    const done = rentals.filter(r => r.returnTime);
    $view.innerHTML = `
      <h2>HDMI 대여</h2>
      <div class="card">
        <h3>대여 등록</h3>
        <p class="hint" style="margin:8px 0">대여 일자와 시간은 등록 시각으로 자동 기록됩니다. 담당자: <b>${esc(staffName())}</b></p>
        <div class="row">
          <input type="text" id="rt-sid" placeholder="대여자 학번" style="width:130px">
          <input type="text" id="rt-name" placeholder="대여자명" style="width:110px">
          <input type="text" id="rt-phone" placeholder="연락처" style="width:140px">
          <input type="text" id="rt-place" placeholder="사용장소" style="width:140px">
          <input type="text" id="rt-no" placeholder="HDMI 번호 (선택)" style="width:140px">
          <button id="rt-add" class="small primary">대여</button>
        </div>
      </div>
      <div class="card">
        <h3>미반납 <span class="pill${out.length ? ' warn' : ''}">${out.length}건</span></h3>
        ${out.length ? `<table>
          <tr><th>대여일시</th><th>대여자</th><th>연락처</th><th>사용장소</th><th>HDMI</th><th>담당자</th><th style="width:150px"></th></tr>
          ${out.map(r => `<tr>
            <td class="mono">${r.date} ${r.time}</td>
            <td>${esc(r.name)} <span class="hint mono">${esc(r.studentId)}</span></td>
            <td class="mono">${esc(r.phone)}</td><td>${esc(r.place)}</td>
            <td class="mono">${esc(r.deviceNo)}</td><td>${esc(r.staff)}</td>
            <td><button class="small primary" data-return="${r.id}">반납 처리</button>
                <button class="small danger" data-del="${r.id}">삭제</button></td></tr>`).join('')}
        </table>` : '<p class="hint">미반납 건이 없습니다.</p>'}
      </div>
      <div class="card">
        <h3>반납 완료</h3>
        ${done.length ? `<table>
          <tr><th>대여일시</th><th>대여자</th><th>사용장소</th><th>HDMI</th><th>반납일시</th><th>반납확인자</th><th style="width:70px"></th></tr>
          ${done.map(r => `<tr>
            <td class="mono">${r.date} ${r.time}</td>
            <td>${esc(r.name)} <span class="hint mono">${esc(r.studentId)}</span></td>
            <td>${esc(r.place)}</td><td class="mono">${esc(r.deviceNo)}</td>
            <td class="mono">${r.returnDate} ${r.returnTime}</td><td>${esc(r.returnStaff)}</td>
            <td><button class="small danger" data-del="${r.id}">삭제</button></td></tr>`).join('')}
        </table>` : '<p class="hint">반납 기록이 없습니다.</p>'}
      </div>`;

    document.getElementById('rt-add').onclick = () => {
      api().RentHDMI(
        staffName(),
        document.getElementById('rt-sid').value.trim(),
        document.getElementById('rt-name').value.trim(),
        document.getElementById('rt-phone').value.trim(),
        document.getElementById('rt-place').value.trim(),
        document.getElementById('rt-no').value.trim(),
      ).then(ok('대여가 등록되었습니다', render), showError);
    };
    $view.querySelectorAll('[data-return]').forEach(b => b.onclick = () => {
      if (confirm('반납 처리할까요? 현재 시각과 확인자가 기록됩니다.')) {
        api().ReturnHDMI(Number(b.dataset.return), staffName()).then(ok('반납 처리되었습니다', render), showError);
      }
    });
    $view.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      if (confirm('이 대여 기록을 삭제할까요?')) {
        api().DeleteRental(Number(b.dataset.del)).then(ok('삭제되었습니다', render), showError);
      }
    });
  };
  await render();
}
