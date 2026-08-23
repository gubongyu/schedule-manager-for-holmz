@echo off
chcp 65001 >nul
cd /d D:\holmz_schedule_manager\tts_build
.venv\Scripts\pyinstaller.exe tts.py --name tts --noconfirm --console --clean ^
 --collect-all melo ^
 --collect-all g2p_en ^
 --collect-all eng_to_ipa ^
 --collect-all anyascii ^
 --collect-all inflect ^
 --collect-all g2pkk ^
 --collect-all jamo ^
 --collect-all transformers ^
 --collect-all num2words ^
 --collect-all unidic_lite ^
 --collect-all mecab_ko_dic ^
 --collect-all pykakasi ^
 --collect-all gruut ^
 --collect-all gruut_ipa ^
 --collect-data tokenizers ^
 --collect-data nltk ^
 --hidden-import=MeCab ^
 --hidden-import=mecab_ko_dic ^
 --copy-metadata melotts ^
 --copy-metadata transformers ^
 --copy-metadata torch ^
 --copy-metadata tqdm ^
 --copy-metadata regex ^
 --copy-metadata requests ^
 --copy-metadata packaging ^
 --copy-metadata filelock ^
 --copy-metadata numpy ^
 --copy-metadata tokenizers
