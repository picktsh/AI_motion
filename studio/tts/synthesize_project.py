# /// script
# requires-python = ">=3.10"
# dependencies = ["edge-tts==7.3.1"]
# ///
"""按项目文稿与选定时音色合成整条旁白，输出到项目 input/voice.mp3。

由任务服务以 `uv run synthesize_project.py --project <id>` 启动：
- 读 `input/script.txt` 作为旁白文本；
- 读 `input/studio-config.json` 的 `voicePreference`，缺省兜底云希；
- 产物落 `input/voice.mp3`，元信息写 `input/voice.json`；
- 不回写 adapter 校验用的 `user.json`，配音绑定进渲染留待后续链路。
"""
import argparse
import datetime
import json
import shutil
import subprocess
import sys
from pathlib import Path

import edge_tts

STUDIO = Path(__file__).resolve().parent.parent
ROOT = STUDIO.parent
DEFAULT_VOICE = "zh-CN-YunxiNeural"


def find_ffprobe() -> Path:
    found = shutil.which("ffprobe")
    if found:
        return Path(found)
    local = ROOT / "studio" / "bin" / "ffprobe"
    if local.exists():
        return local
    raise FileNotFoundError("ffprobe not found on PATH or in studio/bin")


def duration_of(path: Path, ffprobe: Path) -> float:
    out = subprocess.check_output([
        str(ffprobe), "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path),
    ])
    return round(float(out.decode().strip()), 3)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True)
    args = parser.parse_args()

    proj = STUDIO / "projects" / args.project
    inp = proj / "input"
    script_file = inp / "script.txt"
    if not script_file.exists():
        print(f"项目文稿不存在：{script_file}", file=sys.stderr)
        return 1

    text = script_file.read_text(encoding="utf-8").strip()
    if not text:
        print("文稿为空，无法合成配音", file=sys.stderr)
        return 1

    voice = DEFAULT_VOICE
    cfg_file = inp / "studio-config.json"
    if cfg_file.exists():
        try:
            cfg = json.loads(cfg_file.read_text(encoding="utf-8"))
            pref = cfg.get("voicePreference")
            if isinstance(pref, str) and pref.strip():
                voice = pref.strip()
        except json.JSONDecodeError:
            pass

    ffprobe = find_ffprobe()
    audio = inp / "voice.mp3"

    tts = edge_tts.Communicate(text, voice, rate="+0%", pitch="+0Hz")
    asyncio_run(tts, str(audio))

    dur = duration_of(audio, ffprobe)
    meta = {
        "voice": voice,
        "text": text,
        "duration_s": dur,
        "file": "input/voice.mp3",
        "createdAt": datetime.datetime.now().isoformat(timespec="seconds"),
    }
    (inp / "voice.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )
    print(json.dumps({"voice": voice, "duration_s": dur}, ensure_ascii=False))
    return 0


def asyncio_run(tts: edge_tts.Communicate, out: str) -> None:
    import asyncio

    asyncio.run(tts.save(out))


if __name__ == "__main__":
    sys.exit(main())
