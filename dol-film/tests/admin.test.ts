import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./fake-supabase";

const ID = "3f2b8c1e-5d4a-4b6c-9e8f-1a2b3c4d5e6f";
const U = "0c9d8e7f-6a5b-4c3d-8e2f-1a0b9c8d7e6f";
let fake: ReturnType<typeof fakeSupabase>;

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: async () => ({ user: { id: "admin" }, admin: fake.client }),
  audit: vi.fn(async () => {}),
}));
vi.mock("@/lib/notify", () => ({ notify: vi.fn(async () => {}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { cancelOrder, markDelivered, createResultUpload } = await import("@/lib/actions/admin");

function setup(extra: Record<string, unknown> = {}) {
  fake = fakeSupabase({
    orders: [{ id: ID, user_id: U, status: "in_production", payment_key: "pk_1", nickname: "서아", caption: "축하해", contact_phone: "01012345678", result_path: null, template_id: "fairy", ...extra }],
  });
  fake.storageFiles.photos = [`${U}/${ID}/a.jpg`, `${U}/${ID}/b.jpg`];
  fake.storageFiles.results = [];
}

const toss = (ok: boolean) => {
  const f = vi.fn(async () => new Response(JSON.stringify(ok ? { status: "CANCELED" } : { message: "이미 취소된 결제" }), { status: ok ? 200 : 400 }));
  vi.stubGlobal("fetch", f);
  return f;
};

beforeEach(() => {
  process.env.TOSS_SECRET_KEY = "test_gsk_x";
  vi.unstubAllGlobals();
  setup();
});

describe("관리자 취소·환불", () => {
  it("환불에 성공하면 취소 처리하고 사진과 개인정보를 지운다", async () => {
    const f = toss(true);
    const res = await cancelOrder(ID, "고객 요청");
    expect(res.ok).toBe(true);
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain("/v1/payments/pk_1/cancel");
    const o = fake.tables.orders[0];
    expect(o.status).toBe("canceled");
    expect(o.nickname).toBe("-");
    expect(o.contact_phone).toBeNull();
    expect(o.photos_deleted_at).toBeTruthy();
    expect(fake.storageFiles.photos).toHaveLength(0);
  });

  it("환불이 실패하면 원래 상태로 되돌리고 아무것도 지우지 않는다", async () => {
    toss(false);
    const res = await cancelOrder(ID, "고객 요청");
    expect(res.ok).toBe(false);
    const o = fake.tables.orders[0];
    expect(o.status).toBe("in_production");
    expect(o.nickname).toBe("서아");
    expect(fake.storageFiles.photos).toHaveLength(2);
  });

  it("결제 키가 없으면 환불 없이 취소하지 않는다", async () => {
    setup({ payment_key: null });
    const f = toss(true);
    const res = await cancelOrder(ID, "고객 요청");
    expect(res.ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
    expect(fake.tables.orders[0].status).toBe("in_production");
  });

  it("이미 납품된 주문은 여기서 취소할 수 없다", async () => {
    setup({ status: "delivered" });
    const f = toss(true);
    expect((await cancelOrder(ID, "고객 요청")).ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it("취소된 주문에는 납품도, 영상 업로드도 할 수 없다", async () => {
    toss(true);
    await cancelOrder(ID, "고객 요청");
    expect((await markDelivered(ID, `${ID}/x.mp4`)).ok).toBe(false);
    expect((await createResultUpload(ID)).ok).toBe(false);
  });
});

describe("납품", () => {
  it("납품하면 보관 기간을 잡고 삭제 표시를 초기화한다", async () => {
    setup({ result_deleted_at: "2026-01-01T00:00:00.000Z" });
    const res = await markDelivered(ID, `${ID}/new.mp4`);
    expect(res.ok).toBe(true);
    const o = fake.tables.orders[0];
    expect(o.status).toBe("delivered");
    expect(o.result_deleted_at).toBeNull();
    expect(o.photos_purge_after).toBeTruthy();
    expect(o.result_purge_after).toBeTruthy();
  });

  it("다른 주문 폴더의 영상 경로는 거부한다", async () => {
    expect((await markDelivered(ID, "other-order/x.mp4")).ok).toBe(false);
  });
});
