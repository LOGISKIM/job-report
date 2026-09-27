// 테스트용 가짜 Supabase 클라이언트. 테이블별 행을 메모리에 두고, 쓰기 호출을 기록한다.
type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

export function fakeSupabase(tables: Record<string, Row[]>) {
  const writes: { table: string; op: string; values?: Row; matched: number }[] = [];

  function builder(table: string) {
    const filters: Filter[] = [];
    let op: "select" | "update" | "insert" | "delete" = "select";
    let values: Row | undefined;
    let returning = false;
    const rows = () => (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
    const run = () => {
      const matched = rows();
      if (op === "update") {
        matched.forEach((r) => Object.assign(r, values));
        writes.push({ table, op, values, matched: matched.length });
      } else if (op === "insert") {
        (tables[table] ??= []).push({ ...values });
        writes.push({ table, op, values, matched: 1 });
      } else if (op === "delete") {
        tables[table] = (tables[table] ?? []).filter((r) => !matched.includes(r));
        writes.push({ table, op, matched: matched.length });
      }
      // 실제 Supabase처럼 행의 복사본을 돌려준다
      const data = op === "select" || returning ? matched.map((r) => ({ ...r })) : null;
      return { data, error: null, count: matched.length };
    };
    const b = {
      select: () => {
        if (op !== "select") returning = true;
        return b;
      },
      update: (v: Row) => ((op = "update"), (values = v), b),
      insert: (v: Row) => ((op = "insert"), (values = v), b),
      delete: () => ((op = "delete"), b),
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), b),
      neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), b),
      in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), b),
      is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), b),
      gt: (k: string, v: string) => (filters.push((r) => r[k] != null && String(r[k]) > v), b),
      lt: (k: string, v: string) => (filters.push((r) => r[k] != null && String(r[k]) < v), b),
      order: () => b,
      limit: () => b,
      single: async () => {
        const r = run();
        const first = (r.data as Row[] | null)?.[0] ?? null;
        return { data: first, error: first ? null : { message: "not found" } };
      },
      maybeSingle: async () => ({ data: (run().data as Row[] | null)?.[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(resolve, reject),
    };
    return b;
  }

  // 파일 저장소(Google Cloud Storage) 대역: 전체 경로 목록으로 흉내 낸다.
  const files: string[] = [];
  const removed: string[] = [];
  const written: Record<string, string> = {};
  const driver = {
    list: async (prefix: string) => files.filter((p) => p.startsWith(prefix.endsWith("/") ? prefix : prefix + "/")),
    remove: async (paths: string[]) => {
      removed.push(...paths);
      for (const p of paths) {
        const i = files.indexOf(p);
        if (i >= 0) files.splice(i, 1);
      }
    },
    signedReadUrl: async (path: string, ttl: number) => `https://signed.test/${path}?ttl=${ttl}`,
    uploadPolicy: async (path: string, contentType: string, maxBytes: number) => ({
      url: "https://upload.test",
      fields: { key: path, "Content-Type": contentType, max: String(maxBytes) },
    }),
    write: async (path: string, body: string) => {
      written[path] = body;
    },
  };

  return { client: { from: builder }, driver, tables, writes, files, removed, written };
}
