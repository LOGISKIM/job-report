-- 첫돌필름 MVP 초기 스키마
-- 원칙: 브라우저(사용자)는 "자기 주문 읽기"만 할 수 있고, 모든 쓰기는 서버(비밀 키)에서만 한다.

-- 1) 프로필: 관리자 여부만 보관
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "본인 프로필 읽기" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- 가입 시 프로필 자동 생성
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) 주문
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  template_id text not null,
  moods text[] not null default '{}',
  custom_request text check (char_length(custom_request) <= 300),
  nickname text not null check (char_length(nickname) between 1 and 10),
  caption text not null check (char_length(caption) between 1 and 24),
  music smallint not null default 0,
  contact_phone text check (contact_phone ~ '^01[0-9]{8,9}$'),
  amount integer not null check (amount > 0),
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'in_production', 'review', 'delivered', 'canceled')),
  consents jsonb not null,
  sample_consent boolean not null default false,
  photo_count smallint not null default 0,
  payment_key text,
  paid_at timestamptz,
  result_path text,
  delivered_at timestamptz,
  revision_left smallint not null default 1,
  revision_request text check (char_length(revision_request) <= 500),
  photos_purge_after timestamptz,
  photos_deleted_at timestamptz,
  result_purge_after timestamptz,
  result_deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_user_id_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);

alter table public.orders enable row level security;

-- 사용자는 자기 주문만 읽을 수 있다. insert/update/delete 정책이 없으므로 브라우저에서는 쓰기 불가.
create policy "본인 주문 읽기" on public.orders
  for select to authenticated
  using (user_id = (select auth.uid()));

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- 3) 가족 공유 링크: 정책 없음 = 서버에서만 접근
create table public.share_links (
  token text primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.share_links enable row level security;

-- 4) 관리자 열람 기록: 누가 언제 어떤 주문의 사진을 봤는지
create table public.admin_audit (
  id bigint generated always as identity primary key,
  admin_id uuid not null references auth.users (id),
  order_id uuid references public.orders (id) on delete set null,
  action text not null,
  created_at timestamptz not null default now()
);

alter table public.admin_audit enable row level security;

-- 5) 저장소: 둘 다 비공개. 업로드는 서버가 발급한 1회용 업로드 URL로만 가능하다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photos', 'photos', false, 10485760, array['image/jpeg']),
  ('results', 'results', false, 524288000, array['video/mp4']);
-- results 500MB 제한은 Supabase Pro 이상에서만 적용된다. 무료 플랜은 파일당 50MB가 최대이니
-- 무료로 시작할 때는 영상을 50MB 이하로 인코딩하자 (3분 1080p, 약 2Mbps).
