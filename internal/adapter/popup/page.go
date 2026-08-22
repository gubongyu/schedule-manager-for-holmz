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
let ids = [], idx = 0, player = null;
const overlay = (msg) => {
  const ov = document.getElementById('ov');
  ov.textContent = msg;
  ov.style.display = 'flex';
};
function hb(state) {
  fetch('/api/heartbeat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }) }).catch(() => {});
}
window.onYouTubeIframeAPIReady = function () {
  player = new YT.Player('p', {
    videoId: ids[0],
    playerVars: { autoplay: 1, controls: 1, rel: 0 },
    events: {
      onReady: e => e.target.playVideo(),
      onStateChange: e => {
        if (e.data === YT.PlayerState.ENDED) { idx = (idx + 1) % ids.length; player.loadVideoById(ids[idx]); }
        else if (e.data === YT.PlayerState.PLAYING) hb('playing');
      },
      onError: () => hb('error'),
    },
  });
};
(async function init() {
  try {
    ids = ((await (await fetch('/api/playlist')).json()) || []).map(x => x.videoId);
  } catch (e) { }
  if (!ids.length) { overlay('재생목록이 비어 있습니다'); return; }
  const s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  s.onerror = () => hb('error');
  document.head.appendChild(s);
})();
// 페이지가 살아 있는 한 상태와 무관하게 신호를 보낸다.
// 일시정지·버퍼링 중을 "죽은 것"으로 오판해 강제 재로드하는 일을 막는다.
setInterval(() => { if (player) hb('playing'); }, 10000);
const es = new EventSource('/api/events');
es.onmessage = ev => {
  if (ev.data === 'reload') location.reload();
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
