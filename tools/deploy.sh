#!/usr/bin/env bash
# diffgeo-book 배포 — 네 책은 공용 배포 도구 하나로 올린다(2026-09-27 저자 확인).
# 공용 도구가 하는 일: 빌드 → 배포 전 검사(빌드 경고, 수식 명령 노출, KaTeX 오류)에 걸리면 중단
#   → 사이트 저장소(~/imchkkim.github.io)의 diffgeo-book/ 만 맞춤 → 그 폴더와 대문·상태 파일만 커밋 → push.
# 사용: tools/deploy.sh            (인자는 받지 않는다. 커밋 메시지는 공용 도구가 「diffgeo-book 갱신」으로 쓴다)
#       tools/deploy.sh --dry      (계산만, 사이트 저장소를 건드리지 않음)
set -euo pipefail
exec node "$HOME/lameproof/bin/deploy.cjs" diffgeo-book "$@"
