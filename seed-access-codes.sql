-- رموز V3. يتم تخزين SHA-256 فقط داخل قاعدة البيانات.
-- نفّذ هذا الملف بعد schema.sql.
insert into public.access_codes(code_hash,role,display_name,active) values('51f27c5c458d7b3e4b11acfea38aee17d65bc7e1610fb32681911d76856a9205','admin','المشرف العام',true) on conflict(code_hash) do update set role=excluded.role,display_name=excluded.display_name,active=true;
insert into public.access_codes(code_hash,role,display_name,active) values('7db0bcefc642dcc87080b1b59fc67a5cf90f87d8de78fb940c24aee94b31620a','admin','المشرف العام',true) on conflict(code_hash) do update set role=excluded.role,display_name=excluded.display_name,active=true;
insert into public.access_codes(code_hash,role,display_name,active) values('a55fb8a941f1f9ebf2b6c38b7ea9df3ddf078feeb4ebce3427bf5dd37cfc1088','admin','المشرف العام',true) on conflict(code_hash) do update set role=excluded.role,display_name=excluded.display_name,active=true;
insert into public.access_codes(code_hash,role,display_name,active) values('f0dcb254342fe048e8742235a997f097a1ecf2ce30dbe872f0735792c5ae26ed','user','مستخدم القرية',true) on conflict(code_hash) do update set role=excluded.role,display_name=excluded.display_name,active=true;
