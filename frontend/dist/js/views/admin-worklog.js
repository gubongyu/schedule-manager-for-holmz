// 근로기록 관리: 기간·직원 필터 조회.
import { api } from '../api.js';
import { $view, localDateStr, todayStr, esc } from '../ui.js';
import { knownEmployees } from '../session.js';
import { historyTable } from './worklog.js';

export async function renderAdminWorklog() {
  $view.innerHTML = `
    <h2>근로기록 관리</h2>
    <div class="card row">
      <input type="date" id="f-from" value="${localDateStr(new Date(Date.now() - 7 * 86400e3))}">
      <input type="date" id="f-to" value="${todayStr()}">
      <select id="f-emp"><option value="0">전체 직원</option>
        ${knownEmployees().map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select>
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
