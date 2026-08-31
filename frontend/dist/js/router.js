// 화면 전환. 뷰 등록은 main.js가 하고, 라우터는 뷰 구현을 알지 않는다(순환 의존 방지).
import { $view, showError } from './ui.js';
import { ensureAdminVerified, isViewDisabled } from './session.js';

let views = {};
let currentView = 'dashboard';

export function registerViews(map) { views = map; }

export function getCurrentView() { return currentView; }

export async function navigate(name, opts = {}) {
  if (isViewDisabled(name)) return; // 관리자가 꺼둔 기능
  if (name.startsWith('admin-') && !opts.skipAdminGate && !(await ensureAdminVerified())) return;
  currentView = name;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  try {
    await views[name]();
  } catch (err) {
    $view.innerHTML = `<h2>오류</h2>`;
    showError(err);
  }
}

// refresh 는 현재 화면을 다시 그린다 (이벤트·알림으로 상태가 바뀐 경우).
export async function refresh() {
  if (views[currentView]) await navigate(currentView, { skipAdminGate: true });
}
