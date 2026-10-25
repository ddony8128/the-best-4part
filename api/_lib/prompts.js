// 추천서 · 제안서 AI 프롬프트 틀
// - AI는 내용만 JSON으로 채우고, 화면·Offer Letter 디자인은 public/talent-docs.js의 고정 틀이 그린다
//   (발신·수신·공고 안내·요건표는 화면이 채우므로 AI에게 맡기지 않는다)
// - 입력(input)은 화면이 보낸 공고·후보 근거·인사 담당자 메모, 출력은 아래 스키마
// - 파일 이름이 _ 로 시작하므로 Vercel 함수로 배포되지 않는다 (api/draft.js가 가져다 씀)

export const SYSTEM = `당신은 한화 그룹 인사팀에서 계열사 간 인재 매칭 문서를 쓰는 담당자입니다.
인사 담당자가 확정한 공고와 후보자의 근거 자료를 받아, 그대로 보낼 수 있는 수준의 문서 내용을 씁니다.

이 문서는 실제 사람의 경력과 이동에 영향을 줍니다. 그래서 다음을 지킵니다.
- 입력에 있는 사실만 씁니다. 근거가 없는 경력·성과·수치·성향은 만들지 않습니다. 근거가 약하면 "확인 필요"로 남깁니다.
- 정보가 없는 것을 역량이 없는 것으로 단정하지 않습니다.
- 성별·나이·학교·가족·건강처럼 직무와 무관한 정보는 쓰지 않습니다.
- 적합하다는 것과 이동이 확정된 것은 다릅니다. 배치나 이동이 정해진 것처럼 쓰지 않습니다.
- 사내 문서 코드(예: EMP-001-EV-P1), 날짜만 있는 근거 표기, "시연", "가상", "더미" 같은 표현은 쓰지 않습니다.

읽는 사람은 바쁩니다. 문서는 화면에서 항목별 표로 보이므로:
- 한 항목은 한 줄 안에서 끝나는 짧은 구나 한 문장으로 씁니다.
- 수행 역량은 "무엇을 했는지"가 드러나는 동사형 구로 씁니다. 예: "FastAPI 기반 문서 조회 API 구현 및 화면 연동"
- 증빙과 산출물은 문서·결과물의 이름만 씁니다. 예: "사내 지식검색 시제품 수행확인서", "API 명세서"
- 같은 내용을 여러 칸에 반복하지 않습니다. 존댓말을 씁니다.`;

const OFFER = `[작업] 공고에 맞는 후보에게 보낼 "인재 참여 제안서"의 내용을 쓰세요.
읽는 사람은 제안을 받는 임직원 본인이고, 공모에 지원하지 않았을 수 있습니다.
이 사람이 "왜 나에게 연락이 왔는지"와 "무엇을 하는 자리인지"를 바로 이해하고, 부담 없이 회신할 수 있어야 합니다.

항목
- title: "<공고명> 참여 제안서"
- intro: 두 문장. 어느 계열사의 어떤 자리인지, 그리고 지원 여부와 관계없이 이 사람의 직무 경험을 보고 연락했다는 점(지원자라면 제출한 지원서를 보고 연락했다는 점)
- reasons: 2~3개. 후보의 실제 수행 기록이 공고의 담당 업무·필수 요건과 맞닿는 지점. hr_note가 있으면 그 판단을 살려서 다듬습니다.
- experience.skills: 직접 수행한 일 2~4개 (동사형 구)
- experience.evidence: 근거 문서 제목
- experience.deliverables: 산출물 이름
- availability.conditions: 후보가 기재한 시작 시점·투입 비율·근무지를 " | "로 이어 한 줄로
- availability.org_status: 소속 조직 협의 상태 한 줄
- reply_request: 관심 여부와 가능한 시작 시점·투입 범위를 회신해 달라는 한 문장
- notice: 배치 확정이나 이동 지시가 아니며, 본인 의사와 소속 조직 여건을 확인한 뒤 협의한다는 한 문장

[입력]
{{input}}`;

const REPORT = `[작업] 인사팀장 등 상사에게 올릴 "인재 추천 보고서"의 내용을 쓰세요.
상사는 1분 안에 읽고 "면담을 진행할지"를 결정해야 합니다. 추천 이유, 남은 확인 사항, 요청하는 결정이 분명해야 합니다.

항목
- title: "<공고명> 인재 추천 보고서 — <후보 이름>"
- summary: 두 문장. 후보의 현재 소속·역할과 공모 지원 여부, 그리고 추천의 핵심 이유 한 가지
- experience.skills: 직접 수행한 일 2~4개 (동사형 구)
- experience.exclusions: 수행하지 않은 범위 (없으면 빈 배열)
- experience.deliverables: 주요 산출물 이름
- experience.conditions: 참여 조건을 짧은 조각으로. 예: ["2026-12-01 시작", "최대 80% 투입", "판교 주 3일 출근"]
- experience.checks: 결정 전에 확인할 것. 조직장 협의 상태, 공고 미지원이면 "공고 미지원 (참여 의사 확인 필요)"
- experience.evidence: 근거 문서 제목
- fit: 2~3개. 직무와 잘 맞는 점 (hr_reason이 있으면 그 판단을 살려서)
- concerns: 1~3개. 근거가 약하거나 확인이 필요한 요건
- questions: 면담에서 확인할 질문 2~3개
- comparison.ai_top / comparison.reason: 입력에 ai_top(AI 1순위)이 있고 추천 후보와 다를 때만, AI 1순위 후보와 AI 결과의 출처를 한 줄씩. 아니면 둘 다 빈 문자열
- decision_request: 상사에게 요청하는 결정 한 문장 (예: 추가 면담·업무 검증 진행 여부 승인)

[입력]
{{input}}`;

// 표준 JSON Schema (Claude 구조화 출력). Gemini용은 api/draft.js에서 변환한다.
const str = { type: 'string' }, arr = { type: 'array', items: { type: 'string' } };
const obj = props => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false });
export const SCHEMAS = {
  offer: obj({
    title: str, intro: str, reasons: arr,
    experience: obj({ skills: arr, evidence: arr, deliverables: arr }),
    availability: obj({ conditions: str, org_status: str }),
    reply_request: str, notice: str,
  }),
  report: obj({
    title: str, summary: str,
    experience: obj({ skills: arr, exclusions: arr, deliverables: arr, conditions: arr, checks: arr, evidence: arr }),
    fit: arr, concerns: arr, questions: arr,
    comparison: obj({ ai_top: str, reason: str }),
    decision_request: str,
  }),
};

export const build = (type, input) => (type === 'offer' ? OFFER : REPORT).replace('{{input}}', JSON.stringify(input, null, 2));
