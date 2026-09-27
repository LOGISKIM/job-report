"""인터뷰형 컨셉(concepts.py) + 공통 흐름(FLOW)으로 interview.json과 컨셉별 마크다운을 만든다. 실행: python3 build.py"""
import json
import re
from pathlib import Path

from concepts import CONCEPTS, FIELDS

HERE = Path(__file__).parent

# 공통 질문 문구 (컨셉의 "q"로 바꿀 수 있다)
QUESTIONS = {
    "name": "이름이 뭐예요?",
    "parents": "엄마 아빠는 누구예요?",
    "nick": "집에서는 뭐라고 불러요?",
    "year": "1년 동안 어떻게 지냈어요?",
    "memory": "가장 기억에 남는 일은요?",
    "hobby": "가장 좋아하는 놀이는요?",
    "talent": "특기가 있다면요?",
    "food": "가장 좋아하는 음식은요?",
    "mom": "엄마는 어떤 사람이에요?",
    "dad": "아빠는 어떤 사람이에요?",
    "family": "우리 가족을 더 소개해 주세요!",
    "birth": "태어난 날, 기억나요?",
    "dol": "오늘 가장 기대되는 건요?",
    "letter": "마지막으로 엄마 아빠에게 한마디!",
}

# 흐름: (tier, kind, 질문키 또는 None, 대사 또는 함수, 몸짓)
#   tier 1 = 1분·3분·5분, 3 = 3분·5분, 5 = 5분만
#   kind: open(대사 없는 오프닝) / talk(아기가 카메라 보고 말함) / vo(행동 장면 + 목소리) / photo(고객 사진 + 목소리)
FLOW = [
    (1, "open", None, None, None),
    (1, "talk", None, lambda c: c.get("intro1", "안녕하세요! 오늘의 주인공 {이름}입니다."), "waves both hands with a big smile"),
    (1, "talk", None, lambda c: c["intro2"], "nods proudly"),
    (5, "photo", "birth", "제가 태어난 날, {태어난날}.", None),
    (5, "talk", "name", "저는 한 살, {이름}입니다.", "points at itself"),
    (1, "talk", "parents", "엄마 {엄마이름}, 아빠 {아빠이름}의 아기예요.", "claps both hands"),
    (3, "talk", "nick", "집에서는 제 별명이 '{별명}'래요.", "tilts the head and giggles"),
    (3, "talk", "year", lambda c: c["year"][0], "sighs dramatically"),
    (5, "talk", "year", lambda c: c["year"][1], "shakes the head playfully"),
    (3, "vo", None, lambda c: c["broll3"], None),
    (3, "talk", "memory", "아, 잠시만요! 가장 기억에 남는 건요…", "raises one finger as if thinking"),
    (3, "photo", "memory", "{기억에남는일}! {기억한마디}", None),
    (3, "talk", "hobby", lambda c: "제 취미는 {좋아하는놀이}! " + c["hobby_twist"], "makes a proud face"),
    (5, "talk", "talent", lambda c: c["talent"], "flexes tiny arms"),
    (5, "vo", None, lambda c: c["broll5"], None),
    (5, "talk", "food", lambda c: c.get("food", "요즘 최애 메뉴는 {좋아하는음식}!"), "rubs the tummy happily"),
    (1, "talk", "mom", "우리 엄마는요, {엄마는}", "puts both hands on the cheeks"),
    (1, "talk", "dad", "우리 아빠는요, {아빠는}", "giggles with a mischievous look"),
    (5, "talk", "family", "그리고 우리 집엔 {가족소개}도 있어요!", "spreads both arms wide"),
    (3, "talk", "dol", "돌잡이가 제일 기대돼요! 뭘 잡을지는 비밀!", "covers the mouth shyly"),
    (3, "talk", "dol", lambda c: c["dol"], "winks"),
    (3, "talk", "letter", "엄마, 아빠. 저는 아직 배울 게 많지만", "looks at the camera softly"),
    (3, "photo", "letter", "엄마 아빠랑 함께라면 뭐든 잘해낼 수 있을 것 같아요. 서툴러도 더 많이 웃고, 더 많이 사랑한 1년이었어요.", None),
    (1, "talk", "letter", "앞으로도 오래오래 행복하게 지내요. 사랑해요!", "makes a heart with both arms"),
    (3, "talk", None, "와 주신 모든 분들 감사합니다! {애칭} 많이 응원해 주세요!", "bows politely"),
    (1, "talk", None, lambda c: c["closing"], "waves goodbye"),
]

# 사진 구간 길이(초): 길이별로 다르게
PHOTO_SECONDS = {"birth": {5: 30}, "memory": {3: 20, 5: 40}, "letter": {3: 25, 5: 40}}

# 얼굴 정확도: 고객 사진 → 이미지 편집(Nano Banana)으로 "얼굴 기준 이미지"를 먼저 만들고,
# 그 이미지를 첫 프레임으로 넣어 영상을 만든다(Frames to Video). 영상 프롬프트는 첫 프레임의 얼굴을 유지하라고만 쓴다.
# 실제 사진을 두고 "똑같이 재현"하라는 표현은 Flow가 실존 인물 재현으로 보고 거절할 수 있어서 영상 쪽에는 쓰지 않는다.
FACE = (
    "Keep the baby looking the same as in the starting frame for the whole shot: same face, eyes, nose, mouth, "
    "hair and skin tone, with no change to the face."
)

KEEP = (
    "Edit this photo. Keep the baby's face exactly as it is in the photo: same face shape, eyes, eyelids, eyebrows, "
    "nose, lips, ears, cheeks, skin tone, hair and hairline. Do not beautify, smooth, slim, age up or restyle the face, "
    "and keep realistic skin texture."
)


def still_prompt(c, scene=None):
    scene = scene or (
        f"the baby, wearing {c['outfit']}, sits facing the camera. Setting: {c['set'][0].lower() + c['set'][1:]}"
    )
    return (
        f"{KEEP} Change only the clothes, pose and background: {scene[0].lower() + scene[1:].rstrip('.')}. "
        f"Face clearly visible and evenly lit, looking toward the camera, mouth gently closed. "
        f"Lighting and mood: {c['style']}. Medium close-up, 16:9."
    )

# Flow에 넣는 대사에는 성까지 붙은 실명을 넣지 않는다(유명인 정책에 걸림). 아기는 성 뺀 이름({애칭})으로 부르고,
# 엄마·아빠 실명은 빼서 TTS 대본에만 남긴다.
NEUTRAL = [
    (r"\s*\{엄마이름\}", ""), (r"\s*\{아빠이름\}", ""), (r"\{이름\}", "{애칭}"),
]


def veo_line(line):
    for pat, rep in NEUTRAL:
        line = re.sub(pat, rep, line)
    return line


def talk_prompt(c, gesture):
    return (
        f"{c['set']}. Medium close-up: the baby, wearing {c['outfit']}, sits facing the camera and happily says in a cute, slow "
        f"toddler voice: \"{{LINE}}\" then {gesture}. The mouth moves naturally with the Korean words. {FACE} "
        f"Style: {c['style']}. 8-second shot, 16:9. No text, no subtitles, no logos."
    )


def action_prompt(c, visual):
    return (
        f"{visual} The baby wears {c['outfit']}. {FACE} Style: {c['style']}. "
        f"8-second shot, 16:9. No dialogue, soft ambient sound only. No text, no subtitles, no logos."
    )


def build():
    out = []
    for c in CONCEPTS:
        q = {**QUESTIONS, **c.get("q", {})}
        clips = []
        for no, (tier, kind, qkey, line, gesture) in enumerate(FLOW, start=1):
            if callable(line):
                line = line(c)
            item = {"no": no, "tier": tier, "kind": kind, "q": q.get(qkey) if qkey else None}
            if kind == "open":
                item.update(title="오프닝", line=None, prompt=action_prompt(c, c["opener"]),
                            still=still_prompt(c, f"{c['opener']} The baby wears {c['outfit']}"))
            elif kind == "vo":
                visual, vo = line
                item.update(title="행동 장면 (목소리만)", line=vo, prompt=action_prompt(c, visual),
                            still=still_prompt(c, f"{visual} The baby wears {c['outfit']}"))
            elif kind == "photo":
                item.update(title="고객 사진 구간", line=line, prompt=None, seconds=PHOTO_SECONDS[qkey])
            else:
                item.update(title="말하는 장면", line=line, veo=veo_line(line), prompt=talk_prompt(c, gesture))
            clips.append(item)
        out.append({
            "id": c["id"], "name": c["name"], "show": c["show"], "style": c["style"],
            "outfit": c["outfit"], "set": c["set"], "still": still_prompt(c), "clips": clips,
        })

    data = {"fields": [{"key": k, "label": l, "example": e} for k, l, e in FIELDS], "concepts": out}
    (HERE / "interview.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")

    for n, c in enumerate(out, start=1):
        lines = [f"# {n:02d}. {c['name']} · {c['show']}", "", "tier 1 = 1분·3분·5분, 3 = 3분·5분, 5 = 5분만", "",
                 "## 00 얼굴 기준 이미지 (말하는 장면 전부 이 이미지를 첫 프레임으로)", "", "```", c["still"], "```", ""]
        for clip in c["clips"]:
            head = f"## {clip['no']:02d} [{clip['tier']}] {clip['title']}"
            if clip["q"]:
                head += f" · Q. {clip['q']}"
            lines.append(head)
            if clip["line"]:
                lines.append(f"대사: {clip['line']}")
            if clip["kind"] == "photo":
                lines.append("길이: " + ", ".join(f"{k}분 {v}초" for k, v in clip["seconds"].items()))
            if clip.get("still"):
                lines += ["", "첫 프레임 이미지:", "```", clip["still"], "```"]
            if clip["prompt"]:
                if clip.get("veo") and clip["veo"] != clip["line"]:
                    lines.append(f"Flow용 대사(성 뺀 이름): {clip['veo']}")
                lines += ["", "```", clip["prompt"].replace("{LINE}", clip.get("veo") or ""), "```"]
            lines.append("")
        (HERE / f"{n:02d}-{c['id']}.md").write_text("\n".join(lines), encoding="utf-8")

    counts = {t: sum(1 for x in FLOW if x[0] <= t and x[1] != "photo") for t in (1, 3, 5)}
    print(f"{len(out)}개 컨셉, 컨셉당 장면 {len(FLOW)}개 / Flow로 뽑는 장면 수: 1분 {counts[1]}, 3분 {counts[3]}, 5분 {counts[5]}")


if __name__ == "__main__":
    build()
