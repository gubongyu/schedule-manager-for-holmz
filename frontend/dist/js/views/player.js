// 영상 재생: 재생목록과 팝업 재생 제어 (실제 재생은 별도 창).
import { api } from '../api.js';
import { $view, esc, ok, showError } from '../ui.js';

// setPlayerFatal 은 워치독이 복구를 포기했을 때 화면에 띄울 경고를 설정한다.
export function setPlayerFatal(msg) { playerFatalMsg = msg; }

// --- 영상 재생 (별도 팝업 창에서 재생, 이 화면은 리모컨 역할) ---
let playerFatalMsg = '';

export async function renderAdminPlayer() {
  // 재생목록과 음량은 근무자도 조정할 수 있다 (안내 영상은 현장에서 바로 바꿔야 하므로).
  const [items, playing, volume] = await Promise.all(
    [api().PlaylistItems(), api().PlayerStatus(), api().PlayerVolume()]);
  $view.innerHTML = `
    <h2>영상 재생</h2>
    ${playerFatalMsg ? `<div class="fatal-banner">⚠️ ${esc(playerFatalMsg)}</div>` : ''}
    <div class="card">
      <div class="card-head"><h3>재생 제어</h3>
        ${playing ? '<span class="pill acc">▶ 재생 중 (팝업 창)</span>' : '<span class="pill neu">■ 정지됨</span>'}</div>
      <div class="row">
        <button id="pl-start" class="big-btn in" ${playing ? 'disabled' : ''}>팝업으로 재생 시작</button>
        <button id="pl-stop" class="big-btn out" ${playing ? '' : 'disabled'}>재생 종료</button>
      </div>
      <div class="row" style="margin-top:10px;align-items:center;gap:10px">
        <label for="pl-vol">음량</label>
        <input type="range" id="pl-vol" min="0" max="100" step="5" value="${volume}" style="flex:1">
        <span id="pl-vol-val" class="pill neu" style="min-width:52px;text-align:center">${volume}</span>
      </div>
      <p class="hint" style="margin-top:8px">
        영상은 별도 재생 창에서 나옵니다. 창을 TV/보조 모니터로 옮기고 <b>더블클릭</b>하면 전체화면이 됩니다.
        재생 중에도 이 프로그램의 다른 화면을 자유롭게 사용할 수 있으며,
        오류·끊김은 워치독이 자동으로 재시작합니다 (창을 닫아도 다시 열립니다 — 종료는 [재생 종료]로).</p>
    </div>
    <div class="card">
      <h3>재생목록</h3>
      <table><tr><th>순서</th><th>제목</th><th>영상 ID</th><th></th></tr>
      ${(items || []).map(p => `<tr><td>${p.sortOrder}</td><td>${esc(p.title)}</td>
        <td>${esc(p.videoId)}</td><td><button class="small danger" data-del="${p.id}">삭제</button></td></tr>`).join('')}</table>
      <div class="row" style="margin-top:10px">
        <input type="text" id="pl-url" placeholder="YouTube 영상 URL" style="flex:1">
        <input type="text" id="pl-title" placeholder="제목(선택)">
        <button id="pl-add" class="small primary">추가</button>
      </div>
    </div>`;
  document.getElementById('pl-start').onclick = async () => {
    if (!(items || []).length) { alert('재생목록이 비어 있습니다. 영상을 먼저 등록하세요.'); return; }
    playerFatalMsg = '';
    await api().StartPlayback();
    renderAdminPlayer();
  };
  document.getElementById('pl-stop').onclick = async () => { await api().StopPlayback(); renderAdminPlayer(); };
  // 음량: 드래그 중에는 숫자만 갱신하고, 슬라이더를 놓을 때 한 번만 저장한다.
  const vol = document.getElementById('pl-vol'), volVal = document.getElementById('pl-vol-val');
  vol.oninput = () => { volVal.textContent = vol.value; };
  vol.onchange = () => { api().SetPlayerVolume(Number(vol.value)).catch(showError); };
  document.getElementById('pl-add').onclick = () => {
    const url = document.getElementById('pl-url').value.trim();
    if (!url) return;
    api().AddPlaylistItem(url, document.getElementById('pl-title').value.trim())
      .then(ok('추가되었습니다', renderAdminPlayer), showError);
  };
  $view.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    if (confirm('재생목록에서 삭제할까요?')) api().RemovePlaylistItem(Number(b.dataset.del)).then(ok('삭제되었습니다', renderAdminPlayer), showError);
  });
}
