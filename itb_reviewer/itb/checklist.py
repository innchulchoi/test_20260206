"""입찰안내서(ITB) 주요 검토 항목 정의.

건설·EPC 입찰 검토에서 통상 확인하는 항목을 5개 분류, 26개 항목으로 정리했다.
- query: BM25 검색어 (한·영 동의어 포함)
- anchors: 근거 문장을 고를 때 반드시 포함돼야 하는 핵심어 (정규식, 대소문자 무시)
- value_type: 규칙 기반 값 추출 방식 (date | percent | duration | amount | text)
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Item:
    key: str
    label: str
    category: str
    query: str
    anchors: str
    value_type: str
    guide: str  # 검토 포인트 (LLM 프롬프트와 화면 툴팁에 사용)
    exclude: str = ""  # 이 패턴이 있는 문장은 다른 항목의 근거이므로 제외


CATEGORIES = ["일반 정보", "입찰 절차", "보증·지급", "공기·지체", "계약 리스크"]

ITEMS: list[Item] = [
    # ── 일반 정보
    Item("project_name", "프로젝트명", "일반 정보",
         "project name title works 프로젝트 공사명 사업명 건명", r"project|works|공사명|사업명|건명", "text",
         "공식 프로젝트(공사)명", exclude=r"분쟁|dispute"),
    Item("employer", "발주처", "일반 정보",
         "employer owner client purchaser authority 발주처 발주기관 수요기관 계약상대자", r"employer|owner|client|purchaser|authority|발주", "text",
         "발주처(Employer/Owner) 명칭", exclude=r"분쟁|dispute|shall pay|지급|소재지"),
    Item("location", "현장 위치", "일반 정보",
         "site location located country region 현장 위치 소재지 공사장소", r"site|locat|위치|소재지|장소", "text",
         "공사 현장 위치·국가", exclude=r"분쟁|dispute|arbitration|관할"),
    Item("scope", "공사 범위", "일반 정보",
         "scope of work works comprise engineering procurement construction 공사범위 과업범위 공사개요", r"scope|comprise|consist|범위|개요|포함", "text",
         "설계·조달·시공 등 계약자 업무 범위"),
    Item("contract_type", "계약 방식", "일반 정보",
         "contract type lump sum unit price EPC turnkey FIDIC conditions of contract 계약방식 총액 단가 턴키 일괄입찰", r"lump|unit price|turnkey|epc|fidic|reimburs|총액|단가|턴키|일괄", "text",
         "총액(Lump Sum)/단가/턴키 여부와 적용 계약조건(FIDIC 등)"),
    # ── 입찰 절차
    Item("bid_due_date", "입찰 마감일", "입찰 절차",
         "bid submission deadline closing date due date tenders must be received schedule 입찰마감 제출마감 입찰서 제출 마감일시 일정 마감일", r"deadline|closing|due|received|submi|마감", "date",
         "입찰서 제출 마감 일시와 장소"),
    Item("clarification_deadline", "질의 마감일", "입찰 절차",
         "clarification queries questions requests deadline 질의 질의응답 질의서 회신", r"clarif|quer|question|질의", "date",
         "입찰 질의서 제출 기한"),
    Item("site_visit", "현장설명회", "입찰 절차",
         "pre-bid meeting site visit conference schedule 현장설명회 현장답사 입찰설명회 일정", r"pre-bid|site visit|conference|meeting|현장설명|현장답사|설명회", "date",
         "현장설명회/Pre-bid meeting 일정과 참석 의무"),
    Item("bid_validity", "입찰 유효기간", "입찰 절차",
         "bid validity period remain valid days 입찰유효기간 유효기간", r"valid|유효", "duration",
         "입찰서 유효기간(일)", exclude=r"security|guarantee|bond|보증"),
    Item("bid_currency", "입찰 통화", "입찰 절차",
         "currency of bid currencies payment exchange rate 입찰통화 통화 환율", r"currenc|exchange|통화|환율", "text",
         "입찰·지급 통화와 환율 적용 기준"),
    Item("evaluation", "평가 기준", "입찰 절차",
         "evaluation criteria technical commercial weighting lowest evaluated award 평가기준 낙찰자 결정 기술평가 가격평가 배점", r"evaluat|award|weight|lowest|평가|낙찰|배점", "text",
         "기술·가격 평가 방식, 배점, 낙찰자 결정 방법"),
    Item("submission_documents", "제출 서류", "입찰 절차",
         "bid shall comprise documents submitted envelope technical proposal price schedule 제출서류 입찰서류 구비서류", r"comprise|envelope|document|proposal|제출서류|구비서류|입찰서류", "text",
         "기술·가격 제안서 등 제출 서류 구성과 봉투 방식"),
    # ── 보증·지급
    Item("bid_bond", "입찰보증금", "보증·지급",
         "bid security bid bond tender guarantee 입찰보증금 입찰보증서 보증", r"bid security|bid bond|tender (?:security|guarantee)|입찰보증", "percent",
         "입찰보증 금액(비율)과 유효기간", exclude=r"performance|이행|계약보증"),
    Item("performance_bond", "계약이행보증", "보증·지급",
         "performance security performance bond guarantee 계약이행보증 이행보증금 계약보증금 보증", r"performance (?:security|bond|guarantee)|이행보증|계약보증", "percent",
         "이행보증 비율·형식·유효기간", exclude=r"bid security|입찰보증"),
    Item("advance_payment", "선급금", "보증·지급",
         "advance payment down payment advance payment guarantee 선급금 선금", r"advance|down payment|선급|선금", "percent",
         "선급금 비율과 선급금 보증 조건"),
    Item("payment_terms", "기성 지급조건", "보증·지급",
         "interim payment monthly progress payment certificate days invoice 기성 대가지급 지급기한", r"interim|progress payment|payment certificate|invoice|기성|대가", "duration",
         "기성 청구 주기와 지급 기한"),
    Item("retention", "유보금", "보증·지급",
         "retention money retained percent 유보금 하자보수보증금", r"retention|retain|유보", "percent",
         "유보금 비율과 반환 조건"),
    # ── 공기·지체
    Item("completion_period", "공사 기간", "공기·지체",
         "time for completion completion period months commencement date 공사기간 준공기한 착공", r"time for completion|completion|commencement|공사기간|준공|공기", "duration",
         "착공일 기준 준공 기한"),
    Item("liquidated_damages", "지체상금률", "공기·지체",
         "liquidated damages delay damages per day per week rate 지체상금 지체상금률", r"liquidated|delay damages|지체상금", "percent",
         "지체상금률(일/주당 비율)", exclude=r"exceed|maximum|\bcap\b|aggregate|초과|한도|상한"),
    Item("ld_cap", "지체상금 상한", "공기·지체",
         "maximum amount liquidated damages cap aggregate limit not exceed 지체상금 한도 상한", r"(?:maximum|cap|aggregate|not exceed|limit).{0,60}(?:liquidated|delay)|(?:liquidated|delay).{0,80}(?:maximum|cap|exceed|limit)|지체상금.{0,30}(?:한도|상한|초과)", "percent",
         "지체상금 총액 상한(계약금액 대비 %)"),
    # ── 계약 리스크
    Item("warranty", "하자담보기간", "계약 리스크",
         "defects notification period warranty period defects liability 하자담보 하자보수기간 하자담보책임기간", r"defect|warrant|하자", "duration",
         "하자담보(DNP/Warranty) 기간"),
    Item("limitation_of_liability", "책임 한도", "계약 리스크",
         "limitation of liability total liability aggregate liability consequential loss 책임한도 손해배상 한도 간접손해", r"liabilit|consequential|책임|손해배상", "percent",
         "계약자 총 책임 한도와 간접손해 면책"),
    Item("price_adjustment", "물가변동", "계약 리스크",
         "price adjustment escalation fluctuation changes in cost fixed price not subject to adjustment 물가변동 계약금액 조정", r"adjust|escalat|fluctuat|물가|조정", "text",
         "물가변동 조정 가능 여부(고정가격 리스크)"),
    Item("governing_law", "준거법·분쟁해결", "계약 리스크",
         "governing law dispute resolution arbitration court ICC jurisdiction 준거법 분쟁 중재 관할법원", r"governing law|dispute|arbitrat|court|jurisdiction|준거법|분쟁|중재|관할", "text",
         "준거법, 중재기관/관할 법원"),
    Item("insurance", "보험", "계약 리스크",
         "insurance contractor all risks CAR third party liability 보험 공사보험 배상책임", r"insurance|all risks|보험", "text",
         "계약자 부보 의무 보험 종류와 금액"),
    Item("local_content", "현지화 요건", "계약 리스크",
         "local content local subcontractors nationals localization in-country value 현지화 현지 업체 현지인 고용", r"local content|in-country|national|locali|현지", "percent",
         "현지 조달·고용 의무 비율"),
]

ITEM_BY_KEY = {i.key: i for i in ITEMS}
