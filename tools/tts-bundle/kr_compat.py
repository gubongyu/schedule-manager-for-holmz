"""Windows에서 한국어 G2P(g2pkk)가 동작하도록 형태소 분석기를 보정한다.

g2pkk는 Windows일 때만 `eunjeon` 패키지를 요구하는데 Python 3.11에서 설치가 불가능하고,
대안인 `python-mecab-ko`는 Windows의 대소문자 무시 파일시스템 때문에 일본어용
`mecab-python3`(MeCab)와 같은 폴더에 섞여 양쪽이 모두 깨진다.

그래서 이미 설치된 mecab-python3 하나만 쓰고, 사전만 한국어(mecab-ko-dic)로 지정해
g2pkk가 기대하는 pos() 인터페이스를 제공한다. melo 임포트 전에 patch_g2pkk()를 부른다.
"""
from pathlib import Path


class MeCabKoTagger:
    """g2pkk가 기대하는 pos() -> [(형태소, 품사태그), ...] 인터페이스."""

    def __init__(self):
        import MeCab
        import mecab_ko_dic

        # MeCab 인자 파서가 역슬래시를 이스케이프로 처리하므로 슬래시 경로로 넘긴다.
        dicdir = str(Path(mecab_ko_dic.__file__).parent / "dictionary").replace("\\", "/")
        self._tagger = MeCab.Tagger(f"-d {dicdir}")

    def pos(self, text):
        tokens = []
        for line in self._tagger.parse(text).splitlines():
            if not line or line == "EOS":
                continue
            surface, _, feature = line.partition("\t")
            tokens.append((surface, feature.split(",")[0]))
        return tokens


def patch_g2pkk():
    try:
        import g2pkk.g2pkk as g
    except Exception:
        return  # 한국어를 쓰지 않는 환경

    # 실행 중 pip install 을 시도하는 검사를 무력화한다 (번들 실행 시 위험).
    g.G2p.check_mecab = lambda self: None
    g.G2p.get_mecab = lambda self: MeCabKoTagger()
