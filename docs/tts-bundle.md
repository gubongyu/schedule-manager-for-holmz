# 안내 방송 TTS 번들 (MeloTTS, Windows 단독 실행)

안내 방송 음성은 [tts_program](https://github.com/)의 MeloTTS를 그대로 사용하되,
매장 PC에 **Python·WSL·인터넷 없이** 동작하도록 PyInstaller 번들로 만들어 배포한다.

- 배포 위치: `holmz.exe` 옆의 `tts\tts.exe` (앱이 `{app}\tts\tts.exe` 를 호출)
- 용량: 약 2.6GB (실행 파일 1.3GB + 모델 1.3GB)
- 첫 합성 약 15~20초, 같은 문구는 캐시되어 즉시 재생 (`%APPDATA%\HOLMZ\announce`)
- 번들이 없거나 실패하면 Windows 내장 음성으로 자동 대체된다

## 다시 빌드하는 방법

빌드는 **Windows에서** 해야 한다 (PyInstaller는 크로스컴파일 불가).

1. Python 3.11 설치: `winget install --id Python.Python.3.11 --scope user`
   (MeloTTS는 3.11 전용. 3.12+ 에서는 의존성이 깨진다)
2. 작업 폴더에 tts_program 소스를 복사하고 가상환경 구성:
   ```
   python -m venv .venv
   .venv\Scripts\python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
   .venv\Scripts\python -m pip install "git+https://github.com/myshell-ai/MeloTTS.git" soundfile numpy "setuptools<81" pyinstaller
   .venv\Scripts\python -m pip uninstall -y unidic
   ```
3. `tts_core/kr_compat.py` 추가 후 `tts.py` 에서 melo 임포트 전에 `patch_g2pkk()` 호출
   (아래 "Windows 전용 문제" 참고)
4. `tts.py` 상단에 번들 실행 시 자산 경로 고정 코드 추가:
   `HF_HOME`, `TORCH_HOME`, `NLTK_DATA` 를 `exe 폴더/models`, `exe 폴더/nltk_data` 로,
   `HF_HUB_OFFLINE=1` 로 설정
5. `prefetch.py` 실행 — **실제 합성까지** 수행해 모델을 `models\` 로 내려받는다
   (모델 생성만으로는 BERT 가중치가 받아지지 않아 대상 PC에서 실패한다)
6. `%APPDATA%\nltk_data` 를 작업 폴더로 복사 (cmudict)
7. PyInstaller 빌드 (`build.bat` 참고). 데이터 파일이 있는 패키지는 `--collect-all` 필요:
   melo, g2pkk, g2p_en, eng_to_ipa, anyascii, inflect, jamo, transformers,
   num2words, unidic_lite, mecab_ko_dic, pykakasi, gruut, gruut_ipa
8. `dist\tts` + `models` + `nltk_data` 를 `holmz.exe` 옆 `tts\` 로 복사

## Windows 전용 문제와 해결

리눅스(WSL)에서는 드러나지 않는 문제들이다.

| 문제 | 원인 | 해결 |
|---|---|---|
| 한국어 G2P 실패 | `g2pkk` 가 Windows에서만 `eunjeon` 요구 (Python 3.11 빌드 불가) | `mecab-python3` + `mecab-ko-dic` 로 `pos()` 인터페이스 제공 (`kr_compat.py`) |
| MeCab 임포트 붕괴 | Windows는 대소문자를 구분하지 않아 `MeCab`(일본어)과 `mecab`(한국어) 패키지가 한 폴더로 합쳐짐 | `python-mecab-ko` 를 쓰지 않고 `mecab-python3` 하나로 통일, 사전만 한국어 지정 |
| 실행 중 pip install 시도 | `g2pkk.check_mecab()` 이 누락 패키지를 직접 설치하려 함 | `check_mecab` 을 무력화 (번들에서는 위험) |
| 매장 PC에서 모델 없음 | HuggingFace 캐시가 사용자 홈에 생성됨 | `HF_HOME` 을 exe 옆 `models` 로 고정하고 오프라인 모드 |
| cmudict 없음 | NLTK 데이터가 `%APPDATA%\nltk_data` 에 있음 | 번들에 복사하고 `NLTK_DATA` 지정 |
| 대형 일본어 사전 | `unidic`(500MB)이 melotts 의존성으로 설치되지만 실제로는 불필요 | 제거하면 MeCab이 `unidic-lite`(47MB)로 대체 |

## 용량 줄이기

영어 안내가 필요 없다면 다음 두 폴더를 지우면 약 620MB 절약된다 (한국어만 남음):

```
tts\models\hub\models--myshell-ai--MeloTTS-English
tts\models\hub\models--bert-base-uncased
```
