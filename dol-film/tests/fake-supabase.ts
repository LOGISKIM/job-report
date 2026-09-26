// 테스트용 가짜 Supabase 클라이언트. 테이블별 행을 메모리에 두고, 쓰기 호출을 기록한다.
type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

export function fakeSupabase(tables: Record<string, Row[]>) {
  const writes: { table: string; op: string; values?: Row; matched: number }[] = [];

  function builder(table: string) {
    const filters: Filter[] = [];
    let op: "select" | "update" | "insert" | "delete" = "select";
    let values: Row | undefined;
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
      return { data: op === "select" ? matched : null, error: null, count: matched.length };
    };
    const b = {
      select: () => b,
      update: (v: Row) => ((op = "update"), (values = v), b),
      insert: (v: Row) => ((op = "insert"), (values = v), b),
      delete: () => ((op = "delete"), b),
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), b),
      neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), b),
      in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), b),
      is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), b),
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

  const removed: string[] = [];
  const storageFiles: Record<string, string[]> = {};
  const storage = {
    from: (bucket: string) => ({
      list: async (folder: string) => ({
        data: (storageFiles[bucket] ?? [])
          .filter((p) => p.startsWith(folder + "/"))
          .map((p) => ({ name: p.slice(folder.length + 1) })),
        error: null,
      }),
      remove: async (paths: string[]) => {
        removed.push(...paths.map((p) => `${bucket}:${p}`));
        storageFiles[bucket] = (storageFiles[bucket] ?? []).filter((p) => !paths.includes(p));
        return { data: null, error: null };
      },
      createSignedUploadUrl: async (path: string) => ({ data: { path, token: "tok-" + path }, error: null }),
    }),
  };

  return { client: { from: builder, storage }, tables, writes, removed, storageFiles };
}
