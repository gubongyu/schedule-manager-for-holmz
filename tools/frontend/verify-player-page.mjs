// 재생 팝업 페이지(internal/adapter/popup/page.go 안의 <script>)의 동작 검사.
//
// 이 페이지는 브라우저에서만 도는 코드라 Go 테스트로 덮이지 않는다. 여기서는 YouTube
// IFrame API·fetch·EventSource 를 가짜로 세워 실제 페이지 스크립트를 그대로 돌려보고,
// 재생목록 전환이 제대로 되는지 확인한다.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const PAGE = 'internal/adapter/popup/page.go';

function pageScript() {
  const src = readFileSync(PAGE, 'utf8');
  const start = src.indexOf('<script>');
  const end = src.indexOf('</script>');
  if (start < 0 || end < 0) throw new Error(`${PAGE}: <script> 블록을 찾지 못했습니다`);
  return src.slice(start + '<script>'.length, end);
}

const flush = () => new Promise(r => setTimeout(r, 0));

// harness 는 페이지 스크립트를 가짜 브라우저 환경에서 실행하고 관찰 지점을 돌려준다.
async function harness(videoIds, volume = 60, { autoplayOnLoad = true } = {}) {
  const seen = { loaded: [], heartbeats: [], overlay: null, playCalls: 0 };
  const elements = {
    ov: { style: {}, set textContent(v) { seen.overlay = v; }, get textContent() { return seen.overlay; } },
    p: { style: {} },
  };

  const ctx = {
    console,
    JSON, Number, String, Promise, Error, Object, Array, Math,
    setTimeout, clearTimeout,
    setInterval: (fn) => { ctx.__tick = fn; return 1; },
    document: {
      getElementById: (id) => elements[id] ?? { style: {}, textContent: '' },
      createElement: () => ({ set onerror(f) { this._onerror = f; } }),
      head: { appendChild: () => {} },
      addEventListener: () => {},
      documentElement: { requestFullscreen: () => {} },
      exitFullscreen: () => {},
      fullscreenElement: null,
    },
    fetch: async (url, opts) => {
      if (url === '/api/playlist') return { json: async () => videoIds.map(v => ({ videoId: v })) };
      if (url === '/api/volume') return { json: async () => ({ volume }) };
      if (url === '/api/heartbeat') {
        seen.heartbeats.push(JSON.parse(opts.body).state);
        return { ok: true };
      }
      throw new Error('예상치 못한 요청: ' + url);
    },
    EventSource: function () { ctx.__es = this; },
    window: {},
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(pageScript(), ctx);
  await flush();

  // YouTube IFrame API 가 준비된 상황을 흉내낸다.
  let events = null;
  ctx.YT = {
    PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
    Player: function (elId, cfg) {
      events = cfg.events;
      seen.loaded.push(cfg.videoId);
      this.state = ctx.YT.PlayerState.UNSTARTED;
      this.getPlayerState = () => this.state;
      this.setVolume = (v) => { seen.volume = v; };
      this.unMute = () => { seen.unmuted = true; };
      this.playVideo = () => { seen.playCalls++; this.state = ctx.YT.PlayerState.PLAYING; };
      this.stopVideo = () => { this.state = ctx.YT.PlayerState.ENDED; };
      // autoplayOnLoad=false 는 loadVideoById 가 재생까지 이어지지 않고 멈춰 있는 경우다
      // (자동재생 정책·플레이어 상태에 따라 실제로 생긴다).
      this.loadVideoById = (id) => {
        seen.loaded.push(id);
        this.state = autoplayOnLoad ? ctx.YT.PlayerState.BUFFERING : ctx.YT.PlayerState.CUED;
      };
      seen.player = this;
      // 실제 API 와 달리 생성자 안에서 곧바로 onReady 를 부른다. 이 시점에는 아직
      // new YT.Player(...) 의 반환값이 변수에 대입되기 전이므로, 콜백이 모듈 변수에
      // 의존하면 조용히 아무 일도 하지 않는다 (음량 미적용). 그 경우를 잡기 위한 타이밍이다.
      cfg.events.onReady({ target: this });
    },
  };
  ctx.window.onYouTubeIframeAPIReady();
  await flush();

  return {
    seen,
    // fire 는 플레이어 상태 변화를 페이지에 알린다.
    async fire(state) {
      seen.player.state = state;
      events.onStateChange({ data: state, target: seen.player });
      await flush();
    },
    async fail() { events.onError({ data: 150 }); await flush(); },
    async tick() { ctx.__tick(); await flush(); },
    sse: async (data) => { ctx.__es.onmessage({ data }); await flush(); },
    YT: ctx.YT,
  };
}

let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.error(`  FAIL ${name}\n       ${e.message}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const eq = (got, want, what) =>
  assert(JSON.stringify(got) === JSON.stringify(want), `${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

console.log('재생 페이지 검사');

await test('영상이 끝나면 다음 영상으로 넘어간다', async () => {
  const h = await harness(['AAA', 'BBB', 'CCC']);
  await h.fire(h.YT.PlayerState.PLAYING);
  await h.fire(h.YT.PlayerState.ENDED);
  eq(h.seen.loaded, ['AAA', 'BBB'], '재생 순서');
});

await test('마지막 영상이 끝나면 처음으로 돌아간다', async () => {
  const h = await harness(['AAA', 'BBB']);
  await h.fire(h.YT.PlayerState.ENDED); // AAA -> BBB
  await h.fire(h.YT.PlayerState.ENDED); // BBB -> AAA
  eq(h.seen.loaded, ['AAA', 'BBB', 'AAA'], '순환 재생');
});

// 핵심 회귀 검사: 재생할 수 없는 영상(임베드 차단 등)을 만나면 그 영상만 건너뛰어야 한다.
// 예전에는 onError 가 곧바로 'error' 를 보고해 워치독이 페이지를 재로드했고,
// 재로드는 재생목록을 처음부터 다시 시작하므로 두 번째 영상을 영영 넘어가지 못했다.
await test('재생 불가 영상은 건너뛰고 다음 영상을 재생한다', async () => {
  const h = await harness(['AAA', 'BBB', 'CCC']);
  await h.fire(h.YT.PlayerState.PLAYING);
  await h.fire(h.YT.PlayerState.ENDED); // AAA 끝 -> BBB 로드
  await h.fail();                        // BBB 재생 불가
  eq(h.seen.loaded, ['AAA', 'BBB', 'CCC'], '실패한 영상을 건너뛴 재생 순서');
  assert(!h.seen.heartbeats.includes('error'),
    `영상 하나가 실패했다고 error 를 보고하면 안 된다 (보고: ${JSON.stringify(h.seen.heartbeats)})`);
});

await test('재생목록 전체가 실패하면 error 를 보고한다', async () => {
  const h = await harness(['AAA', 'BBB']);
  await h.fail();
  await h.fail();
  assert(h.seen.heartbeats.includes('error'),
    `전부 실패하면 워치독이 알 수 있게 error 를 보고해야 한다 (보고: ${JSON.stringify(h.seen.heartbeats)})`);
});

await test('한 번 재생에 성공하면 실패 횟수가 초기화된다', async () => {
  const h = await harness(['AAA', 'BBB']);
  await h.fail();                            // AAA 실패 -> BBB
  await h.fire(h.YT.PlayerState.PLAYING);    // BBB 재생 성공
  await h.fail();                            // 이후 실패는 다시 처음부터 센다
  assert(!h.seen.heartbeats.includes('error'),
    `재생 성공 후의 단발 실패는 error 가 아니다 (보고: ${JSON.stringify(h.seen.heartbeats)})`);
});

// 첫 영상은 onReady 에서 playVideo() 로 재생이 걸리지만, 이후 영상은 loadVideoById 의
// 자동재생에만 기대고 있었다. 그 가정이 깨지면 영상이 멈춘 채로 남고, 워치독이 60초 뒤
// 재개를 지시할 때까지 정지 상태가 이어진다.
await test('다음 영상이 자동재생되지 않아도 재생을 건다', async () => {
  const h = await harness(['AAA', 'BBB'], 60, { autoplayOnLoad: false });
  await h.fire(h.YT.PlayerState.PLAYING);
  await h.fire(h.YT.PlayerState.ENDED); // AAA 끝 -> BBB 로드
  eq(h.seen.loaded, ['AAA', 'BBB'], '로드 순서');
  assert(h.seen.player.state === h.YT.PlayerState.PLAYING,
    `전환 뒤 재생 중이어야 한다 (상태: ${h.seen.player.state})`);
});

// 건너뛰기 경로도 마찬가지다.
await test('건너뛴 다음 영상도 재생을 건다', async () => {
  const h = await harness(['AAA', 'BBB', 'CCC'], 60, { autoplayOnLoad: false });
  await h.fire(h.YT.PlayerState.PLAYING);
  await h.fail(); // AAA 실패 -> BBB
  assert(h.seen.player.state === h.YT.PlayerState.PLAYING,
    `건너뛴 뒤 재생 중이어야 한다 (상태: ${h.seen.player.state})`);
});

await test('저장된 음량을 플레이어에 적용한다', async () => {
  const h = await harness(['AAA'], 35);
  eq(h.seen.volume, 35, '적용된 음량');
});

await test('stop 명령을 받으면 안내를 표시한다', async () => {
  const h = await harness(['AAA']);
  await h.sse('stop');
  assert(String(h.seen.overlay).includes('종료'), `안내 문구: ${h.seen.overlay}`);
});

console.log(failed ? `\n실패 ${failed}건` : '\n모두 통과');
process.exit(failed ? 1 : 0);
