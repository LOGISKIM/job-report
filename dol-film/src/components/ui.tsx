"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { Template } from "@/lib/catalog";
import { Back } from "./icons";

export function AppBar({
  title,
  back = true,
  backHref,
  onBack,
  progress,
  right,
}: {
  title?: string;
  back?: boolean;
  backHref?: string;
  onBack?: () => void;
  progress?: number;
  right?: ReactNode;
}) {
  const router = useRouter();
  const handleBack = () => {
    if (onBack) return onBack();
    if (backHref) return router.push(backHref);
    router.back();
  };
  return (
    <header className="appbar">
      <button
        className="back"
        aria-label="뒤로 가기"
        onClick={handleBack}
        style={{ visibility: back ? "visible" : "hidden" }}
      >
        <Back />
      </button>
      {title && <span className="ttl">{title}</span>}
      {right && <span className="right">{right}</span>}
      {progress !== undefined && (
        <div className="progress">
          <i style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
    </header>
  );
}

export function Poster({
  t,
  size,
  title,
  chip,
  dur,
}: {
  t: Template;
  size?: "big" | "mini";
  title?: ReactNode;
  chip?: string;
  dur?: boolean;
}) {
  return (
    <div className={`poster ${t.cls} ${size ?? ""}`}>
      <div className="bg" />
      <span className="num" aria-hidden>
        1
      </span>
      {chip && <span className="chip">{chip}</span>}
      <div className="ptitle">
        {title ??
          t.short.map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {line}
            </span>
          ))}
      </div>
      {dur && <span className="dur">3:00</span>}
    </div>
  );
}

export function CTA({ children }: { children: ReactNode }) {
  return <footer className="cta">{children}</footer>;
}

export function LinkButton({ href, children, sub }: { href: string; children: ReactNode; sub?: boolean }) {
  return (
    <Link className={`btn ${sub ? "sub" : ""}`} href={href}>
      {children}
    </Link>
  );
}
