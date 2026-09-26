import { AppBar } from "@/components/ui";

// 초안이다. 출시 전에 환불 규정과 사업자 정보를 확정하자.
export default function TermsPage() {
  return (
    <div className="app">
      <AppBar backHref="/" title="이용약관" />
      <main className="view" style={{ lineHeight: 1.7, fontSize: 14 }}>
        <p className="fine">초안</p>
        <h2 className="sec-title">1. 서비스</h2>
        <p>보내 주신 사진과 요청으로 AI를 활용한 약 3분 길이의 돌 영상을 만들어 드립니다. AI로 만든 영상이라 얼굴이 실제와 조금 다를 수 있습니다.</p>
        <h2 className="sec-title">2. 제작 기간과 수정</h2>
        <p>결제 후 영업일 5일 안에 완성합니다. 완성 후 1번 무료로 수정할 수 있습니다.</p>
        <h2 className="sec-title">3. 취소와 환불</h2>
        <p>{/* TODO: 환불 규정 확정 */}제작 시작 전에는 전액 환불합니다. 제작이 시작된 뒤에는 맞춤 제작 상품이라 환불이 제한될 수 있습니다.</p>
        <h2 className="sec-title">4. 만들 수 없는 요청</h2>
        <p>유명 캐릭터, 연예인 등 타인의 권리를 침해하거나 부적절한 요청은 제작하지 않으며, 이 경우 전액 환불합니다.</p>
      </main>
    </div>
  );
}
