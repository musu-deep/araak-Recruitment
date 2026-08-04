# بوابة التوظيف الرقمية — مجموعة اراك للتنمية

نموذج رقمي متعدد اللغات لطلبات التوظيف الخارجي في مجموعة اراك وشركاتها.

## رابط التشغيل

`https://araak-recruitment.onrender.com/`

## أهم الخصائص

- واجهة عربية حديثة مع الإنجليزية والفرنسية.
- شعار وهوية مجموعة اراك في رأس الصفحة.
- المسمى الوظيفي والقسم حقول اختيارية، والنجمة الحمراء للحقول الإلزامية فقط.
- حقول ميلاد وهوية وسفر قابلة للتعبئة مع قواعد مختلفة للمتقدم داخل المملكة وخارجها.
- قائمة جنسيات وحذف حقل الديانة.
- شرح واضح للمُعالين مع إمكانية إضافة أكثر من مُعال.
- حقول ديناميكية لإضافة الخبرات والمؤهلات والدورات واللغات والمهارات والمراجع.
- رفع السيرة الذاتية في البداية والتعبئة الذكية عبر Edge Function باسم `parse-cv`.
- رفع السيرة والشهادات إلى Supabase Storage.
- أسئلة مباشرة تشمل الجاهزية، آخر ثلاث وظائف، والراتب المتوقع.
- اقتراح موعد مقابلة عن بعد، على أن يعتمد فريق الموارد البشرية الموعد النهائي.
- إقرار قانوني وتوقيع إلكتروني بالاسم أو بالرسم.
- حفظ المسودة تلقائياً في المتصفح قبل الإرسال.

## مسار البيانات

1. يحفظ الطلب في جدول `employment_applications`.
2. تحفظ بيانات المرفقات في `employment_attachments` والملفات داخل `employment-attachments`.
3. يحفظ طلب المقابلة في `meeting_requests`.
4. تستدعى دالة `process-recruitment-submission` لإرسال إشعار الموارد البشرية ورسالة تأكيد للمتقدم.
5. يمكن إرسال نسخة إلى البريد المستعار لتطبيق Recruitment في Odoo Standard عبر `ODOO_RECRUITMENT_ALIAS`.

## إعداد Render

ملف `render.yaml` يجهز الموقع الثابت ويولّد `runtime-config.js` من المتغيرات التالية:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
STORAGE_BUCKET=employment-attachments
PROCESS_FUNCTION=process-recruitment-submission
PARSE_FUNCTION=parse-cv
ODOO_RECRUITMENT_ALIAS=
```

لا يوضع `service_role` أو أي مفتاح سري في Render أو في المتصفح.

## إعداد Supabase

1. شغّل `supabase.sql` من SQL Editor مرة واحدة.
2. انشر الدالتين:

```bash
supabase functions deploy parse-cv
supabase functions deploy process-recruitment-submission
```

3. أضف أسرار Edge Functions بحسب الخدمات المراد تفعيلها:

```env
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.6-flash
RESEND_API_KEY=...
FROM_EMAIL=Araak Recruitment <recruitment@your-domain.com>
HR_EMAIL=louiabdalla1@gmail.com
ODOO_RECRUITMENT_ALIAS=
```

مفتاح Gemini مطلوب فقط للتعبئة الذكية، ومفتاح Resend مطلوب فقط لإشعارات البريد. يظل حفظ الطلبات في Supabase فعالاً حتى عند عدم تفعيل خدمات البريد أو الذكاء الاصطناعي.

## التشغيل المحلي

```bash
node scripts/verify-bundle.mjs
node scripts/build-config.mjs
python -m http.server 8080
```

ثم افتح `http://localhost:8080`.
