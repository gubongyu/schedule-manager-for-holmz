// 화면 공통 유틸: 포맷, 토스트, 모달, 오류 표시.
import { api } from './api.js';

export const $view = document.getElementById('view');

// 로컬(매장) 시간대 기준 YYYY-MM-DD. toISOString은 UTC라 자정~오전 9시(KST)에 전날이 나온다.
export const localDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const todayStr = () => localDateStr(new Date());

export const fmtTime = (rfc3339) => rfc3339 ? new Date(rfc3339).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// --- 공통 모달 ---
export function showModal(html) {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(ov);
  return ov;
}

// --- 동작 피드백 토스트 (Apple HUD 스타일: 하단 중앙, 자동 사라짐) ---
let toastTimer = null;

export function toast(msg, type = 'ok', ms = 2200) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = (type === 'ok' ? '✓ ' : '✕ ') + msg;
  el.classList.toggle('err', type === 'err');
  el.classList.remove('show');
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ok(msg, next)는 성공 토스트를 띄운 뒤 화면을 갱신하는 then 핸들러를 만든다.
export const ok = (msg, next) => () => { toast(msg); return next(); };

export function showError(err) {
  const msg = typeof err === 'string' ? err : (err?.message || String(err));
  toast(msg, 'err');
  const el = document.createElement('p');
  el.className = 'error';
  el.textContent = msg;
  $view.appendChild(el);
}

// --- 공지사항 팝업 (근무 시작 시) ---
export async function showNoticeIfAny() {
  let text = '';
  try { text = await api().GetNotice(); } catch (e) { }
  if (!text || !text.trim()) return;
  const ov = showModal(`
    <h3>📢 공지사항</h3>
    <pre>${esc(text)}</pre>
    <div class="actions"><button class="small primary" id="notice-ok">확인</button></div>`);
  ov.querySelector('#notice-ok').onclick = () => ov.remove();
}

export function elapsedSince(rfc3339) {
  const ms = Date.now() - new Date(rfc3339).getTime();
  if (ms < 0) return '0:00';
  const h = Math.floor(ms / 3600e3), m = Math.floor(ms % 3600e3 / 60e3);
  return `${h}:${String(m).padStart(2, '0')}`;
}

export const fmtBytes = (n) => n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.round(n / 1024)}KB`;

export const fmtDateTime = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
};

export const fileBaseName = (p) => String(p || '').split(/[\\/]/).pop();

export const DAY_LABELS = { MON: '월', TUE: '화', WED: '수', THU: '목', FRI: '금', SAT: '토', SUN: '일' };

export const todayWeekday = () => ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date().getDay()];

// 정시 단위(00~23시) 시간 선택 옵션
export const hourOptions = (selected) => Array.from({ length: 24 }, (_, h) => {
  const v = `${String(h).padStart(2, '0')}:00`;
  return `<option value="${v}" ${v === selected ? 'selected' : ''}>${h}시</option>`;
}).join('');
