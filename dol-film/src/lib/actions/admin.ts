"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, requireAdmin } from "@/lib/admin-auth";
import { getTemplate } from "@/lib/catalog";
import { addDays } from "@/lib/dates";
import { notify } from "@/lib/notify";
import { ERASED_FIELDS } from "@/lib/retention";
import { photoFolder, removeFolder } from "@/lib/storage";
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
  // 납품 전 주문에만 올린다. (납품 완료 주문의 폴더는 자동 정리가 현재 영상만 남기고 비우기 때문)
  const { data: order } = await admin.from("orders").select("status").eq("id", id).single();
  if (!order || !MOVABLE.includes(order.status)) return { ok: false, error: "납품할 수 없는 상태예요" };
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
  // 실패해도 매일 자동 삭제의 "남은 파일 정리" 단계가 다시 지운다.
  if (order.result_path && order.result_path !== path) {
    const { error: removeError } = await admin.storage.from("results").remove([order.result_path]);
    if (removeError) console.error("예전 영상 삭제 실패", id, removeError.message);
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
// 순서: 주문을 먼저 "canceled"로 잠근다(동시에 납품되는 것을 막음) → 환불 → 실패하면 원래 상태로 되돌림 → 성공하면 개인정보와 파일 삭제.
// 파일 삭제가 실패해도 매일 자동 삭제의 "남은 파일 정리" 단계가 다시 지운다.
export async function cancelOrder(id: string, reason: string): Promise<Result> {
  const { user, admin } = await requireAdmin();
  const parsed = z.object({ id: orderId, reason: z.string().trim().min(2).max(100) }).safeParse({ id, reason });
  if (!parsed.success) return { ok: false, error: "취소 사유를 적어 주세요" };
  const { data: order } = await admin.from("orders").select("*").eq("id", id).single();
  if (!order || !MOVABLE.includes(order.status)) return { ok: false, error: "취소할 수 없는 상태예요" };
  if (!order.payment_key) {
    return { ok: false, error: "결제 키가 없어 자동 환불할 수 없어요. 토스페이먼츠 관리자 화면에서 결제 내역을 먼저 확인해 주세요" };
  }

  const { data: claimed, error: claimError } = await admin
    .from("orders")
    .update({ status: "canceled" })
    .eq("id", id)
    .eq("status", order.status)
    .select("id");
  if (claimError || !claimed?.length) return { ok: false, error: "그 사이 주문 상태가 바뀌었어요. 새로고침해 주세요" };

  const refund = await tossCancel(order.payment_key, parsed.data.reason).catch(() => ({ ok: false, body: null }));
  if (!refund.ok) {
    await admin.from("orders").update({ status: order.status }).eq("id", id).eq("status", "canceled");
    return { ok: false, error: `환불 실패: ${refund.body?.message ?? "토스페이먼츠 응답 오류"}` };
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("orders")
    .update({ photos_deleted_at: now, result_deleted_at: now, result_path: null, ...ERASED_FIELDS })
    .eq("id", id);
  if (error) console.error("취소 주문 개인정보 삭제 실패", id, error.message);
  await removeFolder(admin, "photos", photoFolder(order.user_id, id)).catch((e) => console.error("취소 주문 사진 삭제 실패", id, e));
  await removeFolder(admin, "results", id).catch((e) => console.error("취소 주문 영상 삭제 실패", id, e));
  await audit(user.id, id, `canceled:${parsed.data.reason}`);
  revalidatePath(`/admin/orders/${id}`);
  return { ok: true };
}
