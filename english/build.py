"""src/*.txt (word|English|Korean|note) -> sentences.json + sentences.md (200일 x 5문장)."""
import glob, json, re
from collections import OrderedDict

TOTAL, PER_DAY = 1000, 5

groups, seen = OrderedDict(), set()
for path in sorted(glob.glob("src/*.txt")):
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if not line:
            continue
        word, en, ko, note = line.split("|")
        key = re.sub(r"[^a-z ]", "", en.lower())
        if key in seen:
            continue
        seen.add(key)
        groups.setdefault(word, []).append({"word": word, "en": en, "ko": ko, "note": note})

# 1000개 맞추기: 가장 큰 그룹의 끝에서부터 덜어냄
while sum(map(len, groups.values())) > TOTAL:
    max(groups.values(), key=len).pop()

# 각 단어 그룹을 전체 기간에 고르게 퍼뜨림 (하루에 같은 단어가 몰리지 않게)
order = list(groups)
items = sorted(
    ((i + 0.5) / len(g), order.index(w), s)
    for w, g in groups.items() for i, s in enumerate(g)
)
items = [s for *_, s in items]
assert len(items) == TOTAL, len(items)

out = []
for n, s in enumerate(items):
    out.append({"no": n + 1, "day": n // PER_DAY + 1, **s})
json.dump(out, open("sentences.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

with open("sentences.md", "w", encoding="utf-8") as f:
    f.write("# 미국 영어 생활 문장 1000 (하루 5문장 × 200일)\n\n")
    f.write("쉬운 단어(get, take, make, run …)가 여러 뜻으로 쓰이는 문장 위주.\n")
    for s in out:
        if (s["no"] - 1) % PER_DAY == 0:
            f.write(f"\n## Day {s['day']}\n\n")
        f.write(f"{s['no']}. **{s['en']}** — {s['ko']}  \n   `{s['note']}`\n")
print(len(out), "sentences,", len(groups), "words")
