import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const photoFolder = (userId: string, orderId: string) => `${userId}/${orderId}`;

export async function listOrderPhotos(admin: SupabaseClient, userId: string, orderId: string) {
  const folder = photoFolder(userId, orderId);
  const { data, error } = await admin.storage.from("photos").list(folder, { limit: 100 });
  if (error) throw error;
  return (data ?? []).filter((f) => f.name.endsWith(".jpg")).map((f) => `${folder}/${f.name}`);
}

export async function removeOrderPhotos(admin: SupabaseClient, userId: string, orderId: string) {
  const paths = await listOrderPhotos(admin, userId, orderId);
  if (paths.length) {
    const { error } = await admin.storage.from("photos").remove(paths);
    if (error) throw error;
  }
  return paths.length;
}

export async function removeResult(admin: SupabaseClient, path: string | null) {
  if (!path) return;
  const { error } = await admin.storage.from("results").remove([path]);
  if (error) throw error;
}

// 폴더 안의 파일을 지운다. keep에 적은 파일은 남긴다. 지운 개수를 돌려준다.
export async function removeFolder(admin: SupabaseClient, bucket: "photos" | "results", folder: string, keep?: string | null) {
  const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 100 });
  if (error) throw error;
  const paths = (data ?? []).map((f) => `${folder}/${f.name}`).filter((p) => p !== keep);
  if (paths.length) {
    const { error: removeError } = await admin.storage.from(bucket).remove(paths);
    if (removeError) throw removeError;
  }
  return paths.length;
}
