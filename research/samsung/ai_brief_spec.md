# AI·AX 기사 수집 규칙 (공통)

목적: 삼성 계열사 임원과 미팅하기 전에, 회사별로 AI·AX(디지털 전환)에서 무엇에 관심을 두고 무엇을 하고 있는지를 기사로 이해한다.

기간: 2025-10-01 ~ 2026-10-29 (최신 우선). 오늘은 2026-10-29.

## 찾을 것 (회사마다)
- AI·AX 조직 신설·개편, 책임자 선임(CAIO, AX센터장, AI센터장 등)
- 사내 AI 도입(업무 자동화, 생성형 AI, 사내 에이전트, 코딩 AI 등)과 그 성과 수치
- AI를 쓴 사업·제품·공장(AI 팩토리, 디지털 트윈, 로봇, AI 신약 등)
- 외부 파트너십(엔비디아, 오픈AI, 구글 등), 투자, 인력 육성
- 경영진의 AI 관련 발언(신년사, 컨퍼런스 기조연설, 인터뷰)

## 확인 방법
- 이 환경은 뉴스 사이트 직접 접속이 막혀 있다. WebSearch만 쓴다(필요하면 ToolSearch "select:WebSearch"로 불러온다).
- 검색 결과에 실제로 나온 URL·제목·매체·날짜만 쓴다. 지어내지 않는다. 확인 못 하면 넣지 않는다.
- 같은 사건을 다른 매체가 다룬 검색 결과 수를 confirm 에 적는다(1이면 single_source_note 에 이유).

## 사람·조직 연결
- 공시 임원 명단: /home/user/test_20260206/data/001_삼성.json 의 companies[].executives (nm, ofcps, chrg_job). 회사 키는 companies[].dart_name.
- 기사에 나온 사람 이름은 people 에, 기사 속 직함은 people_roles 에 적는다. 공시 명단에 같은 이름이 있으면 그대로 쓰고, 없어도 기사 그대로 적는다.
- 기사 속 조직이 공시 담당업무(chrg_job)에 나오는 조직명과 같으면 units 에 그 이름을 적는다(예: "AI센터", "AX센터"). 아니면 unit_hint 에 기사 표현을 적는다.
- 덧붙여, 기사 주제와 직접 관련된 공시 임원(담당업무에 그 조직이 들어 있는 사람)을 related 에 이름 목록으로 적는다. 공시 명단에서 확인한 사람만.

## 출력 (JSON, UTF-8, indent=1)
{
 "companies": [
  {
   "company": "삼성에스디에스",            // dart_name 그대로. 공시 명단에 없는 계열사는 공식 약칭(예: "삼성디스플레이")
   "interest_summary": "3~4문장. 이 회사가 AI·AX에서 지금 무엇에 집중하는지, 왜인지(기사 근거만)",
   "themes": ["짧은 주제 3~5개"],
   "talking_points": ["미팅에서 물어볼 만한 질문 2~4개 (기사에서 나온 사실에 기대어)"],
   "key_people": [{"name":"", "role":"공시 또는 기사 직함", "why":"왜 만나야 하는지 한 줄", "source":"공시|기사"}],
   "articles": [
     {"date":"YYYY-MM-DD","outlet":"","title":"","url":"","summary":"60자 이내 한국어","category":"조직|도입|사업|파트너십|발언|인사",
      "people":[],"people_roles":{},"units":[],"unit_hint":"","related":[],"confirm":1,"single_source_note":"","grade":"1차|주요|기타"}
   ]
  }
 ]
}
회사마다 기사 3~8건을 목표로 하되, 찾을 수 없으면 적은 대로 두고 interest_summary 에 "공개 기사 적음"이라고 쓴다.
