import type { ReactNode } from "react";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { BrandMark } from "@/components/Brand";
import { GuestGuard } from "@/components/AppShell";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-safe">
      <GuestGuard />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-90"
        style={{ background: "radial-gradient(400px 220px at 50% 0%, rgba(61,220,151,0.22), transparent 70%)" }}
      />
      <div className="relative flex items-center justify-between pt-6">
        <BrandMark size={54} />
        <LocaleSwitch />
      </div>
      <div className="relative mt-8 flex-1">{children}</div>
      <p className="relative mt-8 text-center text-[11px] leading-relaxed text-faint">
        صَرفي · Sarfi — v1.0.0 · تم إنشاء التطبيق بواسطة أبو عمر
      </p>
    </main>
  );
}
