# 책표지 열쇠고리 메이커

책을 검색해 아크릴 열쇠고리 내경(기본 31 × 45mm)에 맞는 앞·뒷면 표지를 만들고, 앞뒤를 한 조각으로 합쳐 A4 인쇄용 PDF로 내려받는 웹 앱입니다.

## 빠른 시작

```bash
npm install
cp .env.example .env.local   # API 키 입력 (아래 참고)
npm run dev                  # http://localhost:3000
```

API 키 없이 화면만 확인하려면 샘플 데이터로 실행하세요.

```bash
BOOK_PROVIDER=mock npm run dev
```

## 도서 API

검색은 서버의 `/api/books/search`를 거칩니다. API 키는 서버 환경변수에만 둡니다. 설정된 제공자를 아래 순서로 시도하고, 실패하면 다음 제공자로 넘어갑니다.

| 순서 | 제공자 | 환경변수 | 비고 |
| --- | --- | --- | --- |
| 1 | YES24 | `YES24_API_URL`, `YES24_API_KEY` | **공개 API 없음.** 제휴 승인 후 `src/lib/providers/yes24.ts` 구현 필요 |
| 2 | 알라딘 TTB | `ALADIN_TTB_KEY` | 표지 최대 500px (`cover500`) |
| 3 | 카카오 책 검색 | `KAKAO_REST_KEY` | 썸네일 URL에서 원본 이미지 추출 |
| 4 | Google Books | (선택) `GOOGLE_BOOKS_API_KEY` | 키 없이 동작, 표지가 작음 |
| - | 샘플 | `BOOK_PROVIDER=mock` | 오프라인 개발·테스트용 |

`BOOK_PROVIDER`를 지정하면 그 제공자 하나만 사용합니다.

## 기능 (PRD 대응)

| PRD | 구현 |
| --- | --- |
| F-01 도서 검색 | 제목·저자·ISBN 검색, 20건씩 페이지 이동, 24시간 서버 캐시 |
| F-02 고해상도 표지 | 큰 표지 우선, 실패 시 썸네일. 이미지 프록시(`/api/image`, 허용 호스트만)로 CORS 해결. 300dpi 미만이면 경고 |
| F-03 앞면 | 채우기/맞추기, 확대 슬라이더, 미리보기에서 드래그로 위치 이동. 채우기는 항상 도련까지 덮음 |
| F-04 뒷면 | 뒷표지 이미지가 있으면 사용. 없으면 자동 템플릿(표지 대표색, 제목·저자·출판사, 소개, ISBN 바코드). 이미지 업로드 가능 |
| F-05 사이즈 변경 | 가로·세로 0.5mm 단위(10~150mm), 가로↔세로 전환, 프리셋 |
| F-06 합치기 | 좌우 펼침(뒷면 \| 앞면), 상하 펼침(뒷면 180° 회전), 따로 자르기 |
| F-07 인쇄 목록 | 수량, 순서, 편집, 삭제. 브라우저에 저장되어 새로고침 후에도 유지 |
| F-08 PDF | 실제 크기 PDF, 자동 배치, 크롭 마크, 자르는 선·접는 선 |
| F-09 테스트 자 | 첫 장 하단에 50mm 자 |
| F-10 용지 | A4, A5, Letter, 4×6인치 |
| F-11 직접 업로드 | "내 이미지로 만들기" |

## 출력 치수

- 한 면 = 내경 − 끼움 여유(기본 0.5mm) → 30.5 × 44.5mm
- 좌우 펼침 한 조각 = 61 × 44.5mm, 바깥쪽에만 도련 1mm (접는 선에는 도련 없음)
- A4, 여백 10mm, 간격 2mm, 테스트 자 공간 14mm → **3열 × 5행 = 15개/장**
- 한 줄에 들어가는 개수: `n = ⌊(사용 폭 − 2 × 도련 + 간격) / (조각 폭 + 간격)⌋`. 간격은 항상 도련 × 2 이상(작으면 도련을 줄임)
- 이미지는 지정 dpi(기본 300)로 렌더링해 JPEG로 넣고, 선·자는 벡터로 그립니다.

인쇄할 때는 **"실제 크기 / 100%"**를 선택하세요.

## 구조

```
src/
  app/
    page.tsx                  화면 (검색 · 편집 · 설정 · 인쇄 목록)
    api/books/search          도서 검색 (제공자 선택 + 캐시)
    api/books/[isbn]          ISBN 상세 조회
    api/image                 표지 이미지 프록시 (허용 호스트, 10MB 제한, 리디렉션 검사)
    api/mock-cover            샘플 표지 SVG
  components/                 SearchPanel, Editor, SettingsPanel, PrintList
  lib/
    layout.ts                 mm 단위 배치 계산 (순수 함수)
    pdf.ts                    pdf-lib로 PDF 생성 (브라우저·Node 공용)
    render.ts                 캔버스 렌더링: 면, 뒷면 템플릿, 합치기 (브라우저 전용)
    ean13.ts                  ISBN 정규화, EAN-13 바코드
    providers/                yes24 · aladin · kakao · google · mock 어댑터
tests/                        Vitest 단위 테스트
scripts/e2e-smoke.cjs         Playwright 브라우저 스모크 테스트
```

## 테스트

```bash
npm test            # 단위 테스트 (배치 계산, 바코드, 제공자 매핑, 프록시 허용 목록, PDF)
npm run typecheck
npm run build

# 브라우저 스모크 테스트 (Playwright 필요)
BOOK_PROVIDER=mock PORT=3100 npm start &
node scripts/e2e-smoke.cjs ./test-output
```

## 남은 일

- YES24 제휴 API 규격 확보 후 `yes24.ts` 구현
- 실제 프린터로 출력해 열쇠고리에 끼워 보고 기본 끼움 여유(0.5mm) 확정
- 표지 저작권 안내 문구 (개인·비상업 용도)
- P2: PNG 개별 내보내기, 텍스트 오버레이
