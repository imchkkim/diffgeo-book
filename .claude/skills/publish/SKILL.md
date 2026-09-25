# /publish — diffgeo-book 배포

## 개요
빌드 결과를 lameproof.com (imchkkim.github.io) 에 배포한다.

## 주의사항
- 빌드는 **저장소 루트에서** 한다. build.cjs 가 `viz/shared/recolor.js`(색 SSOT)를 상대 경로로 읽으므로 /tmp 복사본으로는 안 된다. (node v24 에서 한글 경로 segfault 재현 안 됨, 2026-09-25 확인)
- `gh` CLI 없음 → 직접 git 명령 사용

## 배포 절차

### 1. 빌드
```bash
cd /home/hakkyu/diffgeo-book && npm run build
```
출력에 `katex-error` 가 없는지: `grep -l katex-error dist/*.html` 이 비어 있어야 한다.

### 2. 배포 레포 준비
```bash
cd /tmp
if [ -d imchkkim.github.io ]; then
  cd imchkkim.github.io && git pull
else
  git clone https://github.com/imchkkim/imchkkim.github.io.git
  cd imchkkim.github.io
fi
```

### 3. 복사 및 푸시
```bash
rm -rf /tmp/imchkkim.github.io/diffgeo-book
cp -r /home/hakkyu/diffgeo-book/dist /tmp/imchkkim.github.io/diffgeo-book
cd /tmp/imchkkim.github.io
git add diffgeo-book
git commit -m "Update diffgeo-book"
git push
```

## 배포 URL
https://lameproof.com/diffgeo-book/
