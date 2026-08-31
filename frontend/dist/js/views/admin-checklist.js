// 체크리스트 관리: 항목 추가·수정·삭제.
import { api } from '../api.js';
import { $view, esc, ok, showError } from '../ui.js';

export async function renderAdminChecklist() {
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
