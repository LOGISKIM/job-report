// Google Cloud Storage 버킷 보안 설정을 한 번에 적용한다.
// 사용법: GCS_BUCKET=... GCP_SERVICE_ACCOUNT_KEY=... node scripts/setup-gcs.mjs https://내도메인
import { Storage } from "@google-cloud/storage";

const origin = process.argv[2];
const bucketName = process.env.GCS_BUCKET;
const key = process.env.GCP_SERVICE_ACCOUNT_KEY;
if (!origin || !bucketName || !key) {
  console.error("사용법: GCS_BUCKET=... GCP_SERVICE_ACCOUNT_KEY=... node scripts/setup-gcs.mjs https://내도메인");
  process.exit(1);
}
const credentials = JSON.parse(Buffer.from(key, "base64").toString("utf8"));
const bucket = new Storage({ credentials, projectId: credentials.project_id }).bucket(bucketName);

await bucket.setMetadata({
  // 공개 링크를 실수로라도 만들 수 없게 막는다.
  iamConfiguration: { publicAccessPrevention: "enforced", uniformBucketLevelAccess: { enabled: true } },
  // 브라우저가 우리 사이트에서만 직접 업로드·재생할 수 있게 한다.
  cors: [
    {
      origin: [origin, "http://localhost:3000"],
      method: ["GET", "POST", "HEAD"],
      responseHeader: ["Content-Type", "Range"],
      maxAgeSeconds: 3600,
    },
  ],
  // 자동 삭제 작업이 어떤 이유로 멈춰도 파일이 무기한 남지 않게 하는 안전장치.
  lifecycle: {
    rule: [
      { action: { type: "Delete" }, condition: { age: 45, matchesPrefix: ["photos/"] } },
      { action: { type: "Delete" }, condition: { age: 60, matchesPrefix: ["results/"] } },
      { action: { type: "Delete" }, condition: { age: 14, matchesPrefix: ["backups/"] } },
    ],
  },
});
const [meta] = await bucket.getMetadata();
console.log("완료:", meta.name, "위치", meta.location, "공개 차단", meta.iamConfiguration?.publicAccessPrevention);
if (meta.location !== "ASIA-NORTHEAST3") console.warn("⚠️ 버킷 위치가 서울(asia-northeast3)이 아니에요. 새로 만들 때 서울로 만드세요.");
