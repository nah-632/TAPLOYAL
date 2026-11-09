# SPEC — taployal (structured index)

- **Version:** 1.1 · **Date:** 2026-11-09 · **Status:** APPROVED by owner («اكمل»)

## 0. مرجع البناء المعتمد ⭐

**`docs/BUILD-PROMPT.md` هو مرجع البناء الرسمي** (1645 سطرًا، 15 قسمًا) — اعتمده المالك صراحةً في 2026-11-09:
> «اريد منك اعتماد هذا البرومبت ليكون مرجعك في البناء فقط واعتماد اللوقو المرفق»

- **يتقدّم على** `docs/spec-source.md` عند أي تعارض (رؤية ADR-002).
- **لا يتقدّم على** توجيه CranL Native (ADR-001): البرومبت يذكر Supabase/Vercel كـ**خيارات**، والتوجيه الصريح يمنعهما — انظر ADR-002 §3.
- **اللوقو المعتمد:** `public/brand/taployal-logo.png` (من الملف المرفق، بلا إعادة رسم).
- **الهوية البصرية المعتمدة:** لوحة `BUILD-PROMPT §11.A` — العربية: IBM Plex Sans Arabic · الإنجليزية: Inter (كلاهما مُستضاف محليًا).

---

- **Authority:** `docs/spec-source.md` هو النص المرجعي الكامل للمتطلبات. هذا الملف **فهرس منظّم + فروق (deltas) + قرارات**، ولا يعيد كتابة المتطلبات لتجنّب الازدواج.

> قاعدة الحسم: عند أي تعارض، `docs/spec-source.md` هو المرجع إلا حيث يسجّل هذا الملف **delta** معتمدًا من المالك.

## 1. Objectives

| # | الهدف | مقياس |
|---|---|---|
| O1 | تاجر يبني كارت ولاء بهويته وينشره في < 5 دقائق | setup wizard 4 خطوات يعمل |
| O2 | عميل ينضم ويضيف الكارت في < 30 ثانية | مسار QR→join→wallet |
| O3 | تحديث الرصيد يصل الواجهة في < 10 ثوانٍ | mock provider round-trip |
| O4 | عزل بيانات صارم بين التجّار | RLS + اختبار فاشل-قابل |
| O5 | هوية بصرية موحّدة، عربية أصيلة RTL | style page + token grep |

## 2. Capability Map (تفكيك المراحل)

| Phase | Capability | Independently testable by |
|---|---|---|
| 0 | Foundation: schema · RLS · auth · roles · brand tokens · RTL | isolation test + style page |
| 1 | Card Builder + wizard + branches/map + staff + rewards | merchants publishes a card → QR + join page |
| 2 | Google Wallet (Class/Object/JWT/locations/hero stamps) | mock + JSON assertions |
| 3 | Apple Wallet (.pkpass/signature/WebService/registration/APNs) | mock + bundle assertions |
| 4 | Staff PWA: scan · add · redeem · undo | end-to-end cycle |
| 5 | Dashboard + analytics + export | KPI = SUM(transactions) |
| 6 | Subscriptions + Super Admin + audit | mock payment cycle + suspension |
| 7 | Marketing site + hardening + launch | checklist |

## 3. Deltas المُعتمدة عن المصدر (Demo-first posture)

| Delta | المصدر كان | الآن | السبب |
|---|---|---|---|
| D1 | Apple/Google + بوابات دفع حقيقية | `WalletProvider` + `PaymentProvider` interfaces، والمزوّد الافتراضي **Mock** | لا حسابات مدفوعة (قرار المالك: ديمو أولًا) |
| D2 | Phase 2/3 قبل Phase 4/5 | الترتيب محفوظ، لكن كل Wallet phase يُسلَّم بمزوّد mock قابل للتبديل بـreal | الحفاظ على القيمة الهندسية بلا حصار حسابات |
| D3 | معاينة Apple/Google Wallet «حقيقية» | معاينة محلية مطابقة بصريًا + توليد ملفات فعلية البنية | §12 من المصدر يمنع خدمات خارج الستاك، وGoogle preview يحتاج Issuer |
| D4 | مصادقة Staff بـPIN | جلسة Supabase + تحقّق PIN على السيرفر (`pin_hash`) | تكامل نظيف مع RLS (§9 من المصدر) بلا نظام auth موازٍ |

## 4. Non-negotiables (تُحترم دائمًا)

- §12 «What You Must Not Do» كاملًا — **قائمة حمراء**، وأي انحراف = رفض.
- RLS على **كل** جدول، مفتاح `merchant_id`، وليس في الواجهة فقط.
- لا بيانات شخصية في باركود الـpass (الـ`serialNumber` فقط).
- لا تتبّع موقع من السيرفر إطلاقًا؛ منطق الموقع داخل الـpass فقط.
- `Transactions` append-only، والرصيد لا يُعدّل إلا عبر معاملة.
- idempotency key على كل معاملة (منع التسجيل المزدوج).
- tokens/PINs مُهشّرة، والأسرار في secret manager فقط.
- كل نص عربي بلا letter-spacing، وأرقام غربية، وخصائص CSS منطقية فقط.

## 5. Open Decisions (تعوق التنفيذ الكامل)

| ID | القرار | الأثر | الحالة |
|---|---|---|---|
| Q1 | مكتبة i18n (`next-intl` vs كتالوج داخلي) | يمسّ كل صفحة | PROPOSED: داخلي بلا اعتماد جديد |
| Q2 | Supabase region | data residency + latency | UNKNOWN |
| Q3 | `points_per_unit` وطريقة التقريب | منطق كسب النقاط | UNKNOWN |
| Q4 | سلوك اليوم الثامن بعد `past_due` | §11 | UNKNOWN |
| Q5 | الشعار العربي | يمسّ كل الواجهة | PROPOSED «المس. اجمع. استبدل.» |

## 6. Verification Strategy (محليًا)

| الطبقة | الأداة | الحالة |
|---|---|---|
| Types/lint | `tsc --noEmit` · `next lint` | متاح |
| RLS/DB | SQL على Supabase + harness يثبت القدرة على الفشل | متاح |
| UI/RTL | `/style` page + لقطات عند 360px | متاح |
| Wallet | assertions على بنية `.pkpass` (manifest SHA-1، الملفات، signature غير فارغ) + JSON الخاص بـGoogle | متاح (mock) |
| Build كامل | `next build` | **غير موثوق على هذا الجهاز** ⇒ يُنقل إلى CI |
