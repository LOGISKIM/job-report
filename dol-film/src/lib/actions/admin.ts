"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, requireAdmin } from "@/lib/admin-auth";
import { getTemplate } from "@/lib/catalog";
import { addDays } from "@/lib/dates";
import { notify } from "@/lib/notify";
import { ERASED_FIELDS } from "@/lib/retention";
import { removeOrderPhotos, removeResult } from "@/lib/storage";
import { tossCancel } from "@/lib/toss";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const orderId = z.uuid();
const MOVABLE: readonly string[] = ["paid", "in_production", "review"];

export async function setStatus(id: string, status: string): Promise<Result> {
  const { user, admin } = await requireAdmin();
  const parsed = z.object({ id: orderId, status: z.enum(["paid", "in_production", "review"]) }).safeParse({ id, status });
  if (!parsed.success) return { ok: false, error: "잘못된 요청이에요" };
  const { error } = await admin
    .from("orders")
    .update({ status: parsed.data.status })
    .eq("id", id)
    .in("status", [...MOVABLE]);
  if (error) return { ok: false, error: error.message };
  await audit(user.id, id, `status:${status}`);
  revalidatePath(`/admin/orders/${id}`);
  return { ok: true };
}

// 완성 영상 업로드용 1회용 URL. 영상은 관리자 브라우저에서 저장소로 바로 올라간다.
export async function createResultUpload(id: string): Promise<Result<{ path: string; token: string }>> {
  const { admin } = await requireAdmin();
  if (!orderId.safeParse(id).success) return { ok: false, error: "잘못된 요청이에요" };
  const path = `${id}/${randomUUID()}.mp4`;
  const { data, error } = await admin.storage.from("results").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: error?.message ?? "업로드를 준비하지 못했어요" };
  return { ok: true, path: data.path, token: data.token };
}

export async function markDelivered(id: string, path: string): Promise<Result> {
  const { user, admin } = await requireAdmin();
  if (!orderId.safeParse(id).success || !path.startsWith(`${id}/`) || !path.endsWith(".mp4")) {
    return { ok: false, error: "잘못된 요청이에요" };
  }
  const { data: order } = await admin.from("orders").select("*").eq("id", id).single();
  if (!order || !MOVABLE.includes(order.status)) {
    return { ok: false, error: "납품할 수 없는 상태예요" };
  }

  const now = new Date();
  const { data: updated, error } = await admin
    .from("orders")
    .update({
      status: "delivered",
      result_path: path,
      delivered_at: now.toISOString(),
      // 수정본 납품이어도 보관 기간과 삭제 표시를 새로 잡아야 자동 삭제가 다시 동작한다.
      photos_purge_after: addDays(now, 7).toISOString(),
      result_purge_after: addDays(now, 30).toISOString(),
      result_deleted_at: null,
    })
    .eq("id", id)
    .in("status", [...MOVABLE])
    .select("id");
  if (error || !updated?.length) return { ok: false, error: error?.message ?? "납품할 수 없는 상태예요" };

  // 수정본이면 예전 영상은 DB 갱신이 끝난 뒤에 지운다.
  if (order.result_path && order.result_path !== path) {
    await admin.storage.from("results").remove([order.result_path]);
  }

  await audit(user.id, id, "delivered");
  await notify("delivered", order.contact_phone, {
    "#{애칭}": order.nickname,
    "#{스타일}": getTemplate(order.template_id)?.name ?? "",
  });
  revalidatePath(`/admin/orders/${id}`);
  return { ok: true };
}

// 결제된 주문을 취소하고 전액 환불한다. 사진, 영상, 개인정보를 모두 지운다.
export async function cancelOrder(id: string, reason: string): Promise<Result> {
  const { user, admin } = await requireAdmin();
  const parsed = z.object({ id: orderId, reason: z.string().trim().min(2).max(100) }).safeParse({ id, reason });
  if (!parsed.success) return { ok: false, error: "취소 사유를 적어 주세요" };
  const { data: order } = await admin.from("orders").select("*").eq("id", id).single();
  if (!order || !MOVABLE.includes(order.status)) return { ok: false, error: "취소할 수 없는 상태예요" };

  if (order.payment_key) {
    const refund = await tossCancel(order.payment_key, parsed.data.reason).catch(() => ({ ok: false, body: null }));
    if (!refund.ok) return { ok: false, error: `환불 실패: ${refund.body?.message ?? "토스페이먼츠 응답 오류"}` };
  }

  const now = new Date().toISOString();
  await admin
    .from("orders")
    .update({ status: "canceled", photos_deleted_at: now, result_deleted_at: now, result_path: null, ...ERASED_FIELDS })
    .eq("id", id);
  await removeOrderPhotos(admin, order.user_id, id).catch((e) => console.error("취소 주문 사진 삭제 실패", id, e));
  await removeResult(admin, order.result_path).catch((e) => console.error("취소 주문 영상 삭제 실패", id, e));
  await audit(user.id, id, `canceled:${parsed.data.reason}`);
  revalidatePath(`/admin/orders/${id}`);
  return { ok: true };
}
