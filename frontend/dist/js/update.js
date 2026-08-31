// 새 버전 알림과 설치. 알림 배너에서 [지금 업데이트] 를 누르면 내려받아 교체하고 재시작한다.
import { api } from './api.js';
import { esc, showError } from './ui.js';

let dismissedVersion = ''; // 사용자가 [나중에] 를 누른 버전 — 같은 버전은 다시 띄우지 않는다

const firstLine = (s) => String(s || '').split('\n')[0].trim().slice(0, 80);

// showUpdate 는 새 버전 정보를 상단 배너로 띄운다. av 가 null 이면 아무것도 하지 않는다.
export function showUpdate(av) {
  if (!av || !av.version || av.version === dismissedVersion) return;
  let bar = document.getElementById('update-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'update-bar';
    document.getElementById('main').prepend(bar);
  }
  const note = firstLine(av.notes);
  bar.innerHTML = `<span id="upd-msg">새 버전 <b>${esc(av.version)}</b> 이 나왔습니다.${note ? ` — ${esc(note)}` : ''}</span>
    <span class="spacer"></span>
    <button id="upd-now" class="small primary">지금 업데이트</button>
    <button id="upd-open" class="small ghost">릴리스 보기</button>
    <button id="upd-later" class="small ghost">나중에</button>`;
  bar.style.display = 'flex';
  document.getElementById('upd-now').onclick = () => install(av);
  document.getElementById('upd-open').onclick = () => api().OpenReleasePage(av.pageUrl || av.url);
  document.getElementById('upd-later').onclick = () => {
    dismissedVersion = av.version;
    bar.style.display = 'none';
  };
}

// install 은 내려받아 교체하고 프로그램을 다시 시작한다.
// 성공하면 이 창은 그대로 닫히므로, 되돌아오는 경우는 실패했을 때뿐이다.
async function install(av) {
  if (!confirm(`새 버전 ${av.version} 을 설치하고 프로그램을 다시 시작합니다.\n재생 중인 영상은 중단됩니다. 진행할까요?`)) return;
  const msg = document.getElementById('upd-msg');
  ['upd-now', 'upd-open', 'upd-later'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.disabled = true;
  });
  msg.textContent = '새 버전을 내려받는 중입니다... (창을 닫지 마세요)';
  try {
    await api().InstallUpdate();
    msg.textContent = '설치 완료 — 다시 시작하는 중입니다...';
  } catch (err) {
    msg.textContent = '';
    showUpdateAgain(av);
    showError(err);
  }
}

// showUpdateAgain 은 설치 실패 후 배너를 원래 상태로 되돌린다.
function showUpdateAgain(av) {
  const bar = document.getElementById('update-bar');
  if (bar) bar.remove();
  showUpdate(av);
}

// checkForUpdate 는 시작 시 한 번 조용히 확인한다.
// 실패(네트워크 없음·비공개 저장소 등)는 무시한다 — 매장 화면을 방해하지 않는다.
export async function checkForUpdate() {
  try {
    showUpdate(await api().CheckUpdate());
  } catch (e) { }
}
