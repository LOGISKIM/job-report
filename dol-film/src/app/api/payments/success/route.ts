import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PHOTO_MIN, getTemplate } from "@/lib/catalog";
import { notify } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { tossCancel, tossConfirm } from "@/lib/toss";

// 토스페이먼츠 결제창이 성공하면 이 주소로 돌아온다.
// 브라우저가 보낸 금액은 믿지 않고, DB에 저장된 주문 금액과 비교한 뒤 서버에서 결제를 승인한다.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const orderId = q.get("orderId") ?? "";
  const paymentKey = q.get("paymentKey") ?? "";
  const amount = Number(q.get("amount"));
  const fail = (message: string, retryable = false) =>
    NextResponse.redirect(
      new URL(
        `/pay/fail?message=${encodeURIComponent(message)}${retryable ? `&orderId=${orderId}` : ""}`,
        request.url,
      ),
    );

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
  if (amount !== order.amount) return fail("결제 금액이 주문 금액과 달라요", true);
  if (order.photo_count < PHOTO_MIN || order.photos_deleted_at) return fail("사진 업로드가 끝나지 않았어요");

  const confirm = await tossConfirm(paymentKey, orderId, order.amount).catch(() => ({ ok: false, body: null }));
  const payment = confirm.body;
  if (!confirm.ok || payment?.status !== "DONE" || payment?.totalAmount !== order.amount) {
    if (confirm.ok && payment?.status === "DONE") await tossCancel(paymentKey, "결제 금액 불일치").catch(() => null);
    return fail(payment?.message ?? "결제 승인에 실패했어요", true);
  }

  // 그 사이 주문이 바뀌었으면(자동 취소 등) 한 건도 갱신되지 않는다. 이 경우 결제를 바로 취소한다.
  const { data: updated, error } = await admin
    .from("orders")
    .update({ status: "paid", payment_key: paymentKey, paid_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "pending_payment")
    .select("id");
  if (error || !updated?.length) {
    console.error("결제 후 주문 갱신 실패 → 결제 취소", orderId, error?.message);
    const cancel = await tossCancel(paymentKey, "주문 처리 실패로 자동 취소").catch(() => ({ ok: false }));
    return fail(
      cancel.ok
        ? "주문을 처리하지 못해 결제를 자동으로 취소했어요. 다시 신청해 주세요"
        : "결제는 됐지만 주문 처리에 실패했어요. 고객센터로 알려 주시면 바로 환불해 드려요",
    );
  }

  await notify("paid", order.contact_phone, {
    "#{애칭}": order.nickname,
    "#{스타일}": getTemplate(order.template_id)?.name ?? "",
  });
  return done;
}
