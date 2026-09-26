"use client";

import { loadTossPayments, type TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";
import { useEffect, useRef, useState } from "react";
import { CTA } from "@/components/ui";
import { publicEnv } from "@/lib/env";
import { won } from "@/lib/catalog";

export function TossPay({
  orderId,
  amount,
  orderName,
  customerKey,
}: {
  orderId: string;
  amount: number;
  orderName: string;
  customerKey: string;
}) {
  const widgetsRef = useRef<TossPaymentsWidgets | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const toss = await loadTossPayments(publicEnv.tossClientKey());
        const widgets = toss.widgets({ customerKey });
        await widgets.setAmount({ currency: "KRW", value: amount });
        await Promise.all([
          widgets.renderPaymentMethods({ selector: "#payment-method" }),
          widgets.renderAgreement({ selector: "#agreement" }),
        ]);
        if (!cancelled) {
          widgetsRef.current = widgets;
          setReady(true);
        }
      } catch {
        if (!cancelled) setError("결제 화면을 불러오지 못했어요. 새로고침해 주세요");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [amount, customerKey]);

  const pay = async () => {
    if (!widgetsRef.current) return;
    setError(null);
    try {
      await widgetsRef.current.requestPayment({
        orderId,
        orderName,
        successUrl: `${window.location.origin}/api/payments/success`,
        failUrl: `${window.location.origin}/pay/fail`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg) setError(msg);
    }
  };

  return (
    <>
      <div className="paybox">
        <div id="payment-method" />
        <div id="agreement" />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <CTA>
        <button className="btn" disabled={!ready} onClick={pay}>
          {ready ? `${won(amount)} 결제하기` : "결제 화면을 불러오는 중…"}
        </button>
      </CTA>
    </>
  );
}
