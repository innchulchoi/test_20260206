#!/usr/bin/env python3
"""
포스코(주) 인력 현황 슬라이드 생성기
=====================================
Kearney 스타일의 컨설팅 슬라이드(slide_generator.render_slide)를 재사용하여
'포스코(주) 인력 현황' 한 장(A4 Landscape)을 PNG로 생성합니다.

데이터 출처 / 한계
------------------
- 수치는 포스코(주) 사업보고서(DART), 기업시민(ESG)보고서, 채용정보 집계
  등 '공개 자료'를 기반으로 한 근사치입니다(집계 기준·시점에 따라 차이).
- DART 사업보고서의 「직원의 현황」은 '사업부문별 / 성별 / 고용형태별'로만
  공시되며, '영업·기술·경영지원' 같은 순수 직무별 인원은 공시되지 않습니다.
  직무에 가장 근접한 공개 자료는 ESG 보고서의 '직군(사무직/생산기술직)' 구분입니다.
- 정확한 최신 표가 필요하면 DART(dart.fss.or.kr)의 포스코(주) 사업보고서
  「직원의 현황」 표를 그대로 인용하여 아래 CONTENT를 교체하세요.

Usage:
    python posk_headcount_slide.py            # posk_headcount_slide.png 생성
    python posk_headcount_slide.py out.png    # 출력 파일명 지정
"""

import os
import sys

from slide_generator import render_slide, DEFAULT_PARAMS


# ---------------------------------------------------------------------------
# 슬라이드 내용 — 포스코(주) 인력 현황 (공시 기반 근사치)
# ---------------------------------------------------------------------------
CONTENT = {
    "headline": (
        "포스코(주) 임직원은 약 1.8만 명 규모로, 남성·정규직·장기근속 중심의 "
        "전형적인 중후장대 제조업 인력 구조를 보유"
    ),

    "box1_label": "규모",
    "box1_main": "전체 임직원 약 18,000명대 — 국내 철강 단일 사업장 기준 최대 수준",
    "box1_bullets": [
        "사업보고서 집계 기준 약 18,167명(국민연금 기준 약 15,465명)",
        "지주사 포스코홀딩스(005490)와 분리된 철강 사업회사 기준",
    ],

    "box2_label": "성별",
    "box2_main": "남성 약 95% · 여성 약 5%로, 생산기술직 비중이 큰 남초 구조",
    "box2_bullets": [
        "여성 비중은 사무직·신입 채용 확대로 완만한 상승 추세",
        "현장 안전·교대근무 중심의 생산기술직 특성이 성비에 반영",
    ],

    "box3_label": "고용·근속",
    "box3_main": "정규직(기간의 정함 없는 근로자) 절대다수, 평균 근속 15~19년 수준",
    "box3_bullets": [
        "비정규직 비중 약 3% 이하로 고용 안정성 높음",
        "평균 근속연수는 국내 철강업계 최상위권",
    ],

    "footer_left": "출처: 포스코(주) 사업보고서·기업시민보고서 등 공시자료 (일부 근사치) ",
    "page_number": "1",
}


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else "posk_headcount_slide.png"
    if not os.path.isabs(out_path):
        out_path = os.path.join(os.path.dirname(__file__) or ".", out_path)

    img = render_slide(CONTENT, DEFAULT_PARAMS)
    img.save(out_path, quality=95)
    print(f"Saved to: {out_path}")


if __name__ == "__main__":
    main()
