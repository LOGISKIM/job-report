import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

// RLS를 우회하는 비밀 키 클라이언트. 서버 코드에서만, 권한 확인을 끝낸 뒤에만 쓴다.
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("환경변수 SUPABASE_SECRET_KEY가 설정되지 않았어요.");
  return createClient(publicEnv.supabaseUrl(), secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
