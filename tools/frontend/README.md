# 프론트엔드 모듈 검사

프론트엔드는 빌드 도구 없이 ES 모듈로 동작한다(`frontend/dist/js`).
번들러가 없으므로 import 오류가 실행 시점에야 드러나기 쉬워, 정적 검사를 둔다.

```bash
node tools/frontend/verify-modules.mjs
```

검사 항목:
- import 경로가 실제 파일을 가리키는지
- 가져오는 이름을 대상 모듈이 실제로 export 하는지
- 공용 이름(api, esc, toast, navigate 등)을 import 없이 쓰는지

자산이 바이너리에 포함되는지는 `go test ./frontend/` 가 확인한다.

## 재생 페이지 검사

영상 재생 팝업(`internal/adapter/popup/page.go` 안의 `<script>`)은 브라우저에서만 도는
코드라 Go 테스트가 닿지 않는다. YouTube IFrame API·fetch·EventSource 를 가짜로 세우고
실제 페이지 스크립트를 그대로 돌려 전환 동작을 확인한다.

```bash
node tools/frontend/verify-player-page.mjs
```

검사 항목:
- 영상이 끝나면 다음 영상으로 넘어가는지 (마지막 다음은 처음으로)
- 재생할 수 없는 영상(임베드 차단·삭제)을 만나면 그 영상만 건너뛰는지
- 재생목록 전체가 실패할 때만 워치독에 `error` 를 보고하는지
- 저장된 음량이 플레이어에 적용되는지
