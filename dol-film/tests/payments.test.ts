import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./fake-supabase";

const USER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const ORDER = "3f2b8c1e-5d4a-4b6c-9e8f-1a2b3c4d5e6f";

let fake: ReturnType<typeof fakeSupabase>;
let currentUser: { id: string } | null;

vi.mock("@/lib/supabase/server", () => ({ getUser: async () => currentUser }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn(async () => {}) }));

const { GET } = await import("@/app/api/payments/success/route");

function order(extra: Record<string, unknown> = {}) {
  return {
    id: ORDER,
    user_id: USER,
    template_id: "fairy",
    nickname: "서아",
    status: "pending_payment",
    amount: 49000,
    photo_count: 7,
    payment_key: null,
    contact_phone: null,
    ...extra,
  };
}

function call(amount: number | string, paymentKey = "pk_123") {
  const url = `https://dol.test/api/payments/success?orderId=${ORDER}&paymentKey=${paymentKey}&amount=${amount}`;
  return GET(new NextRequest(url));
}

function tossReturns(body: Record<string, unknown>, ok = true) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 400 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  process.env.TOSS_SECRET_KEY = "test_gsk_x";
  currentUser = { id: USER };
  fake = fakeSupabase({ orders: [order()] });
  vi.unstubAllGlobals();
});

describe("결제 승인", () => {
  it("정상 결제는 서버 금액으로 승인하고 주문을 paid로 바꾼다", async () => {
    const fetchMock = tossReturns({ status: "DONE", totalAmount: 49000 });
    const res = await call(49000);
    expect(res.headers.get("location")).toBe(`https://dol.test/orders/${ORDER}?paid=1`);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body).toEqual({ paymentKey: "pk_123", orderId: ORDER, amount: 49000 });
    expect(fake.tables.orders[0].status).toBe("paid");
    expect(fake.tables.orders[0].payment_key).toBe("pk_123");
  });

  it("주소창의 금액을 바꾸면 토스를 부르지 않고 실패시킨다", async () => {
    const fetchMock = tossReturns({ status: "DONE", totalAmount: 100 });
    const res = await call(100);
    expect(res.headers.get("location")).toContain("/pay/fail");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fake.tables.orders[0].status).toBe("pending_payment");
  });

  it("남의 주문은 결제 승인할 수 없다", async () => {
    currentUser = { id: OTHER };
    const fetchMock = tossReturns({ status: "DONE", totalAmount: 49000 });
    const res = await call(49000);
    expect(res.headers.get("location")).toContain("/pay/fail");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("로그인하지 않으면 실패", async () => {
    currentUser = null;
    const res = await call(49000);
    expect(res.headers.get("location")).toContain("/pay/fail");
  });

  it("토스 응답 금액이 다르면 paid로 바꾸지 않는다", async () => {
    tossReturns({ status: "DONE", totalAmount: 1000 });
    const res = await call(49000);
    expect(res.headers.get("location")).toContain("/pay/fail");
    expect(fake.tables.orders[0].status).toBe("pending_payment");
  });

  it("토스가 거절하면 실패 화면으로 보낸다", async () => {
    tossReturns({ code: "REJECT_CARD_COMPANY", message: "카드사에서 거절했어요" }, false);
    const res = await call(49000);
    expect(decodeURIComponent(res.headers.get("location") ?? "")).toContain("카드사에서 거절했어요");
  });

  it("이미 결제된 주문에 같은 키로 다시 오면 승인 없이 주문 화면으로 보낸다", async () => {
    fake = fakeSupabase({ orders: [order({ status: "paid", payment_key: "pk_123" })] });
    const fetchMock = tossReturns({});
    const res = await call(49000);
    expect(res.headers.get("location")).toContain(`/orders/${ORDER}`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("취소된 주문은 결제 승인하지 않는다", async () => {
    fake = fakeSupabase({ orders: [order({ status: "canceled" })] });
    const fetchMock = tossReturns({ status: "DONE", totalAmount: 49000 });
    const res = await call(49000);
    expect(res.headers.get("location")).toContain("/pay/fail");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("사진 업로드가 끝나지 않은 주문은 결제 승인하지 않는다", async () => {
    fake = fakeSupabase({ orders: [order({ photo_count: 2 })] });
    const fetchMock = tossReturns({ status: "DONE", totalAmount: 49000 });
    await call(49000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("주문 ID 형식이 이상하면 바로 실패", async () => {
    const res = await GET(new NextRequest("https://dol.test/api/payments/success?orderId=../../x&paymentKey=a&amount=1"));
    expect(res.headers.get("location")).toContain("/pay/fail");
  });
});
