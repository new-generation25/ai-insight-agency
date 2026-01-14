# AI Insight Agency 구현 상세 계획서 (v4.0: Standalone Agentic App)

**작성자:** JENNY (AI System Architect)  
**수신자:** MAX  
**날짜:** 2026-01-11  
**목표:** Pure JS & Gemini API 기반의 독립적인 '지능형 기획서 작성 에이전트' 웹 서비스 구축

## 1. 프로젝트 개요 및 아키텍처 (Overview)

기존 Reveal.js 종속성을 완전히 제거하고, **독립적인 웹 애플리케이션(SPA)**으로 구축합니다.
중앙의 Supervisor AI가 사용자의 상태를 판단하여 적절한 도구(Sub-agents)를 호출하는 **'Multi-Agent System'**입니다.

### Agent Roster (AI 팀 구성)

- 🎩 **Supervisor (오케스트레이터):** 사용자 의도 파악, 진행 단계 관리, 서브 에이전트 호출.
- 📂 **Analyst (분석가):** 업로드된 파일(공고문) 분석, 필수 요건 및 제약사항 추출.
- 🎤 **Interviewer (인터뷰어):** 적응형 질문 수행, "잘 모르겠다" 시 예시/객관식 제안.
- ✍️ **Drafter (작가):** 수집된 정보를 바탕으로 마크다운 기획서 작성.
- ⚖️ **Critic (심사위원):** 작성된 초안을 평가(점수화)하고 구체적 보완점 제시.

## 2. 파일 구조 (File Structure)

- `index.html`: 메인 진입점. (기존 agency.html 대체)
- `css/style.css`: Glassmorphism UI, 채팅창, 모달 스타일링.
- `js/main.js`: 앱 초기화, DOM 이벤트 핸들링.
- `js/agent-system.js`: 에이전트 프롬프트 관리 및 Gemini 호출 로직.
- `js/drive-api.js`: [NEW] Google Drive API 연동 (파일 저장/불러오기).
- `config.js`: API KEY 및 환경설정 (사용자 정보 프리셋).

## 3. 상세 프로세스 시나리오 (Process Flow)

MAX님이 요청하신 9단계 프로세스는 다음과 같이 에이전트 로직에 매핑되어 구현됩니다.

### Phase 1: Context Setup (환경 설정)

#### Step 1: 자기소개 (User Context)

- **Supervisor:** "안녕하세요, 작가님. 오늘은 어떤 기획을 하시나요? (장르/지역 등)"
- 사용자 입력 시 Context 메모리에 저장.

#### Step 2: 파일 첨부 (File Context)

- **기능:** 로컬 파일 업로드 또는 Google Drive 파일 선택.
- **Action:** 파일이 감지되면 Supervisor가 Analyst 호출.
- **Analyst:** "공고문을 분석하여 '청년 창업 트랙'에 맞는 전략을 수립하겠습니다."

### Phase 2: Interactive Interview (심층 인터뷰)

#### Step 3: 지원 부문 & 공통 질문

- **Interviewer:** Analyst가 추출한 정보를 바탕으로 필수 질문(트랙, 분야) 우선 수행.
- 이어서 사업의 목적, 차별점 등 공통 요소(3~10개) 순차 질문.

#### Step 4: 파일 기반 심화 질문

- **Interviewer:** "공고문 3페이지의 '성과 목표'는 어떻게 설정하실 건가요?" (Analyst 정보 활용)

#### Step 5: 적응형 질문 (Adaptive Skip)

- **상황:** 사용자가 "잘 모르겠어요" 또는 모호한 답변 선택.
- **Interviewer (Reaction):** "그렇다면, **[A: 안정적인 3단계 성장]**과 [B: 공격적인 초기 확장] 중 어느 쪽이 끌리시나요?" (객관식 변환).

### Phase 3: Drafting & Refinement (작성 및 보완)

#### Step 6: 초안 생성

- **Drafter:** Context(자기소개 + 파일분석 + 인터뷰답변)를 모두 종합하여 구조화된 초안 작성.

#### Step 7: AI 평가 (Critic)

- **Critic:** "현재 점수는 78점입니다. '시장 분석'이 다소 약합니다." (피드백 제공)

#### Step 8: 추가 의견 반영

- **사용자:** "시장 분석에 경쟁사 내용을 좀 더 넣어줘."
- **Drafter:** 피드백 반영하여 수정본(v2) 생성.

#### Step 9: 최종 산출물

- **기능:** 완성된 기획서를 Google Drive에 저장(js/drive-api.js 활용) 또는 PDF/Markdown 다운로드.

## 4. 에이전트 프롬프트 설계 (System Instructions)

각 에이전트의 페르소나와 임무를 정의합니다.

### 4.1. 🎩 Supervisor (메인 조율자)

```javascript
const SUPERVISOR_PROMPT = `
당신은 'AI Insight Agency'의 총괄 매니저입니다.
대화 맥락을 파악하여 다음 행동을 결정하는 JSON을 출력하세요.

[상태 판단 가이드]

1. 파일이 업로드 됨 -> "Analyst" 호출.
2. 분석 완료 후 구체적 정보 필요 -> "Interviewer" 호출.
3. 정보 수집 완료 -> "Drafter" 호출.
4. 초안 작성 완료 -> "Critic" 호출.
5. 평가 후 수정 요청 -> "Drafter" 재호출.

[Output JSON]
{
  "thought": "사용자가 파일을 올렸으니 분석이 필요하다.",
  "next_agent": "Analyst",
  "system_message": "공고문을 꼼꼼히 분석하고 있습니다..."
}
`;
```

### 4.2. 📂 Analyst (문서 분석가)

```javascript
const ANALYST_PROMPT =`
당신은 '문서 분석 전문가'입니다.
업로드된 파일(공고문)을 분석하여 핵심 제약사항을 JSON으로 추출하세요.

[추출 항목]

1. tracks: 지원 분야/트랙 구분
2. required_questions: 필수 기재 항목에 대한 질문 리스트
3. evaluation_criteria: 심사 기준 및 배점
`;
```

### 4.3. 🎤 Interviewer (적응형 인터뷰어)

```javascript
const INTERVIEWER_PROMPT =`
당신은 '전문 인터뷰어'입니다.
@Analyst의 분석 결과와 사용자 정보를 바탕으로 정보를 수집하세요.

[핵심 행동 지침: Smart Skip]
사용자가 답변을 어려워하거나 "모르겠다"고 하면, 질문을 반복하지 말고
**'이해하기 쉬운 예시'**나 **'선택지(A/B)'**를 제시하여 답변을 유도하세요.
`;
```

### 4.4. ✍️ Drafter (전문 작가)

```javascript
const DRAFTER_PROMPT =`
당신은 '전문 기획서 작가'입니다.
수집된 정보를 바탕으로 [마크다운 포맷]의 기획서를 작성하세요.
**bold** 처리는 꼭 필요한 헤더나 핵심 키워드에만 제한적으로 사용하세요.
`;
```

### 4.5. ⚖️ Critic (심사위원)

```javascript
const CRITIC_PROMPT =`
당신은 '냉철한 심사위원'입니다.
기획서를 평가하고 [점수], [합격 가능성 %], [보완점]을 제시하세요.
할루시네이션이 없도록 근거 없는 수치는 포함하지 마세요.
`;
```

## 5. 구현 로드맵 (Standalone)

- **UI 스캐폴딩 (index.html, style.css):** 채팅 인터페이스 및 파일 업로드 존 구축.
- **Google Drive API 연동 (drive-api.js):** OAuth 2.0 클라이언트 설정 및 파일 읽기/쓰기 테스트.
- **Gemini Core (agent-system.js):** 멀티턴 대화 및 시스템 프롬프트 교체 로직 구현.
- **시나리오 통합:** Supervisor 로직을 통해 전체 9단계 흐름 연결.
