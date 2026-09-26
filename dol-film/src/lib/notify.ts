import "server-only";
import { createHmac, randomBytes } from "node:crypto";

// 카카오 알림톡 발송 (솔라피). 환경변수가 없으면 보내지 않고 넘어간다.
// 알림톡 템플릿은 카카오 비즈니스 채널에서 먼저 승인받아야 한다.
export type NotifyKind = "paid" | "delivered";

const TEMPLATE_ENV: Record<NotifyKind, string> = {
  paid: "SOLAPI_TEMPLATE_PAID",
  delivered: "SOLAPI_TEMPLATE_DELIVERED",
};

export async function notify(kind: NotifyKind, to: string | null, variables: Record<string, string>) {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const pfId = process.env.SOLAPI_PF_ID;
  const from = process.env.SOLAPI_SENDER;
  const templateId = process.env[TEMPLATE_ENV[kind]];
  if (!to || !apiKey || !apiSecret || !pfId || !from || !templateId) return;

  const date = new Date().toISOString();
  const salt = randomBytes(16).toString("hex");
  const signature = createHmac("sha256", apiSecret).update(date + salt).digest("hex");

  try {
    const res = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
      },
      body: JSON.stringify({ message: { to, from, kakaoOptions: { pfId, templateId, variables } } }),
    });
    if (!res.ok) console.error("알림톡 발송 실패", res.status);
  } catch (e) {
    // 알림 실패가 주문 처리를 막으면 안 된다.
    console.error("알림톡 발송 오류", e);
  }
}
