// 추천서 · 제안서 AI 프롬프트 틀
// - AI는 내용만 JSON으로 채우고, 화면·Offer Letter 디자인은 public/talent-docs.js의 고정 틀이 그린다
// - 입력(input)은 화면이 보낸 공고·후보 근거·발신/수신 정보, 출력은 아래 스키마
// - 파일 이름이 _ 로 시작하므로 Vercel 함수로 배포되지 않는다 (api/draft.js가 가져다 씀)

export const SYSTEM = `당신은 한화 그룹 인사팀의 인재 매칭 문서 작성 보조입니다.
인사 담당자가 확정한 공고 요건과 후보자의 근거 자료만 사용해 문서 초안을 씁니다.

반드시 지킬 규칙
1. 입력에 있는 사실만 씁니다. 입력에 없는 경력·역량·성과·수치를 만들지 않습니다.
2. 근거가 없는 항목은 "확인 필요"로 쓰고, 정보가 없다는 이유로 역량이 부족하다고 단정하지 않습니다.
3. 성별·나이·출신 학교·가족 관계·건강 등 직무와 무관한 개인 정보는 언급하지 않습니다.
4. 성향을 추측하지 않습니다. 성향은 수행 기록에서 드러난 행동으로만 설명합니다.
5. 사내 문서 코드(예: EMP-001-EV-P1), 작업용 표기, "시연" 같은 표현을 출력하지 않습니다.
6. 존댓말로, 한 항목은 한 문장 이내로 짧게 씁니다. 같은 내용을 반복하지 않습니다.
7. 적합성과 실제 이동 가능 여부는 별개입니다. 이동·배치가 확정된 것처럼 쓰지 않습니다.
8. 출력은 지정된 JSON 형식만 사용합니다.`;

export const OFFER = `[작업] 아래 후보에게 보낼 "인재 참여 제안서" 내용을 작성하세요.
읽는 사람: 제안을 받는 임직원 본인 (공모에 지원하지 않았을 수 있음)
목적: 이 자리가 무엇인지, 왜 이 사람에게 제안하는지 근거와 함께 알리고 참여 의사를 묻는다.

작성 기준
- title: "<공고명> 참여 제안서"
- intro: 2문장. 어느 조직의 어떤 자리인지, 지원 여부와 관계없이 경험을 보고 연락했다는 점
- reasons: 2~3개. 후보의 수행 기록과 공고 요건이 맞닿는 지점
- experience.skills: 후보가 직접 수행한 일을 동사로 끝나는 짧은 구로 (최대 4개)
- experience.evidence: 근거 문서 제목만 (날짜·코드 제외)
- experience.deliverables: 산출물 이름만
- availability: 후보가 기재한 참여 조건과 소속 조직 협의 상태를 그대로
- reply_request: 관심 여부와 가능한 시작 시점·투입 범위를 회신해 달라는 1문장
- notice: 배치 확정이나 이동 지시가 아니며 본인 의사와 소속 조직 여건을 확인한 뒤 협의한다는 1문장

[입력]
{{input}}`;

export const REPORT = `[작업] 상사에게 올릴 "인재 추천 보고서" 내용을 작성하세요.
읽는 사람: 인사팀장 등 보고받는 상사 (짧게 읽고 판단해야 함)
목적: 왜 이 후보를 추천하는지, 무엇을 더 확인해야 하는지, 무엇을 결정해 달라는지 전달한다.

작성 기준
- title: "<공고명> 인재 추천 보고서 — <후보 이름>"
- summary: 2문장. 후보의 현재 소속·역할, 공모 지원 여부, 추천의 핵심 이유
- experience.skills: 직접 수행한 일 (최대 4개), experience.exclusions: 수행하지 않은 범위
- experience.deliverables / conditions / checks / evidence: 입력의 값을 짧게 정리
  - checks에는 조직장 협의 상태, 공고 지원 여부(미지원이면 "참여 의사 확인 필요")를 넣는다
- fit: 2~3개, concerns: 1~3개 (근거가 약하거나 확인이 필요한 요건)
- questions: 면담에서 확인할 질문 2~3개
- comparison: 입력에 ai_top(AI 1순위)이 있고 추천 후보와 다를 때만 작성
- decision_request: 상사에게 요청하는 결정 1문장 (예: 추가 인터뷰 진행 여부 승인)

[입력]
{{input}}`;

const S = { type: 'STRING' }, A = { type: 'ARRAY', items: { type: 'STRING' } };
export const SCHEMAS = {
  offer: {
    type: 'OBJECT',
    properties: {
      title: S, intro: S, reasons: A,
      experience: { type: 'OBJECT', properties: { skills: A, evidence: A, deliverables: A } },
      availability: { type: 'OBJECT', properties: { conditions: S, org_status: S } },
      reply_request: S, notice: S,
    },
    required: ['title', 'intro', 'reasons', 'experience', 'availability', 'reply_request', 'notice'],
  },
  report: {
    type: 'OBJECT',
    properties: {
      title: S, summary: S,
      experience: { type: 'OBJECT', properties: { skills: A, exclusions: A, deliverables: A, conditions: A, checks: A, evidence: A } },
      fit: A, concerns: A, questions: A,
      comparison: { type: 'OBJECT', properties: { ai_top: S, reason: S } },
      decision_request: S,
    },
    required: ['title', 'summary', 'experience', 'fit', 'concerns', 'questions', 'decision_request'],
  },
};

export const build = (type, input) => (type === 'offer' ? OFFER : REPORT).replace('{{input}}', JSON.stringify(input, null, 2));
