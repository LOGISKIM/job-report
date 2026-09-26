import { AppBar } from "@/components/ui";
import { CONSENT_VERSION } from "@/lib/consents";

// 초안이다. 출시 전에 사업자 정보와 담당자 연락처를 채우고, 가능하면 전문가 검토를 받자.
export default function PrivacyPage() {
  return (
    <div className="app">
      <AppBar backHref="/" title="개인정보처리방침" />
      <main className="view" style={{ lineHeight: 1.7, fontSize: 14 }}>
        <p className="fine">버전 {CONSENT_VERSION} · 초안</p>
        <h2 className="sec-title">1. 수집하는 항목과 목적</h2>
        <p>로그인 식별자(카카오), 알림 받을 휴대폰 번호, 아이 사진, 아이 애칭, 요청 내용. 돌 영상 제작과 전달, 진행 알림에만 씁니다.</p>
        <h2 className="sec-title">2. 보관 기간</h2>
        <p>원본 사진은 영상 완성 7일 뒤, 완성 영상과 휴대폰 번호는 30일 뒤 자동으로 삭제합니다. 결제하지 않은 주문의 사진은 하루 뒤 삭제합니다. 결제 기록은 전자상거래법에 따라 5년간 보관합니다.</p>
        <h2 className="sec-title">3. 만 14세 미만 아동의 정보</h2>
        <p>아이 사진은 법정대리인인 보호자의 동의를 받아 처리합니다.</p>
        <h2 className="sec-title">4. 처리 위탁과 국외 이전</h2>
        <p>Supabase(데이터 보관, 서울 리전), Vercel(서비스 운영), 토스페이먼츠(결제), 솔라피(알림톡), Google LLC(미국, AI 영상 생성)에 필요한 범위에서 위탁합니다.</p>
        <h2 className="sec-title">5. 이용자의 권리</h2>
        <p>주문 화면에서 원본 사진을 언제든 바로 삭제할 수 있고, 그 밖의 열람·정정·삭제 요청은 아래 연락처로 받습니다.</p>
        <h2 className="sec-title">6. 개인정보 보호책임자</h2>
        <p>{/* TODO */}이름 · 이메일 · 연락처</p>
      </main>
    </div>
  );
}
