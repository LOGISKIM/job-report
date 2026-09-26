import { AppBar, CTA, LinkButton } from "@/components/ui";

export default async function PayFailPage(props: PageProps<"/pay/fail">) {
  const q = await props.searchParams;
  const message = typeof q.message === "string" ? q.message.slice(0, 200) : "결제를 완료하지 못했어요";
  const orderId = typeof q.orderId === "string" && /^[0-9a-f-]{36}$/.test(q.orderId) ? q.orderId : null;
  return (
    <div className="app">
      <AppBar backHref="/" />
      <main className="view">
        <h1 className="h2">결제하지 못했어요</h1>
        <p className="sub">{message}</p>
        <p className="fine">돈이 빠져나갔는데 이 화면이 보인다면 고객센터로 알려 주세요.</p>
      </main>
      <CTA>
        {orderId ? <LinkButton href={`/order/${orderId}/pay`}>다시 결제하기</LinkButton> : <LinkButton href="/orders">내 주문 보기</LinkButton>}
      </CTA>
    </div>
  );
}
