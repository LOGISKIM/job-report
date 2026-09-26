import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { removeOrderPhotos, removeResult } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

// 매일 한 번 Vercel Cron이 호출한다. 보관 기간이 지난 사진과 영상을 지운다.
function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return new NextResponse("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const report = { photos: 0, abandoned: 0, results: 0, errors: 0 };

  // 1) 납품 후 7일 지난 원본 사진
  const { data: photoOrders } = await admin
    .from("orders")
    .select("id, user_id")
    .lt("photos_purge_after", now)
    .is("photos_deleted_at", null)
    .limit(200);
  for (const o of photoOrders ?? []) {
    try {
      await removeOrderPhotos(admin, o.user_id, o.id);
      await admin.from("orders").update({ photos_deleted_at: now, revision_left: 0 }).eq("id", o.id);
      report.photos++;
    } catch (e) {
      report.errors++;
      console.error("사진 삭제 실패", o.id, e);
    }
  }

  // 2) 하루가 지나도록 결제하지 않은 주문: 사진을 지우고 취소 처리
  const { data: abandoned } = await admin
    .from("orders")
    .select("id, user_id")
    .eq("status", "pending_payment")
    .lt("created_at", dayAgo)
    .limit(200);
  for (const o of abandoned ?? []) {
    try {
      await removeOrderPhotos(admin, o.user_id, o.id);
      await admin
        .from("orders")
        .update({ status: "canceled", photos_deleted_at: now, contact_phone: null })
        .eq("id", o.id);
      report.abandoned++;
    } catch (e) {
      report.errors++;
      console.error("미결제 주문 정리 실패", o.id, e);
    }
  }

  // 3) 납품 후 30일 지난 완성 영상과 연락처
  const { data: resultOrders } = await admin
    .from("orders")
    .select("id, result_path")
    .lt("result_purge_after", now)
    .is("result_deleted_at", null)
    .limit(200);
  for (const o of resultOrders ?? []) {
    try {
      await removeResult(admin, o.result_path);
      await admin
        .from("orders")
        .update({ result_path: null, result_deleted_at: now, contact_phone: null })
        .eq("id", o.id);
      await admin.from("share_links").delete().eq("order_id", o.id);
      report.results++;
    } catch (e) {
      report.errors++;
      console.error("영상 삭제 실패", o.id, e);
    }
  }

  // 4) 만료된 공유 링크 정리
  await admin.from("share_links").delete().lt("expires_at", now);

  return NextResponse.json(report);
}
