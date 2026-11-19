# Anbarnet

A multi-warehouse online store with its own accounting. Persian, right-to-left.
You build it by talking to Claude Code. Start with `/next`.

<!--
  Persian section layout rule: GitHub ignores dir="rtl" on lists and code blocks.
  So: no markdown lists here (use tables or paragraphs), commands only in their own table
  column or code block, never inside a Persian sentence.
-->

<div dir="rtl">

## راهنمای فارسی (برای علیرضا)

### این پروژه چیست؟

انبارنت یک فروشگاه آنلاین چند انباری است، با حسابداری خودش.

شما برنامه‌نویسی نمی‌کنید. با Claude فارسی حرف می‌زنید و Claude کد را می‌نویسد.

کار شما: بگویید فروشگاه **چه کاری** باید بکند، و نتیجه را روی سایت امتحان کنید.

### راه‌اندازی (فقط یک بار، حدود ۳۰ دقیقه)

مرحله‌ها را به ترتیب انجام دهید. دستورها را در ترمینال ویندوز (PowerShell) بنویسید.

اگر مرحله‌ای خطا داد، متن خطا را برای Claude بفرستید و بنویسید: «این خطا را درست کن».

| مرحله | چه کار کنید | دستور یا لینک | نتیجه‌ی درست |
| :---: | --- | --- | --- |
| ۱ | نصب گیت | https://git-scm.com/download/win | دستور `git --version` یک شماره نشان می‌دهد |
| ۲ | نصب نود (نسخه‌ی ۲۴) | https://nodejs.org | دستور `node -v` با `v24` شروع می‌شود |
| ۳ | ترمینال را با Run as Administrator باز کنید و این را بزنید | `corepack enable` | دستور `pnpm -v` یک شماره نشان می‌دهد |
| ۴ | نصب و باز کردن داکر | https://www.docker.com/products/docker-desktop | در داکر نوشته: Engine running |
| ۵ | نصب گیت‌هاب | `winget install --id GitHub.cli` | نصب تمام می‌شود |
| ۶ | ورود به گیت‌هاب (گزینه‌های GitHub.com و HTTPS را انتخاب کنید) | `gh auth login` | دستور `gh auth status` می‌گوید Logged in |
| ۷ | نصب Claude Code و ورود با حساب Claude خودتان | https://claude.com/claude-code | دستور `claude` باز می‌شود |
| ۸ | گرفتن کد پروژه | `gh repo clone masioos/masioos1 anbarnet` | پوشه‌ی anbarnet ساخته می‌شود |
| ۹ | رفتن به پوشه‌ی پروژه | `cd anbarnet` | — |
| ۱۰ | نصب بسته‌ها | `pnpm install` | در آخر می‌بینید: Done |
| ۱۱ | راه‌اندازی پایگاه داده | `pnpm setup:local` | در آخر می‌بینید: ready |
| ۱۲ | روشن کردن سایت | `pnpm dev` | سایت در http://localhost:3000 باز می‌شود |

### کار هر روز

| مرحله | چه کار کنید | دستور |
| :---: | --- | --- |
| ۱ | داکر را باز کنید | — |
| ۲ | در پوشه‌ی anbarnet، Claude را باز کنید | `claude` |
| ۳ | این را بنویسید. Claude می‌گوید قدم بعدی چیست و شروع می‌کند | `/next` |

### یک قابلیت چطور ساخته می‌شود؟

</div>

```
idea → /grill → /plan → /build → you test it → /review → /ship
```

<div dir="rtl">

| قدم | دستور | چه اتفاقی می‌افتد | کار شما |
| :---: | --- | --- | --- |
| ۱ | `/grill` | Claude درباره‌ی ایده‌تان سؤال می‌پرسد، هر بار یک سؤال، با گزینه‌ی پیشنهادی | جواب بدهید، با شماره‌ی گزینه یا به زبان خودتان. در آخر خلاصه را تأیید کنید |
| ۲ | `/plan` | Claude نقشه‌ی فنی را می‌نویسد | هیچ |
| ۳ | `/build` | Claude کد را می‌نویسد و تست می‌کند | سایت را طبق راهنمای Claude امتحان کنید |
| ۴ | `/review` | یک Claude دیگر کد را بررسی و ایرادها را درست می‌کند | هیچ |
| ۵ | `/ship` | کار در گیت‌هاب ثبت و به نسخه‌ی اصلی اضافه می‌شود | هیچ |

لازم نیست این دستورها را حفظ کنید. دستور `/next` خودش قدم درست را انتخاب می‌کند.

می‌توانید معمولی هم حرف بزنید. مثال: «می‌خواهم مشتری بتواند کالای ناموجود را درخواست کند.»

### چند قانون ساده

**ایده‌ی جدید؟** دستور `/next` را بزنید و ایده‌تان را بنویسید. Claude اول سؤال می‌پرسد، بعد می‌سازد.

**هر بار یک قابلیت.** تا قدم آخر تمام نشده، قابلیت بعدی را شروع نکنید.

**قبل از ثبت، سایت را امتحان کنید** و به Claude بگویید درست است یا نه.

**هر چیزی درباره‌ی پول** (قیمت، کارت، درگاه، ۱۵ درصد، حسابداری): Claude قبل از ساخت از شما می‌پرسد. با دقت جواب بدهید.

**رمز، شماره‌ی کارت واقعی یا اطلاعات مشتری** را در چت ننویسید.

**گیر کردید؟** بنویسید «توضیح بده چه کردی»، یا به امیر پیام بدهید.

### کارهایی که فعلاً ساخته شده

صفحه‌ی مدیریت انبارها: http://localhost:3000/admin/warehouses

بقیه‌ی بخش‌ها (کالا، قیمت، سبد خرید، سفارش، پرداخت، حسابداری) با دستور `/next` یکی‌یکی ساخته می‌شوند.

</div>

---

## Set up a Windows PC (one time, ~30 min)

Do these in order. Each step says what you should see.

1. Install **Git**: https://git-scm.com/download/win → in a new terminal, `git --version` prints a version.
2. Install **Node.js 24 LTS**: https://nodejs.org → `node -v` prints `v24...`.
3. Turn on **pnpm**: run `corepack enable` in a terminal opened as Administrator → `pnpm -v` prints a version.
4. Install **Docker Desktop**: https://www.docker.com/products/docker-desktop → open it; the whale icon says "Engine running".
5. Install **GitHub CLI**: `winget install --id GitHub.cli` → then run `gh auth login`, pick GitHub.com, HTTPS, log in with the browser → `gh auth status` says "Logged in".
6. Install **Claude Code** and log in with your Claude account: https://claude.com/claude-code → `claude` opens.
7. Get the code: `gh repo clone masioos/masioos1 anbarnet` then `cd anbarnet`.
8. Install packages: `pnpm install` → ends with "Done".
9. Start the database and set it up: `pnpm setup:local` → ends with "✔ ready".
10. Start the site: `pnpm dev` → open http://localhost:3000.

## Every day

1. Open Docker Desktop.
2. In the `anbarnet` folder run `claude`.
3. Type `/next`. Claude tells you what is next and asks you questions in Persian.

## Commands

| Command              | What it does                                    |
| -------------------- | ----------------------------------------------- |
| `pnpm dev`           | runs the site at http://localhost:3000          |
| `pnpm check`         | typecheck + lint + tests — must be green        |
| `pnpm setup:local`   | first-time database setup                       |
| `pnpm db:generate`   | makes a migration after a `schema.ts` change    |
| `pnpm db:migrate`    | applies migrations to the local database        |
| `pnpm db:studio`     | opens a browser view of the database            |

## For developers

Read `AGENTS.md` (rules), `ARCHITECTURE.md` (shape) and `CONTEXT.md` (words).
