import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setStorageDriverForTest } from "@/lib/storage";
import { fakeSupabase } from "./fake-supabase";

let fake: ReturnType<typeof fakeSupabase>;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));
const { GET } = await import("@/app/api/cron/purge/route");

const U = "11111111-1111-1111-1111-111111111111";
const past = "2026-01-01T00:00:00.000Z";
const future = "2099-01-01T00:00:00.000Z";
const SECRET = "Bearer s3cret-value-long-enough";
const photo = (id: string) => `photos/${U}/${id}/p1.jpg`;
const video = (id: string, name = "a") => `results/${id}/${name}.mp4`;

const req = (auth?: string) =>
  GET(new NextRequest("https://dol.test/api/cron/purge", { headers: auth ? { authorization: auth } : {} }));

beforeEach(() => {
  process.env.CRON_SECRET = "s3cret-value-long-enough";
  fake = fakeSupabase({
    orders: [
      // 납품 후 7일 지남 → 사진 삭제
      { id: "o1", user_id: U, status: "delivered", photos_purge_after: past, photos_deleted_at: null, result_purge_after: future, result_deleted_at: null, result_path: video("o1"), created_at: past },
      // 아직 보관 기간 → 그대로
      { id: "o2", user_id: U, status: "delivered", photos_purge_after: future, photos_deleted_at: null, result_purge_after: future, result_deleted_at: null, result_path: video("o2"), created_at: past },
      // 이틀 넘게 미결제 → 취소 + 사진 삭제
      { id: "o3", user_id: U, status: "pending_payment", photos_purge_after: null, photos_deleted_at: null, result_purge_after: null, result_deleted_at: null, result_path: null, created_at: past, contact_phone: "01012345678" },
      // 30일 지남 → 영상 삭제
      { id: "o4", user_id: U, status: "delivered", photos_purge_after: past, photos_deleted_at: past, result_purge_after: past, result_deleted_at: null, result_path: video("o4"), created_at: past, contact_phone: "01012345678" },
      // 수정 요청으로 제작 중 (보관 기한이 지난 값이 남아 있어도) → 영상을 지우지 않음
      { id: "o6", user_id: U, status: "in_production", photos_purge_after: null, photos_deleted_at: null, result_purge_after: past, result_deleted_at: null, result_path: video("o6"), created_at: past },
      // 제작 중 → 절대 건드리지 않음
      { id: "o5", user_id: U, status: "in_production", photos_purge_after: null, photos_deleted_at: null, result_purge_after: null, result_deleted_at: null, result_path: null, created_at: past },
    ],
    profiles: [{ id: U, is_admin: false }],
    admin_audit: [],
    share_links: [{ token: "t", order_id: "o4", expires_at: future }],
  });
  fake.files.push(...["o1", "o2", "o3", "o5"].map(photo), ...["o1", "o2", "o4", "o6"].map((id) => video(id)));
  setStorageDriverForTest(fake.driver);
});
afterEach(() => setStorageDriverForTest(null));

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
    const res = await req(SECRET);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ photos: 1, abandoned: 1, results: 1, leftovers: 0, overdue: 0, backup: true, errors: 0 });

    expect(fake.removed.sort()).toEqual([photo("o1"), photo("o3"), video("o4")].sort());
    const byId = Object.fromEntries(fake.tables.orders.map((o) => [o.id, o]));
    expect(byId.o3.status).toBe("canceled");
    expect(byId.o3.contact_phone).toBeNull();
    expect(byId.o3.nickname).toBe("-");
    expect(byId.o6.result_path).toBe(video("o6"));
    expect(byId.o4.result_path).toBeNull();
    expect(byId.o4.contact_phone).toBeNull();
    expect(byId.o5.photos_deleted_at).toBeNull();
    expect(fake.files).toContain(photo("o5"));
    expect(fake.files).toContain(photo("o2"));
    expect(fake.tables.share_links).toHaveLength(0);
  });

  it("파일 삭제가 실패해도 다음 실행의 남은 파일 정리가 지운다", async () => {
    const realRemove = fake.driver.remove;
    fake.driver.remove = async () => {
      throw new Error("storage down");
    };
    const first = await (await req(SECRET)).json();
    expect(first.errors).toBeGreaterThan(0);
    expect(fake.files).toContain(photo("o1"));

    // 실제 DB에서는 갱신 트리거가 updated_at을 바꾼다
    fake.driver.remove = realRemove;
    for (const o of fake.tables.orders) o.updated_at = new Date().toISOString();
    const second = await (await req(SECRET)).json();
    expect(second.leftovers).toBeGreaterThan(0);
    expect(fake.files).not.toContain(photo("o1"));
    expect(fake.files).not.toContain(photo("o3"));
    expect(fake.files).not.toContain(video("o4"));
    // 진행 중이거나 보관 기간인 주문의 파일은 그대로
    expect(fake.files).toContain(photo("o5"));
    expect(fake.files).toContain(photo("o2"));
    expect(fake.files).toContain(video("o6"));
    expect(fake.files).toContain(video("o2"));
  });

  it("수정본 납품 때 못 지운 예전 영상은 정리하고 현재 영상은 남긴다", async () => {
    fake.tables.orders.push({ id: "o7", user_id: U, status: "delivered", photos_purge_after: future, photos_deleted_at: null, result_purge_after: future, result_deleted_at: null, result_path: video("o7", "new"), created_at: past, updated_at: new Date().toISOString() });
    fake.files.push(video("o7", "old"), video("o7", "new"));
    await req(SECRET);
    expect(fake.files).toContain(video("o7", "new"));
    expect(fake.files).not.toContain(video("o7", "old"));
  });

  it("DB를 날짜별 파일로 백업한다", async () => {
    await req(SECRET);
    const [path] = Object.keys(fake.written);
    expect(path).toMatch(/^backups\/db-\d{4}-\d{2}-\d{2}\.json$/);
    const backup = JSON.parse(fake.written[path]);
    expect(backup.orders).toHaveLength(6);
    expect(backup.profiles).toHaveLength(1);
    expect(backup.share_links).toBeUndefined(); // 공유 토큰은 백업하지 않는다
  });
});
