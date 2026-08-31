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
