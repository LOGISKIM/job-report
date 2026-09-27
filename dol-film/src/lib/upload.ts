import type { UploadPolicy } from "@/lib/storage";

// 브라우저에서 서버가 발급한 업로드 정책으로 Google Cloud Storage에 파일을 직접 올린다.
export async function uploadWithPolicy(policy: UploadPolicy, file: Blob) {
  const form = new FormData();
  for (const [k, v] of Object.entries(policy.fields)) form.append(k, v);
  form.append("file", file); // file 필드는 반드시 마지막
  const res = await fetch(policy.url, { method: "POST", body: form });
  if (!res.ok) throw new Error(`업로드 실패 (${res.status})`);
}
