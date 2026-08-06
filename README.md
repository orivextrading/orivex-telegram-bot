# بوت Orivex على تليجرام (نسخة Vercel — مجاني بدون كارت)

بوت بيرد على المتدربين بأزرار جاهزة (الكورسات، الأسعار، الأسئلة الشائعة، حالة التسجيل)
+ رد ذكي بالـ AI لأي سؤال حر مش موجود في الأزرار.

هنا النسخة اللي بتشتغل على **Vercel** (مجانية بالكامل ومحتاجاش بطاقة بنكية).

## 1) اعمل البوت على تليجرام
1. افتح تليجرام وابحث عن **BotFather**
2. ابعتله `/newbot` واتبع الخطوات
3. هيديك **توكن** (Token) — احفظه

## 2) ارفع الملفات دي على GitHub
لو عندك repository قديم فيه ملفات النسخة التانية (index.js, package.json القديم)،
امسح الملفات القديمة وارفع بدالها:
- `academyData.js`
- `package.json` (النسخة الجديدة)
- مجلد `api` بالكامل (فيه `webhook.js` و `setup.js`)

## 3) اربطه بـ Vercel
1. روح [vercel.com](https://vercel.com) وسجل دخول بحساب **GitHub** (من غير كارت خالص)
2. دوس **"Add New" → "Project"**
3. اختار الـ repository بتاعك (`orivex-telegram-bot`)
4. سيب كل الإعدادات زي ما هي (Vercel بيكتشف إنه Node.js تلقائي، مفيش Build/Start Command يدوي)
5. قبل ما تدوس Deploy، افتح **"Environment Variables"** وضيف:

| الاسم | القيمة |
|---|---|
| `TELEGRAM_BOT_TOKEN` | التوكن من BotFather |
| `SUPABASE_URL` | `https://galqietgfuvwcawqcwza.supabase.co` |
| `SUPABASE_ANON_KEY` | `sb_publishable__ojs-sDZ7eThwPCcKs8oXg_8iEhVO8b` |
| `WEBSITE_URL` | `https://orivextrading.github.io/orivex/` |
| `WHATSAPP_NUMBER` | `201036824645` |
| `ANTHROPIC_API_KEY` | (سيبها فاضية دلوقتي لو لسه معملتهاش) |

6. دوس **"Deploy"** واستنى دقيقة

## 4) فعّل البوت (خطوة لازمة كل مرة تعمل Deploy جديد)
بعد ما الـ Deploy يخلص، هيديك رابط زي:
```
https://orivex-telegram-bot.vercel.app
```
افتح المتصفح واكتب نفس الرابط ده + `/api/setup`، يعني:
```
https://orivex-telegram-bot.vercel.app/api/setup
```
لو ظهرلك رسالة "✅ تم تفعيل البوت بنجاح" يبقى خلصت — روح كلم البوت على تليجرام دلوقتي وجرب.

## تحديث بيانات الكورسات أو الأسئلة الشائعة
كل بيانات الكورسات والـ FAQ في ملف `academyData.js`. عدّل فيه وارفعه تاني على GitHub،
Vercel بيعمل Deploy تلقائي لوحده كل مرة تحدّث فيها الملفات.

## ليه مفيش تأخير أو "نوم" زي Render المجاني؟
Vercel بتشغّل الكود لحظة ما رسالة توصل بس (مش سيرفر شغال طول الوقت)، فمفيش مفهوم
"استنى يصحى" أصلاً — كل رسالة بتتنفذ فورًا من غير أي تجهيز مسبق.

## ملاحظة عن التكلفة
- الأزرار والـ FAQ الثابتة: مجانية بالكامل، من غير أي حد استخدام يقلقك في المدى القريب
- الرد الذكي (AI): محتاج `ANTHROPIC_API_KEY` من console.anthropic.com (مدفوع بالاستخدام، تكلفة صغيرة جدًا لكل رسالة). من غيره، البوت بيوجّه أي سؤال حر لواتساب تلقائيًا.
