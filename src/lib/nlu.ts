import { CATEGORIES, type CategoryId } from "@/lib/categories";
import type { CurrencyCode } from "@/lib/money";
import { addCivilDays, fromCivilDate, isValidCivilDate, toCivilDate } from "@/lib/utils";

export interface ParseResult {
  amount: number | null;
  currency: CurrencyCode;
  category: CategoryId;
  kind: "expense" | "income";
  date: string; // civil yyyy-mm-dd
  dateLabelKey: "today" | "yesterday" | "thisWeek" | "picked";
  note: string;
  confidence: number;
  hasAmount: boolean;
  matched: { amount: boolean; category: boolean; date: boolean; currency: boolean };
}

/* ------------------------------------------------------------------ */
/* Normalisation                                                       */
/* ------------------------------------------------------------------ */

export function normalizeArabic(input: string): string {
  let t = input || "";
  t = t.replace(/[\u064B-\u0652\u0670\u0640]/g, ""); // tashkeel + tatweel
  t = t.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  t = t.replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  t = t.replace(/[أإآٱ]/g, "ا");
  t = t.replace(/ى/g, "ي");
  t = t.replace(/ئ/g, "ي");
  t = t.replace(/ؤ/g, "و");
  t = t.replace(/ة/g, "ه");
  t = t.toLowerCase();
  return t;
}

const norm = normalizeArabic;

/** Arabic tokens are matched without their definite article / dialect prefix. */
function stripArticle(token: string): string {
  if (token.startsWith("هال") && token.length > 4) return token.slice(3);
  if (token.startsWith("ال") && token.length > 3) return token.slice(2);
  return token;
}

function tokensOf(text: string): string[] {
  return norm(text)
    .split(/[\s،؛,.!?؟~…:]+/)
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Numbers: digits + Syrian dialect words (incl. compounds)            */
/* ------------------------------------------------------------------ */

const DIGIT_WORDS: Record<string, number> = {
  صفر: 0, واحد: 1, وحده: 1, واحده: 1,
  تنين: 2, اتنين: 2, اثنين: 2, ثنتين: 2,
  تلاته: 3, ثلاثه: 3, تلت: 3, تلات: 3,
  اربعه: 4, اربع: 4,
  خمسه: 5, خمس: 5,
  سته: 6, ست: 6,
  سبعة: 7, سبعه: 7, سبع: 7,
  تمنيه: 8, تمانيا: 8, ثمانيه: 8, تمن: 8,
  تسعه: 9, تسع: 9,
  عشره: 10, عشر: 10,
};

const TEENS: Record<string, number> = {
  حداشر: 11, حداشره: 11, طناشر: 12, تناشر: 12, طنش: 12, تلطاشر: 13, تلتاشر: 13,
  اربعتاشر: 14, اربعطاش: 14, خمستاشر: 15, خمسطاش: 15, ستاشر: 16, ستطاش: 16,
  سبعتاشر: 17, تمنتاشر: 18, تمنطاشر: 18, تسعتاشر: 19,
};

const TENS: Record<string, number> = {
  عشرين: 20, تلاتين: 30, ثلاثين: 30, اربعين: 40, خمسين: 50,
  ستين: 60, سبعين: 70, تمانين: 80, تمنين: 80, تسعين: 90,
};

const SCALES: Record<string, number> = {
  ميه: 100, مئه: 100, مايه: 100, مئين: 200, ميتين: 200,
  الف: 1000, الاف: 1000, الفا: 1000, الفين: 2000,
  مليون: 1_000_000, ملايين: 1_000_000, ملاين: 1_000_000,
};

const NUMBER_TOKENS = new Set<string>([
  ...Object.keys(DIGIT_WORDS),
  ...Object.keys(TEENS),
  ...Object.keys(TENS),
  ...Object.keys(SCALES),
  "نص",
  "ربع",
  "و",
]);

function lookupWord(w: string): number | null {
  if (DIGIT_WORDS[w] !== undefined) return DIGIT_WORDS[w];
  if (TEENS[w] !== undefined) return TEENS[w];
  if (TENS[w] !== undefined) return TENS[w];
  if (SCALES[w] !== undefined) return SCALES[w];
  return null;
}

const ATTACHED_PREFIXES = ["ب", "ل", "و", "ف", "ع"];

/**
 * Resolves one token to a number:
 * plain words, prefixed words (بميه = 100, بالف = 1000) and
 * dialect compounds (خمسمية = 500, تلتالاف = 3000).
 */
export function resolveNumberToken(rawTok: string): number | null {
  return resolveCore(rawTok) ?? resolveCore(stripArticle(rawTok));
}

function resolveCore(rawTok: string): number | null {
  let t = rawTok;
  for (const p of ATTACHED_PREFIXES) {
    if (t.length > 2 && t.startsWith(p) && lookupWord(t.slice(1)) !== null) {
      t = t.slice(1);
      break;
    }
  }
  if (/^\d+([.,]\d+)?$/.test(t)) return Number.parseFloat(t.replace(",", "."));
  const direct = lookupWord(t);
  if (direct !== null) return direct;
  // compound: <digit-word><scale> e.g. خمسمية / تلتالاف / سبعالاف
  for (let i = 2; i <= t.length - 2; i++) {
    const left = t.slice(0, i);
    const right = t.slice(i);
    const lv = lookupWord(left);
    const rs = SCALES[right];
    if (lv !== null && rs !== undefined && lv <= 99) return lv * rs;
  }
  // compound: <digit-word><digit-word> e.g. خمسه عشر (rare in one token)
  for (let i = 2; i <= t.length - 2; i++) {
    const lv = lookupWord(t.slice(0, i));
    const rv = lookupWord(t.slice(i));
    if (lv !== null && rv !== null && lv <= 9 && rv >= 10) return lv + rv;
  }
  return null;
}

function isNumericToken(tok: string): boolean {
  if (/^\d+([.,]\d+)?$/.test(tok)) return true;
  if (NUMBER_TOKENS.has(tok)) return true;
  return resolveNumberToken(tok) !== null;
}

function isFraction(tok: string): "half" | "quarter" | null {
  const t = stripArticle(tok);
  if (t === "نص" || t === "ونص" || t === "نصفي") return "half";
  if (t === "ربع" || t === "وربع") return "quarter";
  return null;
}

/** Evaluate a run of number tokens into one value. */
function evaluateNumberRun(run: string[]): { value: number; consumed: number } {
  let current = 0;
  let lastUnit = 0;
  let consumed = 0;
  let sawFraction = false;

  for (let i = 0; i < run.length; i++) {
    const rawTok = run[i];
    if (!rawTok) continue;
    const tok = stripArticle(rawTok);
    if (tok === "و") continue;

    const fraction = isFraction(tok);
    if (fraction) {
      const base = lastUnit >= 100 ? lastUnit : 1;
      current += fraction === "half" ? base / 2 : base / 4;
      sawFraction = true;
      consumed = i + 1;
      continue;
    }

    const scaleKey = [rawTok, tok, resolvePrefix(rawTok), resolvePrefix(tok)].find((k) => SCALES[k] !== undefined);
    const scale = scaleKey !== undefined ? SCALES[scaleKey] : undefined;
    if (scale !== undefined) {
      const mult = lastUnit >= 1 && lastUnit <= 99 && lastUnit < scale ? lastUnit : 1;
      current = current - lastUnit + mult * scale;
      lastUnit = mult * scale;
      consumed = i + 1;
      continue;
    }

    const value = resolveNumberToken(tok);
    if (value !== null) {
      // a resolved compound like خمسمية (500) already includes its scale
      current += value;
      lastUnit = value;
      consumed = i + 1;
      continue;
    }
    break;
  }

  if (sawFraction) current = Math.round(current * 100) / 100;
  return { value: Math.round(current * 100) / 100, consumed };
}

function resolvePrefix(tok: string): string {
  for (const p of ATTACHED_PREFIXES) {
    if (tok.length > 2 && tok.startsWith(p) && SCALES[tok.slice(1)] !== undefined) return tok.slice(1);
  }
  return tok;
}

/**
 * Every plausible money amount in the utterance, scored so the number that sits
 * right next to a currency word wins over stray numbers (dates, quantities).
 */
export function extractAmount(text: string): { value: number; raw: string; tokens: string[] } | null {
  const tokens = tokensOf(text);
  let best: { value: number; raw: string; tokens: string[]; score: number; index: number } | null = null;

  for (let i = 0; i < tokens.length; i++) {
    if (!isNumericToken(tokens[i])) continue;
    const run: string[] = [];
    let j = i;
    while (j < tokens.length && (isNumericToken(tokens[j]) || isFraction(tokens[j]) || stripArticle(norm(tokens[j])) === "و")) {
      if (stripArticle(norm(tokens[j])) === "و" && !(isNumericToken(tokens[j + 1] ?? "") || isFraction(tokens[j + 1] ?? ""))) break;
      run.push(tokens[j]);
      j++;
    }
    if (!run.length) continue;
    const { value } = evaluateNumberRun(run);
    if (!(value >= 0.25 && value <= 1_000_000_000)) {
      i = j - 1;
      continue;
    }

    let score = 0;
    if (value >= 10) score += 1;
    if (value >= 100) score += 0.5;
    const gap = tokens.slice(j, j + 3).findIndex((t) => MONEY_WORDS.has(stripArticle(norm(t))));
    if (gap === 0) score += 4;
    else if (gap === 1) score += 2;
    else if (gap > 1) score += 1;
    const before = tokens.slice(Math.max(0, i - 3), i).some((t) => MONEY_WORDS.has(stripArticle(norm(t))));
    if (before) score += 1.5;

    if (!best || score > best.score) best = { value, raw: run.join(" "), tokens: run, score, index: i };
    i = j - 1;
  }

  return best ? { value: best.value, raw: best.raw, tokens: best.tokens } : null;
}

/* ------------------------------------------------------------------ */
/* Currency (Arabic dialect + English)                                 */
/* ------------------------------------------------------------------ */

const CURRENCY_RULES: { code: CurrencyCode; keys: string[] }[] = [
  { code: "TRY", keys: ["ليره تركيه", "ليره تركي", "تركيه", "تركي", "turkish lira", "turkish", "try", "₺"] },
  { code: "USD", keys: ["دولار امريكي", "دولارات", "دولار", "العمله الخضرا", "dollar", "dollars", "usd", "$", "bucks"] },
  { code: "EUR", keys: ["يورو", "اير", "euro", "eur", "€"] },
  { code: "SAR", keys: ["ريال سعودي", "ريال", "ريالات", "riyal", "sar", "saudi"] },
  { code: "SYP_OLD", keys: ["ليره سوريه قديمه", "ليره قديمه", "الليره القديمه", "القديمه", "قديما", "old syrian pound", "old syrian", "old pound"] },
  {
    code: "SYP_NEW",
    keys: [
      "ليره سوريه جديده",
      "ليره سوريه",
      "ليره جديده",
      "الليره الجديده",
      "ليره سوري",
      "ليرات",
      "ليره",
      "ل.س",
      "سوريه",
      "سوري",
      "new syrian pound",
      "syrian pound",
      "syrian pounds",
      "syrian",
      "pounds",
      "pound",
      "syp",
      "ls",
    ],
  },
];

/** Individual currency words, used to score candidate amounts. */
export const MONEY_WORDS = new Set(
  CURRENCY_RULES.flatMap((r) => r.keys)
    .flatMap((k) => norm(k).split(/\s+/))
    .filter(Boolean),
);

export function detectCurrency(rawText: string, fallback: CurrencyCode): { code: CurrencyCode; matched: boolean; key: string | null } {
  const text = ` ${norm(rawText)} `;
  for (const rule of CURRENCY_RULES) {
    for (const key of rule.keys) {
      const k = norm(key);
      if (!k) continue;
      // word-boundary aware match so "pound" never fires inside another word
      const re = new RegExp(`(^|[^\\p{L}\\p{N}])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "u");
      if (re.test(text)) return { code: rule.code, matched: true, key };
    }
  }
  return { code: fallback, matched: false, key: null };
}

/* ------------------------------------------------------------------ */
/* Category (Arabic dialect + English)                                 */
/* ------------------------------------------------------------------ */

const EN_KEYWORDS: Record<CategoryId, string[]> = {
  transport: ["taxi", "cab", "uber", "bus", "fuel", "gasoline", "petrol", "transport", "transportation", "parking", "flight", "train", "trip to", "damascus", "ride", "commute", "car wash"],
  food: ["food", "lunch", "dinner", "breakfast", "restaurant", "falafel", "shawarma", "chicken", "meat", "vegetables", "fruit", "supermarket", "groceries", "grocery", "coffee", "tea", "juice", "sweets", "sandwich", "bakery", "delivery", "snack", "bread", "rice", "sugar"],
  bills: ["bill", "bills", "electricity", "water bill", "generator", "ampere", "gas bill", "heating", "internet", "subscription", "rent due", "installment", "tax", "fine", "utility", "utilities"],
  health: ["medicine", "pharmacy", "doctor", "hospital", "clinic", "lab test", "surgery", "dentist", "vitamins", "treatment", "health"],
  communication: ["phone bill", "mobile", "recharge", "top up", "data plan", "sim", "wifi", "internet bill"],
  shopping: ["shirt", "pants", "jacket", "shoes", "clothes", "clothing", "shop", "shopping", "detergent", "diapers", "bag", "perfume", "laptop", "phone", "device"],
  education: ["school", "university", "course", "lesson", "tutor", "books", "notebook", "stationery", "tuition", "exam", "library"],
  home: ["rent", "house", "apartment", "furniture", "fridge", "washing machine", "maintenance", "repair", "painting", "plumber", "electrician", "cleaning", "home"],
  family: ["gift", "present", "wedding", "engagement", "eid", "family", "kids", "baby", "milk", "toy"],
  fun: ["cinema", "cafe", "outing", "beach", "pool", "stadium", "football", "playstation", "netflix", "party", "amusement"],
  personal: ["haircut", "barber", "salon", "cigarettes", "smoking", "gym", "personal"],
  income: ["salary", "income", "received", "got paid", "paid me", "earned", "refund", "sales", "commission", "bonus", "transfer received", "wage"],
  other: ["expense", "spent", "paid", "cost", "misc", "other", "stuff"],
};

export function detectCategory(rawText: string): { category: CategoryId; matched: boolean } {
  const tokens = tokensOf(rawText);
  const stripped = tokens.map(stripArticle);
  const line = ` ${stripped.join(" ")} `;
  const lower = ` ${rawText.toLowerCase()} `;

  let best: { category: CategoryId; len: number } | null = null;
  const consider = (category: CategoryId, len: number) => {
    if (!best || len > best.len) best = { category, len };
  };

  // Arabic keywords (single + multi word, article-insensitive)
  for (const cat of CATEGORIES) {
    for (const kw of cat.keywords) {
      const k = norm(kw).split(/\s+/).filter(Boolean).map(stripArticle).join(" ");
      if (!k || k.length < 2) continue;
      if (line.includes(` ${k} `)) consider(cat.id, k.length);
    }
  }
  // English keywords
  for (const cat of Object.keys(EN_KEYWORDS) as CategoryId[]) {
    for (const kw of EN_KEYWORDS[cat]) {
      const k = kw.toLowerCase();
      if (lower.includes(` ${k} `) || lower.includes(` ${k},`) || lower.includes(` ${k}.`)) consider(cat, k.length);
    }
  }

  if (best) return { category: (best as { category: CategoryId }).category, matched: true };
  return { category: "other", matched: false };
}

/* ------------------------------------------------------------------ */
/* Kind (expense / income)                                             */
/* ------------------------------------------------------------------ */

const INCOME_KEYS = [
  "قبضت", "استلمت", "راتب", "راتبي", "معاش", "دخلي", "جاني", "جاتني", "ربحت", "رجعلي", "رجع لي",
  "حواله", "مبيعات", "بعت", "مكافاه", "عائدا", "دخل",
  "salary", "received", "got paid", "earned", "refund", "income", "bonus", "commission", "paid me",
];
const EXPENSE_KEYS = [
  "دفعت", "صرفت", "كلفني", "كلفت", "اشتريت", "شريت", "عطيت", "اعطيت", "اديت", "اخدت", "اخذت",
  "حساب", "فاتوره", "مصروف", "خسرت",
  "paid", "spent", "cost", "bought", "expense",
];

export function detectKind(rawText: string, category: CategoryId): "expense" | "income" {
  const tokens = tokensOf(rawText).map(stripArticle);
  const line = ` ${tokens.join(" ")} `;
  const lower = ` ${rawText.toLowerCase()} `;
  if (category === "income") return "income";
  const hit = (keys: string[]) =>
    keys.some((k) => {
      const nk = norm(k);
      if (/^[a-z ,]+$/.test(nk)) return lower.includes(` ${nk} `);
      return line.includes(` ${stripArticle(nk)} `);
    });
  if (hit(INCOME_KEYS)) return "income";
  if (hit(EXPENSE_KEYS)) return "expense";
  return "expense";
}

/* ------------------------------------------------------------------ */
/* Dates (civil, never UTC-parsed)                                     */
/* ------------------------------------------------------------------ */

const WEEKDAYS: Record<string, number> = {
  الاحد: 0, الاثنين: 1, الاتنين: 1, الثلاثاء: 2, التلاتا: 2, الاربعاء: 3, الاربع: 3,
  الخميس: 4, الجمعه: 5, السبت: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

const MONTHS: Record<string, number> = {
  "كانون الثاني": 1, "يناير": 1, "شباط": 2, "فبراير": 2, "اذار": 3, "مارس": 3, "نيسان": 4, "ابريل": 4,
  "ايار": 5, "مايو": 5, "حزيران": 6, "يونيو": 6, "تموز": 7, "يوليو": 7, "اب": 8, "اغسطس": 8,
  "ايلول": 9, "سبتمبر": 9, "تشرين الاول": 10, "اكتوبر": 10, "تشرين الثاني": 11, "نوفمبر": 11,
  "كانون الاول": 12, "ديسمبر": 12,
  "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6, "july": 7,
  "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
};

export interface DateParse {
  date: string;
  labelKey: ParseResult["dateLabelKey"];
  matchedText: string[];
}

export function parseDate(rawText: string, todayCivil: string): DateParse {
  const tokens = tokensOf(rawText);
  const stripped = tokens.map(stripArticle);
  const line = ` ${stripped.join(" ")} `;
  const lower = ` ${rawText.toLowerCase()} `;
  const today = fromCivilDate(todayCivil);

  const has = (phrase: string) => {
    const parts = norm(phrase).split(/\s+/).filter(Boolean).map(stripArticle);
    if (/^[a-z ]+$/.test(phrase.toLowerCase())) return lower.includes(` ${phrase.toLowerCase()} `);
    return line.includes(` ${parts.join(" ")} `);
  };
  const at = (days: number, labelKey: DateParse["labelKey"], matched: string): DateParse => ({
    date: addCivilDays(todayCivil, days),
    labelKey,
    matchedText: matched ? [matched] : [],
  });

  if (has("اول مبارح") || has("قبل مبارح") || has("day before yesterday")) {
    return { date: addCivilDays(todayCivil, -2), labelKey: "yesterday", matchedText: ["اول مبارح", "قبل مبارح", "day before yesterday"] };
  }
  if (has("مبارح") || has("البارحه") || has("امس") || has("yesterday")) {
    return { date: addCivilDays(todayCivil, -1), labelKey: "yesterday", matchedText: ["مبارح", "البارحه", "امس", "yesterday"] };
  }
  if (has("بعد بكرا") || has("بعد بكره") || has("day after tomorrow")) {
    return { date: addCivilDays(todayCivil, 2), labelKey: "picked", matchedText: ["بعد بكرا", "day after tomorrow"] };
  }
  if (has("بكرا") || has("بكره") || has("tomorrow")) {
    return { date: addCivilDays(todayCivil, 1), labelKey: "picked", matchedText: ["بكرا", "بكره", "tomorrow"] };
  }

  // "من/قبل <n> يوم|أسبوع|شهر"  •  "<n> days ago"
  const idxRel = tokens.findIndex((t) => stripArticle(norm(t)) === "من" || stripArticle(norm(t)) === "قبل");
  if (idxRel >= 0) {
    const numTok = tokens[idxRel + 1];
    const unitTok = stripArticle(norm(tokens[idxRel + 2] ?? ""));
    if (numTok) {
      const n = /^\d+$/.test(numTok) ? Number(numTok) : (resolveNumberToken(stripArticle(norm(numTok))) ?? 0);
      const units = ["يوم", "ايام", "اسبوع", "اسابيع", "شهر", "اشهر", "ساعه", "ساعات"];
      if (n > 0 && n < 400 && units.includes(unitTok)) {
        const days = unitTok.includes("اسبوع") ? n * 7 : unitTok.includes("شهر") ? n * 30 : n;
        return at(-days, "thisWeek", tokens.slice(idxRel, idxRel + 3).join(" "));
      }
    }
  }
  const agoEn = lower.match(/(\d+)\s+(day|days|week|weeks|month|months)\s+ago/);
  if (agoEn) {
    const n = Number(agoEn[1]);
    const days = agoEn[2].startsWith("week") ? n * 7 : agoEn[2].startsWith("month") ? n * 30 : n;
    return at(-days, "thisWeek", agoEn[0]);
  }

  if (has("الاسبوع الماضي") || has("last week")) {
    return { date: addCivilDays(todayCivil, -7), labelKey: "thisWeek", matchedText: ["الاسبوع الماضي", "last week"] };
  }
  if (has("الاسبوع الجاي") || has("الاسبوع القادم") || has("next week")) {
    return { date: addCivilDays(todayCivil, 7), labelKey: "picked", matchedText: ["الاسبوع الجاي", "next week"] };
  }
  if (has("الشهر الماضي") || has("last month")) {
    return {
      date: toCivilDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      labelKey: "picked",
      matchedText: ["الشهر الماضي", "last month"],
    };
  }
  if (has("اول الشهر") || has("first of the month")) {
    return { date: toCivilDate(new Date(today.getFullYear(), today.getMonth(), 1)), labelKey: "picked", matchedText: ["اول الشهر"] };
  }

  const normText = ` ${norm(rawText)} `;
  const iso = normText.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const candidate = `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    if (isValidCivilDate(candidate)) return { date: candidate, labelKey: "picked", matchedText: [iso[0].trim()] };
  }
  const dmy = normText.match(/(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = dmy[3] ? (dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3])) : today.getFullYear();
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { date: toCivilDate(new Date(year, month - 1, day)), labelKey: "picked", matchedText: [dmy[0].trim()] };
    }
  }

  // "<n> الشهر"  •  "on the <n>th"
  const dayIdx = stripped.findIndex((t, i) => t === "الشهر" || t === "شهر" || t === "the");
  if (dayIdx > 0) {
    const prev = tokens[dayIdx - 1];
    const day = /^\d+$/.test(prev) ? Number(prev) : (resolveNumberToken(stripArticle(norm(prev))) ?? 0);
    if (day >= 1 && day <= 31) {
      let d = new Date(today.getFullYear(), today.getMonth(), day);
      if (d > today) d = new Date(today.getFullYear(), today.getMonth() - 1, day);
      return { date: toCivilDate(d), labelKey: "picked", matchedText: [`${prev} ${tokens[dayIdx]}`] };
    }
  }

  for (const [name, month] of Object.entries(MONTHS)) {
    if (!has(name)) continue;
    const re = new RegExp(`(\\d{1,2})\\s+${norm(name).split(/\s+/).map(stripArticle).join("\\s+")}`);
    const m = line.match(re);
    if (m) {
      const day = Number(m[1]);
      const year = new Date(today.getFullYear(), month - 1, day) > today ? today.getFullYear() - 1 : today.getFullYear();
      return { date: toCivilDate(new Date(year, month - 1, day)), labelKey: "picked", matchedText: [m[0].trim()] };
    }
    return { date: toCivilDate(new Date(today.getFullYear(), month - 1, 1)), labelKey: "picked", matchedText: [name] };
  }

  for (const [name, target] of Object.entries(WEEKDAYS)) {
    if (!has(name)) continue;
    const diff = (today.getDay() - target + 7) % 7;
    return at(-diff, "thisWeek", name);
  }

  if (has("اليوم") || has("هاليوم") || has("today")) {
    return { date: todayCivil, labelKey: "today", matchedText: ["اليوم", "هاليوم", "today"] };
  }

  return { date: todayCivil, labelKey: "today", matchedText: [] };
}

/* ------------------------------------------------------------------ */
/* Note cleaning — keeps the user's original wording                   */
/* ------------------------------------------------------------------ */

const LEADING_FILLERS = new Set(
  [
    "صرفنا","صرفت","دفعت","دفعنا","دفع","دفعو","دفعتلهم","دفعتلوا","حاسبنا","حاسبت","عطينا","كلفني","كلفت","كلفنا","اشتريت","شريت","عطينا","عطيت","اعطيت","اديت",
    "اخدت","اخذت","حسبت","سجل","سجلي","سجللي","قيد","قيدلي","بدي","ياريت","لوسمحت","منفضلك","مرحبا","هلا",
    "يلا","طيب","تمام","هاي","هاد","هي","هو","في","انه","انو","يعني","بس","و","علي","عليه","عليها","مني",
    "paid","spent","cost","costme","bought","i","me","my","the","a","an","it","was","for","of","please",
  ].map((w) => norm(w)),
);

const CURRENCY_NOISE = [
  "ليره سوريه جديده","ليره سوريه قديمه","ليره سوريه","ليره جديده","ليره قديمه","ليره سوري","ليرات","ليره","ل.س",
  "سوريه","سوري","دولار امريكي","دولارات","دولار","يورو","ريال سعودي","ريال","ليره تركيه","تركي","جديده","جديد","قديمه",
  "dollar","dollars","usd","euro","eur","pound","pounds","syrian","new","old","syp","lira","riyal","$",
];

export function buildNote(rawText: string, amountTokens: string[], dateMatched: string[]): string {
  const rawTokens = rawText
    .split(/[\s،؛,.!?؟~…:]+/)
    .filter(Boolean);

  const amountSet = new Set(amountTokens.map((t) => stripArticle(norm(t))));
  const dropSingle = new Set([...CURRENCY_NOISE, "ب", "ل"].map((w) => norm(w)));
  const dropPhrases = new Set<string>(
    dateMatched
      .flatMap((d) => [norm(d), norm(d).split(/\s+/).filter(Boolean).map(stripArticle).join(" ")])
      .filter(Boolean),
  );

  const out: string[] = [];
  for (let i = 0; i < rawTokens.length; i++) {
    const nt = stripArticle(norm(rawTokens[i]));

    let phraseLen = 0;
    for (const len of [4, 3, 2, 1]) {
      if (i + len <= rawTokens.length) {
        const phrase = rawTokens
          .slice(i, i + len)
          .map((x) => stripArticle(norm(x)))
          .join(" ");
        if (dropPhrases.has(phrase)) {
          phraseLen = len;
          break;
        }
      }
    }
    if (phraseLen) {
      i += phraseLen - 1;
      continue;
    }

    if (/^\d+([.,]\d+)?$/.test(nt)) continue; // stray digits
    if (amountSet.has(nt)) continue;
    if (dropSingle.has(nt)) continue;
    if (SCALES[nt] !== undefined) continue; // ألف / مية leftovers
    if (LEADING_FILLERS.has(nt) && out.length === 0) continue;
    out.push(rawTokens[i]);
  }

  const cleaned = out.join(" ").replace(/\s+/g, " ").trim();
  return cleaned;
}

/* ------------------------------------------------------------------ */
/* Main entry                                                          */
/* ------------------------------------------------------------------ */

export function parseUtterance(
  rawText: string,
  opts: { today: string; fallbackCurrency: CurrencyCode },
): ParseResult {
  const text = (rawText || "").trim();
  const amount = extractAmount(text);
  const currency = detectCurrency(text, opts.fallbackCurrency);
  const { category, matched: catMatched } = detectCategory(text);
  const dateInfo = parseDate(text, opts.today);
  const kind = detectKind(text, category);
  const note = buildNote(text, amount?.tokens ?? [], dateInfo.matchedText);

  let confidence = 0;
  if (amount) confidence += 0.55;
  if (currency.matched) confidence += 0.15;
  if (catMatched) confidence += 0.2;
  if (note) confidence += 0.1;

  return {
    amount: amount?.value ?? null,
    currency: currency.code,
    category: kind === "income" ? "income" : category,
    kind,
    date: dateInfo.date,
    dateLabelKey: dateInfo.labelKey,
    note,
    confidence: Math.min(1, confidence),
    hasAmount: Boolean(amount),
    matched: {
      amount: Boolean(amount),
      category: catMatched,
      date: dateInfo.matchedText.length > 0,
      currency: currency.matched,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Spoken feedback (only when the user allows audio)                   */
/* ------------------------------------------------------------------ */

export function spokenConfirmation(
  p: ParseResult,
  formattedAmount: string,
  label: string,
  locale: string,
): string {
  if (!locale.startsWith("ar")) return `Done. ${formattedAmount} on ${label} is saved.`;
  if (p.kind === "income") return `تمام، سجّلتلك دخل ${formattedAmount} تحت ${label}.`;
  return `تمام، سجّلت ${formattedAmount} على ${label}.`;
}

export const EXAMPLE_UTTERANCES = [
  "كلفني 5000 ليرة سوري روح على دمشق",
  "دفعت 25 ليره جديده فلافل على الغدا",
  "اشتريت دوا من الصيدلية بمية ليره مبارح",
  "فاتورة الكهربا 320 ليره",
  "قبضت راتبي 1500 ليره جديده",
  "عطيت السرفيس خمسمية ليره قديمه",
];

export const EXAMPLE_UTTERANCES_EN = [
  "it cost me 5000 syrian pounds to go to damascus",
  "paid 25 pounds for falafel lunch yesterday",
  "electricity bill 320 pounds",
  "received my salary 1500 new syrian pounds",
];
