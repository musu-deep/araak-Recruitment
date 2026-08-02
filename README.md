# بوابة التوظيف الرقمية — مجموعة اراك للتنمية

بوابة عربية متجاوبة لنموذج التوظيف الدولي، تتضمن نموذجاً متعدد الخطوات، رفع المرفقات، طلب اجتماع، وحفظ المسودة تلقائياً.

## الحالة التشغيلية الحالية

- النشر: GitHub Pages عبر GitHub Actions.
- قناة الاستقبال الفورية: البريد الإداري `louiabdalla1@gmail.com` من خلال FormSubmit.
- قاعدة البيانات الموصى بها للإنتاج: Supabase.
- Odoo الحالي: `https://araakceo.odoo.com` بخطة Standard؛ لذلك الربط المباشر عبر External API غير مفعّل.
- الربط الممكن مع Odoo Standard: وضع البريد المستعار لوظيفة Recruitment داخل `ODOO_RECRUITMENT_ALIAS` في `config.js` بعد إنشائه من Odoo.

> ملاحظة: FormSubmit يرسل رسالة تفعيل إلى البريد الإداري عند أول استخدام. بعد اعتمادها تصبح قناة الاستقبال فعالة. لا توجد مفاتيح سرية داخل المستودع.

## رابط النشر المتوقع

`https://musu-deep.github.io/araak-Recruitment/`

## تفعيل Supabase لاحقاً

1. إنشاء مشروع Supabase.
2. تشغيل `supabase.sql` من SQL Editor.
3. وضع `SUPABASE_URL` و`SUPABASE_ANON_KEY` داخل `config.js`؛ وهما قيمتان عامتان للمتصفح.
4. نشر الدالة الموجودة في `supabase/functions/process-recruitment-submission`.
5. حفظ مفاتيح Odoo أو Resend في Supabase Secrets فقط، وعدم إضافتها إلى GitHub.

## التشغيل المحلي

```bash
python -m http.server 8080
```

ثم افتح `http://localhost:8080`.
