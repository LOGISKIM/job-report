import { getTemplate } from "@/lib/catalog";

// 관리자 화면에서 Google Flow에 붙여 넣을 장면별 프롬프트를 만든다.
const STYLE: Record<string, string> = {
  fairy: "pastel fairytale world, soft glowing light, dreamy clouds",
  hanbok: "traditional Korean hanok courtyard, colorful saekdong hanbok, warm afternoon sunlight",
  space: "cute cinematic outer space adventure, stars and moon, soft rim light",
  seasons: "natural outdoor scenery, soft seasonal colors, gentle daylight",
};

export function buildPrompts(order: { template_id: string; moods: string[]; custom_request: string | null }) {
  const t = getTemplate(order.template_id);
  const common =
    "one-year-old Korean baby, keep the face identical to the reference image, 8 seconds, slow gentle camera push-in, no text, no dialogue, no subtitles";

  if (!t || t.id === "custom") {
    const moods = order.moods.join(", ");
    return (order.custom_request ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((scene, i) => `장면 ${i + 1}: ${scene}\n→ Cinematic shot, ${moods} mood. ${scene}. ${common}.`);
  }

  return t.scenes
    .filter((s) => s.kind === "ai")
    .map((s) => `${s.name} (${s.seconds}초): ${s.desc}\n→ Cinematic shot, ${STYLE[t.id] ?? ""}. ${s.desc}. ${common}.`);
}
