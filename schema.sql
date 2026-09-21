-- برنامج خدمات قرية الحرية V3
-- نظام دخول بالرموز + جلسات موقعة عشوائياً داخل قاعدة البيانات.
-- لا يحتاج Supabase Auth للمستخدمين النهائيين.
-- مهم: نفّذ هذا الملف كاملاً في SQL Editor مرة واحدة.

create extension if not exists pgcrypto;

drop function if exists public.login_by_code(text);
drop function if exists public.validate_session(text);
drop function if exists public.logout_session(text);
drop function if exists public.submit_complaint(text,text,text);
drop function if exists public.submit_suggestion(text,text,text);
drop function if exists public.get_my_complaints(text);
drop function if exists public.get_my_suggestions(text);
drop function if exists public.admin_get_complaints(text);
drop function if exists public.admin_get_suggestions(text);
drop function if exists public.admin_create_news(text,text,text);
drop function if exists public.admin_save_prayer(text,date,text,text,text,text,text,text);
drop function if exists public.admin_create_service(text,text,text);
drop function if exists public.admin_create_event(text,text,text,text);
drop function if exists public.admin_create_emergency(text,text,text,text);
drop function if exists public.admin_set_about(text,text);
drop function if exists public.admin_update_complaint_status(text,uuid,text);

create table if not exists public.access_codes(
  id uuid primary key default gen_random_uuid(),
  code_hash text unique not null,
  role text not null check(role in ('admin','user')),
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles(
  id uuid primary key default gen_random_uuid(),
  access_code_id uuid unique references public.access_codes(id) on delete set null,
  display_name text not null,
  role text not null check(role in ('admin','user')),
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.login_sessions(
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists login_sessions_token_hash_idx on public.login_sessions(token_hash);
create index if not exists login_sessions_expires_idx on public.login_sessions(expires_at);

create table if not exists public.news(
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.prayer_times(
  id uuid primary key default gen_random_uuid(),
  prayer_date date unique not null,
  fajr text, sunrise text, dhuhr text, asr text, maghrib text, isha text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.services(
  id uuid primary key default gen_random_uuid(),
  name text not null, description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.events(
  id uuid primary key default gen_random_uuid(),
  title text not null, event_at timestamptz, description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.emergency_contacts(
  id uuid primary key default gen_random_uuid(),
  name text not null, phone text not null, description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.app_settings(
  key text primary key,
  value text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.complaints(
  id uuid primary key default gen_random_uuid(),
  reference_no text unique not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  status text not null default 'جديدة',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists complaints_user_idx on public.complaints(user_id);

create table if not exists public.suggestions(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  status text not null default 'جديد',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists suggestions_user_idx on public.suggestions(user_id);

-- منع الوصول المباشر للبيانات الحساسة، مع السماح بالقراءة العامة للمحتوى المنشور.
alter table public.access_codes enable row level security;
alter table public.profiles enable row level security;
alter table public.login_sessions enable row level security;
alter table public.news enable row level security;
alter table public.prayer_times enable row level security;
alter table public.services enable row level security;
alter table public.events enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.app_settings enable row level security;
alter table public.complaints enable row level security;
alter table public.suggestions enable row level security;

drop policy if exists "public_read_news" on public.news;
create policy "public_read_news" on public.news for select to anon, authenticated using (true);
drop policy if exists "public_read_prayer" on public.prayer_times;
create policy "public_read_prayer" on public.prayer_times for select to anon, authenticated using (true);
drop policy if exists "public_read_services" on public.services;
create policy "public_read_services" on public.services for select to anon, authenticated using (true);
drop policy if exists "public_read_events" on public.events;
create policy "public_read_events" on public.events for select to anon, authenticated using (true);
drop policy if exists "public_read_emergency" on public.emergency_contacts;
create policy "public_read_emergency" on public.emergency_contacts for select to anon, authenticated using (true);
drop policy if exists "public_read_settings" on public.app_settings;
create policy "public_read_settings" on public.app_settings for select to anon, authenticated using (true);

-- لا توجد سياسات مباشرة للكتابة أو القراءة على الجداول الحساسة؛ العمليات تمر عبر RPCs أدناه.
revoke all on public.access_codes from anon, authenticated;
revoke all on public.profiles from anon, authenticated;
revoke all on public.login_sessions from anon, authenticated;
revoke all on public.complaints from anon, authenticated;
revoke all on public.suggestions from anon, authenticated;
revoke insert, update, delete on public.news from anon, authenticated;
revoke insert, update, delete on public.prayer_times from anon, authenticated;
revoke insert, update, delete on public.services from anon, authenticated;
revoke insert, update, delete on public.events from anon, authenticated;
revoke insert, update, delete on public.emergency_contacts from anon, authenticated;
revoke insert, update, delete on public.app_settings from anon, authenticated;

create or replace function public._hash_text(p_text text)
returns text language sql immutable security definer set search_path=public
as $$ select encode(digest(coalesce(p_text,''),'sha256'),'hex') $$;

create or replace function public._session_profile(p_token text)
returns table(profile_id uuid, role text, display_name text)
language plpgsql security definer set search_path=public
as $$
declare v_hash text;
begin
  if p_token is null or length(trim(p_token)) < 20 then return; end if;
  v_hash:=public._hash_text(trim(p_token));
  return query
    select p.id,p.role,p.display_name
    from public.login_sessions s
    join public.profiles p on p.id=s.profile_id
    where s.token_hash=v_hash and s.expires_at>now()
    limit 1;
end $$;

create or replace function public.login_by_code(p_code text)
returns table(user_id uuid, role text, display_name text, session_token text)
language plpgsql security definer set search_path=public
as $$
declare
  v_code public.access_codes%rowtype;
  v_profile public.profiles%rowtype;
  v_token text;
begin
  select * into v_code
  from public.access_codes
  where active=true and code_hash=public._hash_text(trim(p_code))
  limit 1;

  if not found then return; end if;

  select * into v_profile from public.profiles where access_code_id=v_code.id limit 1;
  if not found then
    insert into public.profiles(access_code_id,display_name,role)
    values(v_code.id,v_code.display_name,v_code.role)
    returning * into v_profile;
  else
    update public.profiles set display_name=v_code.display_name,role=v_code.role,last_login_at=now()
    where id=v_profile.id
    returning * into v_profile;
  end if;

  v_token:=encode(gen_random_bytes(32),'hex');
  insert into public.login_sessions(profile_id,token_hash,expires_at)
  values(v_profile.id,public._hash_text(v_token),now()+interval '30 days');

  delete from public.login_sessions where expires_at<=now();

  return query select v_profile.id,v_profile.role,v_profile.display_name,v_token;
end $$;

create or replace function public.validate_session(p_token text)
returns table(user_id uuid, role text, display_name text)
language sql security definer set search_path=public
as $$ select profile_id,role,display_name from public._session_profile(p_token) $$;

create or replace function public.logout_session(p_token text)
returns boolean language plpgsql security definer set search_path=public
as $$
begin
  delete from public.login_sessions where token_hash=public._hash_text(trim(p_token));
  return true;
end $$;

create or replace function public.submit_complaint(p_token text,p_title text,p_body text)
returns table(reference_no text)
language plpgsql security definer set search_path=public
as $$
declare v_profile record; v_ref text;
begin
  select * into v_profile from public._session_profile(p_token) limit 1;
  if not found or v_profile.role<>'user' then raise exception 'غير مصرح بإرسال الشكوى'; end if;
  if length(trim(coalesce(p_title,'')))<2 or length(trim(coalesce(p_body,'')))<2 then raise exception 'أكمل بيانات الشكوى'; end if;
  v_ref:='FV-'||to_char(now(),'YYMMDDHH24MISS')||'-'||upper(substr(encode(gen_random_bytes(3),'hex'),1,6));
  insert into public.complaints(reference_no,user_id,title,body)
  values(v_ref,v_profile.profile_id,trim(p_title),trim(p_body));
  return query select v_ref;
end $$;

create or replace function public.submit_suggestion(p_token text,p_title text,p_body text)
returns boolean language plpgsql security definer set search_path=public
as $$
declare v_profile record;
begin
  select * into v_profile from public._session_profile(p_token) limit 1;
  if not found or v_profile.role<>'user' then raise exception 'غير مصرح بإرسال المقترح'; end if;
  insert into public.suggestions(user_id,title,body)
  values(v_profile.profile_id,trim(p_title),trim(p_body));
  return true;
end $$;

create or replace function public.get_my_complaints(p_token text)
returns setof public.complaints language plpgsql security definer set search_path=public
as $$
declare v_profile record;
begin
  select * into v_profile from public._session_profile(p_token) limit 1;
  if not found then raise exception 'جلسة غير صالحة'; end if;
  return query select * from public.complaints where user_id=v_profile.profile_id order by created_at desc;
end $$;

create or replace function public.get_my_suggestions(p_token text)
returns setof public.suggestions language plpgsql security definer set search_path=public
as $$
declare v_profile record;
begin
  select * into v_profile from public._session_profile(p_token) limit 1;
  if not found then raise exception 'جلسة غير صالحة'; end if;
  return query select * from public.suggestions where user_id=v_profile.profile_id order by created_at desc;
end $$;

create or replace function public._require_admin(p_token text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_profile record;
begin
  select * into v_profile from public._session_profile(p_token) limit 1;
  if not found or v_profile.role<>'admin' then raise exception 'صلاحية المشرف مطلوبة'; end if;
  return v_profile.profile_id;
end $$;

create or replace function public.admin_get_complaints(p_token text)
returns setof public.complaints language plpgsql security definer set search_path=public
as $$ begin perform public._require_admin(p_token); return query select * from public.complaints order by created_at desc; end $$;

create or replace function public.admin_get_suggestions(p_token text)
returns setof public.suggestions language plpgsql security definer set search_path=public
as $$ begin perform public._require_admin(p_token); return query select * from public.suggestions order by created_at desc; end $$;

create or replace function public.admin_create_news(p_token text,p_title text,p_body text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_admin uuid; v_id uuid;
begin
  v_admin:=public._require_admin(p_token);
  insert into public.news(title,body,created_by) values(trim(p_title),trim(p_body),v_admin) returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_save_prayer(p_token text,p_prayer_date date,p_fajr text,p_sunrise text,p_dhuhr text,p_asr text,p_maghrib text,p_isha text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_admin uuid; v_id uuid;
begin
  v_admin:=public._require_admin(p_token);
  insert into public.prayer_times(prayer_date,fajr,sunrise,dhuhr,asr,maghrib,isha,created_by)
  values(p_prayer_date,p_fajr,p_sunrise,p_dhuhr,p_asr,p_maghrib,p_isha,v_admin)
  on conflict(prayer_date) do update set fajr=excluded.fajr,sunrise=excluded.sunrise,dhuhr=excluded.dhuhr,asr=excluded.asr,maghrib=excluded.maghrib,isha=excluded.isha,created_by=excluded.created_by
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_create_service(p_token text,p_name text,p_description text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_admin uuid; v_id uuid;
begin
  v_admin:=public._require_admin(p_token);
  insert into public.services(name,description,created_by) values(trim(p_name),trim(p_description),v_admin) returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_create_event(p_token text,p_title text,p_event_at text,p_description text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_admin uuid; v_id uuid; v_date timestamptz;
begin
  v_admin:=public._require_admin(p_token);
  if nullif(trim(p_event_at),'') is null then v_date:=null; else v_date:=p_event_at::timestamptz; end if;
  insert into public.events(title,event_at,description,created_by) values(trim(p_title),v_date,trim(p_description),v_admin) returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_create_emergency(p_token text,p_name text,p_phone text,p_description text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_admin uuid; v_id uuid;
begin
  v_admin:=public._require_admin(p_token);
  insert into public.emergency_contacts(name,phone,description,created_by) values(trim(p_name),trim(p_phone),trim(p_description),v_admin) returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_set_about(p_token text,p_value text)
returns boolean language plpgsql security definer set search_path=public
as $$
declare v_admin uuid;
begin
  v_admin:=public._require_admin(p_token);
  insert into public.app_settings(key,value,updated_by,updated_at)
  values('about',coalesce(p_value,''),v_admin,now())
  on conflict(key) do update set value=excluded.value,updated_by=excluded.updated_by,updated_at=now();
  return true;
end $$;

create or replace function public.admin_update_complaint_status(p_token text,p_complaint_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path=public
as $$
begin
  perform public._require_admin(p_token);
  if p_status not in ('جديدة','قيد المراجعة','قيد المعالجة','تم الحل','مغلقة') then raise exception 'حالة غير صالحة'; end if;
  update public.complaints set status=p_status,updated_at=now() where id=p_complaint_id;
  return found;
end $$;

-- الصلاحيات اللازمة لاستدعاء RPC من المتصفح.
grant usage on schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
grant select on public.news,public.prayer_times,public.services,public.events,public.emergency_contacts,public.app_settings to anon, authenticated;
