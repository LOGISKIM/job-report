const DAY = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY);
}

// 주말을 건너뛰고 영업일 기준으로 더한다 (공휴일은 MVP에서는 무시).
export function addBusinessDays(date: Date, days: number) {
  const d = new Date(date);
  let left = days;
  while (left > 0) {
    d.setTime(d.getTime() + DAY);
    const kstDay = new Date(d.getTime() + 9 * 60 * 60 * 1000).getUTCDay();
    if (kstDay !== 0 && kstDay !== 6) left--;
  }
  return d;
}

export function formatKDate(value: string | Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));
}

export function formatKDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
