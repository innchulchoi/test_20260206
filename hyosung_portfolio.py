#!/usr/bin/env python3
"""
효성그룹 사업 포트폴리오 슬라이드 생성기
=====================================
slide_generator.py 의 렌더러를 재사용하여 효성그룹의 사업 포트폴리오를
Kearney 스타일 컨설팅 슬라이드(A4 가로)로 생성한다.

2024년 7월 효성그룹은 2개 지주사 체제(효성그룹 / HS효성)로 계열분리되었으며,
본 자료는 그 구조와 각 그룹의 핵심 사업을 3장의 슬라이드로 정리한다.

Usage:
    python hyosung_portfolio.py        # PNG 3장 생성
"""

import os
import slide_generator as sg

# 한글 렌더링을 위해 Nanum 폰트를 우선 사용하도록 폰트 경로를 재지정
_KO_REGULAR = [
    "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
    "/usr/share/fonts/truetype/nanum/NanumBarunGothic.ttf",
]
_KO_BOLD = [
    "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
    "/usr/share/fonts/truetype/nanum/NanumBarunGothicBold.ttf",
]


def _first_existing(paths, fallback):
    for p in paths:
        if os.path.isfile(p):
            return p
    return fallback


sg.FONT_PATH = _first_existing(_KO_REGULAR, sg.FONT_PATH)
sg.FONT_BOLD_PATH = _first_existing(_KO_BOLD, sg.FONT_BOLD_PATH)


FOOTER = "HYOSUNG GROUP  |  BUSINESS PORTFOLIO"

# ---------------------------------------------------------------------------
# Slide 1 — 그룹 개관: 2개 지주사 체제
# ---------------------------------------------------------------------------
SLIDE1 = {
    "headline": (
        "효성그룹은 2024년 7월 효성·HS효성 2개 지주사 체제로 계열분리되어, "
        "섬유·중공업·화학·첨단소재를 아우르는 글로벌 소재 포트폴리오를 운영"
    ),
    "box1_label": "그룹 구조",
    "box1_main": "㈜효성(조현준 회장)과 에이치에스효성(조현상 부회장) 2개 지주사로 독립경영 체제 전환",
    "box1_bullets": [
        "2024년 7월 HS효성 공식 출범, 상호 지분 정리로 계열분리 마무리",
        "1966년 창립 이후 섬유에서 출발해 산업소재 중심 그룹으로 성장",
    ],
    "box2_label": "핵심 경쟁력",
    "box2_main": "스판덱스·타이어코드·탄소섬유 등 세계 1위 소재를 다수 보유한 글로벌 소재 강자",
    "box2_bullets": [
        "차별화된 원천기술 기반의 고부가 산업소재 포트폴리오",
        "28개국 100여 개 사업장 기반의 글로벌 생산·판매 네트워크",
    ],
    "box3_label": "사업 영역",
    "box3_main": "섬유·무역, 중공업·에너지, 화학, 첨단소재, IT 서비스로 이어지는 다각화 포트폴리오",
    "box3_bullets": [
        "효성그룹: 효성티앤씨·효성중공업·효성화학·효성ITX·효성TNS",
        "HS효성: HS효성첨단소재·효성인포메이션시스템·효성토요타",
    ],
    "footer_left": FOOTER,
    "page_number": "1",
}

# ---------------------------------------------------------------------------
# Slide 2 — 효성그룹(조현준 회장) 3대 상장 계열사
# ---------------------------------------------------------------------------
SLIDE2 = {
    "headline": (
        "효성그룹(조현준 회장)은 섬유·무역, 중공업·에너지, 화학의 3대 상장 계열사를 "
        "축으로 소재부터 전력·수소 인프라까지 사업을 전개"
    ),
    "box1_label": "효성티앤씨",
    "box1_main": "섬유·무역 — 스판덱스(크레오라) 세계 1위, 나일론·폴리에스터 및 글로벌 무역",
    "box1_bullets": [
        "친환경 리사이클 섬유 '리젠' 등 지속가능 소재로 사업 확대",
        "2024년 효성화학 특수가스(NF3) 사업 인수로 반도체 소재 진출",
    ],
    "box2_label": "효성중공업",
    "box2_main": "중공업·에너지 — 변압기·차단기 등 전력기기와 ESS, 수소 인프라, 건설",
    "box2_bullets": [
        "북미·중동 전력망 수요 확대에 대응한 초고압 변압기 공급 확대",
        "2024년 세계 최초 100% 수소엔진 발전기 상용화 성공",
    ],
    "box3_label": "효성화학",
    "box3_main": "화학 — 폴리프로필렌(PP), TPA, 필름 및 세계 최초 개발 소재 폴리케톤",
    "box3_bullets": [
        "폴리케톤 등 고부가 엔지니어링 플라스틱으로 제품 믹스 개선",
        "PP·필름 등 기초화학 사업 구조조정을 통한 수익성 회복 추진",
    ],
    "footer_left": FOOTER,
    "page_number": "2",
}

# ---------------------------------------------------------------------------
# Slide 3 — HS효성(조현상 부회장) 핵심 사업
# ---------------------------------------------------------------------------
SLIDE3 = {
    "headline": (
        "HS효성(조현상 부회장)은 HS효성첨단소재를 중심으로 산업용 소재와 신성장 "
        "소재, IT 서비스로 독립경영 포트폴리오를 구축"
    ),
    "box1_label": "HS효성첨단소재",
    "box1_main": "산업소재 — 타이어보강재(타이어코드) 세계 1위, 탄소섬유·아라미드",
    "box1_bullets": [
        "고성능 탄소섬유 증설로 수소·항공·에너지 소재 시장 공략",
        "아라미드 등 슈퍼섬유 라인업으로 고부가 소재 비중 확대",
    ],
    "box2_label": "신성장 동력",
    "box2_main": "스틸코드 인수와 이차전지 음극재 투자로 소재 사업 영역을 확장",
    "box2_bullets": [
        "스틸코드 사업 인수로 타이어보강재 토털 솔루션 체계 구축",
        "이차전지 음극재 신사업 진출로 미래 성장 기반 마련",
    ],
    "box3_label": "IT·기타",
    "box3_main": "효성인포메이션시스템(HIS) 등 IT 서비스와 유통·물류 계열로 사업 다각화",
    "box3_bullets": [
        "효성인포메이션시스템: 데이터센터·클라우드 인프라 사업",
        "효성토요타·비나물류 등 유통·물류 기반 계열사 운영",
    ],
    "footer_left": FOOTER,
    "page_number": "3",
}


def main():
    out_dir = os.path.dirname(os.path.abspath(__file__))
    slides = [
        ("hyosung_portfolio_1_overview.png", SLIDE1),
        ("hyosung_portfolio_2_hyosung.png", SLIDE2),
        ("hyosung_portfolio_3_hs_hyosung.png", SLIDE3),
    ]
    for filename, content in slides:
        img = sg.render_slide(content, sg.DEFAULT_PARAMS)
        path = os.path.join(out_dir, filename)
        img.save(path, quality=95)
        print(f"Saved: {path}")


if __name__ == "__main__":
    main()
