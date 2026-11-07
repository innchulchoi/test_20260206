"""테스트용 가상 입찰안내서 생성 (실제 프로젝트·기관과 무관한 가상 데이터).

  python samples/make_samples.py
  → samples/sample_itb_en.pdf  (영문 EPC ITB, 14페이지)
  → samples/sample_itb_ko.docx (국문 공공 건설 입찰안내서)
"""
from pathlib import Path

HERE = Path(__file__).resolve().parent

EN_SECTIONS = [
    ("SECTION I - INSTRUCTIONS TO BIDDERS", [
        ("1. General", [
            "1.1 The Employer, Northbay Energy Authority (the \"Employer\"), invites sealed bids for the Riverside 600 MW Combined Cycle Power Plant Project (the \"Project\").",
            "1.2 The Site is located in the Riverside Industrial Zone, Port Halden, Republic of Nordavia.",
            "1.3 The scope of work comprises the engineering, procurement, construction, commissioning and testing of a 600 MW combined cycle power plant including two gas turbines, two heat recovery steam generators, one steam turbine, a 400 kV switchyard and all balance of plant.",
            "1.4 The Contract shall be a lump sum turnkey EPC contract based on the FIDIC Conditions of Contract for EPC/Turnkey Projects (Silver Book), 2017 Edition, as amended by the Particular Conditions.",
        ]),
        ("2. Bidding Schedule", [
            "2.1 A pre-bid meeting and site visit will be held on 2026-01-20 at 10:00 hrs at the Employer's site office. Attendance is mandatory for all bidders.",
            "2.2 Bidders may submit requests for clarification in writing no later than 2026-02-10. The Employer will respond to all clarification queries within ten (10) days.",
            "2.3 Bids must be received at the Employer's address no later than 2026-03-16 at 14:00 hrs local time (the bid submission deadline). Late bids shall be rejected.",
            "2.4 Bids shall remain valid for a period of 180 days after the bid submission deadline.",
        ]),
        ("3. Preparation of Bids", [
            "3.1 The Bid shall comprise two separate envelopes: Envelope A (Technical Proposal) and Envelope B (Price Proposal including the completed Price Schedules).",
            "3.2 The currency of the Bid shall be United States Dollars (USD). Local costs may be quoted up to 20% in Nordavian Krona (NVK) at the exchange rate published by the Central Bank 28 days prior to the bid submission deadline.",
            "3.3 Each bid shall be accompanied by a Bid Security in the amount of 2% of the Bid Price, in the form of an unconditional bank guarantee valid for 28 days beyond the bid validity period.",
        ]),
        ("4. Evaluation and Award", [
            "4.1 Bids will be evaluated on a pass/fail technical evaluation followed by commercial evaluation. Technical compliance carries a weighting of 30% and price a weighting of 70%.",
            "4.2 The Contract will be awarded to the bidder whose bid is technically compliant and has the lowest evaluated price after applying the weighting.",
        ]),
    ]),
    ("SECTION II - PARTICULAR CONDITIONS OF CONTRACT", [
        ("Clause 4.2 Performance Security", [
            "The Contractor shall deliver a Performance Security in the amount of 10% of the Contract Price within 28 days after receiving the Letter of Acceptance. The Performance Security shall remain valid until the issue of the Performance Certificate.",
        ]),
        ("Clause 4.8 Local Content", [
            "The Contractor shall ensure that not less than 30% of the total value of the Works is sourced from Nordavian nationals, local subcontractors and local suppliers (in-country value).",
        ]),
        ("Clause 8.2 Time for Completion", [
            "The Time for Completion of the whole of the Works shall be 36 months from the Commencement Date.",
        ]),
        ("Clause 8.8 Delay Damages", [
            "If the Contractor fails to achieve Taking Over by the Time for Completion, the Contractor shall pay liquidated damages to the Employer at the rate of 0.15% of the Contract Price per calendar day of delay.",
            "The total amount of delay damages shall not exceed a maximum of 20% of the Contract Price.",
        ]),
        ("Clause 11.3 Defects Notification Period", [
            "The Defects Notification Period shall be 24 months from the date of Taking Over, and shall be extended for any repaired or replaced item by a further 12 months, subject to an overall maximum of 36 months.",
        ]),
        ("Clause 13.8 Adjustments for Changes in Cost", [
            "The Contract Price is fixed and firm and shall not be subject to any adjustment for rise or fall in the cost of labour, materials, equipment or other inputs to the Works.",
        ]),
        ("Clause 14.2 Advance Payment", [
            "The Employer shall make an advance payment of 10% of the Contract Price, against submission of an Advance Payment Guarantee of equal amount. The advance payment shall be recovered by deductions from interim payments.",
        ]),
        ("Clause 14.3 Application for Interim Payments", [
            "The Contractor shall submit monthly statements. The Employer shall pay the amount certified in each Interim Payment Certificate within 56 days after receiving the statement and supporting documents.",
        ]),
        ("Clause 14.9 Retention Money", [
            "Retention Money of 10% shall be deducted from each interim payment until the total Retention Money reaches 5% of the Contract Price. Half shall be released at Taking Over.",
        ]),
        ("Clause 17.6 Limitation of Liability", [
            "The total liability of the Contractor to the Employer under or in connection with the Contract shall not exceed 100% of the Accepted Contract Amount. Neither Party shall be liable for loss of profit or any indirect or consequential loss, except in cases of fraud or wilful misconduct.",
        ]),
        ("Clause 19 Insurance", [
            "The Contractor shall effect and maintain Contractor's All Risks insurance for the full replacement value of the Works and third party liability insurance with a minimum limit of USD 50,000,000 per occurrence.",
        ]),
        ("Clause 21 Disputes and Arbitration", [
            "The Contract shall be governed by the laws of the Republic of Nordavia. Any dispute not settled amicably shall be finally settled by arbitration under the Rules of Arbitration of the International Chamber of Commerce (ICC), with the seat of arbitration in Singapore.",
        ]),
    ]),
]

FILLER = (
    "The Contractor shall comply with all applicable laws, permits, codes and standards, including the Employer's "
    "health, safety and environmental requirements, quality management procedures and document control procedures. "
    "All drawings, specifications, calculations and data sheets shall be submitted for review in accordance with the "
    "Employer's Requirements. Review by the Employer shall not relieve the Contractor of any of its obligations. "
)


def make_pdf(path: Path) -> None:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer

    ss = getSampleStyleSheet()
    story = [Paragraph("INVITATION TO BID - SAMPLE (FICTIONAL)", ss["Title"]),
             Paragraph("Riverside 600 MW Combined Cycle Power Plant Project - Bid Documents Volume 1", ss["Heading2"]),
             Paragraph("This is a fictional document generated for software testing only.", ss["Italic"]),
             PageBreak()]
    for sec_title, clauses in EN_SECTIONS:
        story.append(Paragraph(sec_title, ss["Heading1"]))
        for i, (title, paras) in enumerate(clauses):
            story.append(Paragraph(title, ss["Heading2"]))
            for p in paras:
                story.append(Paragraph(p, ss["BodyText"]))
            for _ in range(2):
                story.append(Paragraph(FILLER, ss["BodyText"]))
            story.append(Spacer(1, 8))
            if i % 2 == 1:
                story.append(PageBreak())
        story.append(PageBreak())
    SimpleDocTemplate(str(path), pagesize=A4).build(story)


KO_PARAS = [
    ("제1장 입찰 개요", [
        "1. 공사명: 한빛시 하수처리장 증설 및 고도처리시설 설치공사 (가상 예시)",
        "2. 발주기관: 한빛시 상하수도사업소",
        "3. 공사 위치: 한빛시 동구 강변로 일원",
        "4. 공사 개요: 하수처리 용량 50,000㎥/일 증설, 고도처리시설 설치 및 기존 시설 개량을 포함한다.",
        "5. 계약방식: 총액 확정 계약, 설계·시공 일괄입찰(턴키) 방식",
    ]),
    ("제2장 입찰 일정", [
        "6. 현장설명회는 2027년 2월 5일 14시 한빛시청 대회의실에서 개최하며 참석은 선택사항이다.",
        "7. 입찰 관련 질의는 2027년 2월 20일까지 서면으로 제출하여야 한다.",
        "8. 입찰서 제출 마감일시는 2027년 3월 10일 17시이며 마감 이후 도착분은 무효로 한다.",
        "9. 입찰유효기간은 입찰서 제출 마감일로부터 90일로 한다.",
        "10. 입찰서류는 기술제안서와 가격제안서를 각각 별도 봉투에 넣어 제출한다.",
        "11. 낙찰자 결정: 기술평가 60점, 가격평가 40점을 합산하여 최고 득점자를 낙찰자로 결정한다.",
    ]),
    ("제3장 보증 및 대가 지급", [
        "12. 입찰보증금은 입찰금액의 5%로 하며 보증보험증권으로 납부할 수 있다.",
        "13. 계약보증금은 계약금액의 15%로 한다.",
        "14. 선급금은 계약금액의 30%를 지급하며 선급금 보증서를 제출하여야 한다.",
        "15. 기성 대가는 매월 1회 청구하며 발주기관은 청구를 받은 날부터 5일 이내에 지급한다.",
        "[표]\n구분 | 비율 | 비고\n입찰보증금 | 5% | 보증보험 가능\n계약보증금 | 15% | 현금 또는 보증서",
    ]),
    ("제4장 공기 및 지체상금", [
        "16. 공사기간은 착공일로부터 30개월로 한다.",
        "17. 지체상금률은 계약금액의 1000분의 0.5로 하며 지체일수 1일마다 부과한다.",
        "18. 지체상금 총액은 계약금액의 30%를 초과할 수 없다.",
    ]),
    ("제5장 계약 조건", [
        "19. 하자담보책임기간은 준공일로부터 3년으로 한다.",
        "20. 계약금액은 국가를 당사자로 하는 계약에 관한 법률에 따라 물가변동으로 인한 계약금액 조정을 할 수 있다.",
        "21. 손해배상 책임은 계약금액을 한도로 하며 간접손해는 배상하지 아니한다.",
        "22. 계약상대자는 공사보험(건설공사보험)과 제3자 배상책임보험에 가입하여야 한다.",
        "23. 이 계약과 관련한 분쟁은 발주기관 소재지 관할 법원에서 해결한다.",
    ]),
]


def make_docx(path: Path) -> None:
    import docx

    d = docx.Document()
    d.add_heading("입찰안내서 (가상 예시 문서)", 0)
    d.add_paragraph("이 문서는 소프트웨어 시험용으로 만든 가상 문서입니다.")
    for title, paras in KO_PARAS:
        d.add_heading(title, 1)
        for p in paras:
            if p.startswith("[표]"):
                rows = [r.split(" | ") for r in p.split("\n")[1:]]
                t = d.add_table(rows=len(rows), cols=3)
                for i, r in enumerate(rows):
                    for j, c in enumerate(r):
                        t.cell(i, j).text = c
            else:
                d.add_paragraph(p)
    d.save(str(path))


if __name__ == "__main__":
    make_pdf(HERE / "sample_itb_en.pdf")
    make_docx(HERE / "sample_itb_ko.docx")
    print("created:", HERE / "sample_itb_en.pdf", HERE / "sample_itb_ko.docx")
