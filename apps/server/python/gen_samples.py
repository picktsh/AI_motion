#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate edge-tts voice style samples and a manifest.

Each sample uses a short line matched to the voice's temperament.
Rate and pitch are kept at neutral (+0% / +0Hz) so the base timbre is comparable.
"""
import json
import os
import shutil
import subprocess
from pathlib import Path

import edge_tts

# 仓库根由服务端注入 PROJECT_ROOT；回退按新层级回溯。
ROOT = Path(os.environ.get("PROJECT_ROOT") or Path(__file__).resolve().parents[3])
OUT = ROOT / "studio" / "tts" / "samples"
OUT.mkdir(parents=True, exist_ok=True)


def _find_ffprobe() -> Path:
    found = shutil.which("ffprobe")
    if found:
        return Path(found)
    local = ROOT / "apps" / "server" / "vendor" / "ffprobe"
    if local.exists():
        return local
    raise FileNotFoundError("ffprobe not found on PATH or in apps/server/vendor")


FFPROBE = _find_ffprobe()

# id, voice, label, style, text, rate, pitch
SAMPLES = [
    ("01-xiaoxiao-warm", "zh-CN-XiaoxiaoNeural", "晓晓", "女·温暖·新闻小说",
     "写了八年代码，我想把这段摸索的经过，慢慢讲给你听。", "+0%", "+0Hz"),
    ("02-xiaoyi-lively", "zh-CN-XiaoyiNeural", "晓伊", "女·活泼·卡通",
     "哈喽，今天又做出一个新片子，快来看看我是怎么折腾的。", "+0%", "+0Hz"),
    ("03-yunjian-passion", "zh-CN-YunjianNeural", "云健", "男·激情·体育",
     "别犹豫，动手就对了。工具不怕多，敢试才能出成果。", "+0%", "+0Hz"),
    ("04-yunxi-sunshine", "zh-CN-YunxiNeural", "云希", "男·阳光·活泼",
     "嘿，朋友，这个方法挺有意思，咱们一块儿来试试吧。", "+0%", "+0Hz"),
    ("05-yunxia-cute", "zh-CN-YunxiaNeural", "云夏", "男·可爱·卡通",
     "哇，这个视频做得好好玩呀，我也想跟着学一学呢。", "+0%", "+0Hz"),
    ("06-yunyang-pro", "zh-CN-YunyangNeural", "云扬", "男·专业·新闻",
     "下面这段内容基于实际操作整理，建议结合自己的情况参考。", "+0%", "+0Hz"),
    ("07-liaoning-xiaobei", "zh-CN-liaoning-XiaobeiNeural", "晓北", "女·辽宁方言·幽默",
     "哎妈呀，这玩意儿整得还真像那么回事，你说有意思不？", "+0%", "+0Hz"),
    ("08-shaanxi-xiaoni", "zh-CN-shaanxi-XiaoniNeural", "晓妮", "女·陕西方言·明亮",
     "今儿个给咱谝一谝，这新折腾出来的活，看着还真嫽得很。", "+0%", "+0Hz"),
]


def duration_of(path: Path) -> float:
    out = subprocess.check_output([
        str(FFPROBE), "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path)
    ])
    return round(float(out.decode().strip()), 3)


async def main() -> None:
    manifest = []
    for sid, voice, label, style, text, rate, pitch in SAMPLES:
        media = OUT / f"{sid}.mp3"
        tts = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
        await tts.save(str(media))
        dur = duration_of(media)
        manifest.append({
            "id": sid,
            "file": media.name,
            "voice": voice,
            "label": label,
            "style": style,
            "text": text,
            "rate": rate,
            "pitch": pitch,
            "duration_s": dur,
        })
        print(f"OK {sid} {voice} {dur}s")

    (OUT / "samples.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"\n{len(manifest)} samples -> {OUT}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
