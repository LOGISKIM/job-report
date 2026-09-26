// 동의 항목. 문구를 바꾸면 version을 올려서 누가 어떤 버전에 동의했는지 남긴다.
export const CONSENT_VERSION = "2026-09-v1";

export type ConsentId = "privacy" | "child" | "overseas" | "ai" | "sample";

export const CONSENTS: { id: ConsentId; required: boolean; label: string; rows: [string, string][] }[] = [
  {
    id: "privacy",
    required: true,
    label: "개인정보 수집·이용 동의",
    rows: [
      ["항목", "로그인 식별자, 알림 받을 휴대폰 번호, 아이 사진, 애칭"],
      ["목적", "돌 영상 제작과 전달, 진행 알림"],
      ["보관", "원본 사진은 완성 7일 뒤, 영상은 30일 뒤 삭제"],
    ],
  },
  {
    id: "child",
    required: true,
    label: "만 14세 미만 아동 사진 처리 동의 (보호자)",
    rows: [
      ["안내", "아이의 법정대리인인 보호자 본인이 동의해요"],
      ["범위", "영상 제작에만 쓰고 다른 곳에 쓰지 않아요"],
    ],
  },
  {
    id: "overseas",
    required: true,
    label: "제작 위탁 및 국외 이전 안내",
    rows: [
      ["받는 곳", "Google LLC (미국) · AI 영상 생성"],
      ["이전 항목", "아이 사진, 장면 설명"],
      ["보관", "영상 생성 직후 작업 프로젝트 삭제"],
    ],
  },
  {
    id: "ai",
    required: true,
    label: "AI 생성 영상 안내",
    rows: [
      ["안내", "AI로 만든 영상이라 얼굴이 실제와 조금 다를 수 있어요"],
      ["수정", "결과를 보고 1번 무료로 고칠 수 있어요"],
    ],
  },
  {
    id: "sample",
    required: false,
    label: "샘플 영상으로 활용 동의",
    rows: [
      ["안내", "동의하면 완성 영상을 서비스 샘플로 보여 줄 수 있어요"],
      ["철회", "언제든 문의로 철회할 수 있어요"],
    ],
  },
];
