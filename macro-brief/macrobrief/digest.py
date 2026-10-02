"""Tag collected items by topic and write a Markdown shortlist (digest.md)."""
import json
import re
from collections import defaultdict

from .collect import load_config

TOPIC_LABELS = {
    "rates": "금리·채권", "inflation": "물가", "labor": "고용", "fx": "환율·달러",
    "ai_semis": "AI·반도체", "energy": "에너지", "china": "중국", "credit": "크레딧",
    "equities": "주식", "korea": "한국",
}


def _patterns(topics):
    return {t: re.compile(r"\b(" + "|".join(re.escape(k) for k in kws) + r")\b", re.I)
            for t, kws in topics.items()}


def tag_items(items, topics):
    pats = _patterns(topics)
    for item in items:
        text = f"{item['title']} {item['title']} {item.get('summary', '')}"  # title counts double
        hits = {t: len(p.findall(text)) for t, p in pats.items()}
        item["topics"] = sorted((t for t, n in hits.items() if n), key=lambda t: -hits[t])
        item["score"] = sum(hits.values())
    return items


def write_digest(out_dir, per_topic=5):
    cfg = load_config()
    data = json.loads((out_dir / "items.json").read_text(encoding="utf-8"))
    items = tag_items(data["items"], cfg["topics"])

    by_topic = defaultdict(list)
    for item in items:
        if item["topics"]:
            by_topic[item["topics"][0]].append(item)

    lines = [f"# 매크로 브리프 후보 ({data['collected']}, 최근 {data['days']}일)", ""]
    lines += ["## 수집 상태", "", "| 출처 | 결과 |", "|---|---|"]
    for s in data["status"]:
        lines.append(f"| {s['id']} | {'✅ ' + str(s['count']) + '건' if s['ok'] else '❌ ' + s['error']} |")

    lines += ["", "## 주제별 후보", "",
              "점수는 주제 키워드가 제목·요약에 나온 횟수예요. 민간(private) 자료는 요약과 출처 표기만, "
              "공공(public) 자료는 인용이 자유로운 편이에요.", ""]
    ranked = sorted(by_topic.items(), key=lambda kv: -sum(i["score"] for i in kv[1]))
    for topic, group in ranked:
        lines += [f"### {TOPIC_LABELS.get(topic, topic)} ({len(group)}건)", ""]
        for item in sorted(group, key=lambda i: (-i["score"], i["date"] or ""))[:per_topic]:
            extra = f" · 본문: `{item['text_file']}`" if item.get("text_file") else ""
            lines.append(f"- **[{item['title']}]({item['url']})**  ")
            lines.append(f"  {item['date'] or '날짜 미상'} · {item['tag']} ({item['tier']}) · 점수 {item['score']}{extra}")
            if item.get("summary"):
                lines.append(f"  > {item['summary'][:220]}")
        lines.append("")

    untagged = [i for i in items if not i["topics"]]
    if untagged:
        lines += [f"### 분류 안 됨 ({len(untagged)}건)", ""]
        lines += [f"- [{i['title']}]({i['url']}) · {i['tag']}" for i in untagged[:15]]

    path = out_dir / "digest.md"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    (out_dir / "items.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    return path
