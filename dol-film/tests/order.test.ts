import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setStorageDriverForTest } from "@/lib/storage";
import { fakeSupabase } from "./fake-supabase";

const U = "0c9d8e7f-6a5b-4c3d-8e2f-1a0b9c8d7e6f";
const OTHER = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const ID = "3f2b8c1e-5d4a-4b6c-9e8f-1a2b3c4d5e6f";
let fake: ReturnType<typeof fakeSupabase>;
let currentUser: { id: string } | null;

vi.mock("@/lib/supabase/server", () => ({ getUser: async () => currentUser }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const { prepareUploads, finalizeUploads, deletePhotosNow } = await import("@/lib/actions/order");

beforeEach(() => {
  currentUser = { id: U };
  fake = fakeSupabase({ orders: [{ id: ID, user_id: U, status: "pending_payment", photo_count: 0, photos_deleted_at: null }] });
  fake.files.push(`photos/${U}/${ID}/old.jpg`);
  setStorageDriverForTest(fake.driver);
});
afterEach(() => setStorageDriverForTest(null));

describe("사진 업로드 권한", () => {
  it("사진마다 내 주문 폴더, JPEG, 10MB 제한이 걸린 업로드 권한을 준다", async () => {
    const res = await prepareUploads(ID, 7);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.uploads).toHaveLength(7);
    for (const u of res.uploads) {
      expect(u.fields.key).toMatch(new RegExp(`^photos/${U}/${ID}/[0-9a-f-]{36}\\.jpg$`));
      expect(u.fields["Content-Type"]).toBe("image/jpeg");
      expect(Number(u.fields.max)).toBe(10 * 1024 * 1024);
    }
    expect(fake.files).not.toContain(`photos/${U}/${ID}/old.jpg`); // 재시도 전 기존 사진 정리
  });

  it("남의 주문에는 업로드 권한을 주지 않는다", async () => {
    currentUser = { id: OTHER };
    expect((await prepareUploads(ID, 7)).ok).toBe(false);
  });

  it("사진 수가 범위를 벗어나면 거부한다", async () => {
    expect((await prepareUploads(ID, 3)).ok).toBe(false);
    expect((await prepareUploads(ID, 11)).ok).toBe(false);
  });

  it("업로드가 끝나면 실제 올라간 사진 수를 센다", async () => {
    fake.files.length = 0;
    fake.files.push(...Array.from({ length: 6 }, (_, i) => `photos/${U}/${ID}/${i}.jpg`));
    expect((await finalizeUploads(ID)).ok).toBe(true);
    expect(fake.tables.orders[0].photo_count).toBe(6);
  });

  it("결제 전 주문은 사진 즉시 삭제를 할 수 없다", async () => {
    expect((await deletePhotosNow(ID)).ok).toBe(false);
  });
});
