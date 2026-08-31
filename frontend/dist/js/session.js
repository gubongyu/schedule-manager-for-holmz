// 접속 세션과 역할별 화면 접근 제어.
import { api } from './api.js';
import { esc } from './ui.js';

let employees = [];

// 관리자가 꺼둔 기능의 메뉴는 역할과 무관하게 숨긴다.
// 여기서 다루는 메뉴는 모두 관리자·근무자 공용이라 다시 켜면 그대로 되살리면 된다.
const TOGGLEABLE_VIEWS = ['dashboard', 'rental', 'lost-found', 'lost-reported', 'sub-request'];
let disabledViews = new Set();

export function setDisabledViews(names) {
  disabledViews = new Set(names);
  // 다시 켠 메뉴는 일단 되살린 뒤, 역할별 표시 규칙을 다시 적용한다
  // (대타 신청처럼 근무자 전용인 메뉴가 관리자에게 보이지 않도록).
  TOGGLEABLE_VIEWS.forEach(v => {
    const b = document.querySelector(`#nav [data-view="${v}"]`);
    if (b) b.style.display = '';
  });
  if (session) applyRoleVisibility();
  hideDisabledViews();
}

export function isViewDisabled(name) { return disabledViews.has(name); }

function hideDisabledViews() {
  disabledViews.forEach(v => {
    const b = document.querySelector(`#nav [data-view="${v}"]`);
    if (b) b.style.display = 'none';
  });
}

// firstVisibleView 는 지금 눌러볼 수 있는 첫 메뉴다 (대시보드를 껐을 때의 진입 화면).
export function firstVisibleView() {
  const btn = [...document.querySelectorAll('#nav button[data-view]')]
    .find(b => b.style.display !== 'none');
  return btn ? btn.dataset.view : 'dashboard';
}

// setSession 은 로그인 성공 시 세션을 설정한다.
export function setSession(s) { session = s; }
export function currentSession() { return session; }
export function knownEmployees() { return employees; }

// forgetEmployeeVerification 은 학번이 바뀐 직원의 세션 확인을 무효화한다.
export function forgetEmployeeVerification(id) { verifiedEmployees.delete(id); }

// --- 접속 세션 ---
// 앱 시작 시 이름+학번(직원) 또는 이름+PIN(관리자)으로 로그인한다.
let session = null; // {role: 'admin'|'employee', employeeId, employeeName}

const verifiedEmployees = new Set();

let adminVerified = false;

// applyRoleVisibility 는 역할에 따라 메뉴 표시를 정한다.
// 관리자: 근무자용 메뉴 숨김 / 근무자: 관리자 메뉴 숨김
// (안내 방송·스케줄 관리는 양쪽 모두 사용하는 공용 메뉴라 숨기지 않는다)
function applyRoleVisibility() {
  const isAdmin = session.role === 'admin';
  document.querySelectorAll('#nav [data-view^="admin-"], #nav .nav-sep')
    .forEach(el => { el.style.display = isAdmin ? '' : 'none'; });
  document.querySelectorAll('#nav [data-view="worklog"], #nav [data-view="checklist-open"], #nav [data-view="checklist-close"], #nav [data-view="sub-request"], #nav [data-view="player"]')
    .forEach(el => { el.style.display = isAdmin ? 'none' : ''; });
}

export function applySession() {
  document.body.classList.add('authed');
  const isAdmin = session.role === 'admin';
  applyRoleVisibility();
  if (!isAdmin) updateChecklistMenus();
  // 근무자 선택은 접속 정보로 대체되므로 항상 숨긴다
  document.querySelector('#topbar label.emp').style.display = 'none';
  document.getElementById('whoami').textContent =
    isAdmin ? '관리자' : `${session.employeeName} 님`;
  hideDisabledViews();
  if (isAdmin) {
    adminVerified = true;
  } else {
    adminVerified = false;
    verifiedEmployees.add(session.employeeId);
  }
}

export async function ensureEmployeeVerified() {
  const emp = selectedEmployee();
  if (!emp) { alert('근무자를 선택하세요.'); return null; }
  // 직원 접속이면 본인만 조작 가능하고 접속 시 이미 검증되었다.
  if (session?.role === 'employee') {
    return emp.id === session.employeeId ? emp : null;
  }
  // 관리자가 다른 근무자를 대신 조작할 때는 해당 직원의 학번을 확인한다.
  if (verifiedEmployees.has(emp.id)) return emp;
  if (!(await api().EmployeeNeedsVerify(emp.id))) { verifiedEmployees.add(emp.id); return emp; }
  const sid = prompt(`${emp.name} 님의 학번을 입력하세요.`);
  if (sid === null) return null;
  if (!(await api().VerifyEmployee(emp.id, sid))) { alert('학번이 일치하지 않습니다.'); return null; }
  verifiedEmployees.add(emp.id);
  return emp;
}

// 오픈/마감 체크리스트 메뉴는 관리자가 지정한 당일 오픈/마감 시각이 있을 때만,
// 각 시각 3시간 전부터 표시한다 (요일별로 지정이 없으면 그날은 숨김).
let todayOC = null;

export async function updateChecklistMenus() {
  if (session?.role !== 'employee') return;
  try { todayOC = await api().TodayOpenClose(); } catch (e) { todayOC = null; }
  const nowHM = new Date().toTimeString().slice(0, 5);
  const visibleFrom = (hm) => {
    if (!hm) return false;
    const from = (Number(hm.slice(0, 2)) - 3 + 24) % 24;
    return nowHM >= `${String(from).padStart(2, '0')}:${hm.slice(3)}` || from > Number(hm.slice(0, 2));
  };
  const openVisible = todayOC?.open ? visibleFrom(todayOC.open) : false;
  const closeVisible = todayOC?.close ? visibleFrom(todayOC.close) : false;
  const openBtn = document.querySelector('#nav [data-view="checklist-open"]');
  const closeBtn = document.querySelector('#nav [data-view="checklist-close"]');
  if (openBtn) openBtn.style.display = openVisible ? '' : 'none';
  if (closeBtn) closeBtn.style.display = closeVisible ? '' : 'none';
  hideDisabledViews();
}

export async function ensureAdminVerified() {
  // 접속 시 역할이 정해지므로 별도 PIN 재입력은 없다.
  return session?.role === 'admin';
}

export function selectedEmployee() {
  if (session?.role !== 'employee') return null;
  return employees.find(e => e.id === session.employeeId)
    || { id: session.employeeId, name: session.employeeName };
}

export async function refreshEmployees() {
  employees = (await api().ListEmployees(true)) || [];
  const sel = document.getElementById('employee-select');
  const prev = sel.value;
  sel.innerHTML = employees.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
  if (prev && employees.some(e => String(e.id) === prev)) sel.value = prev;
}

// 오픈/마감 시각이 지나가면 체크리스트 메뉴 노출도 따라 바뀌므로 주기적으로 갱신한다.
setInterval(() => { if (session?.role === 'employee') updateChecklistMenus(); }, 60 * 1000);
