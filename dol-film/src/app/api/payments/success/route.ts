import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getTemplate } from "@/lib/catalog";
import { notify } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";

// 토스페이먼츠 결제창이 성공하면 이 주소로 돌아온다.
// 브라우저가 보낸 금액은 믿지 않고, DB에 저장된 주문 금액과 비교한 뒤 서버에서 결제를 승인한다.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const orderId = q.get("orderId") ?? "";
  const paymentKey = q.get("paymentKey") ?? "";
  const amount = Number(q.get("amount"));
  const fail = (message: string) =>
    NextResponse.redirect(new URL(`/pay/fail?message=${encodeURIComponent(message)}`, request.url));

  if (!z.uuid().safeParse(orderId).success || !paymentKey || paymentKey.length > 200) {
    return fail("결제 정보가 올바르지 않아요");
  }

  const user = await getUser();
  if (!user) return fail("로그인이 필요해요");

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("*").eq("id", orderId).eq("user_id", user.id).single();
  if (!order) return fail("주문을 찾을 수 없어요");

  const done = NextResponse.redirect(new URL(`/orders/${orderId}?paid=1`, request.url));
  if (order.status !== "pending_payment") {
    // 새로고침 등으로 다시 들어온 경우
    return order.payment_key === paymentKey ? done : fail("이미 처리된 주문이에요");
  }
  if (amount !== order.amount) return fail("결제 금액이 주문 금액과 달라요");
  if (order.photo_count < 5) return fail("사진 업로드가 끝나지 않았어요");

  const secret = process.env.TOSS_SECRET_KEY;
  if (!secret) return fail("결제 설정이 끝나지 않았어요");

  const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(secret + ":").toString("base64"),
      "Content-Type": "application/json",
      "Idempotency-Key": `confirm-${orderId}`,
    },
    body: JSON.stringify({ paymentKey, orderId, amount: order.amount }),
  });
  const payment = await res.json().catch(() => null);
  if (!res.ok || payment?.status !== "DONE" || payment?.totalAmount !== order.amount) {
    return fail(payment?.message ?? "결제 승인에 실패했어요");
  }

  const { error } = await admin
    .from("orders")
    .update({ status: "paid", payment_key: paymentKey, paid_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "pending_payment");
  if (error) {
    // 결제는 됐는데 기록이 실패한 경우. 관리자가 토스페이먼츠 관리자 화면에서 확인해야 한다.
    console.error("결제 후 주문 갱신 실패", orderId, error.message);
    return fail("결제는 완료됐지만 주문 기록에 실패했어요. 고객센터로 알려 주세요");
  }

  await notify("paid", order.contact_phone, {
    "#{애칭}": order.nickname,
    "#{스타일}": getTemplate(order.template_id)?.name ?? "",
  });
  return done;
}
