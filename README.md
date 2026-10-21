# TALENT LINK — 한화 AI 솔루션 챌린지 (자유주제 · 인사 매칭 AI)

TF·공석이 생기면 그룹 전체(계열사 불문)에서 적합한 인재를 찾아 근거와 함께 추천하는 서비스.
기획 기록은 [`docs/project-notes.md`](docs/project-notes.md)에 있습니다.

- 배포 주소: https://talent-link-seven.vercel.app (main에 push하면 1~2분 내 자동 반영)
- 저장소: https://github.com/ddony8128/the-best-4part

---

## 팀원 작업 방법 (가장 간단한 순서)

### 방법 A. GitHub 웹에서 바로 수정 — 설치 없음
1. 저장소 페이지에서 수정할 파일을 클릭 → 연필(✏️) 아이콘
2. 내용 수정 → 아래 **Commit changes** 버튼
3. 1~2분 뒤 Vercel이 자동으로 다시 배포합니다

문서(`docs/`)나 작은 수정은 이 방법이 제일 빠릅니다.

### 방법 B. GitHub Desktop — 설치만 하면 클릭으로 끝
1. https://desktop.github.com 설치 후 GitHub 로그인
2. **File → Clone repository** → `ddony8128/the-best-4part` 선택
3. 파일을 고쳐서 저장하면 왼쪽에 변경 목록이 뜹니다
4. 아래 설명 칸에 한 줄 적고 **Commit to main** → 위쪽 **Push origin**
5. 작업을 시작하기 전에는 항상 **Fetch origin / Pull**을 먼저 누르세요

### 방법 C. 터미널
```bash
git clone https://github.com/ddony8128/the-best-4part.git
cd the-best-4part
# ... 파일 수정 ...
git pull                      # 시작 전 최신 상태로
git add .
git commit -m "무엇을 바꿨는지 한 줄"
git push
```

### 공통 규칙
- **작업 전 Pull, 작업 후 바로 Push.** 오래 들고 있으면 충돌이 납니다.
- 같은 파일을 동시에 고치지 않도록 카톡으로 "나 `public/xxx.html` 만질게" 한 마디.
- API 키·비밀번호는 절대 코드나 커밋에 넣지 않습니다. Vercel 환경변수에만 둡니다.
- 실제 임직원 정보·회사 기밀을 넣지 않습니다. 모든 데이터는 가상입니다.

> 처음 참여하는 팀원은 저장소 소유자에게 GitHub 아이디를 알려 **Collaborator 초대**를 받아야 Push할 수 있습니다.
> (저장소 → Settings → Collaborators → Add people)

---

## 폴더 구조
```
public/      배포되는 웹 화면 (HTML/CSS/JS). 여기 파일이 그대로 사이트가 됩니다.
  index.html            시작 페이지 (인사 담당자 / 지원자 입구)
  hr_matching.html      AI 인재 매칭: JD → 요건 확정 → 전수 스캔 → 상위 10명 → 추천서·제안서
  talent_hr_admin.html  인사팀 채용 운영 콘솔 (팀원 참고 파일 기반)
  employee.html         임직원: 받은 제안 · 적합도 진단 · 보충할 점 · 바로 지원
api/         Vercel 서버 함수 자리 (LLM 호출 등). 키는 환경변수로 읽습니다.
docs/        기획 기록 (project-notes.md, submission-draft.md)
reference/   원본 참고 파일 (수정하지 않음)
video/       과제 소개 영상 (Remotion) + 화면 녹화·브라우저 테스트 스크립트
```

세 화면은 같은 브라우저 저장소(localStorage)로 연결됩니다. 인사 매칭에서 제안서를 보내면 임직원 화면에 "받은 제안"으로 뜨고, 임직원이 지원하면 인사 콘솔의 지원자 목록과 운영 기록에 나타납니다. 모든 데이터는 가상이고 AI 결과는 시연용 모의 생성입니다.

## 영상 다시 만들기
```bash
cd video
npm install
node scripts/e2e.mjs          # 세 화면 연결 흐름 테스트 (15개 항목)
node scripts/record.mjs       # 실제 화면 조작을 녹화 → public/rec/*.mp4, src/recordings.json
npx remotion studio src/index.tsx                                   # 미리보기·수정
npx remotion render src/index.tsx TalentLink out/talent-link.mp4   # 렌더
```
자막은 `video/src/Main.tsx`의 `HR_CAPTIONS` / `EMP_CAPTIONS`, 장면은 `video/src/scenes.tsx`에서 고칩니다.

## 로컬에서 보기
빌드가 없습니다. `public/index.html`을 브라우저로 열면 됩니다.
서버 함수(`api/`)까지 같이 보려면:
```bash
npm i -g vercel      # 한 번만
vercel dev           # http://localhost:3000
```

## 배포
`main` 브랜치에 Push하면 Vercel이 자동 배포합니다. 수동 배포가 필요하면 `vercel --prod`.
