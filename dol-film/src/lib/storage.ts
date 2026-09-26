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
