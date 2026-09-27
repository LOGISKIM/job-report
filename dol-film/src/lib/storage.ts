import "server-only";
import { Storage } from "@google-cloud/storage";

// 파일 저장소: Google Cloud Storage 비공개 버킷 하나에 폴더(접두사)로 나눠 보관한다.
//   photos/{userId}/{orderId}/{uuid}.jpg   고객이 올린 사진
//   results/{orderId}/{uuid}.mp4           완성 영상
//   backups/db-YYYY-MM-DD.json             DB 매일 백업
// 버킷은 공개 접근 차단이 켜져 있고, 파일은 서버가 만든 만료 링크로만 올리고 읽는다.

export type Area = "photos" | "results";

const LIMITS: Record<Area, { contentType: string; maxBytes: number }> = {
  photos: { contentType: "image/jpeg", maxBytes: 10 * 1024 * 1024 },
  results: { contentType: "video/mp4", maxBytes: 1024 * 1024 * 1024 },
};

export type UploadPolicy = { url: string; fields: Record<string, string> };

// 저장소 동작만 모아 둔 인터페이스. 테스트에서는 메모리 구현으로 바꿔 끼운다.
export interface StorageDriver {
  list(prefix: string): Promise<string[]>;
  remove(paths: string[]): Promise<void>;
  signedReadUrl(path: string, ttlSeconds: number, downloadName?: string): Promise<string>;
  uploadPolicy(path: string, contentType: string, maxBytes: number, ttlSeconds: number): Promise<UploadPolicy>;
  write(path: string, body: string, contentType: string): Promise<void>;
}

function gcsDriver(): StorageDriver {
  const bucketName = process.env.GCS_BUCKET;
  const key = process.env.GCP_SERVICE_ACCOUNT_KEY;
  if (!bucketName || !key) throw new Error("환경변수 GCS_BUCKET, GCP_SERVICE_ACCOUNT_KEY가 설정되지 않았어요.");
  const credentials = JSON.parse(Buffer.from(key, "base64").toString("utf8"));
  const bucket = new Storage({ credentials, projectId: credentials.project_id }).bucket(bucketName);
  const expiry = (ttl: number) => Date.now() + ttl * 1000;

  return {
    async list(prefix) {
      const [files] = await bucket.getFiles({ prefix: prefix.endsWith("/") ? prefix : prefix + "/", maxResults: 500 });
      return files.map((f) => f.name);
    },
    async remove(paths) {
      await Promise.all(paths.map((p) => bucket.file(p).delete({ ignoreNotFound: true })));
    },
    async signedReadUrl(path, ttl, downloadName) {
      const [url] = await bucket.file(path).getSignedUrl({
        version: "v4",
        action: "read",
        expires: expiry(ttl),
        ...(downloadName ? { responseDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}` } : {}),
      });
      return url;
    },
    async uploadPolicy(path, contentType, maxBytes, ttl) {
      // POST 정책: 정해진 경로, 파일 형식, 최대 크기를 벗어나면 Google이 업로드를 거부한다.
      const [policy] = await bucket.file(path).generateSignedPostPolicyV4({
        expires: expiry(ttl),
        fields: { "Content-Type": contentType },
        conditions: [["content-length-range", 1, maxBytes], ["eq", "$Content-Type", contentType]],
      });
      return { url: policy.url, fields: policy.fields };
    },
    async write(path, body, contentType) {
      await bucket.file(path).save(body, { contentType, resumable: false });
    },
  };
}

let driver: StorageDriver | null = null;
function store() {
  return (driver ??= gcsDriver());
}
export function setStorageDriverForTest(d: StorageDriver | null) {
  driver = d;
}

export const photoFolder = (userId: string, orderId: string) => `photos/${userId}/${orderId}`;
export const resultFolder = (orderId: string) => `results/${orderId}`;

export async function listOrderPhotos(userId: string, orderId: string) {
  return (await store().list(photoFolder(userId, orderId))).filter((p) => p.endsWith(".jpg"));
}

export async function removeOrderPhotos(userId: string, orderId: string) {
  const paths = await listOrderPhotos(userId, orderId);
  if (paths.length) await store().remove(paths);
  return paths.length;
}

// 폴더 안의 파일을 지운다. keep에 적은 파일은 남긴다. 지운 개수를 돌려준다.
export async function removeFolder(folder: string, keep?: string | null) {
  const paths = (await store().list(folder)).filter((p) => p !== keep);
  if (paths.length) await store().remove(paths);
  return paths.length;
}

export async function removeFile(path: string | null) {
  if (path) await store().remove([path]);
}

export function signedReadUrl(path: string, ttlSeconds: number, downloadName?: string) {
  return store().signedReadUrl(path, ttlSeconds, downloadName);
}

export function uploadPolicy(area: Area, path: string, ttlSeconds = 15 * 60) {
  const { contentType, maxBytes } = LIMITS[area];
  return store().uploadPolicy(path, contentType, maxBytes, ttlSeconds);
}

export function writeFile(path: string, body: string, contentType: string) {
  return store().write(path, body, contentType);
}
