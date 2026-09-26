"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, requireAdmin } from "@/lib/admin-auth";
import { getTemplate } from "@/lib/catalog";
import { addDays } from "@/lib/dates";
import { notify } from "@/lib/notify";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const orderId = z.uuid();
const MOVABLE = ["paid", "in_production", "review"] as const;

export async function setStatus(id: string, status: string): Promise<Result> {
  const { user, admin } = await requireAdmin();
  const parsed = z.object({ id: orderId, status: z.enum(MOVABLE) }).safeParse({ id, status });
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
  if (!order || !["paid", "in_production", "review"].includes(order.status)) {
    return { ok: false, error: "납품할 수 없는 상태예요" };
  }

  // 수정본이면 예전 영상은 지운다.
  if (order.result_path && order.result_path !== path) {
    await admin.storage.from("results").remove([order.result_path]);
  }
  const now = new Date();
  const { error } = await admin
    .from("orders")
    .update({
      status: "delivered",
      result_path: path,
      delivered_at: now.toISOString(),
      photos_purge_after: addDays(now, 7).toISOString(),
      result_purge_after: addDays(now, 30).toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await audit(user.id, id, "delivered");
  await notify("delivered", order.contact_phone, {
    "#{애칭}": order.nickname,
    "#{스타일}": getTemplate(order.template_id)?.name ?? "",
  });
  revalidatePath(`/admin/orders/${id}`);
  return { ok: true };
}
