# /publish — diffgeo-book 배포

## 개요
빌드 결과를 lameproof.com (imchkkim.github.io) 의 `diffgeo-book/` 에 올린다. 네 책은 공용 배포 도구 하나로 배포한다(2026-09-27 저자 확인).

## 주의사항
- **이 책(diffgeo-book/)만 배포한다.** 사이트 저장소는 네 책과 대문이 함께 쓴다(사용자 지시: "배포할때 이 저장소만 배포되고 다른 저장소는 건드리지 않게 할 것"). 공용 도구는 옮긴 책 폴더와 대문·배포 상태 파일만 커밋하고, 그 밖의 변경은 남겨 둔다.
- 커밋과 배포는 저자가 말할 때만 한다.
- 직접 git 명령을 치지 말 것.

## 배포 절차

```bash
/home/hakkyu/diffgeo-book/tools/deploy.sh --dry   # 계산만 (사이트 저장소를 건드리지 않음)
/home/hakkyu/diffgeo-book/tools/deploy.sh         # = cd ~/lameproof && node bin/deploy.cjs diffgeo-book
```

공용 도구가 하는 일: 빌드 → 배포 전 검사(`~/lameproof/lib/check.cjs`: 빌드 경고, 화면에 드러난 수식 명령, KaTeX 오류)에 걸리면 올리지 않음 → `~/imchkkim.github.io/diffgeo-book/` 을 맞춤 → 커밋(메시지 「diffgeo-book 갱신」) → push.

배포 확인: `curl -s https://lameproof.com/diffgeo-book/<페이지> | grep -c '<새 문구>'` 가 1 이상이 될 때까지 기다린다(GitHub Pages 반영 1~2분).

## 배포 URL
https://lameproof.com/diffgeo-book/
