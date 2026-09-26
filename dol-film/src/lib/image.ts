// 브라우저에서 사진을 다시 그려서 JPEG로 저장한다.
// 캔버스로 다시 저장하면 EXIF(촬영 위치 GPS, 기기 정보)가 모두 빠지고, 사진이 아닌 파일은 여기서 걸러진다.
const MAX_SIDE = 2048;
const MAX_INPUT_BYTES = 30 * 1024 * 1024;

export async function sanitizePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("사진 파일만 올릴 수 있어요");
  if (file.size > MAX_INPUT_BYTES) throw new Error("30MB보다 큰 사진은 올릴 수 없어요");

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("사진을 처리하지 못했어요");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("사진을 처리하지 못했어요"))), "image/jpeg", 0.9),
  );
}
