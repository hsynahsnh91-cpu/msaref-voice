"use client";

import { useI18n } from "@/lib/i18n/provider";
import { VERSION } from "@/lib/i18n/dictionary";

interface Section {
  ar: { h: string; p: string[] };
  en: { h: string; p: string[] };
}

const SECTIONS: Section[] = [
  {
    ar: {
      h: "شو منجمع؟",
      p: [
        "منجمع بس المعلومات اللازمة لحسابك: البريد الإلكتروني، كلمة السر (مشفّرة بخوارزمية scrypt وما بتنعرف أبداً)، الاسم اختياري، ميزانيتك وعملتك، معاملاتك، وتسجيلاتك الصوتية مع النص المكتوب.",
        "ما في أي حسابات وهمية ولا بيانات تجريبية (demo) مخزّنة بالتطبيق. كل صفّ بالبنك بيلحق بمستخدم حقيقي سجّل بإيده.",
      ],
    },
    en: {
      h: "What we collect",
      p: [
        "Only what your account needs: email, password (hashed with scrypt and never recoverable), an optional name, your budget and currency, your transactions, and your voice recordings with their transcripts.",
        "There are no demo or fake accounts anywhere in this app. Every database row belongs to a real person who signed up themselves.",
      ],
    },
  },
  {
    ar: {
      h: "كيف بينعالج الصوت؟",
      p: [
        "التعرّف على الكلام بيتم بمحرك الصوت الحقيقي الموجود بجهازك (Web Speech API بالمتصفح، أو SpeechRecognizer على أندرويد). التسجيل بيروح لمزوّد التعرّف تبع النظام فقط لحتى يتحوّل لنص.",
        "التسجيل الصوتي الأصلي بينحفظ بحسابك أنت حتى تقدر ترجع تسمعه من قسم «الوارد» وتتحقق من المصروف.",
        "عندك خيار «كتم إعادة الصوت بعد التسجيل»: لما يكون مفعّل، التطبيق ما بيعيد كلامك ولا بينطق أي شي بعد الإرسال.",
      ],
    },
    en: {
      h: "How voice is processed",
      p: [
        "Speech-to-text runs on your device's real speech engine (the browser Web Speech API, or Android SpeechRecognizer). Audio goes only to the system's recognition provider to be turned into text.",
        "The original recording is stored inside your own account so you can replay it later from the Inbox and verify the expense.",
        "You control the “Mute playback after recording” option: when it is on, the app never echoes your voice and never speaks anything back after you send.",
      ],
    },
  },
  {
    ar: {
      h: "العملة والأرقام",
      p: [
        "التطبيق محسوب بالليرة السورية الجديدة (كل 100 ليرة قديمة = 1 ليرة جديدة)، وفيك تختار عملة تانية لأي مبلغ. التحويل بين الليرة القديمة والجديدة بيتم تلقائياً ضمن ملخّص الميزانية.",
      ],
    },
    en: {
      h: "Currency & numbers",
      p: [
        "The app is denominated in the New Syrian Pound (100 old pounds = 1 new pound). You can pick another currency per amount; old↔new pound conversion is handled automatically in the budget summary.",
      ],
    },
  },
  {
    ar: {
      h: "ما منعمل",
      p: [
        "ما منبيع بيانات، ما في إعلانات، ما في أدوات تتبع (analytics)، وما في مشاركة لأي جهة تالتة. التسجيلات ما بتطلع برا حسابك.",
      ],
    },
    en: {
      h: "What we never do",
      p: ["We never sell data, run ads, embed analytics trackers, or share anything with third parties. Your recordings never leave your account."],
    },
  },
  {
    ar: {
      h: "حذف بياناتك",
      p: [
        "فيك بأي لحظة تحذف كل بياناتك من الإعدادات («حذف كل بياناتي»). الحذف نهائي وبيشيل الحساب والمعاملات والتسجيلات كلها.",
      ],
    },
    en: {
      h: "Deleting your data",
      p: ["You can permanently delete everything from Settings (“Delete all my data”). This removes the account, transactions and recordings for good."],
    },
  },
  {
    ar: {
      h: "الأمان وجلسات الدخول",
      p: [
        "الجلسات بتنتهي بعد 30 يوم، والكوكيز httpOnly. تسجيل الدخول حقيقي: إيميل وكلمة سر موجودين فعلاً بالبنك، وما بيقبل أي إيميل عشوائي.",
      ],
    },
    en: {
      h: "Security & sessions",
      p: [
        "Sessions expire after 30 days and cookies are httpOnly. Sign-in is real: the email and password must exist in the database — arbitrary credentials are rejected.",
      ],
    },
  },
  {
    ar: {
      h: "تواصل",
      p: ["أي سؤال عن الخصوصية: راجع مطوّر التطبيق أبو عمر. هالنسخة رقمها " + VERSION + "."],
    },
    en: {
      h: "Contact",
      p: [`Questions about privacy: reach out to the developer, Abu Omar. This is version ${VERSION}.`],
    },
  },
];

export function PrivacyBody() {
  const { t, isAr } = useI18n();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black text-ink">{t("privacyTitle")}</h1>
        <p className="num mt-1 text-xs text-faint">{t("privacyUpdated")}</p>
      </header>
      {SECTIONS.map((s, i) => {
        const body = isAr ? s.ar : s.en;
        return (
          <section key={i} className="animate-fade-up" style={{ animationDelay: `${i * 45}ms` }}>
            <h2 className="mb-1.5 text-[15px] font-bold text-mint-soft">{body.h}</h2>
            {body.p.map((p, j) => (
              <p key={j} className="mb-2 text-[13px] leading-relaxed text-muted">
                {p}
              </p>
            ))}
          </section>
        );
      })}
    </div>
  );
}
