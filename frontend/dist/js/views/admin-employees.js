// 근로 장학생 관리: 학과·이름·학번·근무 시작일 등록과 수정 (근로 종료일은 시작일 +11개월).
import { api } from '../api.js';
import { $view, esc, toast, showError } from '../ui.js';
import { refreshEmployees, forgetEmployeeVerification } from '../session.js';

export async function renderAdminEmployees() {
  const render = async () => {
    const all = (await api().ListEmployees(true)) || [];
    $view.innerHTML = `
      <h2>직원 관리</h2>
      <div class="card">
        <table><tr><th>학과</th><th>이름</th><th>학번</th><th style="width:140px">근무 시작일</th>
          <th style="width:110px">근로 종료일</th><th style="width:175px"></th></tr>
        ${all.map(e => `<tr data-emp="${e.id}">
          <td><input type="text" data-f="dept" value="${esc(e.department)}" style="width:100%"></td>
          <td><input type="text" data-f="name" value="${esc(e.name)}" style="width:100%"></td>
          <td><input type="text" data-f="sid" value="${esc(e.studentId)}" style="width:100%"></td>
          <td><input type="date" data-f="start" value="${esc(e.startDate)}"></td>
          <td class="mono hint">${esc(e.endDate) || '—'}</td>
          <td><button class="small primary" data-save="${e.id}">저장</button>
              <button class="small danger" data-del="${e.id}">삭제</button></td></tr>`).join('')}</table>
        <div class="row" style="margin-top:10px">
          <input type="text" id="emp-dept" placeholder="학과">
          <input type="text" id="emp-name" placeholder="이름">
          <input type="text" id="emp-sid" placeholder="학번">
          <label class="hint">근무 시작일 <input type="date" id="emp-start"></label>
          <button id="emp-add" class="small primary">장학생 추가</button>
        </div>
        <p class="hint" style="margin-top:8px">
          학번은 출퇴근·체크리스트 작성 시 본인 확인에 사용됩니다.
          근로 종료일은 근무 시작일로부터 11개월 뒤로 자동 계산되어 Google Drive 명단에 기록됩니다.</p>
      </div>`;
    document.getElementById('emp-add').onclick = () => {
      const name = document.getElementById('emp-name').value.trim();
      if (!name) { alert('이름을 입력하세요.'); return; }
      api().AddEmployee(name,
        document.getElementById('emp-sid').value.trim(),
        document.getElementById('emp-dept').value.trim(),
        document.getElementById('emp-start').value)
        .then(async () => { toast('직원이 추가되었습니다'); await refreshEmployees(); await render(); }, showError);
    };
    $view.querySelectorAll('[data-save]').forEach(b => b.onclick = () => {
      const row = b.closest('tr');
      const id = Number(row.dataset.emp);
      forgetEmployeeVerification(id);
      api().UpdateEmployee({
        id,
        name: row.querySelector('[data-f=name]').value.trim(),
        studentId: row.querySelector('[data-f=sid]').value.trim(),
        department: row.querySelector('[data-f=dept]').value.trim(),
        startDate: row.querySelector('[data-f=start]').value,
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
