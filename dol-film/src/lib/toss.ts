import "server-only";

// 토스페이먼츠 서버 API. 시크릿 키는 서버에서만 쓴다.
function authHeader() {
  const secret = process.env.TOSS_SECRET_KEY;
  if (!secret) throw new Error("환경변수 TOSS_SECRET_KEY가 설정되지 않았어요.");
  return "Basic " + Buffer.from(secret + ":").toString("base64");
}

export async function tossConfirm(paymentKey: string, orderId: string, amount: number) {
  const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      // 같은 결제(paymentKey)가 두 번 승인되지 않게 한다. 주문 ID로 잡으면 실패 후 재결제까지 막힌다.
      "Idempotency-Key": `confirm-${paymentKey}`,
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, body };
}

export async function tossCancel(paymentKey: string, reason: string) {
  const res = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}/cancel`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      "Idempotency-Key": `cancel-${paymentKey}`,
    },
    body: JSON.stringify({ cancelReason: reason }),
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, body };
}
