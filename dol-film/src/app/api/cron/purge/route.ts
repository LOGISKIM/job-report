import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ABANDON_AFTER_MS, DAY_MS, ERASED_FIELDS } from "@/lib/retention";
import { photoFolder, removeFolder, removeOrderPhotos, removeResult } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

// 매일 한 번 Vercel Cron이 호출한다. 보관 기간이 지난 사진과 영상을 지운다.
//
// 각 항목은 "조건부 갱신으로 먼저 찜한 뒤 파일을 지운다". 그 사이 고객이 수정 요청을 하거나
// 결제를 마쳐 상태가 바뀌었다면 갱신이 0건이 되어 건너뛴다.
// 파일 삭제가 실패해도 마지막 "남은 파일 정리" 단계가 최근 7일간 삭제 처리된 주문의 폴더를 매일 다시 훑어 지운다.
function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return new NextResponse("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const abandonCutoff = new Date(nowDate.getTime() - ABANDON_AFTER_MS).toISOString();
  const overdueCutoff = new Date(nowDate.getTime() - 30 * DAY_MS).toISOString();
  const sweepSince = new Date(nowDate.getTime() - 7 * DAY_MS).toISOString();
  const report = { photos: 0, abandoned: 0, results: 0, leftovers: 0, overdue: 0, errors: 0 };

  // 1) 납품 후 7일 지난 원본 사진
  const { data: photoOrders } = await admin
    .from("orders")
    .select("id, user_id")
    .eq("status", "delivered")
    .lt("photos_purge_after", now)
    .is("photos_deleted_at", null)
    .limit(200);
  for (const o of photoOrders ?? []) {
    const { data: claimed, error } = await admin
      .from("orders")
      .update({ photos_deleted_at: now, revision_left: 0 })
      .eq("id", o.id)
      .eq("status", "delivered")
      .lt("photos_purge_after", now)
      .is("photos_deleted_at", null)
      .select("id");
    if (error) { report.errors++; continue; }
    if (!claimed?.length) continue;
    try {
      await removeOrderPhotos(admin, o.user_id, o.id);
      report.photos++;
    } catch (e) {
      report.errors++;
      console.error("사진 삭제 실패 (남은 파일 정리에서 다시 시도)", o.id, e);
    }
  }

  // 2) 이틀이 지나도록 결제하지 않은 주문: 취소하고 사진과 개인정보를 지운다
  const { data: abandoned } = await admin
    .from("orders")
    .select("id, user_id")
    .eq("status", "pending_payment")
    .lt("created_at", abandonCutoff)
    .limit(200);
  for (const o of abandoned ?? []) {
    const { data: claimed, error } = await admin
      .from("orders")
      .update({ status: "canceled", photos_deleted_at: now, ...ERASED_FIELDS })
      .eq("id", o.id)
      .eq("status", "pending_payment")
      .select("id");
    if (error) { report.errors++; continue; }
    if (!claimed?.length) continue;
    try {
      await removeOrderPhotos(admin, o.user_id, o.id);
      report.abandoned++;
    } catch (e) {
      report.errors++;
      console.error("미결제 주문 사진 삭제 실패 (남은 파일 정리에서 다시 시도)", o.id, e);
    }
  }

  // 3) 납품 후 30일 지난 완성 영상과 연락처
  const { data: resultOrders } = await admin
    .from("orders")
    .select("id, result_path")
    .eq("status", "delivered")
    .lt("result_purge_after", now)
    .is("result_deleted_at", null)
    .limit(200);
  for (const o of resultOrders ?? []) {
    const { data: claimed, error } = await admin
      .from("orders")
      .update({ result_path: null, result_deleted_at: now, contact_phone: null })
      .eq("id", o.id)
      .eq("status", "delivered")
      .lt("result_purge_after", now)
      .is("result_deleted_at", null)
      .select("id");
    if (error) { report.errors++; continue; }
    if (!claimed?.length) continue;
    try {
      await removeResult(admin, o.result_path);
      await admin.from("share_links").delete().eq("order_id", o.id);
      report.results++;
    } catch (e) {
      report.errors++;
      console.error("영상 삭제 실패 (남은 파일 정리에서 다시 시도)", o.id, e);
    }
  }

  // 4) 만료된 공유 링크 정리
  await admin.from("share_links").delete().lt("expires_at", now);

  // 5) 남은 파일 정리: 최근 7일 안에 바뀐 주문 중
  //    - 사진 삭제 처리된 주문 → 사진 폴더에 남은 파일 삭제
  //    - 영상 삭제 처리됐거나 취소된 주문 → 영상 폴더 전체 삭제
  //    - 납품 완료 주문 → 현재 영상을 뺀 예전 영상 삭제 (수정본 납품 때 못 지운 것)
  const { data: recent } = await admin
    .from("orders")
    .select("id, user_id, status, photos_deleted_at, result_deleted_at, result_path")
    .gt("updated_at", sweepSince)
    .limit(500);
  for (const o of recent ?? []) {
    try {
      if (o.photos_deleted_at) report.leftovers += await removeFolder(admin, "photos", photoFolder(o.user_id, o.id));
      if (o.result_deleted_at || o.status === "canceled") report.leftovers += await removeFolder(admin, "results", o.id);
      else if (o.status === "delivered" && o.result_path) {
        report.leftovers += await removeFolder(admin, "results", o.id, o.result_path);
      }
    } catch (e) {
      report.errors++;
      console.error("남은 파일 정리 실패", o.id, e);
    }
  }

  // 6) 결제 후 30일이 지나도록 납품하지 않은 주문은 지우지 않고 관리자가 보도록 로그만 남긴다
  const { data: overdue } = await admin
    .from("orders")
    .select("id")
    .in("status", ["paid", "in_production", "review"])
    .lt("paid_at", overdueCutoff)
    .limit(200);
  report.overdue = overdue?.length ?? 0;
  if (report.overdue) console.warn("납품 기한을 크게 넘긴 주문", overdue?.map((o) => o.id));

  return NextResponse.json(report);
}
