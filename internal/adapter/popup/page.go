package popup

// playerPage 는 팝업 창에 표시되는 재생 페이지다. YouTube IFrame Player로 재생목록을
// 순환 재생하고, /api/heartbeat 로 상태를 보고하며, SSE(/api/events)로 reload/stop 명령을 받는다.
const playerPage = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>HOLMZ 영상 재생</title>
<style>
html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
#p { width: 100%; height: 100%; }
#ov { position: fixed; inset: 0; display: none; align-items: center; justify-content: center;
     color: #8e8e93; font: 15px 'Malgun Gothic', sans-serif; background: #000; text-align: center; }
</style>
</head>
<body>
<div id="p"></div>
<div id="ov"></div>
<script>
let ids = [], idx = 0, player = null, volume = 60;
const overlay = (msg) => {
  const ov = document.getElementById('ov');
  ov.textContent = msg;
  ov.style.display = 'flex';
};
// stateName 은 플레이어의 실제 상태를 워치독이 아는 이름으로 바꾼다.
function stateName() {
  if (!player || !player.getPlayerState || typeof YT === 'undefined') return 'unstarted';
  switch (player.getPlayerState()) {
    case YT.PlayerState.PLAYING: return 'playing';
    case YT.PlayerState.PAUSED: return 'paused';
    case YT.PlayerState.BUFFERING: return 'buffering';
    case YT.PlayerState.ENDED: return 'ended';
    default: return 'unstarted';
  }
}
// applyVolume 은 앱이 지정한 음량을 플레이어에 적용한다 (0 초과면 음소거도 해제).
function applyVolume() {
  if (!player || !player.setVolume) return;
  try {
    player.setVolume(volume);
    if (volume > 0 && player.unMute) player.unMute();
  } catch (e) { }
}
function hb(state) {
  fetch('/api/heartbeat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }) }).catch(() => {});
}
window.onYouTubeIframeAPIReady = function () {
  player = new YT.Player('p', {
    videoId: ids[0],
    playerVars: { autoplay: 1, controls: 1, rel: 0 },
    events: {
      onReady: e => { applyVolume(); e.target.playVideo(); },
      onStateChange: e => {
        if (e.data === YT.PlayerState.ENDED) { idx = (idx + 1) % ids.length; player.loadVideoById(ids[idx]); return; }
        hb(stateName());
      },
      onError: () => hb('error'),
    },
  });
};
(async function init() {
  try {
    ids = ((await (await fetch('/api/playlist')).json()) || []).map(x => x.videoId);
  } catch (e) { }
  // 재로드되어도 앱에 저장된 음량을 다시 읽어 적용한다.
  try {
    const v = (await (await fetch('/api/volume')).json()).volume;
    if (typeof v === 'number') volume = v;
  } catch (e) { }
  if (!ids.length) { overlay('재생목록이 비어 있습니다'); return; }
  const s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  s.onerror = () => hb('error');
  document.head.appendChild(s);
})();
// 실제 재생 상태를 그대로 보고한다. 워치독은 heartbeat 이 끊긴 것(페이지 죽음)과
// 재생 상태가 아닌 채로 오래 머무는 것(일시정지·버퍼링·자동재생 차단)을 나눠서 판단한다.
setInterval(() => { if (player) hb(stateName()); }, 10000);
const es = new EventSource('/api/events');
es.onmessage = ev => {
  if (ev.data === 'reload') location.reload();
  else if (ev.data === 'resume') { try { if (player) player.playVideo(); } catch (e) { } }
  else if (ev.data.startsWith('volume:')) { volume = Number(ev.data.slice(7)); applyVolume(); }
  else if (ev.data === 'stop') {
    try { if (player) player.stopVideo(); } catch (e) { }
    overlay('재생이 종료되었습니다. 이 창은 닫아도 됩니다.');
  }
};
// 더블클릭으로 전체화면 전환
document.addEventListener('dblclick', () => {
  document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
});
</script>
</body>
</html>
`
