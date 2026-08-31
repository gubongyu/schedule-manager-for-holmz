// 분실물: 습득(found)과 접수(reported)를 각각 기록하고 회수 처리한다.
import { api } from '../api.js';
import { $view, esc, ok, showError } from '../ui.js';
import { currentSession } from '../session.js';

function staffName() {
  const s = currentSession();
  return s?.role === 'employee' ? s.employeeName : '관리자';
}

// 습득물: 보관 중인 항목은 찾아간 학생 정보를 함께 입력받아 회수 처리한다.
function foundSection(items) {
  const keep = items.filter(v => !v.claimDate);
  const done = items.filter(v => v.claimDate);
  return `
    <div class="card">
      <h3>습득물 등록</h3>
      <p class="hint" style="margin:8px 0">날짜는 등록 시각으로 자동 기록됩니다.</p>
      <div class="row">
        <input type="text" id="fd-item" placeholder="분실물 (예: 무선 이어폰)" style="width:200px">
        <input type="text" id="fd-feature" placeholder="특징 (색상·모양 등)" style="flex:1">
        <button id="fd-add" class="small primary">등록</button>
      </div>
    </div>
    <div class="card">
      <h3>보관 중 <span class="pill${keep.length ? ' warn' : ''}">${keep.length}건</span></h3>
      ${keep.length ? `<table>
        <tr><th style="width:110px">습득일</th><th>분실물</th><th>특징</th><th style="width:110px"></th></tr>
        ${keep.map(v => `<tr>
          <td class="mono">${v.date}</td><td>${esc(v.item)}</td><td class="hint">${esc(v.feature)}</td>
          <td><button class="small primary" data-claim-found="${v.id}">회수</button>
              <button class="small danger" data-del="${v.id}">삭제</button></td></tr>`).join('')}
      </table>` : '<p class="hint">보관 중인 습득물이 없습니다.</p>'}
    </div>
    <div class="card">
      <h3>회수 완료</h3>
      ${done.length ? `<table>
        <tr><th>습득일</th><th>분실물</th><th>찾아간 학생</th><th>연락처</th><th>회수일</th><th>확인자</th><th style="width:70px"></th></tr>
        ${done.map(v => `<tr>
          <td class="mono">${v.date}</td><td>${esc(v.item)}</td>
          <td>${esc(v.name)} <span class="hint mono">${esc(v.studentId)}</span></td>
          <td class="mono">${esc(v.phone)}</td><td class="mono">${v.claimDate}</td><td>${esc(v.claimStaff)}</td>
          <td><button class="small danger" data-del="${v.id}">삭제</button></td></tr>`).join('')}
      </table>` : '<p class="hint">회수 기록이 없습니다.</p>'}
    </div>`;
}

// 접수: 학생이 분실 신고를 하면 학생 정보까지 함께 받고, 물건을 찾으면 회수 처리한다.
function reportedSection(items) {
  const open = items.filter(v => !v.claimDate);
  const done = items.filter(v => v.claimDate);
  return `
    <div class="card">
      <h3>분실 접수</h3>
      <div class="row">
        <input type="text" id="rp-item" placeholder="분실물" style="width:150px">
        <input type="text" id="rp-feature" placeholder="특징" style="width:170px">
        <input type="text" id="rp-sid" placeholder="학번" style="width:120px">
        <input type="text" id="rp-name" placeholder="이름" style="width:100px">
        <input type="text" id="rp-phone" placeholder="연락처" style="width:140px">
        <button id="rp-add" class="small primary">접수</button>
      </div>
    </div>
    <div class="card">
      <h3>찾는 중 <span class="pill${open.length ? ' warn' : ''}">${open.length}건</span></h3>
      ${open.length ? `<table>
        <tr><th style="width:110px">접수일</th><th>분실물</th><th>특징</th><th>신고자</th><th>연락처</th><th style="width:110px"></th></tr>
        ${open.map(v => `<tr>
          <td class="mono">${v.date}</td><td>${esc(v.item)}</td><td class="hint">${esc(v.feature)}</td>
          <td>${esc(v.name)} <span class="hint mono">${esc(v.studentId)}</span></td><td class="mono">${esc(v.phone)}</td>
          <td><button class="small primary" data-claim-rep="${v.id}">회수</button>
              <button class="small danger" data-del="${v.id}">삭제</button></td></tr>`).join('')}
      </table>` : '<p class="hint">접수된 분실물이 없습니다.</p>'}
    </div>
    <div class="card">
      <h3>회수 완료</h3>
      ${done.length ? `<table>
        <tr><th>접수일</th><th>분실물</th><th>신고자</th><th>회수일</th><th>확인자</th><th style="width:70px"></th></tr>
        ${done.map(v => `<tr>
          <td class="mono">${v.date}</td><td>${esc(v.item)}</td>
          <td>${esc(v.name)} <span class="hint mono">${esc(v.studentId)}</span></td>
          <td class="mono">${v.claimDate}</td><td>${esc(v.claimStaff)}</td>
          <td><button class="small danger" data-del="${v.id}">삭제</button></td></tr>`).join('')}
      </table>` : '<p class="hint">회수 기록이 없습니다.</p>'}
    </div>`;
}

export async function renderLostItems(type) {
  const render = async () => {
    const items = (await api().LostItems(type)) || [];
    const found = type === 'found';
    $view.innerHTML = `<h2>${found ? '분실물 습득' : '분실물 접수'}</h2>` +
      (found ? foundSection(items) : reportedSection(items));

    if (found) {
      document.getElementById('fd-add').onclick = () => {
        api().RecordFoundItem(
          document.getElementById('fd-item').value.trim(),
          document.getElementById('fd-feature').value.trim(),
        ).then(ok('습득물이 등록되었습니다', render), showError);
      };
      $view.querySelectorAll('[data-claim-found]').forEach(b => b.onclick = () => {
        const sid = prompt('찾아간 학생의 학번을 입력하세요.');
        if (sid === null) return;
        const name = prompt('이름을 입력하세요.');
        if (name === null) return;
        const phone = prompt('전화번호를 입력하세요.') ?? '';
        api().ClaimFoundItem(Number(b.dataset.claimFound), sid.trim(), name.trim(), phone.trim(), staffName())
          .then(ok('회수 처리되었습니다', render), showError);
      });
    } else {
      document.getElementById('rp-add').onclick = () => {
        api().RecordLostReport(
          document.getElementById('rp-item').value.trim(),
          document.getElementById('rp-feature').value.trim(),
          document.getElementById('rp-sid').value.trim(),
          document.getElementById('rp-name').value.trim(),
          document.getElementById('rp-phone').value.trim(),
        ).then(ok('분실 신고가 접수되었습니다', render), showError);
      };
      $view.querySelectorAll('[data-claim-rep]').forEach(b => b.onclick = () => {
        if (confirm('회수 처리할까요? 오늘 날짜와 확인자가 기록됩니다.')) {
          api().ClaimLostReport(Number(b.dataset.claimRep), staffName())
            .then(ok('회수 처리되었습니다', render), showError);
        }
      });
    }
    $view.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      if (confirm('이 기록을 삭제할까요?')) {
        api().DeleteLostItem(Number(b.dataset.del)).then(ok('삭제되었습니다', render), showError);
      }
    });
  };
  await render();
}
