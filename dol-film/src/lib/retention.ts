// 취소된 주문에서 지우는 개인정보. 결제 기록(금액, 결제 키)은 전자상거래법 보관 의무 때문에 남긴다.
export const ERASED_FIELDS = {
  nickname: "-",
  caption: "-",
  custom_request: null,
  moods: [] as string[],
  contact_phone: null,
  revision_request: null,
};

export const DAY_MS = 24 * 60 * 60 * 1000;
// 결제하지 않은 주문을 정리하기까지 기다리는 시간 (결제 중인 사람과 겹치지 않게 넉넉히)
export const ABANDON_AFTER_MS = 2 * DAY_MS;
