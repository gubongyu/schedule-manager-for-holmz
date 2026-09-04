#!/usr/bin/env bash
# 릴리스 준비: 검사 → 빌드 → 체크섬 → 태그.
#
# 버전 문자열을 한 곳에서만 받아 태그와 빌드에 함께 쓴다. 태그와 exe 에 박힌 버전이
# 어긋나면 자동 업데이트가 잘못 판단하므로(같은 버전인데 새 버전으로 보이거나 그 반대),
# 두 값을 손으로 맞추지 않도록 이 스크립트를 거친다.
#
#   tools/release.sh v1.0.1
#
# 실제 배포(태그 푸시·GitHub 릴리스 생성)는 하지 않는다. 끝에 안내되는 명령을 확인하고
# 직접 실행한다.
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="${1:-}"
if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "사용법: tools/release.sh vX.Y.Z   (예: tools/release.sh v1.0.1)" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "오류: 커밋되지 않은 변경이 있습니다. 릴리스는 깨끗한 작업트리에서만 만듭니다." >&2
  git status --short >&2
  exit 1
fi

if git rev-parse -q --verify "refs/tags/$VERSION" >/dev/null; then
  echo "오류: 태그 $VERSION 이 이미 있습니다." >&2
  exit 1
fi

echo "== 검사 =="
go vet ./...
go test ./...
node tools/frontend/verify-modules.mjs
node tools/frontend/verify-player-page.mjs

echo
echo "== 빌드 ($VERSION) =="
mkdir -p build
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -tags desktop,production \
  -ldflags "-w -s -H windowsgui -X main.version=$VERSION" \
  -o build/holmz.exe ./cmd/holmz

# 체크섬 파일에는 파일명만 남긴다. 경로가 섞이면 릴리스 자산으로 받은 뒤
# sha256sum -c 검증이 실패한다.
(cd build && sha256sum holmz.exe > holmz.exe.sha256)

# 주입된 버전이 실제 바이너리에 들어갔는지 확인한다.
# grep -q 로 조기 종료시키면 strings 가 SIGPIPE 로 죽어 pipefail 에 걸리므로,
# 입력을 끝까지 읽는 grep -c 를 쓴다 (매치가 없을 때의 종료코드 1은 || true 로 흡수).
version_hits=$(strings build/holmz.exe | grep -cx -- "$VERSION" || true)
if [[ "${version_hits:-0}" -eq 0 ]]; then
  echo "오류: 빌드된 exe 에서 $VERSION 문자열을 찾지 못했습니다." >&2
  exit 1
fi

echo "  build/holmz.exe  $(stat -c%s build/holmz.exe) bytes"
echo "  $(cat build/holmz.exe.sha256)"

echo
echo "== 태그 =="
git tag -a "$VERSION" -m "$VERSION"
echo "  $VERSION -> $(git rev-parse --short HEAD)"

cat <<EOF

준비가 끝났습니다. 배포하려면:

  git push origin $VERSION
  gh release create $VERSION build/holmz.exe build/holmz.exe.sha256 \\
    --title "$VERSION" --notes "릴리스 내용"

되돌리려면:  git tag -d $VERSION
EOF
