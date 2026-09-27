"""concepts.py로 복붙용 프롬프트(JSON, 마크다운)를 만든다. 실행: python3 build.py"""
import json
from pathlib import Path

from concepts import CONCEPTS, VERSIONS

HERE = Path(__file__).parent
CLIP_SECONDS = 8
SECONDS_PER_PHOTO = 5

FACE = (
    "The baby is the one-year-old Korean baby from the reference image; keep the face, hair and skin tone "
    "exactly the same as the reference."
)
TAIL = "8-second shot, 16:9. No text, no subtitles, no logos, no dialogue."


def full_prompt(scene: str, style: str) -> str:
    parts = [scene]
    if "baby" in scene.lower():
        parts.append(FACE)
    parts.append(f"Style: {style}.")
    parts.append(TAIL)
    return " ".join(parts)


def mmss(s: int) -> str:
    return f"{s // 60}:{s % 60:02d}"


def build():
    out = []
    for c in CONCEPTS:
        clips = []
        for i, (tier, title, desc, scene) in enumerate(c["clips"], start=1):
            clips.append({"no": i, "tier": tier, "title": title, "desc": desc, "prompt": full_prompt(scene, c["style"])})
        assert len(clips) == 16, c["id"]
        counts = {t: sum(1 for x in clips if x["tier"] == t) for t in (1, 3, 5)}
        assert counts == {1: 6, 3: 4, 5: 6}, (c["id"], counts)

        versions = {}
        for minutes, v in VERSIONS.items():
            used = [x for x in clips if x["tier"] in v["tiers"]]
            timeline, t, k = [], 0, 0
            inserts = dict(zip(v["after"], v["photo_blocks"]))
            for idx, clip in enumerate(used, start=1):
                timeline.append({"type": "ai", "start": mmss(t), "end": mmss(t + CLIP_SECONDS), "clip": clip["no"]})
                t += CLIP_SECONDS
                if idx in inserts:
                    sec = inserts[idx]
                    k += 1
                    timeline.append({
                        "type": "photo", "start": mmss(t), "end": mmss(t + sec), "seconds": sec,
                        "photos": max(1, round(sec / SECONDS_PER_PHOTO)), "block": k,
                    })
                    t += sec
            assert t == minutes * 60, (c["id"], minutes, t)
            versions[str(minutes)] = {"label": v["label"], "ai_clips": len(used), "timeline": timeline}

        out.append({k: c[k] for k in ("id", "name", "mood", "style")} | {"clips": clips, "versions": versions})

    (HERE / "prompts.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")

    for n, c in enumerate(out, start=1):
        lines = [f"# {n:02d}. {c['name']}", "", f"분위기: {c['mood']}", ""]
        for minutes in ("1", "3", "5"):
            v = c["versions"][minutes]
            lines += [f"## {v['label']} 버전 (AI 장면 {v['ai_clips']}개 + 사진)", ""]
            for item in v["timeline"]:
                if item["type"] == "photo":
                    lines += [f"### {item['start']}–{item['end']} · 사진 구간 {item['block']} ({item['seconds']}초, 사진 약 {item['photos']}장)", ""]
                    continue
                clip = c["clips"][item["clip"] - 1]
                lines += [
                    f"### {item['start']}–{item['end']} · 씬 {clip['no']:02d} {clip['title']}",
                    f"{clip['desc']}",
                    "",
                    "```",
                    clip["prompt"],
                    "```",
                    "",
                ]
        (HERE / f"{n:02d}-{c['id']}.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"{len(out)}개 컨셉, 장면 {sum(len(c['clips']) for c in out)}개 생성")


if __name__ == "__main__":
    build()
