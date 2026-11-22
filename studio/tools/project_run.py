# /// script
# requires-python = ">=3.11"
# ///
"""项目生成运行器：由任务服务以 `uv run project_run.py --project <id>` 启动。

按模板自身入口分流：
- 带 assistant/motion.mjs 的包 → 官方云端 expert（消耗包内 Key 的积分）；
- 带 adapter.py 的包 → 本机 prepare → render，不联网。
每次运行使用全新实例目录，避免复用旧 plan/instance 报错。
运行结果写回 project.json（status/artifactRel/error），日志同时落 run.log。
"""
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BIN = ROOT / "studio" / "bin"
ENV = {**os.environ, "PATH": f"{BIN}{os.pathsep}{os.environ.get('PATH', '')}"}


def log(logfile: Path, text: str) -> None:
    print(text, flush=True)
    with logfile.open("a", encoding="utf-8") as f:
        f.write(text + "\n")


def run(cmd: list[str], logfile: Path, timeout: int) -> int:
    log(logfile, f"$ {' '.join(cmd)}")
    proc = subprocess.Popen(cmd, cwd=ROOT, env=ENV, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    start = time.time()
    assert proc.stdout is not None
    for line in proc.stdout:
        log(logfile, line.rstrip("\n"))
        if time.time() - start > timeout:
            proc.kill()
            log(logfile, "[超时] 命令超过时限已终止")
            return 124
    return proc.wait()


def find_template(template_id: str) -> Path | None:
    base = ROOT / "studio" / "templates"
    direct = base / template_id
    if (direct / "motion.json").exists():
        return direct
    if not base.exists():
        return None
    for d in base.iterdir():
        meta = d / "motion.json"
        if not meta.exists():
            continue
        m = json.loads(meta.read_text(encoding="utf-8"))
        t = m.get("template") or {}
        canonical = f"{t.get('id')}@{t.get('version')}"
        if canonical == template_id or d.name == template_id:
            return d
    return None


def main() -> int:
    args = sys.argv[1:]
    if "--project" not in args:
        print("缺少 --project", flush=True)
        return 2
    pid = args[args.index("--project") + 1]
    pdir = ROOT / "studio" / "projects" / pid
    pfile = pdir / "project.json"
    project = json.loads(pfile.read_text(encoding="utf-8"))
    logfile = pdir / "run.log"
    logfile.write_text(f"# run {time.strftime('%Y-%m-%d %H:%M:%S')}\n", encoding="utf-8")

    def save(**kw):
        project.update(kw)
        pfile.write_text(json.dumps(project, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    tpl = find_template(project["templateId"])
    if tpl is None:
        save(status="failed", error="模板不存在，请重新下载导入")
        log(logfile, "模板不存在")
        return 1

    attempt = 1
    while (pdir / f"instance-{attempt}").exists():
        attempt += 1
    instance = pdir / f"instance-{attempt}"
    outdir = pdir / "output"
    outdir.mkdir(parents=True, exist_ok=True)

    try:
        if (tpl / "assistant" / "motion.mjs").exists():
            archive = ROOT / project["archiveRel"]
            if not archive.exists():
                save(status="failed", error="缺少原始 .motion 包，请重新下载导入")
                return 1
            assets = pdir / "input" / "assets"
            assets.mkdir(parents=True, exist_ok=True)
            code = run(
                ["node", str(tpl / "assistant" / "motion.mjs"), "api", str(archive), "expert",
                 "--script", str(pdir / "input" / "script.txt"),
                 "--max-credits", str(project.get("runMaxCredits") or 0),
                 "--assets", str(assets), "--instance", str(instance), "--run"],
                logfile, 30 * 60,
            )
            if code != 0:
                save(status="failed", error="官方生成失败，见 run.log（额度不足时为 insufficient_credits）")
                return code
            videos = sorted(instance.rglob("*.mp4"), key=lambda p: p.stat().st_mtime, reverse=True)
            if not videos:
                save(status="failed", error="官方返回成功但没有找到成片")
                return 1
            rel = videos[0].relative_to(ROOT).as_posix()
        else:
            adapter = tpl / "adapter.py"
            if not adapter.exists():
                save(status="failed", error="模板缺少 adapter.py，请重新下载导入")
                return 1
            uv = shutil.which("uv", path=ENV["PATH"]) or "uv"
            code = run([uv, "run", str(adapter), "prepare", "--input", str(pdir / "input" / "user.json"),
                        "--out", str(instance)], logfile, 10 * 60)
            if code != 0:
                save(status="failed", error="准备失败，见 run.log")
                return code
            ua = instance / "user-assets"
            ua.mkdir(parents=True, exist_ok=True)
            cover = ROOT / "studio" / "videos" / "input" / "cover.png"
            if cover.exists():
                shutil.copyfile(cover, ua / "cover.png")
            # 适配器要求输出路径必须不存在：每次渲染写临时名，成功后再覆盖正式产物。
            out = outdir / f"run-{attempt}.mp4"
            code = run([uv, "run", str(adapter), "render", "--instance", str(instance), "--out", str(out)],
                       logfile, 30 * 60)
            if code != 0:
                save(status="failed", error="渲染失败，见 run.log")
                return code
            audio_tmp = out.with_name(f"{out.stem}-with-audio.mp4")
            final = outdir / "video.mp4"
            final_audio = outdir / "video-with-audio.mp4"
            if audio_tmp.exists():
                os.replace(audio_tmp, final_audio)
                if out.exists():
                    os.replace(out, final)
                rel = final_audio.relative_to(ROOT).as_posix()
            else:
                os.replace(out, final)
                rel = final.relative_to(ROOT).as_posix()

        save(status="done", artifactRel=rel, error=None)
        log(logfile, f"完成：{rel}")
        print(json.dumps({"ok": True, "artifact": rel}, ensure_ascii=False), flush=True)
        return 0
    except Exception as e:  # noqa: BLE001
        save(status="failed", error=str(e))
        log(logfile, f"异常：{e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
