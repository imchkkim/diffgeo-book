# /publish — diffgeo-book 배포

## 개요
빌드 결과를 lameproof.com (imchkkim.github.io) 에 배포한다.

## 주의사항
- Node.js는 한글 경로에서 segfault 발생 가능 → 반드시 `/tmp/diffgeo-build/`에서 빌드
- `gh` CLI 없음 → 직접 git 명령 사용

## 배포 절차

### 1. 빌드
```bash
# 의존성이 없으면 먼저 설치
cd /tmp/diffgeo-build && npm ls katex 2>/dev/null || npm install katex markdown-it@13 markdown-it-texmath

# 빌드 스크립트 복사 및 실행
cp /home/hakkyu/diffgeo-book/build.cjs /tmp/diffgeo-build/build.cjs
node build.cjs /home/hakkyu/diffgeo-book
```

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
