# /// script
# requires-python = ">=3.10"
# dependencies = ["edge-tts==7.3.1"]
# ///
"""分段合成旁白，输出每段 mp3 与词边界 JSON。"""
import asyncio, json, sys
from pathlib import Path
import edge_tts

VOICE = "zh-CN-XiaoyiNeural"
RATE = "+0%"
PITCH = "+0Hz"

SEGMENTS = [
    {"id": "B1", "start": 0.0, "end": 8.0,
     "text": "最近刷到 AI 自动剪辑，博主阿杜讲它方便快捷又高效，我一下就来了兴趣。"},
    {"id": "B2", "start": 8.0, "end": 18.0,
     "text": "于是我顺着他的视频一路往下深挖，翻介绍、看思路，一点点把流程弄明白。"},
    {"id": "B3", "start": 18.0, "end": 28.0,
     "text": "以前剪片费时费力，现在自动出片省心不少；摸清工具思路以后，第一条成片比我预想的成型得更快。"},
    {"id": "B4", "start": 28.0, "end": 36.0,
     "text": "就从这一条视频开始，我深挖琢磨，交出了自己的第一条片子。"},
]

OUT = Path(r"D:\AI_motion\tts\segments")
OUT.mkdir(parents=True, exist_ok=True)
TICKS = 10_000_000


async def synth(seg):
    com = edge_tts.Communicate(seg["text"], VOICE, rate=RATE, pitch=PITCH,
                               boundary="WordBoundary")
    audio = bytearray()
    bounds = []
    async for chunk in com.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            bounds.append({
                "text": chunk["text"],
                "start": round(chunk["offset"] / TICKS, 3),
                "end": round((chunk["offset"] + chunk["duration"]) / TICKS, 3),
            })
    mp3 = OUT / f"{seg['id']}.mp3"
    mp3.write_bytes(bytes(audio))
    return {"id": seg["id"], "windowStart": seg["start"], "windowEnd": seg["end"],
            "text": seg["text"], "audio": str(mp3), "bounds": bounds}


async def main():
    results = []
    for seg in SEGMENTS:
        r = await synth(seg)
        results.append(r)
        print(f"{r['id']}: bounds={len(r['bounds'])} chars={len(r['text'])}")
    (OUT / "segments.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
