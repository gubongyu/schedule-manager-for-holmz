"""빌드 시 한국어/영어 모델을 번들 폴더로 미리 내려받는다.

대상 PC에서 인터넷 없이 동작하도록, 여기서 받은 models 폴더를 배포본에 함께 넣는다.
"""
import os
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent / "models"
os.environ["HF_HOME"] = str(BASE)
os.environ["TORCH_HOME"] = str(BASE / "torch")
BASE.mkdir(parents=True, exist_ok=True)

from tts_core.kr_compat import patch_g2pkk  # noqa: E402

patch_g2pkk()

from melo.api import TTS  # noqa: E402  (환경변수 설정 후 임포트해야 한다)

SAMPLES = {"KR": "안내 방송 준비", "EN": "Announcement ready"}

# 실제 합성까지 수행해야 BERT 가중치 등 지연 로딩되는 자산까지 모두 받아둔다.
for lang, sample in SAMPLES.items():
    print(f"[prefetch] {lang} 모델 준비 중...", flush=True)
    model = TTS(language=lang, device="cpu")
    speaker = list(model.hps.data.spk2id.values())[0]
    model.tts_to_file(sample, speaker, output_path=None, speed=1.0, quiet=True)
    print(f"[prefetch] {lang} 완료", flush=True)

print("[prefetch] 모든 모델 준비 완료:", BASE)
sys.exit(0)
