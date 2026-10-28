# OpenDART API 메모

Base: `https://opendart.fss.or.kr/api/` · 모든 요청에 `crtfc_key` · 일일 20,000건 한도

## 사용하는 엔드포인트

| 엔드포인트 | 용도 | 주요 파라미터 |
|---|---|---|
| `corpCode.xml` | 전체 회사 고유번호(zip 안 XML): corp_code, corp_name, stock_code, modify_date | - |
| `company.json` | 기업개황: ceo_nm, jurir_no(법인등록번호), corp_cls(Y 유가/K 코스닥/N 코넥스/E 기타), induty_code, est_dt, adres, hm_url | corp_code |
| `exctvSttus.json` | 임원 현황 | corp_code, bsns_year, reprt_code |
| `hyslrSttus.json` | 최대주주 현황 | 위와 같음 |
| `otrCprInvstmntSttus.json` | 타법인 출자 현황 | 위와 같음 |

`reprt_code`: 11011 사업보고서, 11012 반기, 11013 1분기, 11014 3분기.
제출 기한(대략): 사업 3/31, 1분기 5/15, 반기 8/14, 3분기 11/14. `collect.py`는 기한이 지난 보고서만 시도한다.

## 응답 필드

**exctvSttus**: rcept_no, stlm_dt(결산기준일), nm, sexdstn, birth_ym, ofcps(직위), rgist_exctv_at(등기임원여부:
사내이사/사외이사/기타비상무이사/미등기 등), fte_at(상근여부), chrg_job(담당업무), main_career, mxmm_shrholdr_relate,
hffc_pd(재직기간), tenure_end_on(임기만료일)

**hyslrSttus**: nm, relate, stock_knd, bsis_posesn_stock_co, bsis_posesn_stock_qota_rt, trmend_posesn_stock_co,
trmend_posesn_stock_qota_rt(기말 지분율), rm. 보통주와 우선주가 따로 나오고 "계" 합계 행이 있다.

**otrCprInvstmntSttus**: inv_prm(법인명), frst_acqs_de, invstmnt_purps, frst_acqs_amount, bsis_blce_qy,
bsis_blce_qota_rt, trmend_blce_qy, trmend_blce_qota_rt(기말 지분율), trmend_blce_acntbk_amount,
recent_bsns_year_fnnr_sttus_tot_assets, recent_bsns_year_fnnr_sttus_thstrm_ntpf. "합계" 행이 있고, 해외 법인은 영문명으로 나온다.

## 상태코드

| 코드 | 의미 | 처리 |
|---|---|---|
| 000 | 정상 | |
| 013 | 조회된 데이터 없음 | 정상 흐름: 그 보고서가 없거나 해당 항목이 없음 |
| 010 / 011 / 012 | 미등록·사용불가 키, 접근불가 IP | 중단, 키 확인 |
| 020 | 요청 제한 초과 | 중단, 다음 날 같은 명령으로 재개 |
| 100 / 101 | 필드 오류 | 파라미터 확인 |
| 800 | 시스템 점검 | 잠시 후 재시도 |
| 900 / 901 | 정의되지 않은 오류, 키 기간 만료 | |

## 호출량 계산 (collect.py)

DART에 이름이 있는 계열사마다 아래 순서로 호출한다.
1. 사업보고서 임원현황: 1~2건. 없으면 여기서 끝난다(정기보고서 미제출 회사).
2. 있으면 더 최근 분기·반기 보고서 1~3건, 기업개황 1건, 최대주주 1건, 타법인출자 1~2건.

동명 법인이 여러 개면 기업개황을 최대 6건 더 불러 법인등록번호로 가린다.
50개 그룹 기준 약 4,000~6,000건이다. 모든 응답은 `<out>/cache/<endpoint>/<params>.json`에 저장된다.
corpCode는 7일 동안 캐시한다.

## 회사명 매칭

공정위 명단은 "에스케이하이닉스(주)"처럼 영문을 한글로 적는다. DART는 "SK하이닉스"처럼 영문을 그대로 둔다.
`common.norm_name()`은 법인 형태 표기를 지우고 영문 대문자를 한글 이름(S→에스, K→케이)으로 바꿔 두 표기를 맞춘다.
"NAVER"처럼 영어 단어로 된 상호는 이 방식으로 맞지 않으므로 `name_overrides.json`에 적는다.
