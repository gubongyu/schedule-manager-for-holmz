// 오픈/마감 체크리스트: 항목 체크, 사진 첨부, 완료 처리.
import { api } from '../api.js';
import { $view, esc, fmtTime, ok, toast, showError } from '../ui.js';
import { ensureEmployeeVerified } from '../session.js';

export async function renderChecklist(type) {
  const label = type === 'open' ? '오픈' : '마감';
  const view = await api().TodayChecklist(type);
  $view.innerHTML = `
    <h2>${label} 체크리스트 — ${view.date}</h2>
    ${view.completed ? `<div class="done-banner">✅ ${label} 완료 — ${fmtTime(view.completedAt)} (${esc(view.completedBy)})</div>` : ''}
    <div id="cl-items"></div>
    <button id="btn-complete" class="big-btn in" ${view.completed ? 'disabled' : ''}>${label} 완료 처리</button>`;
  const wrap = document.getElementById('cl-items');
  wrap.innerHTML = view.entries.map(e => `
    <div class="check-item" data-entry="${e.id}">
      <input type="checkbox" data-id="${e.id}" ${e.checked ? 'checked' : ''} ${view.completed ? 'disabled' : ''}>
      <span>${esc(e.name)}</span>
      ${e.required ? '<span class="req">필수</span>' : ''}
      <span class="meta">${e.checked ? `${fmtTime(e.checkedAt)} · ${esc(e.checkedBy)}` : ''}</span>
      ${view.completed ? '' : `<button class="small" data-photo-attach="${e.id}">📷 사진</button>`}
      ${e.photoPath ? `<button class="small" data-photo-view="${e.id}" data-path="${esc(e.photoPath)}">보기</button>` : ''}
      ${e.photoPath && !view.completed ? `<button class="small danger" data-photo-del="${e.id}" data-path="${esc(e.photoPath)}">사진 삭제</button>` : ''}
    </div>
    <div class="photo-box" id="photo-${e.id}"></div>`).join('') ||
    '<p>등록된 항목이 없습니다. 관리자 메뉴에서 항목을 추가하세요.</p>';

  wrap.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.onchange = async () => {
      const verified = await ensureEmployeeVerified();
      if (!verified) { cb.checked = !cb.checked; return; }
      api().CheckItem(Number(cb.dataset.id), cb.checked, verified.name).then(() => renderChecklist(type), showError);
    };
  });
  wrap.querySelectorAll('[data-photo-attach]').forEach(b => b.onclick = async () => {
    if (!(await ensureEmployeeVerified())) return;
    api().AttachChecklistPhoto(Number(b.dataset.photoAttach))
      .then(path => { if (path) { toast('사진이 첨부되었습니다'); renderChecklist(type); } }, showError);
  });
  wrap.querySelectorAll('[data-photo-view]').forEach(b => b.onclick = () => {
    const box = document.getElementById(`photo-${b.dataset.photoView}`);
    if (box.innerHTML) { box.innerHTML = ''; return; }
    api().PhotoDataURL(b.dataset.path)
      .then(url => { box.innerHTML = `<img src="${url}" alt="첨부 사진">`; }, showError);
  });
  wrap.querySelectorAll('[data-photo-del]').forEach(b => b.onclick = async () => {
    if (!(await ensureEmployeeVerified())) return;
    if (confirm('첨부 사진을 삭제할까요?')) {
      api().RemoveChecklistPhoto(Number(b.dataset.photoDel), b.dataset.path)
        .then(ok('사진이 삭제되었습니다', () => renderChecklist(type)), showError);
    }
  });
  document.getElementById('btn-complete').onclick = async () => {
    const verified = await ensureEmployeeVerified();
    if (!verified) return;
    api().CompleteChecklist(type, verified.name).then(ok(label + ' 완료 처리되었습니다', () => renderChecklist(type)), showError);
  };
}
