import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./fake-supabase";

let fake: ReturnType<typeof fakeSupabase>;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));
const { GET } = await import("@/app/api/cron/purge/route");

const U = "11111111-1111-1111-1111-111111111111";
const past = "2026-01-01T00:00:00.000Z";
const future = "2099-01-01T00:00:00.000Z";

const req = (auth?: string) =>
  GET(new NextRequest("https://dol.test/api/cron/purge", { headers: auth ? { authorization: auth } : {} }));

beforeEach(() => {
  process.env.CRON_SECRET = "s3cret-value";
  fake = fakeSupabase({
    orders: [
      // 납품 후 7일 지남 → 사진 삭제
      { id: "o1", user_id: U, status: "delivered", photos_purge_after: past, photos_deleted_at: null, result_purge_after: future, result_deleted_at: null, result_path: "o1/a.mp4", created_at: past },
      // 아직 보관 기간 → 그대로
      { id: "o2", user_id: U, status: "delivered", photos_purge_after: future, photos_deleted_at: null, result_purge_after: future, result_deleted_at: null, result_path: "o2/a.mp4", created_at: past },
      // 하루 넘게 미결제 → 취소 + 사진 삭제
      { id: "o3", user_id: U, status: "pending_payment", photos_purge_after: null, photos_deleted_at: null, result_purge_after: null, result_deleted_at: null, result_path: null, created_at: past, contact_phone: "01012345678" },
      // 30일 지남 → 영상 삭제
      { id: "o4", user_id: U, status: "delivered", photos_purge_after: past, photos_deleted_at: past, result_purge_after: past, result_deleted_at: null, result_path: "o4/a.mp4", created_at: past, contact_phone: "01012345678" },
      // 제작 중 → 절대 건드리지 않음
      { id: "o5", user_id: U, status: "in_production", photos_purge_after: null, photos_deleted_at: null, result_purge_after: null, result_deleted_at: null, result_path: null, created_at: past },
    ],
    share_links: [{ token: "t", order_id: "o4", expires_at: future }],
  });
  fake.storageFiles.photos = ["o1", "o2", "o3", "o5"].map((id) => `${U}/${id}/p1.jpg`);
});

describe("자동 삭제 (cron)", () => {
  it("비밀값이 없거나 틀리면 401", async () => {
    expect((await req()).status).toBe(401);
    expect((await req("Bearer wrong")).status).toBe(401);
    expect(fake.removed).toHaveLength(0);
  });

  it("CRON_SECRET이 설정되지 않았으면 누구도 호출할 수 없다", async () => {
    delete process.env.CRON_SECRET;
    expect((await req("Bearer ")).status).toBe(401);
    expect((await req("Bearer undefined")).status).toBe(401);
  });

  it("보관 기간이 지난 것만 지운다", async () => {
    const res = await req("Bearer s3cret-value");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ photos: 1, abandoned: 1, results: 1, errors: 0 });

    expect(fake.removed.sort()).toEqual([`photos:${U}/o1/p1.jpg`, `photos:${U}/o3/p1.jpg`, "results:o4/a.mp4"].sort());
    const byId = Object.fromEntries(fake.tables.orders.map((o) => [o.id, o]));
    expect(byId.o3.status).toBe("canceled");
    expect(byId.o3.contact_phone).toBeNull();
    expect(byId.o4.result_path).toBeNull();
    expect(byId.o4.contact_phone).toBeNull();
    expect(byId.o5.photos_deleted_at).toBeNull();
    expect(fake.storageFiles.photos).toContain(`${U}/o5/p1.jpg`);
    expect(fake.storageFiles.photos).toContain(`${U}/o2/p1.jpg`);
    expect(fake.tables.share_links).toHaveLength(0);
  });
});
