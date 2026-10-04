import Link from "next/link";
import { BrandMark } from "@/components/Brand";
import { PrivacyBody } from "./body";
import { LocaleSwitch } from "@/components/LocaleSwitch";

export const dynamic = "force-dynamic";

export const metadata = { title: "سياسة الخصوصية · Privacy — صَرفي Sarfi" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 pb-16 pt-safe">
      <div className="flex items-center justify-between gap-3 py-5">
        <Link href="/settings" className="tap flex items-center gap-2.5">
          <BrandMark size={40} />
          <span className="text-[15px] font-black text-ink">صَرفي · Sarfi</span>
        </Link>
        <LocaleSwitch compact />
      </div>
      <article className="rounded-3xl border border-line-soft bg-surface/80 p-6 animate-fade-up">
        <PrivacyBody />
      </article>
      <p className="mt-6 text-center text-[12px] text-faint">v1.0.0 — تم إنشاء التطبيق بواسطة أبو عمر · Crafted by Abu Omar</p>
    </main>
  );
}
