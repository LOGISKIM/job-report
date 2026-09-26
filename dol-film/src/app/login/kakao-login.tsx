"use client";

import { useState } from "react";
import { CTA } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export function KakaoLogin({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  const login = async () => {
    setBusy(true);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "kakao", options: { redirectTo } });
    if (error) setBusy(false);
  };
  return (
    <CTA>
      <button className="btn kakao" onClick={login} disabled={busy}>
        {busy ? "카카오로 이동 중…" : "카카오로 시작하기"}
      </button>
    </CTA>
  );
}
