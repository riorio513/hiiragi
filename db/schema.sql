-- ヒイラギ（メロジョイ店舗監視ツール）のテーブル定義
-- 同じ Supabase プロジェクトを他アプリと共有しているため、専用スキーマに閉じ込める。
-- 何度実行しても壊れないよう、すべて IF NOT EXISTS で書く。

create schema if not exists hiiragi;

-- ── 利用者 ────────────────────────────────────────────────
create table if not exists hiiragi.users (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,
  password_hash   text not null,
  display_name    text not null default '',
  role            text not null default 'user',
  is_active       boolean not null default true,
  failed_logins   integer not null default 0,
  locked_until    timestamptz,
  reset_token_hash text,
  reset_expires_at timestamptz,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists hiiragi.user_settings (
  user_id        uuid primary key references hiiragi.users(id) on delete cascade,
  timezone       text not null default 'Asia/Tokyo',
  quiet_enabled  boolean not null default false,
  quiet_start    text not null default '22:00',
  quiet_end      text not null default '06:00',
  onboarded      boolean not null default false,
  updated_at     timestamptz not null default now()
);

-- 招待リンク（管理者が友人に配る）
create table if not exists hiiragi.invites (
  code        text primary key,
  created_by  uuid references hiiragi.users(id) on delete set null,
  note        text not null default '',
  max_uses    integer not null default 1,
  used_count  integer not null default 0,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- ── 販売場所 ──────────────────────────────────────────────
create table if not exists hiiragi.stores (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references hiiragi.users(id) on delete cascade,
  name        text not null,
  url         text not null default '',
  kind        text not null default 'other',
  is_official boolean not null default false,
  is_active   boolean not null default true,
  note        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists stores_user_idx on hiiragi.stores(user_id);

-- ── 公式アカウント（SNS等） ───────────────────────────────
create table if not exists hiiragi.official_accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references hiiragi.users(id) on delete cascade,
  name        text not null,
  url         text not null default '',
  platform    text not null default 'other',
  is_official boolean not null default true,
  store_id    uuid references hiiragi.stores(id) on delete set null,
  note        text not null default '',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists accounts_user_idx on hiiragi.official_accounts(user_id);

-- ── 商品 ──────────────────────────────────────────────────
create table if not exists hiiragi.products (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references hiiragi.users(id) on delete cascade,
  name                  text not null,
  description           text not null default '',
  image_url             text not null default '',
  target_price          integer,
  monitoring_enabled    boolean not null default true,
  notify_enabled        boolean not null default true,
  sale_starts_at        timestamptz,
  sale_ends_at          timestamptz,
  sale_note             text not null default '',
  is_demo               boolean not null default false,
  sale_soon_notified_at timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists products_user_idx on hiiragi.products(user_id);

create table if not exists hiiragi.product_accounts (
  product_id uuid not null references hiiragi.products(id) on delete cascade,
  account_id uuid not null references hiiragi.official_accounts(id) on delete cascade,
  primary key (product_id, account_id)
);

-- ── 監視対象（URL単位。全利用者で共有し、外部サイトへのアクセスを1回にまとめる） ──
create table if not exists hiiragi.monitor_targets (
  id                 uuid primary key default gen_random_uuid(),
  url                text not null unique,
  host               text not null,
  adapter            text not null default 'generic',
  min_interval_sec   integer not null default 1800,
  is_active          boolean not null default true,
  disabled_reason    text,
  robots_allowed     boolean,
  robots_checked_at  timestamptz,
  last_checked_at    timestamptz,
  next_check_at      timestamptz not null default now(),
  last_status        text,
  last_price         integer,
  last_currency      text not null default 'JPY',
  last_title         text,
  last_success_at    timestamptz,
  last_error_code    text,
  last_error_message text,
  consecutive_errors integer not null default 0,
  restock_seq        integer not null default 0,
  created_at         timestamptz not null default now()
);
create index if not exists targets_due_idx on hiiragi.monitor_targets(is_active, next_check_at);

-- 商品と監視対象URLの紐付け（＝商品×販売場所×商品ページ）
create table if not exists hiiragi.product_urls (
  id                 uuid primary key default gen_random_uuid(),
  product_id         uuid not null references hiiragi.products(id) on delete cascade,
  store_id           uuid references hiiragi.stores(id) on delete set null,
  target_id          uuid not null references hiiragi.monitor_targets(id) on delete cascade,
  label              text not null default '',
  is_active          boolean not null default true,
  price_alert_active boolean not null default false,
  price_alert_seq    integer not null default 0,
  error_alert_active boolean not null default false,
  error_alert_seq    integer not null default 0,
  created_at         timestamptz not null default now(),
  unique (product_id, target_id)
);
create index if not exists product_urls_product_idx on hiiragi.product_urls(product_id);
create index if not exists product_urls_target_idx on hiiragi.product_urls(target_id);

-- ── 監視履歴（共有） ──────────────────────────────────────
create table if not exists hiiragi.monitor_results (
  id            bigserial primary key,
  target_id     uuid not null references hiiragi.monitor_targets(id) on delete cascade,
  checked_at    timestamptz not null default now(),
  stock_status  text not null,
  price         integer,
  title         text,
  http_status   integer,
  adapter       text,
  error_code    text,
  error_message text,
  note          text
);
create index if not exists results_target_idx on hiiragi.monitor_results(target_id, checked_at desc);

-- ── アプリ内通知 ──────────────────────────────────────────
create table if not exists hiiragi.notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references hiiragi.users(id) on delete cascade,
  product_id     uuid references hiiragi.products(id) on delete cascade,
  product_url_id uuid references hiiragi.product_urls(id) on delete set null,
  kind           text not null,
  title          text not null,
  body           text not null default '',
  price          integer,
  store_name     text not null default '',
  link_url       text not null default '',
  event_key      text not null,
  is_read        boolean not null default false,
  read_at        timestamptz,
  created_at     timestamptz not null default now(),
  unique (user_id, event_key)
);
create index if not exists notifications_user_idx on hiiragi.notifications(user_id, created_at desc);

-- ── 監視処理の実行ログ（管理画面用） ──────────────────────
create table if not exists hiiragi.monitor_runs (
  id          bigserial primary key,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  checked     integer not null default 0,
  errors      integer not null default 0,
  notified    integer not null default 0,
  source      text not null default 'cron',
  note        text not null default ''
);

-- ── デモ用の模擬ショップ（このアプリ自身が配信するダミーページの在庫状態） ──
create table if not exists hiiragi.demo_shop_items (
  slug         text primary key,
  name         text not null,
  price        integer not null,
  in_stock     boolean not null default false,
  updated_at   timestamptz not null default now()
);
