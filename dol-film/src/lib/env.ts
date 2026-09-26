function required(name: string, value: string | undefined) {
  if (!value) throw new Error(`환경변수 ${name}가 설정되지 않았어요. .env.example을 참고하세요.`);
  return value;
}

// NEXT_PUBLIC_ 값은 빌드 때 문자열로 치환되므로 process.env.X 형태로 직접 읽어야 한다.
export const publicEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseKey: () =>
    required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  tossClientKey: () => required("NEXT_PUBLIC_TOSS_CLIENT_KEY", process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY),
};
