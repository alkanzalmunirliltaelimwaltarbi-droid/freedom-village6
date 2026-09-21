# إعداد Supabase — V3

**نفّذ `schema.sql` ثم `seed-access-codes.sql` بالترتيب.**

بعد التنفيذ، إذا ظهرت الدالة `public.login_by_code` في Database > Functions فلن يظهر خطأ schema cache الخاص بالإصدار السابق.

### رموز الاختبار
`FREEDOM-ADM-01`
`FREEDOM-ADM-02`
`FREEDOM-ADM-03`
`FREEDOM-USER`

### أمان
لا تستخدم service_role في `app.js`.
الرموز نفسها لا تُحفظ كنص صريح؛ ملف seed يحتوي على SHA-256 فقط.
