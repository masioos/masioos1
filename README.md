# Anbarnet

A multi-warehouse online store with its own accounting. Persian, right-to-left.
You build it by talking to Claude Code. Start with `/next`.

<div dir="rtl">

## راهنمای فارسی (برای علیرضا)

### این پروژه چیست؟

انبارنت یک فروشگاه آنلاین چند انباری است، با حسابداری خودش. شما برنامه‌نویسی نمی‌کنید؛
با **Claude Code** فارسی حرف می‌زنید و Claude کد را می‌نویسد. کار شما این است که بگویید
فروشگاه **چه کاری** باید بکند، و نتیجه را روی سایت امتحان کنید.

### راه‌اندازی (فقط یک بار، حدود ۳۰ دقیقه)

مرحله‌ها را به ترتیب انجام دهید. بعد از هر مرحله، نتیجه‌ی گفته‌شده را ببینید.
دستورها را در **Terminal** ویندوز (PowerShell) بنویسید.

1. **Git** را نصب کنید: https://git-scm.com/download/win ← در یک ترمینال تازه، `git --version` یک شماره نسخه نشان می‌دهد.
2. **Node.js 24 LTS** را نصب کنید: https://nodejs.org ← `node -v` عبارت `v24...` را نشان می‌دهد.
3. ترمینال را با **Run as Administrator** باز کنید و `corepack enable` را بزنید ← `pnpm -v` یک شماره نشان می‌دهد.
4. **Docker Desktop** را نصب کنید و باز کنید: https://www.docker.com/products/docker-desktop ← پایین برنامه نوشته "Engine running".
5. **GitHub CLI** را نصب کنید: `winget install --id GitHub.cli` ← بعد `gh auth login` را بزنید، `GitHub.com` و `HTTPS` را انتخاب کنید و با مرورگر وارد شوید ← `gh auth status` می‌گوید "Logged in".
6. **Claude Code** را نصب کنید و با حساب Claude خودتان وارد شوید: https://claude.com/claude-code ← دستور `claude` باز می‌شود.
7. کد را بگیرید: `gh repo clone masioos/masioos1 anbarnet` و بعد `cd anbarnet`.
8. بسته‌ها را نصب کنید: `pnpm install` ← در آخر "Done" می‌بینید.
9. پایگاه داده را راه بیندازید: `pnpm setup:local` ← در آخر "✔ ready" می‌بینید.
10. سایت را روشن کنید: `pnpm dev` ← آدرس http://localhost:3000 را در مرورگر باز کنید.

اگر مرحله‌ای خطا داد، متن خطا را در Claude کپی کنید و بنویسید «این خطا را درست کن».

### کار هر روز

1. **Docker Desktop** را باز کنید.
2. در پوشه‌ی `anbarnet` دستور `claude` را بزنید.
3. بنویسید **`/next`**. همین. Claude می‌گوید قدم بعدی چیست و کار را شروع می‌کند.

### یک قابلیت چطور ساخته می‌شود؟

```
ایده ← /grill ← /plan ← /build ← شما امتحان می‌کنید ← /review ← /ship
```

| قدم | چه اتفاقی می‌افتد | کار شما |
| --- | --- | --- |
| `/grill` | Claude درباره‌ی ایده‌تان سؤال می‌پرسد، هر بار یک سؤال، با گزینه‌ی پیشنهادی | جواب بدهید، با شماره‌ی گزینه یا به زبان خودتان. در آخر خلاصه را تأیید کنید |
| `/plan` | Claude نقشه‌ی فنی را می‌نویسد | هیچ |
| `/build` | Claude کد را می‌نویسد و تست می‌کند | آخر کار، طبق راهنمای Claude سایت را امتحان کنید |
| `/review` | یک Claude دیگر کد را بررسی و ایرادها را درست می‌کند | هیچ |
| `/ship` | کار در GitHub ثبت و به نسخه‌ی اصلی اضافه می‌شود | هیچ |

لازم نیست این دستورها را حفظ کنید. **`/next`** خودش قدم درست را انتخاب می‌کند.
می‌توانید معمولی هم حرف بزنید، مثلاً: «می‌خواهم مشتری بتواند کالای ناموجود را درخواست کند.»

### چند قانون ساده

- **ایده‌ی جدید؟** فقط بنویسید `/next` و بعد ایده‌تان را. Claude اول سؤال می‌پرسد، بعد می‌سازد.
- **هر بار یک قابلیت.** تا `/ship` تمام نشده، قابلیت بعدی را شروع نکنید.
- **قبل از `/ship` حتماً سایت را امتحان کنید** و به Claude بگویید درست است یا نه.
- **هر چیزی درباره‌ی پول** (قیمت، کارت، درگاه، ۱۵٪، حسابداری): Claude قبل از ساخت از شما می‌پرسد. با دقت جواب بدهید.
- **رمز، شماره‌ی کارت واقعی یا اطلاعات مشتری** را در چت ننویسید.
- اگر گیر کردید یا Claude کاری کرد که نمی‌فهمید، بنویسید «توضیح بده چه کردی» یا به امیر پیام بدهید.

### کارهایی که فعلاً ساخته شده

- صفحه‌ی مدیریت انبارها: http://localhost:3000/admin/warehouses

بقیه‌ی بخش‌ها (کالا، قیمت، سبد خرید، سفارش، پرداخت، حسابداری) با `/next` یکی‌یکی ساخته می‌شوند.

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
