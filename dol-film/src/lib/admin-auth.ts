import "server-only";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";

// 관리자가 아니면 페이지가 없는 것처럼 404를 돌려준다 (관리자 화면의 존재를 드러내지 않기 위해).
export async function requireAdmin() {
  const user = await getUser();
  if (!user) notFound();
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!data?.is_admin) notFound();
  return { user, admin };
}

export async function audit(adminId: string, orderId: string | null, action: string) {
  const admin = createAdminClient();
  await admin.from("admin_audit").insert({ admin_id: adminId, order_id: orderId, action });
}
