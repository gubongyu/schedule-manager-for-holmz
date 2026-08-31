// 스케줄 관리: Windows 작업 스케줄러 자동화 등록.
import { api } from '../api.js';
import { $view, esc, ok, toast, showError, DAY_LABELS, fileBaseName } from '../ui.js';

const ACTION_LABELS = {
  'notify-open': '오픈 체크리스트 알림',
  'notify-close': '마감 체크리스트 알림',
  'upload': '근로기록 업로드',
  'play-start': '영상 재생 시작',
  'play-stop': '영상 재생 종료',
  'play-audio': '음성 재생 (안내방송)',
};

// --- 안내방송 재생 ---
let announceAudio = null;

async function playAudioPath(path) {
  if (!path) return;
  try {
    const url = await api().AudioDataURL(path);
    if (announceAudio) announceAudio.pause();
    announceAudio = new Audio(url);
    await announceAudio.play();
  } catch (err) {
    console.error('안내방송 재생 실패', err);
  }
}

export async function renderSchedule() {
  const render = async () => {
    const list = (await api().ListSchedules()) || [];
    $view.innerHTML = `
      <h2>스케줄 관리</h2>
      <div class="card">
        <h3>자동화 템플릿</h3>
        <p class="hint" style="margin:8px 0">
          오픈 시각: 체크리스트 알림 + 영상 재생 시작 / 마감 시각: 체크리스트 알림 + 근로기록 업로드 + 영상 재생 종료</p>
        <div class="row">
          <label>오픈 <input type="text" id="tpl-open" value="09:00" style="width:80px"></label>
          <label>마감 <input type="text" id="tpl-close" value="22:00" style="width:80px"></label>
          <button id="tpl-apply" class="small primary">템플릿 적용</button>
        </div>
      </div>
      <div class="card">
        <h3>등록된 스케줄</h3>
        <table><tr><th>작업명</th><th>시각</th><th>요일</th><th>동작</th><th>활성</th><th></th></tr>
        ${list.map(s => `<tr>
          <td>${esc(s.taskName)}</td><td>${s.runTime}</td>
          <td>${(s.repeatDays && s.repeatDays.length) ? s.repeatDays.map(d => DAY_LABELS[d] || d).join(',') : '매일'}</td>
          <td>${ACTION_LABELS[s.actionType] || s.actionType}${s.actionType === 'play-audio'
            ? `<div class="hint">${esc(fileBaseName(s.payload))}${s.repeat > 1 ? ` × ${s.repeat}회` : ''}</div>` : ''}</td>
          <td><input type="checkbox" data-toggle="${s.id}" ${s.active ? 'checked' : ''}></td>
          <td>${s.actionType === 'play-audio'
            ? `<button class="small" data-test-audio="${esc(s.payload)}" title="미리듣기">▶ 테스트</button> ` : ''}
            <button class="small danger" data-del="${s.id}">삭제</button></td></tr>`).join('')}</table>
        <div class="row" style="margin-top:10px">
          <input type="text" id="sc-name" placeholder="작업명">
          <input type="text" id="sc-time" placeholder="HH:MM" style="width:80px">
          <select id="sc-action">${Object.entries(ACTION_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
          <span id="sc-audio-wrap" style="display:none">
            <button id="sc-audio-pick" class="small">🔊 음성 파일 선택</button>
            <span id="sc-audio-name" class="hint"></span>
            <label>재생 <input type="number" id="sc-repeat" min="1" max="5" value="1" style="width:56px">회</label>
          </span>
          <span id="sc-days">${Object.entries(DAY_LABELS).map(([v, l]) =>
            `<label style="margin-right:4px"><input type="checkbox" value="${v}">${l}</label>`).join('')}</span>
          <button id="sc-add" class="small primary">추가</button>
        </div>
        <p class="hint" style="margin-top:8px">요일 미선택 시 매일 실행. Windows 작업 스케줄러 등록에는 관리자 권한이 필요할 수 있습니다.</p>
      </div>`;
    document.getElementById('tpl-apply').onclick = () =>
      api().ApplyScheduleTemplate(document.getElementById('tpl-open').value, document.getElementById('tpl-close').value)
        .then(ok('자동화 템플릿 5건이 등록되었습니다', render), showError);
    let audioPayload = '';
    const scAction = document.getElementById('sc-action');
    scAction.onchange = () => {
      document.getElementById('sc-audio-wrap').style.display =
        scAction.value === 'play-audio' ? 'inline-flex' : 'none';
    };
    document.getElementById('sc-audio-pick').onclick = () => {
      api().PickAudioFile().then(path => {
        if (path) {
          audioPayload = path;
          document.getElementById('sc-audio-name').textContent = fileBaseName(path);
        }
      }, showError);
    };
    document.getElementById('sc-add').onclick = () => {
      const name = document.getElementById('sc-name').value.trim();
      const time = document.getElementById('sc-time').value.trim();
      if (!name || !/^\d{2}:\d{2}$/.test(time)) { alert('작업명과 시각(HH:MM)을 입력하세요.'); return; }
      const days = [...document.querySelectorAll('#sc-days input:checked')].map(c => c.value);
      const isAudio = scAction.value === 'play-audio';
      const payload = isAudio ? audioPayload : '';
      const repeat = isAudio ? Number(document.getElementById('sc-repeat').value || 1) : 1;
      api().AddSchedule(name, time, days, scAction.value, payload, repeat).then(ok('스케줄이 등록되었습니다', render), showError);
    };
    $view.querySelectorAll('[data-test-audio]').forEach(b => b.onclick = () => playAudioPath(b.dataset.testAudio));
    $view.querySelectorAll('[data-toggle]').forEach(cb => cb.onchange = () =>
      api().ToggleSchedule(Number(cb.dataset.toggle), cb.checked).then(() => { toast(cb.checked ? '활성화되었습니다' : '비활성화되었습니다'); return render(); }, showError));
    $view.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      if (confirm('이 스케줄을 삭제할까요?')) api().DeleteSchedule(Number(b.dataset.del)).then(ok('삭제되었습니다', render), showError);
    });
  };
  await render();
}
