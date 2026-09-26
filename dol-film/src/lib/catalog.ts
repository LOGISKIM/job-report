// 템플릿 카탈로그. 가격은 서버에서도 이 파일을 기준으로 계산하므로 브라우저가 보낸 금액은 쓰지 않는다.

export type SceneKind = "ai" | "photo";
export type Scene = { name: string; desc: string; seconds: number; kind: SceneKind };

export type Template = {
  id: string;
  name: string;
  short: string[];
  cls: string;
  price: number;
  badge?: string;
  desc: string;
  scenes: Scene[];
};

export const TEMPLATES: Template[] = [
  {
    id: "fairy",
    name: "동화 속 첫 생일",
    short: ["동화 속", "첫 생일"],
    cls: "t-fairy",
    price: 49000,
    badge: "인기",
    desc: "구름 위 성에서 요정 친구들과 생일 파티를 열어요.",
    scenes: [
      { name: "오프닝", desc: "구름 사이로 성이 보이고 아이가 창밖을 바라봐요", seconds: 15, kind: "ai" },
      { name: "성장 앨범", desc: "보내 주신 사진으로 만드는 1년 앨범", seconds: 90, kind: "photo" },
      { name: "생일 파티", desc: "요정 친구들과 케이크 촛불을 불어요", seconds: 30, kind: "ai" },
      { name: "별빛 마차", desc: "마차를 타고 밤하늘을 날아요", seconds: 15, kind: "ai" },
      { name: "엔딩", desc: "가족 인사와 생일 축하 자막", seconds: 30, kind: "ai" },
    ],
  },
  {
    id: "hanbok",
    name: "한복 돌잔치",
    short: ["한복", "돌잔치"],
    cls: "t-hanbok",
    price: 49000,
    badge: "전통",
    desc: "한옥 마당에서 색동 한복을 입고 돌잡이를 해요.",
    scenes: [
      { name: "오프닝", desc: "햇살이 드는 한옥 마당", seconds: 15, kind: "ai" },
      { name: "성장 앨범", desc: "보내 주신 사진으로 만드는 1년 앨범", seconds: 90, kind: "photo" },
      { name: "돌잡이", desc: "실, 연필, 마이크, 청진기 중 하나를 잡아요", seconds: 30, kind: "ai" },
      { name: "가족 인사", desc: "색동 한복 차림으로 손을 흔들어요", seconds: 15, kind: "ai" },
      { name: "엔딩", desc: "\"무병장수\" 붓글씨 자막", seconds: 30, kind: "ai" },
    ],
  },
  {
    id: "space",
    name: "우주 탐험 첫돌",
    short: ["우주 탐험", "첫돌"],
    cls: "t-space",
    price: 54000,
    badge: "NEW",
    desc: "로켓을 타고 달에 첫걸음을 남겨요.",
    scenes: [
      { name: "오프닝", desc: "로켓 발사 카운트다운", seconds: 15, kind: "ai" },
      { name: "성장 앨범", desc: "보내 주신 사진으로 만드는 1년 앨범", seconds: 90, kind: "photo" },
      { name: "달 위의 첫걸음", desc: "우주복을 입고 달 표면을 아장아장 걸어요", seconds: 30, kind: "ai" },
      { name: "별자리", desc: "아이 이름으로 별자리를 그려요", seconds: 15, kind: "ai" },
      { name: "엔딩", desc: "지구를 배경으로 생일 축하 자막", seconds: 30, kind: "ai" },
    ],
  },
  {
    id: "seasons",
    name: "사계절 성장 앨범",
    short: ["사계절", "성장 앨범"],
    cls: "t-seasons",
    price: 44000,
    desc: "봄부터 겨울까지, 아이의 첫 1년을 계절로 담아요.",
    scenes: [
      { name: "봄", desc: "벚꽃길을 걷는 장면", seconds: 15, kind: "ai" },
      { name: "성장 앨범", desc: "보내 주신 사진으로 만드는 1년 앨범", seconds: 90, kind: "photo" },
      { name: "여름과 가을", desc: "바닷가와 낙엽길", seconds: 30, kind: "ai" },
      { name: "겨울", desc: "첫눈을 만져 보는 장면", seconds: 15, kind: "ai" },
      { name: "엔딩", desc: "계절이 한 바퀴 돌아 생일 축하 자막", seconds: 30, kind: "ai" },
    ],
  },
];

export const CUSTOM: Template = {
  id: "custom",
  name: "나만의 스타일",
  short: ["나만의", "스타일"],
  cls: "t-custom",
  price: 79000,
  desc: "원하는 분위기와 장면을 적어 주시면 그대로 만들어 드려요.",
  scenes: [],
};

export const MOODS = ["따뜻한", "몽환적인", "신나는", "클래식한", "귀여운", "영화 같은", "자연 속", "레트로"];

export const MUSIC = [
  { name: "잔잔한 피아노", desc: "따뜻하고 차분해요" },
  { name: "오르골 자장가", desc: "포근하고 귀여워요" },
  { name: "경쾌한 우쿨렐레", desc: "밝고 신나요" },
];

export const PHOTO_MIN = 5;
export const PHOTO_MAX = 10;

export function getTemplate(id: string): Template | undefined {
  if (id === CUSTOM.id) return CUSTOM;
  return TEMPLATES.find((t) => t.id === id);
}

export function won(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

export function mmss(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const STATUS_LABEL: Record<string, string> = {
  pending_payment: "결제 대기",
  paid: "접수 완료",
  in_production: "제작 중",
  review: "검수 중",
  delivered: "완성",
  canceled: "취소됨",
};

// 진행 상황 화면의 단계 (0~3)
export function stageOf(status: string) {
  switch (status) {
    case "paid":
      return 0;
    case "in_production":
      return 1;
    case "review":
      return 2;
    case "delivered":
      return 3;
    default:
      return -1;
  }
}
