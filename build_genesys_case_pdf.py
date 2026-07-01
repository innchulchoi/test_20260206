# -*- coding: utf-8 -*-
"""Standalone Korean PDF: Genesys case study (original + public-source research)."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    KeepTogether, ListFlowable, ListItem, HRFlowable
)

FD = "/usr/share/fonts/truetype/nanum/"
pdfmetrics.registerFont(TTFont("Nanum", FD + "NanumGothic.ttf"))
pdfmetrics.registerFont(TTFont("NanumB", FD + "NanumGothicBold.ttf"))

WEF_BLUE = colors.HexColor("#1a3d6e")
ACCENT = colors.HexColor("#c8102e")
LIGHT = colors.HexColor("#eef2f7")
GREY = colors.HexColor("#5a5a5a")
BOXBG = colors.HexColor("#f4f6f9")
CASEBG = colors.HexColor("#fdf0f0")

def S(name, **kw):
    base = dict(fontName="Nanum", fontSize=10, leading=15, textColor=colors.black)
    base.update(kw); return ParagraphStyle(name, **base)

st_title = S("t", fontName="NanumB", fontSize=20, leading=26, textColor=WEF_BLUE)
st_sub = S("s", fontSize=11, leading=16, textColor=GREY)
st_h2 = S("h2", fontName="NanumB", fontSize=13, leading=18, textColor=WEF_BLUE, spaceBefore=12, spaceAfter=5)
st_h3 = S("h3", fontName="NanumB", fontSize=11, leading=15, textColor=ACCENT, spaceBefore=9, spaceAfter=3)
st_body = S("b", fontSize=10, leading=15.5, alignment=TA_JUSTIFY, spaceAfter=6)
st_bullet = S("bl", fontSize=9.7, leading=14.5)
st_small = S("sm", fontSize=8.5, leading=12, textColor=GREY)
st_cap = S("c", fontName="NanumB", fontSize=9, leading=13, textColor=ACCENT, spaceBefore=3, spaceAfter=3)
st_th = S("th", fontName="NanumB", fontSize=9, leading=12.5, textColor=colors.white)
st_td = S("td", fontSize=8.8, leading=12.5)
st_tdb = S("tdb", fontName="NanumB", fontSize=8.8, leading=12.5, textColor=WEF_BLUE)
st_tag = S("tag", fontName="NanumB", fontSize=8, leading=11, textColor=ACCENT)
st_caseh = S("ch", fontName="NanumB", fontSize=12, leading=16, textColor=ACCENT, spaceAfter=4)

story = []
def P(t, s=st_body): return Paragraph(t, s)
def sp(h=6): return Spacer(1, h)
def blts(items, s=st_bullet):
    return ListFlowable([ListItem(Paragraph(i, s)) for i in items],
        bulletType="bullet", bulletColor=ACCENT, bulletFontSize=7,
        leftIndent=14, bulletOffsetY=1, spaceBefore=2, spaceAfter=6)

def box(flow, bg=BOXBG, bar=WEF_BLUE, keep=False):
    inner = Table([[flow]], colWidths=[16.0*cm])
    inner.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), bg),
        ("LEFTPADDING", (0,0), (-1,-1), 12), ("RIGHTPADDING", (0,0), (-1,-1), 12),
        ("TOPPADDING", (0,0), (-1,-1), 10), ("BOTTOMPADDING", (0,0), (-1,-1), 10),
        ("LINEBEFORE", (0,0), (0,-1), 3, bar),
        ("BOX", (0,0), (-1,-1), 0.5, bar),
    ]))
    return KeepTogether([sp(3), inner, sp(6)]) if keep else inner

def mktable(header, rows, widths):
    data = [[P(h, st_th) for h in header]]
    for r in rows:
        data.append([P(c, st_tdb) if i == 0 else P(c, st_td) for i, c in enumerate(r)])
    t = Table(data, colWidths=widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0,0), (-1,0), WEF_BLUE), ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 6), ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("GRID", (0,0), (-1,-1), 0.4, colors.HexColor("#c9d3e0")),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0: style.append(("BACKGROUND", (0,i), (-1,i), LIGHT))
    t.setStyle(TableStyle(style)); return t

# ---------------- CONTENT ----------------
story.append(P("사례 연구: Genesys", st_tag))
story.append(P("Genesys — 분산 실행을 통한 AI 운영화", st_title))
story.append(P("WEF 「AI 우선 운영체제」 백서 사례 발췌 + 공개 자료 기반 심층 리서치", st_sub))
story.append(sp(6))
story.append(HRFlowable(width="100%", thickness=1, color=WEF_BLUE))
story.append(sp(10))

# 1. 원문 사례
story.append(P("1. 원문 백서 사례 (블록 3: 운영 재설계)", st_h2))
cs = []
cs.append(P("사례 연구 3", st_tag))
cs.append(P("Genesys: 분산 실행을 통한 AI 운영화", st_caseh))
for t in [
    "Genesys는 각 기능에 임베드된 운영 리더들로 구성된 AI 태스크포스로 시작했으며, 이니셔티브가 실제 워크플로에 기반하도록 보장하는 책임을 맡았습니다. 초기 노력으로 200개 이상의 사용 사례를 목록화하고, 각 역할에서 AI가 자동화할 수 있는 작업에 대한 아이디어를 개발하여 AI가 임팩트를 낼 수 있는 지점에 대한 공유된 관점을 만들었습니다.",
    "Genesys의 초점은 이제 표준화된 플레이북을 통한 실행으로 옮겨갔으며, 이는 팀이 다음을 수행하는 방식을 안내합니다: 워크플로 식별·우선순위화 / 업무 방식 재설계 / 솔루션 평가(구축·구매·활성화) / 가치 측정.",
    "실행은 분산되어 있습니다. 팀은 각자의 영역 내에서 신속하게 움직입니다. 수요 창출 부서는 사업 개발 워크플로 전반에 에이전트를 대규모로 배포했고, IT는 AI를 서비스 관리에 내재화하고 있습니다. 진전은 고임팩트 워크플로에 고정된 채 병렬로 이루어집니다.",
]:
    cs.append(P(t, S("cb", fontSize=9.4, leading=14, alignment=TA_JUSTIFY, spaceAfter=5)))
story.append(box(cs, bg=CASEBG, bar=ACCENT))
story.append(sp(4))
story.append(P("핵심 메시지: Genesys의 우위는 특정 도구가 아니라 <b>규율(discipline)</b>에서 나옵니다. ①실제 워크플로에 뿌리내린 태스크포스로 기회를 발굴하고, ②표준 플레이북으로 실행 방식을 통일하되, ③실행 자체는 각 부서에 분산해 고임팩트 워크플로를 병렬로 밀어붙입니다.", st_body))

# 2. 회사 배경
story.append(P("2. 회사 개요와 규모 (공개 자료)", st_h2))
story.append(P("Genesys는 클라우드 기반 고객경험(CX)·컨택센터 소프트웨어 기업입니다. 자사의 대표 플랫폼 Genesys Cloud를 중심으로, 최근 스스로를 'AI 기반 경험 오케스트레이션(AI-Powered Experience Orchestration)' 플랫폼으로 재정의하고 있습니다.", st_body))
story.append(P("주요 지표 (2026 회계연도 기준, 공개 발표)", st_cap))
story.append(mktable(
    ["지표", "수치", "비고"],
    [
        ["Genesys Cloud ARR", "약 26억 달러", "FY26 4분기(2025.11~2026.1) 말 기준"],
        ["ARR 성장률", "전년 대비 35% 이상", "클라우드 전환·AI 채택이 견인"],
        ["FY2026 총매출", "약 30억 달러", "회계연도 전체 기준"],
        ["Genesys Cloud AI 사용 고객 비중", "70% 이상", "2026년 1월 말 기준"],
    ],
    [5.2*cm, 4.3*cm, 6.5*cm],
))
story.append(sp(4))
story.append(P("→ 본문 사례가 설명하는 '내부 운영화' 규율이 제품과 광범위한 고객 기반의 실제 채택으로 이어지고 있음을 보여줍니다.", st_small))

# 3. 전략
story.append(P("3. 전략 방향 — '경험 오케스트레이션'", st_h2))
story.append(P("Genesys의 제품 전략은 개별 작업의 자동화를 넘어 <b>사람·시스템·데이터·AI를 실시간으로 조율(orchestrate)</b>하여 고객·직원 경험을 설계하는 것입니다. 이는 백서 사례의 '분산 실행'과 '고임팩트 워크플로 중심' 접근을, 내부 운영을 넘어 시장 제품 논리로 확장한 것으로 볼 수 있습니다.", st_body))

# 4. 타임라인
story.append(P("4. 주요 제품·발표 타임라인 (2025–2026)", st_h2))
story.append(mktable(
    ["시점", "발표 내용"],
    [
        ["2025년 9월\n(Xperience 2025)", "더 높은 자율성·맥락 인식을 갖춘 Genesys Cloud Copilot·Virtual Agent 공개. 에이전트 간 협업(Agent2Agent, A2A)과 모델 컨텍스트 프로토콜(MCP) 기본 지원. ServiceNow와 전략적 파트너십 확대 — AI 에이전트가 기업 시스템을 넘나들며 자율 협업."],
        ["2026년 2월", "업계 최초로 <b>대규모 행동 모델(LAM, Large Action Model)</b> 기반 '에이전트형 가상 상담원(Agentic Virtual Agent, AVA)' 발표. 프런트·백오피스 시스템을 아우르는 고객 요청의 자율적 종단 간(end-to-end) 해결 지향. AI Studio의 노코드 도구로 목표·가드레일·행동을 정의하되, 모든 자율 결정이 기업 거버넌스·감사·컴플라이언스 통제 내에서 작동."],
    ],
    [3.4*cm, 12.6*cm],
))

# 5. 성과
story.append(P("5. 도입 성과와 검증", st_h2))
story.append(blts([
    "초기 도입·검증 기관: M&T Bank, Banco Pichincha, 포춘 50대 북미 유통업체 등",
    "자율형 AI 시스템 도입 조직 보고: 이슈 해결 시간 <b>28% 단축</b>, 최초 접촉 해결률(FCR) <b>19% 향상</b>",
    "노코드 구성으로 전문 개발 인력 없이도 기업 규모의 가상 상담원 배포 가능 — 경직된 봇 플로 대비 자연스러운 대화·높은 작업 완료율",
]))

# 6. 시사점
story.append(P("6. 시사점 — 내부 규율과 시장 포지셔닝의 연결", st_h2))
story.append(box([
    P("Genesys는 두 층위에서 AI 우선 패턴을 동시에 실행하고 있습니다:", S("bx", fontSize=9.4, leading=14, spaceAfter=5)),
    blts([
        "<b>내부:</b> '태스크포스 → 표준 플레이북 → 분산 실행'이라는 규율로 AI를 운영화 (백서 블록 3: 운영 재설계)",
        "<b>외부:</b> 이 역량을 '경험 오케스트레이션'이라는 제품·시장 포지셔닝으로 전환 (백서 블록 5: 새로운 가치 창출)",
    ], S("bx2", fontSize=9.2, leading=13.5)),
    P("즉 Genesys는 '운영 재설계'로 축적한 역량을 '시장에서의 포지셔닝'으로 연결하는, AI 우선 기업의 전형적 경로를 보여줍니다.", S("bx3", fontSize=9.4, leading=14, spaceBefore=2)),
]))

# 출처
story.append(sp(6))
story.append(P("출처", st_h3))
story.append(P("아래는 2절~5절 보완 정보의 공개 출처입니다. 1절 사례 본문은 WEF 백서에서 발췌했습니다. 수치는 각 사의 공개 발표 기준이며, 원문 백서에는 포함되지 않은 보완 정보입니다.", st_small))
story.append(blts([
    "Genesys 뉴스룸 — AI Agents with Greater Autonomy (2025.9) / Industry's First Agentic Virtual Agent Powered by LAMs (2026.2) / Record Fourth Quarter FY2026 (2026.3)",
    "Genesys Cloud Resource Center — Agentic virtual agents overview",
    "Forbes — Genesys Shifts Enterprise CX Strategy from LLMs to LAMs (2026.2.10)",
    "CMSWire — Genesys Launches LAM-Powered Agentic Virtual Agent (2026.2)",
    "Business Wire · Yahoo Finance — Genesys 실적·발표 보도 (2025.9 / 2026.3)",
], st_small))

# ---------------- DOC ----------------
DOC_TITLE = "사례 연구: Genesys — 분산 실행을 통한 AI 운영화"
def on_page(canvas, doc):
    canvas.saveState(); w, h = A4
    canvas.setStrokeColor(colors.HexColor("#c9d3e0")); canvas.setLineWidth(0.4)
    canvas.line(2*cm, 1.4*cm, w-2*cm, 1.4*cm)
    canvas.setFont("Nanum", 7.5); canvas.setFillColor(GREY)
    canvas.drawString(2*cm, 1.0*cm, DOC_TITLE)
    canvas.drawRightString(w-2*cm, 1.0*cm, "%d" % doc.page)
    canvas.restoreState()

doc = BaseDocTemplate(
    "/tmp/claude-0/-home-user-test-20260206/84f31a37-e5c2-5160-862b-4f9008683dbc/scratchpad/genesys_ko.pdf",
    pagesize=A4, leftMargin=2*cm, rightMargin=2*cm, topMargin=1.8*cm, bottomMargin=1.8*cm,
    title=DOC_TITLE, author="Genesys case study (Korean)")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=on_page)])
doc.build(story)
print("done")
