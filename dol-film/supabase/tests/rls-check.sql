\set ON_ERROR_STOP on
insert into auth.users values ('11111111-1111-1111-1111-111111111111','a@x'),('22222222-2222-2222-2222-222222222222','b@x');
select 'profiles auto-created: ' || count(*) from public.profiles;
insert into public.orders (user_id, template_id, nickname, caption, amount, consents, contact_phone)
values ('11111111-1111-1111-1111-111111111111','fairy','서아','첫 번째 생일 축하해',49000,'{}','01012345678'),
       ('22222222-2222-2222-2222-222222222222','space','도윤','생일 축하해',54000,'{}',null);
-- 사용자 A로 접속
set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select 'A sees orders: ' || count(*) || ' (expect 1)' from public.orders;
select 'A sees share_links: ' || count(*) || ' (expect 0)' from public.share_links;
select 'A sees admin_audit: ' || count(*) || ' (expect 0)' from public.admin_audit;
select 'A sees profiles: ' || count(*) || ' (expect 1)' from public.profiles;
do $$ begin
  begin update public.orders set amount = 1; raise notice 'update rows affected: %', (select count(*) from public.orders where amount = 1);
  exception when others then raise notice 'update blocked: %', sqlerrm; end;
  begin insert into public.orders (user_id, template_id, nickname, caption, amount, consents) values (auth.uid(),'fairy','x','y',1,'{}'); raise notice 'INSERT WAS ALLOWED (bad)';
  exception when others then raise notice 'insert blocked: %', sqlerrm; end;
  begin update public.profiles set is_admin = true; raise notice 'profiles admin rows now: %', (select count(*) from public.profiles where is_admin);
  exception when others then raise notice 'profile update blocked: %', sqlerrm; end;
end $$;
reset role;
select 'admin flags true (expect 0): ' || count(*) from public.profiles where is_admin;
select 'amount tampered (expect 0): ' || count(*) from public.orders where amount = 1;
-- 익명
set role anon; select set_config('request.jwt.claim.sub','',false);
select 'anon sees orders: ' || count(*) || ' (expect 0)' from public.orders;
reset role;
-- 제약조건
do $$ begin
  begin insert into public.orders (user_id, template_id, nickname, caption, amount, consents, contact_phone) values ('11111111-1111-1111-1111-111111111111','fairy','서아','c',1000,'{}','010-1234'); raise notice 'BAD PHONE ACCEPTED';
  exception when check_violation then raise notice 'bad phone rejected'; end;
  begin insert into public.orders (user_id, template_id, nickname, caption, amount, consents, status) values ('11111111-1111-1111-1111-111111111111','fairy','서아','c',1000,'{}','hacked'); raise notice 'BAD STATUS ACCEPTED';
  exception when check_violation then raise notice 'bad status rejected'; end;
end $$;
update public.orders set status='paid' where nickname='서아' returning 'updated_at touched: ' || (updated_at >= created_at);
select id, public, file_size_limit, allowed_mime_types from storage.buckets;
