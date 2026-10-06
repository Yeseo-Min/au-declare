# 호주 입국 신고 리스트 — 휴대폰 앱 버전

휴대폰으로 챙긴 음식·약을 한 장 찍으면 제품별로 잘라 영문명·성분·수량을 채우고,
검사관에게 보여줄 영문 신고 시트와 입국카드 작성 예시까지 만들어 주는 웹앱(PWA)이에요.
홈 화면에 추가하면 일반 앱처럼 쓸 수 있어요.

## 구성

```
au-declare/
├─ public/                 ← 휴대폰에서 열리는 앱
│  ├─ index.html           앱 화면 전체
│  ├─ manifest.webmanifest 홈 화면 설치 정보
│  ├─ sw.js                오프라인 캐시 (공항에서 인터넷 없어도 리스트가 열려요)
│  ├─ icon-192.png / icon-512.png
│  ├─ u2netp.onnx          AI 배경 제거 모델 (휴대폰 안에서 실행, Apache-2.0)
│  └─ ort*.js / ort*.wasm  모델 실행기 (onnxruntime-web 1.17.3, MIT)
├─ api/claude.js           서버 함수: 사진·글자를 Claude API로 전달 (API 키는 서버에만 보관)
├─ vercel.json             배포 설정 (서버 함수 최대 60초)
└─ package.json
```

## API 키 없이 먼저 써보기
API 키 없이 배포해도 앱은 작동해요. 사진 자동 인식과 Claude 자동 작성만 꺼지고, 나머지는 무료로 쓸 수 있어요.
- 제품 사전 검색(약 220개), 목록 붙여넣기, 수량 조절
- 사진 찍기, 흰 배경 처리, 모아 찍은 사진을 네모로 나눠 자르기
- 영문 신고 시트(PDF·이미지 저장), 입국카드 작성 예시

키 없이 쓸 때는 아래 **1단계를 건너뛰고**, 3단계에서 환경 변수를 넣지 않고 바로 Deploy 하면 돼요.
나중에 키를 추가하려면 Vercel 프로젝트 → Settings → Environment Variables에 `ANTHROPIC_API_KEY`를 넣고 Deployments에서 **Redeploy** 를 누르세요.

## 배포하기 (Vercel 기준, 20분 정도)

### 1. Claude API 키 만들기
1. https://console.anthropic.com 에 가입하고 결제 수단을 등록해요.
2. **API Keys → Create Key** 로 키를 만들고 복사해 둬요. (`sk-ant-...`로 시작)
3. **Limits** 메뉴에서 월 사용 한도를 작게(예: 몇 달러) 걸어 두세요. 링크가 새도 큰 요금이 나오지 않아요.

### 2. GitHub에 올리기
1. https://github.com 에서 새 저장소(예: `au-declare`)를 만들어요. 비공개(Private)로 해도 돼요.
2. **Add file → Upload files** 로 이 폴더 안의 파일과 폴더(`public`, `api`, `vercel.json`, `package.json`, `README.md`)를 그대로 끌어다 놓고 Commit 해요.

### 3. Vercel에 배포
1. https://vercel.com 에 GitHub 계정으로 로그인해요.
2. **Add New → Project** 에서 방금 만든 저장소를 **Import** 해요.
3. Framework Preset은 **Other** 로 두고, **Environment Variables** 에 아래를 넣어요.

| 이름 | 값 | 필수 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 1단계에서 복사한 키 | 필수 |
| `APP_PASSCODE` | 아무 비밀번호 (예: `sydney2026`) | 권장 — 넣으면 비밀번호를 아는 사람만 인식 기능을 쓸 수 있어요 |
| `CLAUDE_MODEL` | 사진 인식에 쓸 모델 ID | 선택 — 기본값 `claude-sonnet-5-5` |
| `CLAUDE_MODEL_QUICK` | 빠른 검색에 쓸 모델 ID | 선택 — 기본값 `claude-haiku-4-5-20251001` |

4. **Deploy** 를 누르면 `https://au-declare-xxxx.vercel.app` 같은 주소가 생겨요.

> 모델 ID가 바뀌었다는 오류가 나오면 https://docs.claude.com/en/docs/about-claude/models 에서 최신 ID를 확인해 `CLAUDE_MODEL` 에 넣고 다시 배포(Redeploy)하세요.

### 4. 휴대폰에 설치
1. 삼성 인터넷이나 크롬으로 배포 주소를 열어요.
2. 메뉴 → **홈 화면에 추가** (크롬은 **앱 설치**) 를 누르면 아이콘이 생겨요.
3. 앱에서 **연결 테스트** 를 눌러 "사진 요청 테스트: 성공"이 나오는지 확인해요.
   `APP_PASSCODE` 를 넣었다면 처음에 비밀번호 입력칸이 뜨니 넣고 저장하면 돼요.

## 비용
- 사진 한 장 인식 = Claude API 요청 1~2번이에요. 요금은 모델과 사진 크기에 따라 달라져요. 최신 요금은 https://www.anthropic.com/pricing 에서 확인하세요.
- 앱이 사진을 긴 변 1400px JPEG로 줄여서 보내서 요금이 덜 나와요.
- 배경 제거는 휴대폰 안에서 돌아가서 요금이 들지 않아요.
- Vercel 무료(Hobby) 요금제로 충분해요.

## 직접 고쳐 보려면
- 제품 사전: `public/index.html` 안의 `PF`(음식), `PM`(약품) 배열에 `['제조사','제품명','기본 분류','영문명']` 형식으로 한 줄씩 추가하면 돼요.
- 서버 동작: `api/claude.js` — 분당 요청 제한(`PER_MINUTE`), 이미지 개수 제한 등을 바꿀 수 있어요.
- 내 컴퓨터에서 실행: `npm i -g vercel` 후 폴더에서 `vercel dev` (환경 변수는 `.env.local` 파일에 `ANTHROPIC_API_KEY=...`).

## 알아둘 점
- 판정(신고·검사 대상 등)과 성분 정보는 참고용이에요. 공개 배포 전에 DAFF(호주 농림부)·TGA 기준과 실제 포장 성분표로 확인하세요.
- 리스트는 휴대폰 브라우저에만 저장돼요. 브라우저 데이터를 지우면 사라져요.
