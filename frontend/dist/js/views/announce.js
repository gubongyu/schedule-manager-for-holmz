// 안내 방송: 문구를 음성으로 합성해 송출하고, 생성한 안내문을 관리한다.
import { api } from '../api.js';
import { $view, esc, ok, toast, showError, fmtBytes, fmtDateTime } from '../ui.js';

// 안내 방송: 입력한 문구를 tts_program(MeloTTS)으로 wav 합성해 즉시 송출한다.
// 생성한 음성은 파일로 남아 목록에서 다시 방송하거나 삭제할 수 있다.
let annAudio = null;

let announceBusy = false;

export async function renderAnnounce() {
  const playing = annAudio && !annAudio.paused;
  let saved = [];
  try { saved = (await api().ListAnnouncements()) || []; } catch (e) { }

  $view.innerHTML = `
    <h2>안내 방송</h2>
    <div class="card">
      <div class="card-head"><h3>방송 문구</h3>
        <span class="pill ${playing ? 'acc' : 'neu'}">${playing ? '📢 방송 중' : '대기'}</span></div>
      <textarea id="ann-text" rows="4" placeholder="예) 4층 열람실이 30분 후 마감됩니다. 정리 부탁드립니다." style="width:100%"></textarea>
      <div class="row" style="margin-top:12px">
        <label>속도
          <select id="ann-rate">
            <option value="0.9">느리게</option>
            <option value="1" selected>보통</option>
            <option value="1.15">빠르게</option>
          </select>
        </label>
        <button id="ann-play" class="big-btn in">📢 방송 시작</button>
        <button id="ann-stop" class="big-btn out" ${playing ? '' : 'disabled'}>중지</button>
      </div>
      <p id="ann-status" class="hint" style="margin-top:8px">
        한국어/영어는 자동 인식됩니다. 처음 쓰는 문구는 음성 생성에 20초 내외가 걸리고, 같은 문구는 이후 즉시 재생됩니다.</p>
    </div>
    <div class="card">
      <div class="card-head"><h3>생성한 안내문</h3>
        <span class="hint">${saved.length ? `${saved.length}건 · ${fmtBytes(saved.reduce((a, c) => a + c.size, 0))}` : ''}</span></div>
      <p class="hint" style="margin:8px 0">
        생성된 음성은 <b>%APPDATA%\\HOLMZ\\announce</b> 에 저장되어 스케줄의 "음성 재생"에서도 고를 수 있습니다.
        더 이상 쓰지 않는 안내문은 삭제해 공간을 정리하세요.</p>
      ${saved.length ? `<table>
        <tr><th>문구</th><th style="width:130px">생성</th><th style="width:70px">용량</th><th style="width:190px"></th></tr>
        ${saved.map((a, i) => `<tr>
          <td>${esc(a.text) || '<span class="hint">(문구 정보 없음)</span>'}</td>
          <td class="hint">${fmtDateTime(a.createdAt)}</td>
          <td class="mono hint">${fmtBytes(a.size)}</td>
          <td><button class="small primary" data-replay="${i}">다시 방송</button>
              <button class="small danger" data-del-ann="${i}">삭제</button></td></tr>`).join('')}
      </table>` : '<p class="hint">아직 생성한 안내문이 없습니다.</p>'}
    </div>`;

  const setStatus = (msg) => { document.getElementById('ann-status').textContent = msg; };

  // 이미 만들어 둔 음성을 그대로 재생한다 (합성 없이 즉시).
  const playSaved = async (item) => {
    try {
      const url = await api().AudioDataURL(item.wavPath);
      if (annAudio) annAudio.pause();
      annAudio = new Audio(url);
      annAudio.onended = () => renderAnnounce();
      await annAudio.play();
      toast('방송을 시작했습니다');
      renderAnnounce();
    } catch (err) { showError(err); }
  };

  const startAnnounce = async (text) => {
    if (announceBusy) { toast('음성을 생성하는 중입니다. 잠시만 기다려주세요.', 'err'); return; }
    announceBusy = true;
    const rate = Number(document.getElementById('ann-rate').value || 1);
    const playBtn = document.getElementById('ann-play');
    playBtn.disabled = true;
    setStatus('음성을 생성하는 중입니다... (처음 쓰는 문구는 20초 내외)');
    try {
      const res = await api().Announce(text, rate);
      if (res.fallback) {
        toast('TTS 생성 실패 — 내장 음성으로 방송했습니다', 'err');
        console.warn('TTS fallback:', res.message);
        renderAnnounce();
        return;
      }
      if (annAudio) annAudio.pause();
      annAudio = new Audio(res.audioUrl);
      annAudio.onended = () => renderAnnounce();
      await annAudio.play();
      toast('방송을 시작했습니다');
      renderAnnounce();
    } catch (err) {
      showError(err);
      setStatus('방송에 실패했습니다. 설정의 TTS 명령을 확인하세요.');
      playBtn.disabled = false;
    } finally {
      announceBusy = false;
    }
  };

  document.getElementById('ann-play').onclick = () => {
    const text = document.getElementById('ann-text').value.trim();
    if (!text) { toast('방송할 내용을 입력하세요.', 'err'); return; }
    startAnnounce(text);
  };
  document.getElementById('ann-stop').onclick = async () => {
    if (annAudio) { annAudio.pause(); annAudio = null; }
    await api().StopAnnounce();
    toast('방송을 중지했습니다');
    renderAnnounce();
  };
  $view.querySelectorAll('[data-replay]').forEach(b => b.onclick = () =>
    playSaved(saved[Number(b.dataset.replay)]));
  $view.querySelectorAll('[data-del-ann]').forEach(b => b.onclick = () => {
    const item = saved[Number(b.dataset.delAnn)];
    if (!confirm(`이 안내문을 삭제할까요?\n\n${item.text || item.wavPath}`)) return;
    api().DeleteAnnouncement(item.wavPath).then(ok('삭제되었습니다', renderAnnounce), showError);
  });
}
