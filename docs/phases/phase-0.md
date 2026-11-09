# Phase 0 — Foundation (task breakdown)

**Deliverable (من §13):** دخول لكل دور + **عزل مُثبت باختبار** + **style page** يعرض كل توكن وكل مكوّن.
**Definition of Done:** كل مهمة أدناه مُنفَّذة ومُتحقَّق منها محليًا، و`tsc --noEmit` نظيف، واختبار العزل **يثبت أنه قادر على الفشل**.

> قيد: `next build` غير موثوق على هذا الجهاز (يتعلّق) ⇒ التحقق المحلي عبر `next dev` + سكربتات Node. البناء الكامل يُترك لـCI.

---

## T0.1 — هيكل المشروع (Scaffold)
- **Scope:** Next.js (App Router) + TypeScript strict + Tailwind + path alias `@/*` + ESLint.
- **Files:** `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `.gitignore`, `.env.example`.
- **AC:** `npm run dev` يقدّم صفحة 200 على `localhost`، و`tsc --noEmit` نظيف، و`.env.local` مستثنى من git.
- **Verify:** `curl -s -o /dev/null -w '%{http_code}' localhost:3000`.

## T0.2 — Design tokens (مصدر واحد)
- **Scope:** Deep Navy `#0B1F3B` · Teal `#00A996` · Mint `#E6F7F2` · Cream `#FAFAF7` · Gold `#D4AF37` + neutrals مشتقّة من Navy + status (success=Teal, error `#C0392B`, warning `#D97706`) + radii (24/16/pill).
- **Files:** `app/globals.css` (`@theme`), `lib/brand.ts` (نسخة TS للاستخدام خارج CSS).
- **AC:** لا `#hex` في أي ملف واجهة آخر (فحص grep)، وكل التوكنز ظاهرة بصريًا في `/style`.
- **Verify:** `rg -n '#[0-9a-fA-F]{6}' app components --glob '!globals.css'` ⇒ صفر نتائج.

## T0.3 — الخطوط
- **Scope:** `next/font` لـ Playfair Display · Inter · IBM Plex Sans Arabic · Noto Naskh Arabic؛ Arabic headings ↔ Noto Naskh، Arabic body/UI ↔ IBM Plex Sans Arabic.
- **AC:** صفحة عربية تعرض عناوين بلا أي fallback glyph، ومقاييس §10.2 (56/36/28/20/16/13) معرّفة كـutility.
- **Verify:** لقطة `/style?lang=ar` + فحص `document.fonts` عبر المتصفح.

## T0.4 — RTL + i18n foundation
- **Scope:** `[locale]` segment (`ar` افتراضي، `en`)، `dir`/`lang` على `<html>`، مبدّل «AR | EN»، كتالوج داخلي (ADR-003)، دعم `<bdi>` للأسماء/الأرقام.
- **AC:** كل صفحة تعمل عند 360px في الاتجاهين؛ لا خاصية `left/right` في CSS (فحص).
- **Verify:** `rg -n '\b(margin|padding|inset|border)-(left|right)\b' app components` ⇒ صفر نتائج.

## T0.5 — مخطط قاعدة البيانات (Schema)
- **Scope:** كل جداول §6: `merchants, users, branches, loyalty_cards, customers, passes, apple_pass_registrations, transactions, rewards, redemptions, plans, subscriptions, invoices, push_jobs, audit_logs` + `id/created_at/updated_at` + `merchant_id` مفهرس + القيود الفريدة المذكورة.
- **AC:** migrations تُطبَّق بالترتيب على قاعدة نظيفة بلا خطأ، وكل جدول تابع لتاجر يحمل `merchant_id` NOT NULL مفهرسًا.
- **Verify:** `supabase db push` (أو SQL مباشر) + استعلام `information_schema` يسرد الجداول والأعمدة.

## T0.6 — RLS + policies
- **Scope:** تفعيل RLS على **كل** جدول؛ policy لكل جدول تابع بـ`merchant_id = current merchant`؛ منع anon من أي كتابة؛ دور staff بقراءة/كتابة مقيّدة (لا analytics، لا تعديل الكارت).
- **AC:** الجداول التابعة بلا policy تسمح بالمرور = صفر. `plans` عامة للقراءة فقط.
- **Verify:** استعلام على `pg_policies` يثبت التغطية 100% للجداول التابعة.

## T0.7 — Auth + الأدوار
- **Scope:** Supabase Auth (email+password + Google)، جدول `users` مربوطًا بـ`auth.users`، أدوار `merchant_owner | staff | super_admin`، ربط `pin_hash` للموظف، بوابة 2FA للسوبر أدمن (TOTP).
- **AC:** كل دور يصل لما يخصّه فقط؛ محاولة دور staff للوصول لأي route خاص بالمالك تُرفض.
- **Verify:** سكربت Node يسجّل الدخول بثلاثة حسابات ويجرّب مسارات ممنوعة ⇒ كلها 403/رفض.

## T0.8 — اختبار العزل (Isolation harness) — **الاختبار القادر على الفشل**
- **Scope:** تاجران A وB ببيانات متشابهة؛ تُنفَّذ محاولات قراءة/تعديل متقاطعة عبر قناة العميل الحقيقي (PostgREST) لا عبر service role.
- **AC:** كل محاولة متقاطعة تفشل، **ويثبت السكربت أنه يفشل فعلًا عند تعطيل policy** (canary) — مع `finally` يضمن إعادة السياسة.
- **Verify:** `node tests/rls/isolation.mjs` ⇒ يخرج success؛ وبتعطيل policy مؤقتًا ⇒ يخرج failure ثم يُعيد السياسة.

## T0.9 — صفحة Style (كل توكن وكل مكوّن)
- **Scope:** عرض التوكنز + الأزرار (gold على navy، navy على light، outlined، دائري) + KPI card + badges الحالة + الحقول + الجداول القابلة للترتيب + dialogs + toasts + empty states + شاشة النجاح «You're In!».
- **AC:** كل عنصر مطابق لـ§10.4، ويظهر في الاتجاهين عند 360px.
- **Verify:** لقطة `/style` عربي + إنجليزي.

---

## Order & Dependencies

```
T0.1 → T0.2 → T0.3 → T0.4
                 ↘
T0.1 → T0.5 → T0.6 → T0.7 → T0.8
T0.2 → T0.9   (T0.9 تستهلك tokens من T0.2 وT0.3)
```

## Risks

| خطر | احتمال | تخفيف |
|---|---|---|
| `next build` يتعلّق على iSH | مرتفع | dev + سكربتات، والبناء في CI |
| بطء/تعليق npm في الخلفية | متوسط | تنفيذ متسلسل، بلا كتابة ملفات أثناء التثبيت |
| مجلدات لا تُنشأ على هذا الجهاز | متوسط | أسماء بديلة أو staging عبر git |
| بقايا hex في مكوّنات shadcn | متوسط | فحص grep كخطوة إجبارية في T0.2 وT0.9 |

---

## Progress Log

### 2026-11-09 — T0.1 / T0.2 / T0.3 (جزئي)

| Task | الحالة | الدليل الفعلي |
|---|---|---|
| T0.1 Scaffold | ✅ DONE | Next.js 16.4.5 + React 19.3.1 + Tailwind 4.3.5 + TS 5.9.3؛ `GET / → HTTP 200` (12,152 bytes)؛ `tsc --noEmit` بلا مخرجات |
| T0.2 Tokens | ✅ DONE (قيد التحقق الآلي) | كل الألوان/المقاييس في `app/globals.css` فقط؛ تحقّق حيّ: body bg `rgb(250,250,247)` = Cream، body color `rgb(11,31,59)` = Navy |
| T0.3 Fonts | ✅ DONE | self-hosted woff2؛ تحقّق حيّ: `h1 → notoNaskh`، `body → plexArabic`؛ `h1Size = 36px` (hero-mobile) |
| T0.4 RTL/i18n | 🟡 PARTIAL | `dir="rtl"` و`lang="ar"` مُثبتان حيًّا؛ مبدّل AR\|EN وكتالوج الرسائل لم يُبنَ بعد |
| T0.5 Schema | ⬜ TODO | يحتاج قرار region + مشروع Supabase |
| T0.6 RLS | ⬜ TODO | يعتمد على T0.5 |
| T0.7 Auth+roles | ⬜ TODO | يعتمد على T0.5 |
| T0.8 Isolation test | ⬜ TODO | يعتمد على T0.6 |
| T0.9 Style page | 🟡 PARTIAL | صفحة هبوط تعرض التوكنز؛ جدول المكوّنات الكامل لم يُبنَ |
| — | — | — |
| فحص التوكنز الآلي (`check:tokens`) | ⬜ TODO | سكربت grep المذكور في AC لـT0.2 |
| فحص CSS المنطقي (`check:logical`) | ⬜ TODO | |

**عوائق بيئية حُلّت (موثّقة في ADR-009/010/011):**
1. `fs.realpathSync.native` يفشل على مسار الجسر ⇒ المشروع في `/root/taployal`.
2. `npm install` يفشل بسبب symlinks على مسار الجسر ⇒ نفس الحل + `--no-bin-links` عند الحاجة.
3. Next.js يورّث وسائط V8 المفروضة إلى `NODE_OPTIONS` ⇒ `tools/patch-next-for-sandbox.mjs` (postinstall).
4. `next/font/google` لا يصل إلى Google Fonts (`EHOSTUNREACH` IPv6) ⇒ خطوط مستضافة ذاتيًا.

**ملاحظة أداء حقيقية:** تشغيل Node هنا بلا JIT (`--no-opt`) ⇒ أول compile للصفحة ≈ 22–35 ثانية، والطلب الساخن ≈ 9.6 ثانية. `next build` لم يُجرَّب بعد. قرار العمل: اعتبار هذا قيدًا معروفًا، والتحقق المنطقي عبر سكربتات Node/SQL حيث أمكن بدل الاعتماد على دورات dev.

**قيد معروف:** `document.fonts` يعرض 16 إدخالًا بحالة `unloaded` — وهي أوزان مُعلنة لم تُستخدم بعد في هذه الصفحة، لا خطوط فاشلة. يلزم فحص أدق في T0.9 لخطوط المستخدمة فعلًا.
