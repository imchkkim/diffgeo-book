# /publish — diffgeo-book 배포

## 개요
빌드 결과를 lameproof.com (imchkkim.github.io) 에 배포한다.

## 주의사항
- **이 책(diffgeo-book/)만 배포한다.** 사이트 저장소 imchkkim.github.io 는 다른 책(dynamics-book, genrl-book, infogeo-book …)과 대문이 함께 쓰는 공용 저장소다. 그 폴더들과 루트 파일은 절대 건드리지 않는다(사용자 지시: "배포할때 이 저장소만 배포되고 다른 저장소는 건드리지 않게 할 것").
  - 루트에서 `git add -A` / `git commit -a` 금지. 스테이징·커밋은 `diffgeo-book/` 경로로만.
  - push 거절 시 `git pull --rebase` 후 재시도. force push 금지.
- 빌드는 저장소 루트에서 한다(build.cjs 가 `viz/shared/recolor.js` 를 상대 경로로 읽음).
- `gh` CLI 없음 → 직접 git 명령 사용

## 배포 절차

위 규칙을 강제하는 스크립트 하나로 한다. 직접 git 명령을 치지 말 것.

```bash
/home/hakkyu/diffgeo-book/tools/deploy.sh "커밋 메시지(한국어)"
```

스크립트가 하는 일: 빌드 → katex-error 검사 → 사이트 저장소 pull --rebase → `diffgeo-book/` 만 교체·스테이징 → 그 밖의 경로가 스테이징되면 중단 → `diffgeo-book/` 경로만 커밋 → push(거절 시 rebase 후 재시도, force 없음). 끝에 변경 파일 수를 출력한다.

배포 확인: `curl -s https://lameproof.com/diffgeo-book/<페이지> | grep -c '<새 문구>'` 가 1 이상이 될 때까지 기다린다(GitHub Pages 반영 1~2분).

## 배포 URL
https://lameproof.com/diffgeo-book/
