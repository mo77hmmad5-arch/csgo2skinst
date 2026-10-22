# جمر (SkinBox)

موقع صناديق وسكنات ألعاب بهوية حمراء/سوداء: خادم Fastify + PostgreSQL (Prisma) وواجهة عربية RTL.

> **تنبيه:** المشروع يعمل حاليًا في وضع **Sandbox** (أرصدة تجريبية فقط، بلا دفع حقيقي). فتح الصناديق بمال حقيقي قد يُعدّ قمارًا في بلدك، وتحظره شروط Steam. راجع الجانب القانوني قبل تفعيل أي دفع حقيقي.

## التشغيل بـ Docker (الأسهل)
```bash
docker compose up --build
# ثم افتح http://localhost:3000
```

## التشغيل المحلي
```bash
cp .env.example .env
docker compose up -d db          # أو استخدم PostgreSQL لديك
npm install
npx prisma migrate dev --name init   # يولّد الجداول (مجلد 20260101000001_init)
npm run db:seed                   # الأدوار + صناديق تجريبية
npm run dev                       # http://localhost:3000
```
> مجلد `prisma/migrations/20260101000002_integrity` (المشغّلات والقيود) يجب أن يأتي **بعد** ترحيل `init`. إن ولّد Prisma اسمًا بتاريخ لاحق فأعد تسمية مجلد integrity ليكون أحدث منه.

## ما الموجود الآن
- صفحات: الصناديق، صفحة الصندوق مع بكرة الفتح والاحتمالات، المخزون، المحفظة وسجل الحركات، العدالة.
- فتح الصندوق على الخادم بمعاملة واحدة، دفتر حركات ثابت، Idempotency، نسخ مؤرخة للصناديق، RBAC.
- جلسات `HttpOnly` وحماية Origin وRate limit وCSP، وإدارة موافقة الكوكيز.
- CI على GitHub Actions (`typecheck` و`test`).

## ما لم يُبنَ بعد
الدخول عبر Steam وGoogle، الدفع والسحب الحقيقيان، لوحة الإدارة، Trade Offers.

## الرفع إلى GitHub
```bash
git remote add origin https://github.com/<user>/skinbox.git
git branch -M main
git push -u origin main
```
