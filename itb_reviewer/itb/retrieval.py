"""BM25 검색기 (외부 의존성 없음, 한·영 혼합 문서용).

영문은 단어 단위, 한글은 어절 + 글자 bigram으로 토큰화해서
'지체상금률' 같은 붙여 쓴 복합어도 '지체상금'으로 찾을 수 있게 한다.
"""
from __future__ import annotations

import math
import re
from collections import Counter

from .parser import Chunk

_EN = re.compile(r"[a-z0-9]+(?:\.[0-9]+)?")
_KO = re.compile(r"[가-힣]+")
_STOP = {"the", "of", "and", "to", "in", "a", "for", "be", "by", "or", "shall", "is", "on", "with", "as", "any", "this", "that", "an", "at", "are", "from"}


def tokenize(text: str) -> list[str]:
    text = text.lower()
    toks = [t for t in _EN.findall(text) if t not in _STOP]
    for w in _KO.findall(text):
        toks.append(w)
        if len(w) >= 2:
            toks.extend(w[i : i + 2] for i in range(len(w) - 1))
    return toks


_GENERIC = {"입찰", "계약", "공사", "기간", "금액", "조건", "내용", "관련", "bid", "contract", "works", "period", "date"}


def _words(text: str) -> list[str]:
    text = text.lower()
    return [w for w in _EN.findall(text) if w not in _STOP] + _KO.findall(text)


def expand_query(query: str) -> str:
    """검토 항목 사전으로 질의를 한·영 확장한다 (예: '지체상금 상한' → liquidated damages cap ...).

    국문 질문으로 영문 ITB를 검색하거나 그 반대일 때 필요하다.
    한글 조사를 감안해 '질문 단어가 사전 단어로 시작하면' 일치로 본다.
    """
    from .checklist import ITEMS

    qwords = _words(query)

    def hit(w: str) -> bool:
        return len(w) >= 2 and any(q.startswith(w) for q in qwords)

    extra = []
    for item in ITEMS:
        label = _words(item.label)
        label_match = bool(label) and all(hit(w) for w in label)
        dict_match = any(hit(w) for w in _words(item.query) if w not in _GENERIC)
        if label_match or dict_match:
            extra.append(item.query)
    return query + (" " + " ".join(extra) if extra else "")


class BM25Index:
    def __init__(self, chunks: list[Chunk], k1: float = 1.5, b: float = 0.75):
        self.chunks = chunks
        self.k1, self.b = k1, b
        self.tfs: list[Counter] = []
        df: Counter = Counter()
        for c in chunks:
            tf = Counter(tokenize(f"{c.section}\n{c.text}"))
            self.tfs.append(tf)
            df.update(tf.keys())
        self.lens = [sum(tf.values()) for tf in self.tfs]
        self.avgdl = (sum(self.lens) / len(self.lens)) if self.lens else 1.0
        n = len(chunks)
        self.idf = {t: math.log(1 + (n - f + 0.5) / (f + 0.5)) for t, f in df.items()}

    def search(self, query: str, top_k: int = 5) -> list[tuple[Chunk, float]]:
        q = tokenize(query)
        if not q:
            return []
        scores = []
        for i, tf in enumerate(self.tfs):
            s = 0.0
            dl = self.lens[i] or 1
            for t in q:
                f = tf.get(t)
                if not f:
                    continue
                s += self.idf.get(t, 0.0) * f * (self.k1 + 1) / (f + self.k1 * (1 - self.b + self.b * dl / self.avgdl))
            if s > 0:
                scores.append((s, i))
        scores.sort(reverse=True)
        return [(self.chunks[i], s) for s, i in scores[:top_k]]
