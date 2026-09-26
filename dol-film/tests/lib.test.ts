import { describe, expect, it } from "vitest";
import { CUSTOM, TEMPLATES, getTemplate, stageOf } from "@/lib/catalog";
import { CONSENTS } from "@/lib/consents";
import { addBusinessDays } from "@/lib/dates";
import { buildPrompts } from "@/lib/prompts";
import { safeNext } from "@/lib/safe-next";

describe("safeNext (로그인 후 이동 주소)", () => {
  it("사이트 안의 경로는 그대로 쓴다", () => {
    expect(safeNext("/orders/abc?x=1")).toBe("/orders/abc?x=1");
  });
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "", null, undefined])(
    "외부로 나가는 주소 %s 는 막는다",
    (v) => {
      expect(safeNext(v)).toBe("/");
    },
  );
});

describe("addBusinessDays (완성 예정일)", () => {
  it("금요일에 결제하면 영업일 5일 뒤는 다음 주 금요일", () => {
    // 2026-09-25(금) 10:00 KST
    const d = addBusinessDays(new Date("2026-09-25T01:00:00Z"), 5);
    expect(d.toISOString().slice(0, 10)).toBe("2026-10-02");
  });
  it("토요일에 결제해도 주말은 세지 않는다", () => {
    const d = addBusinessDays(new Date("2026-09-26T01:00:00Z"), 1);
    expect(d.toISOString().slice(0, 10)).toBe("2026-09-28");
  });
});

describe("카탈로그", () => {
  it("모든 템플릿은 가격이 양수이고 장면 합계가 3분이다", () => {
    for (const t of TEMPLATES) {
      expect(t.price).toBeGreaterThan(0);
      expect(t.scenes.reduce((s, x) => s + x.seconds, 0)).toBe(180);
    }
  });
  it("템플릿 ID는 서로 겹치지 않는다", () => {
    const ids = [...TEMPLATES.map((t) => t.id), CUSTOM.id];
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("없는 템플릿은 undefined", () => {
    expect(getTemplate("nope")).toBeUndefined();
    expect(getTemplate("custom")).toBe(CUSTOM);
  });
  it("진행 단계 매핑", () => {
    expect(["paid", "in_production", "review", "delivered"].map(stageOf)).toEqual([0, 1, 2, 3]);
    expect(stageOf("pending_payment")).toBe(-1);
  });
  it("샘플 활용 동의만 선택 항목이다", () => {
    expect(CONSENTS.filter((c) => !c.required).map((c) => c.id)).toEqual(["sample"]);
  });
});

describe("Flow 프롬프트", () => {
  it("템플릿은 AI 장면마다 하나씩 만든다", () => {
    const prompts = buildPrompts({ template_id: "fairy", moods: [], custom_request: null });
    expect(prompts).toHaveLength(TEMPLATES[0].scenes.filter((s) => s.kind === "ai").length);
    expect(prompts[0]).toContain("reference image");
  });
  it("나만의 스타일은 적은 줄마다 하나씩 만든다", () => {
    const prompts = buildPrompts({ template_id: "custom", moods: ["따뜻한"], custom_request: "바닷가\n\n회전목마" });
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("회전목마");
  });
});
