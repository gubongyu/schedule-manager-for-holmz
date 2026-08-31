// 앱 부팅: 테마·사이드바, 접속, 뷰 등록, 런타임 이벤트 배선.
import { api } from './api.js';
import { toast, todayStr } from './ui.js';
import { applySession, firstVisibleView, refreshEmployees, selectedEmployee, setDisabledViews, setSession } from './session.js';
import { navigate, refresh, registerViews, getCurrentView } from './router.js';
import { checkForUpdate, showUpdate } from './update.js';

import { renderDashboard } from './views/dashboard.js';
import { renderWorklog } from './views/worklog.js';
import { renderChecklist } from './views/checklist.js';
import { renderSubRequest } from './views/subrequest.js';
import { renderAdminPlayer, setPlayerFatal } from './views/player.js';
import { renderAnnounce } from './views/announce.js';
import { renderRental } from './views/rental.js';
import { renderLostItems } from './views/lostitems.js';
import { renderSchedule } from './views/schedule.js';
import { renderAdminWorklog } from './views/admin-worklog.js';
import { renderAdminShifts } from './views/shifts.js';
import { renderAdminChecklist } from './views/admin-checklist.js';
import { renderAdminEmployees } from './views/admin-employees.js';
import { renderAdminSettings } from './views/settings.js';

registerViews({
  'dashboard': renderDashboard,
  'worklog': renderWorklog,
  'checklist-open': () => renderChecklist('open'),
  'checklist-close': () => renderChecklist('close'),
  'sub-request': renderSubRequest,
  'player': renderAdminPlayer,
  'announce': renderAnnounce,
  'rental': renderRental,
  'lost-found': () => renderLostItems('found'),
  'lost-reported': () => renderLostItems('reported'),
  'admin-worklog': renderAdminWorklog,
  'admin-shifts': renderAdminShifts,
  'admin-checklist': renderAdminChecklist,
  'schedule': renderSchedule,
  'admin-player': renderAdminPlayer,
  'admin-employees': renderAdminEmployees,
  'admin-settings': renderAdminSettings,
});

// --- 테마 / 사이드바 토글 (localStorage 유지) ---
function applyTheme() {
  const dark = localStorage.getItem('holmz-theme') === 'dark';
  if (dark) document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  document.getElementById('theme-toggle').textContent = dark ? '◑ 라이트' : '◐ 다크';
}

function applySidebar() {
  document.body.classList.toggle('side-hidden', localStorage.getItem('holmz-side') === 'hidden');
}

document.getElementById('theme-toggle').onclick = () => {
  localStorage.setItem('holmz-theme',
    localStorage.getItem('holmz-theme') === 'dark' ? 'light' : 'dark');
  applyTheme();
};
document.getElementById('side-toggle').onclick = () => {
  localStorage.setItem('holmz-side',
    localStorage.getItem('holmz-side') === 'hidden' ? 'shown' : 'hidden');
  applySidebar();
};
applyTheme();
applySidebar();

// 스케줄 트리거(--action) 처리: 알림 동작은 해당 체크리스트 화면으로 이동한다.
function handleScheduleAction(action) {
  if (action === 'notify-open') navigate('checklist-open');
  else if (action === 'notify-close') navigate('checklist-close');
}

// --- 정각 업무 기록 알림 ---
// 근무 중(출근 상태)이면 매 정각에 작은 알림을 띄워 해당 시간의 업무를 선택하게 한다.
let lastHourKey = '';

// 근무 중이면 매 정각에 업무 기록을 알린다.
setInterval(async () => {
  const now = new Date();
  if (now.getMinutes() !== 0) return;
  const key = `${todayStr()}-${now.getHours()}`;
  if (key === lastHourKey) return;
  const emp = selectedEmployee();
  if (!emp) return;
  let cur = null;
  try { cur = await api().CurrentShift(emp.id); } catch (e) { return; }
  if (!cur) return;
  lastHourKey = key;
  api().ShowWindow();
  const hh = String(now.getHours()).padStart(2, '0');
  toast(`${hh}:00 입니다. 근무 내용을 기록해주세요.`, 'ok', 8000);
  if (getCurrentView() === 'worklog') refresh();
}, 20 * 1000);

// --- 접속 화면 ---
async function doLogin() {
  const name = document.getElementById('login-name').value.trim();
  const secret = document.getElementById('login-secret').value.trim();
  const errEl = document.getElementById('login-err');
  if (!name || !secret) return;
  try {
    const res = await api().Login(name, secret);
    if (!res) {
      errEl.textContent = '이름 또는 학번(PIN)이 일치하지 않습니다.';
      errEl.style.display = '';
      return;
    }
    setSession(res);
    errEl.style.display = 'none';
    document.getElementById('login-secret').value = '';
    await startApp();
  } catch (err) {
    errEl.textContent = err?.message || String(err);
    errEl.style.display = '';
  }
}

document.querySelectorAll('#nav button[data-view]').forEach(b => b.onclick = () => navigate(b.dataset.view));
document.getElementById('employee-select').onchange = () => refresh();
document.getElementById('today').textContent = new Date().toLocaleDateString('ko-KR', { dateStyle: 'full' });
document.getElementById('login-btn').onclick = doLogin;
document.getElementById('login-secret').onkeydown = e => { if (e.key === 'Enter') doLogin(); };
document.getElementById('login-name').onkeydown = e => { if (e.key === 'Enter') document.getElementById('login-secret').focus(); };
document.getElementById('logout').onclick = () => location.reload();
document.getElementById('login-name').focus();

let eventsWired = false;
// 꺼둔 기능의 메뉴 이름 목록.
function disabledViewsOf(features) {
  const f = features || {};
  return [
    ['dashboard', f.dashboard], ['rental', f.rental],
    ['lost-found', f.lostFound], ['lost-reported', f.lostReported],
    ['sub-request', f.subRequest],
  ].filter(([, on]) => on === false).map(([name]) => name);
}

async function startApp() {
  await refreshEmployees();
  let features = null;
  try { features = await api().GetFeatures(); } catch (e) { features = null; }
  setDisabledViews(disabledViewsOf(features));
  applySession();
  if (!eventsWired && window.runtime) {
    eventsWired = true;
    window.runtime.EventsOn('schedule:action', handleScheduleAction);
    // 재생은 팝업 창이 담당. 여기서는 상태 표시만 갱신한다.
    const refreshPlayerView = () => {
      const v = getCurrentView();
      if (v === 'admin-player' || v === 'player' || v === 'dashboard') refresh();
    };
    window.runtime.EventsOn('player:start', refreshPlayerView);
    window.runtime.EventsOn('player:stop', refreshPlayerView);
    window.runtime.EventsOn('update:available', showUpdate);
    window.runtime.EventsOn('player:fatal', msg => {
      setPlayerFatal(msg || '영상 재생을 복구하지 못했습니다.');
      refreshPlayerView();
    });
  }
  const startupAction = await api().GetStartupAction();
  await navigate(features?.dashboard === false ? firstVisibleView() : 'dashboard');
  if (startupAction) handleScheduleAction(startupAction);
  checkForUpdate(); // 시작 시 1회 (이후 하루 한 번은 백엔드가 이벤트로 알린다)
}
