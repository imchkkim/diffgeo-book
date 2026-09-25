#!/usr/bin/env bash
# diffgeo-book 배포: 공용 사이트 저장소(imchkkim.github.io)의 diffgeo-book/ 폴더만 바꾼다.
# 다른 책(dynamics-book, genrl-book, infogeo-book …)과 대문 파일은 절대 건드리지 않는다.
#   - 스테이징은 diffgeo-book/ 경로로만 한다 (git add -A 루트 금지)
#   - diffgeo-book/ 밖의 변경이 스테이징되면 중단
#   - 이미 있던 다른 사람의 미커밋 변경은 그대로 둔다(건드리지 않음)
#   - push 거절 시 pull --rebase 후 재시도, force push 금지
set -euo pipefail

BOOK=/home/hakkyu/diffgeo-book
SITE=/tmp/imchkkim.github.io
DIR=diffgeo-book
MSG="${1:-diffgeo-book 갱신}"

# 1. 빌드 (저장소 루트에서)
cd "$BOOK"
npm run build >/dev/null
if grep -l katex-error dist/*.html >/dev/null 2>&1; then
  echo "중단: 수식 렌더 오류(katex-error)가 있다" >&2; exit 1
fi

# 2. 사이트 저장소 준비
if [ -d "$SITE/.git" ]; then
  git -C "$SITE" pull --rebase -q
else
  git clone -q https://github.com/imchkkim/imchkkim.github.io.git "$SITE"
fi
cd "$SITE"

# 3. diffgeo-book/ 만 교체
rm -rf "$DIR"
cp -r "$BOOK/dist" "$DIR"
git add -A -- "$DIR"

# 4. 스테이징 검사: diffgeo-book/ 밖이 하나라도 있으면 중단
outside=$(git diff --cached --name-only | grep -v "^$DIR/" || true)
if [ -n "$outside" ]; then
  echo "중단: $DIR/ 밖의 파일이 스테이징됨:" >&2; echo "$outside" >&2
  git reset -q -- $outside
  exit 1
fi
if git diff --cached --quiet; then
  echo "변경 없음 — 배포할 것이 없다"; exit 0
fi

git commit -q -m "$MSG" -- "$DIR"

# 5. push (거절되면 rebase 후 최대 3번 재시도, force 금지)
for i in 1 2 3; do
  if git push -q; then
    echo "배포 완료: $(git log --oneline -1)"
    git show --stat --format= HEAD | tail -1
    exit 0
  fi
  echo "push 거절 — pull --rebase 후 재시도 ($i)" >&2
  git pull --rebase -q
done
echo "중단: push 실패. 수동 확인 필요" >&2; exit 1
