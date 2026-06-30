#!/usr/bin/env python3
"""
포스크 직무별 인원 현황 슬라이드 생성기
=======================================
Kearney 스타일의 컨설팅 슬라이드(slide_generator.render_slide)를 재사용하여
'포스크 직무별 인원 현황' 한 장(A4 Landscape)을 PNG로 생성합니다.

주의: 아래 인원 수치는 실제 데이터가 아닌 '예시(illustrative)' 값입니다.
      실제 인원 현황 숫자로 CONTENT 딕셔너리를 교체한 뒤 다시 실행하세요.

Usage:
    python posk_headcount_slide.py            # posk_headcount_slide.png 생성
    python posk_headcount_slide.py out.png    # 출력 파일명 지정
"""

import os
import sys

from slide_generator import render_slide, DEFAULT_PARAMS


# ---------------------------------------------------------------------------
# 슬라이드 내용 — 포스크 직무별 인원 현황 (예시 데이터)
# 전체 240명 = 영업·마케팅 84명(35%) + 기술·개발 108명(45%) + 경영지원 48명(20%)
# ---------------------------------------------------------------------------
CONTENT = {
    "headline": (
        "포스크 전체 인원 240명은 기술·개발(45%) 중심으로 구성되어 있으며, "
        "사업 성장에 대응하기 위해 영업·경영지원 직무의 단계적 충원이 필요"
    ),

    "box1_label": "기술·개발",
    "box1_main": "기술·개발 직무 108명(전체의 45%)으로 제품·서비스 경쟁력의 핵심 인력군",
    "box1_bullets": [
        "S/W 개발 62명 · 데이터/AI 24명 · 인프라/보안 22명으로 구성",
        "신규 서비스 라인 확대에 대응한 시니어 엔지니어 보강이 시급",
    ],

    "box2_label": "영업·마케팅",
    "box2_main": "영업·마케팅 직무 84명(35%)으로 고객 접점 및 매출 창출을 담당",
    "box2_bullets": [
        "국내영업 48명 · 해외영업 18명 · 마케팅 18명으로 배치",
        "해외 사업 확대 대비 글로벌 영업 인력의 비중 확대 필요",
    ],

    "box3_label": "경영지원",
    "box3_main": "경영지원 직무 48명(20%)으로 인사·재무·총무 등 백오피스 운영을 지원",
    "box3_bullets": [
        "재무/회계 16명 · 인사/총무 18명 · 전략기획 14명으로 구성",
        "조직 성장에 따른 인사·전략 기능의 전문 인력 확충 검토",
    ],

    "footer_left": "포스크  |  직무별 인원 현황 (예시 데이터)",
    "page_number": "1",
}


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else "posk_headcount_slide.png"
    out_path = os.path.join(os.path.dirname(__file__) or ".", out_path) \
        if not os.path.isabs(out_path) else out_path

    img = render_slide(CONTENT, DEFAULT_PARAMS)
    img.save(out_path, quality=95)
    print(f"Saved to: {out_path}")


if __name__ == "__main__":
    main()
