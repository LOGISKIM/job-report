"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CUSTOM, MOODS, MUSIC, PHOTO_MAX, PHOTO_MIN, getTemplate } from "@/lib/catalog";
import { CONSENTS, CONSENT_VERSION } from "@/lib/consents";
import { addDays } from "@/lib/dates";
import { ERASED_FIELDS } from "@/lib/retention";
import { listOrderPhotos, photoFolder, removeOrderPhotos } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const orderInput = z.object({
  templateId: z.string(),
  moods: z.array(z.enum(MOODS as [string, ...string[]])).max(MOODS.length).default([]),
  customRequest: z.string().trim().max(300).optional(),
  nickname: z.string().trim().min(1).max(10),
  caption: z.string().trim().min(1).max(24),
  music: z.number().int().min(0).max(MUSIC.length - 1),
  phone: z
    .string()
    .transform((s) => s.replace(/\D/g, ""))
    .pipe(z.string().regex(/^01[0-9]{8,9}$/)),
  consents: z.record(z.string(), z.boolean()),
});

export type OrderInput = z.input<typeof orderInput>;

// 로그인한 사용자의 주문만 찾는다. 주문 ID는 브라우저에서 오므로 소유자를 반드시 같이 확인한다.
async function ownOrder(orderId: string) {
  const user = await getUser();
  if (!user) return null;
  if (!z.uuid().safeParse(orderId).success) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("orders").select("*").eq("id", orderId).eq("user_id", user.id).single();
  if (!data) return null;
  return { user, admin, order: data };
}

export async function createOrder(raw: OrderInput): Promise<Result<{ orderId: string }>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요" };

  const parsed = orderInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "입력한 내용을 다시 확인해 주세요" };
  const input = parsed.data;

  const template = getTemplate(input.templateId);
  if (!template) return { ok: false, error: "없는 템플릿이에요" };
  const isCustom = template.id === CUSTOM.id;
  if (isCustom && (!input.moods.length || (input.customRequest ?? "").length < 10)) {
    return { ok: false, error: "분위기와 장면 설명을 적어 주세요" };
  }
  if (CONSENTS.some((c) => c.required && input.consents[c.id] !== true)) {
    return { ok: false, error: "필수 항목에 모두 동의해 주세요" };
  }

  const admin = createAdminClient();

  // 결제 대기 주문은 한 사람당 하나만 둔다. 새로 신청하면 이전 결제 대기 주문은 사진과 함께 정리한다.
  // (이전 주문이 동시에 결제되더라도 결제 승인 단계에서 상태가 바뀐 것을 알아채고 자동 취소한다)
  const { data: stale } = await admin
    .from("orders")
    .update({ status: "canceled", photos_deleted_at: new Date().toISOString(), ...ERASED_FIELDS })
    .eq("user_id", user.id)
    .eq("status", "pending_payment")
    .select("id");
  for (const o of stale ?? []) {
    await removeOrderPhotos(admin, user.id, o.id).catch((e) => console.error("이전 주문 사진 삭제 실패", o.id, e));
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("orders")
    .insert({
      user_id: user.id,
      template_id: template.id,
      moods: isCustom ? input.moods : [],
      custom_request: isCustom ? input.customRequest : null,
      nickname: input.nickname,
      caption: input.caption,
      music: input.music,
      contact_phone: input.phone,
      amount: template.price, // 가격은 항상 서버의 카탈로그 기준
      consents: {
        version: CONSENT_VERSION,
        agreed_at: now,
        items: Object.fromEntries(CONSENTS.map((c) => [c.id, input.consents[c.id] === true])),
      },
      sample_consent: input.consents.sample === true,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "주문을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요" };
  return { ok: true, orderId: data.id };
}

// 사진 업로드용 1회용 URL을 발급한다. 경로는 서버가 정하므로 남의 폴더에 올릴 수 없다.
export async function prepareUploads(
  orderId: string,
  count: number,
): Promise<Result<{ uploads: { path: string; token: string }[] }>> {
  const found = await ownOrder(orderId);
  if (!found) return { ok: false, error: "주문을 찾을 수 없어요" };
  if (found.order.status !== "pending_payment") return { ok: false, error: "이미 결제됐거나 취소된 주문이에요" };
  if (!Number.isInteger(count) || count < PHOTO_MIN || count > PHOTO_MAX) {
    return { ok: false, error: `사진은 ${PHOTO_MIN}~${PHOTO_MAX}장 올려 주세요` };
  }

  // 다시 시도하는 경우를 위해 기존 사진을 지우고 새로 받는다.
  await removeOrderPhotos(found.admin, found.user.id, orderId);

  const folder = photoFolder(found.user.id, orderId);
  const uploads: { path: string; token: string }[] = [];
  for (let i = 0; i < count; i++) {
    const path = `${folder}/${randomUUID()}.jpg`;
    const { data, error } = await found.admin.storage.from("photos").createSignedUploadUrl(path);
    if (error || !data) return { ok: false, error: "업로드를 준비하지 못했어요" };
    uploads.push({ path: data.path, token: data.token });
  }
  return { ok: true, uploads };
}

export async function finalizeUploads(orderId: string): Promise<Result> {
  const found = await ownOrder(orderId);
  if (!found) return { ok: false, error: "주문을 찾을 수 없어요" };
  if (found.order.status !== "pending_payment") return { ok: false, error: "이미 결제된 주문이에요" };
  const paths = await listOrderPhotos(found.admin, found.user.id, orderId);
  if (paths.length < PHOTO_MIN || paths.length > PHOTO_MAX) {
    return { ok: false, error: "사진이 제대로 올라가지 않았어요. 다시 시도해 주세요" };
  }
  await found.admin.from("orders").update({ photo_count: paths.length }).eq("id", orderId);
  return { ok: true };
}

export async function requestRevision(orderId: string, text: string): Promise<Result> {
  const found = await ownOrder(orderId);
  if (!found) return { ok: false, error: "주문을 찾을 수 없어요" };
  const body = z.string().trim().min(5).max(500).safeParse(text);
  if (!body.success) return { ok: false, error: "고칠 점을 5자 이상 적어 주세요" };
  const o = found.order;
  if (o.status !== "delivered" || o.revision_left < 1) return { ok: false, error: "수정 요청을 할 수 없는 상태예요" };
  if (o.photos_deleted_at) return { ok: false, error: "원본 사진이 삭제되어 수정할 수 없어요" };

  // 조건부 갱신: 그 사이 자동 삭제가 사진을 지웠다면 한 건도 바뀌지 않는다.
  const { data: updated } = await found.admin
    .from("orders")
    .update({
      status: "in_production",
      revision_left: o.revision_left - 1,
      revision_request: body.data,
      // 다시 납품할 때 보관 기간을 새로 잡는다. 그동안은 자동 삭제 대상에서 빠진다.
      photos_purge_after: null,
      result_purge_after: null,
    })
    .eq("id", orderId)
    .eq("status", "delivered")
    .is("photos_deleted_at", null)
    .select("id");
  if (!updated?.length) return { ok: false, error: "수정 요청을 할 수 없는 상태예요" };
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

export async function deletePhotosNow(orderId: string): Promise<Result> {
  const found = await ownOrder(orderId);
  if (!found) return { ok: false, error: "주문을 찾을 수 없어요" };
  const o = found.order;
  if (o.photos_deleted_at) return { ok: true };
  // 완성된 주문만. 결제 전 주문은 이틀 뒤 자동으로 정리되고, 제작 중에는 사진이 필요하다.
  if (o.status !== "delivered") {
    return { ok: false, error: "완성된 뒤에 지울 수 있어요" };
  }
  await removeOrderPhotos(found.admin, found.user.id, orderId);
  await found.admin
    .from("orders")
    .update({ photos_deleted_at: new Date().toISOString(), revision_left: 0 })
    .eq("id", orderId);
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

export async function createShareLink(orderId: string): Promise<Result<{ token: string; expiresAt: string }>> {
  const found = await ownOrder(orderId);
  if (!found) return { ok: false, error: "주문을 찾을 수 없어요" };
  const o = found.order;
  if (o.status !== "delivered" || !o.result_path) return { ok: false, error: "완성된 영상이 없어요" };

  const week = addDays(new Date(), 7);
  const limit = o.result_purge_after ? new Date(o.result_purge_after) : week;
  const expiresAt = (week < limit ? week : limit).toISOString();
  const token = randomBytes(24).toString("base64url"); // 추측할 수 없는 192비트 토큰

  const { error } = await found.admin.from("share_links").insert({ token, order_id: orderId, expires_at: expiresAt });
  if (error) return { ok: false, error: "링크를 만들지 못했어요" };
  return { ok: true, token, expiresAt };
}

export async function revokeShareLinks(orderId: string): Promise<Result> {
  const found = await ownOrder(orderId);
  if (!found) return { ok: false, error: "주문을 찾을 수 없어요" };
  await found.admin
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("order_id", orderId)
    .is("revoked_at", null);
  return { ok: true };
}
