"""Shared helpers: company-name normalisation and a small cached OpenDART client."""
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import zipfile
import xml.etree.ElementTree as ET

DART = os.environ.get("DART_BASE", "https://opendart.fss.or.kr/api/")  # override only for tests

# FTC lists names in Hangul ("에스케이하이닉스(주)") while DART often keeps Latin
# letters ("SK하이닉스"). Spelling every Latin letter out in Hangul makes both match.
LETTERS = {
    "A": "에이", "B": "비", "C": "씨", "D": "디", "E": "이", "F": "에프", "G": "지",
    "H": "에이치", "I": "아이", "J": "제이", "K": "케이", "L": "엘", "M": "엠",
    "N": "엔", "O": "오", "P": "피", "Q": "큐", "R": "알", "S": "에스", "T": "티",
    "U": "유", "V": "브이", "W": "더블유", "X": "엑스", "Y": "와이", "Z": "지",
}
_CORP_FORMS = re.compile(
    r"\(주\)|㈜|\(유\)|\(합\)|\(사\)|\(재\)|주식회사|유한회사|유한책임회사|합자회사|합명회사|"
    r"사단법인|재단법인|\(株\)|co\.,?\s*ltd\.?|inc\.?|corp\.?|ltd\.?",
    re.I,
)


def norm_name(name):
    """Canonical key for matching company names across FTC and DART."""
    s = (name or "").strip()
    s = re.sub(r"\(舊[^)]*\)|\(구[^)]*\)", "", s)
    s = _CORP_FORMS.sub("", s)
    s = s.upper()
    s = "".join(LETTERS.get(c, c) for c in s)
    s = s.replace("&", "앤").replace("쓰", "스")  # 에쓰-오일 / S-Oil
    return re.sub(r"[^0-9가-힣]", "", s)


def norm_jurir(no):
    digits = re.sub(r"\D", "", str(no or ""))
    return digits.zfill(13) if digits else ""


class DartError(RuntimeError):
    pass


class Dart:
    """OpenDART client that caches every JSON response on disk so runs can resume.

    Status codes: 000 ok, 013 no data, 010/011/012/901 key problems, 020 daily limit (20,000 calls).
    """

    def __init__(self, key, cache_dir, delay=0.12):
        if not key:
            raise DartError("DART_API_KEY 가 없습니다. export DART_API_KEY=... 로 등록하세요.")
        self.key = key
        self.cache_dir = cache_dir
        self.delay = delay
        self.calls = 0
        os.makedirs(cache_dir, exist_ok=True)

    def _get(self, url, retries=4):
        for attempt in range(retries):
            try:
                with urllib.request.urlopen(url, timeout=60) as r:
                    return r.read()
            except Exception as e:  # network hiccups: back off and retry
                if attempt == retries - 1:
                    raise DartError(f"요청 실패: {e}")
                time.sleep(2 ** (attempt + 1))

    def json(self, endpoint, **params):
        tag = "_".join(str(params[k]) for k in sorted(params))
        path = os.path.join(self.cache_dir, endpoint, f"{tag}.json")
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        q = urllib.parse.urlencode({"crtfc_key": self.key, **params})
        time.sleep(self.delay)
        data = json.loads(self._get(f"{DART}{endpoint}.json?{q}").decode("utf-8"))
        self.calls += 1
        status = data.get("status")
        if status in ("010", "011", "012", "901"):
            raise DartError(f"인증키 오류 {status}: {data.get('message')}")
        if status == "020":
            raise DartError("일일 호출 한도(20,000건)를 넘었습니다. 내일 같은 명령으로 이어서 실행하세요(캐시됨).")
        if status not in ("000", "013"):
            raise DartError(f"{endpoint} {params}: {status} {data.get('message')}")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        return data

    def document_executives(self, rcept_no):
        """Executive rows parsed from the report's original document (document.xml). The zip is
        large (~0.5 MB) so only the parsed rows are cached. Returns [] if DART has no document."""
        from report_doc import VERSION, executives_from_document, unzip_document

        path = os.path.join(self.cache_dir, f"document_v{VERSION}", f"{rcept_no}.json")
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        time.sleep(self.delay)
        raw = self._get(f"{DART}document.xml?{urllib.parse.urlencode({'crtfc_key': self.key, 'rcept_no': rcept_no})}")
        self.calls += 1
        if raw[:2] != b"PK":
            status = re.search(rb"<status>(\d+)</status>|\"status\"\s*:\s*\"(\d+)\"", raw)
            code = (status.group(1) or status.group(2)).decode() if status else "?"
            if code in ("010", "011", "012", "901"):
                raise DartError(f"인증키 오류 {code}")
            if code == "020":
                raise DartError("일일 호출 한도(20,000건)를 넘었습니다. 내일 같은 명령으로 이어서 실행하세요(캐시됨).")
            rows = []
        else:
            rows = executives_from_document(unzip_document(raw))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False)
        return rows

    def corp_codes(self, max_age_days=7):
        """All DART-registered companies: list of {corp_code, corp_name, stock_code, modify_date}."""
        path = os.path.join(self.cache_dir, "corp_codes.json")
        if os.path.exists(path) and time.time() - os.path.getmtime(path) < max_age_days * 86400:
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        raw = self._get(f"{DART}corpCode.xml?crtfc_key={self.key}")
        if raw[:2] != b"PK":
            try:
                err = json.loads(raw.decode("utf-8"))
                msg = f"{err.get('status')} {err.get('message')}"
            except ValueError:
                msg = raw[:200].decode("utf-8", "replace")
            raise DartError(f"corpCode.xml 을 받지 못했습니다 ({msg}). 인증키를 확인하세요.")
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            root = ET.fromstring(z.read(z.namelist()[0]))
        rows = [
            {k: (el.findtext(k) or "").strip() for k in ("corp_code", "corp_name", "stock_code", "modify_date")}
            for el in root.iter("list")
        ]
        with open(path, "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False)
        return rows


def load_groups(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def select_groups(groups_doc, group=None, rank=None):
    """Pick groups by name/alias (comma separated) or rank range like '1-50'."""
    groups = groups_doc["groups"]
    if group:
        wanted = [norm_name(g) for g in group.split(",")]
        out = [g for g in groups if any(w in {norm_name(a) for a in [g["name"], *g.get("aliases", [])]} for w in wanted)]
        if not out:
            sys.exit(f"그룹을 찾지 못했습니다: {group}")
        return out
    if rank:
        lo, _, hi = rank.partition("-")
        lo, hi = int(lo), int(hi or lo)
        return [g for g in groups if lo <= g["rank"] <= hi]
    return [g for g in groups if g["rank"] <= 50]
