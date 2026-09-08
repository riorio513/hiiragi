
import { query, queryOne } from "@/lib/db";
import type { StockStatus } from "@/lib/types";
import { adapterByName } from "./adapters";
import { analyze } from "./analyze";
import { fetchPage } from "./fetcher";
import { checkRobots } from "./robots";
import { computeInterval, isWithinQuietHours } from "./schedule";

/**
 * 監視の本体。
 * 1つのURL（monitor_targets）を1回だけ見に行き、結果を履歴に残し、
 * そのURLを見ている全員に必要な通知だけを作る。
 * 同じURLを複数人が登録していても、外部サイトへのアクセスは1回で済む。
 */

const ROBOTS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type TargetRow = {
  id: string;
  url: string;
  host: string;
  adapter: string;
  min_interval_sec: number;
  is_active: boolean;
  robots_allowed: boolean | null;
  robots_checked_at: Date | null;
  last_status: StockStatus | null;
  last_price: number | null;
  consecutive_errors: number;
  restock_seq: number;
};

type WatcherRow = {
  product_url_id: string;
  product_id: string;
  user_id: string;
  product_name: string;
  target_price: number | null;
  notify_enabled: boolean;
  price_alert_active: boolean;
  price_alert_seq: number;
  error_alert_active: boolean;
  error_alert_seq: number;
  store_name: string | null;
  timezone: string | null;
  quiet_enabled: boolean | null;
  quiet_start: string | null;
  quiet_end: string | null;
  sale_starts_at: Date | null;
};

export type CheckOutcome = {
  targetId: string;
  status: StockStatus;
  price: number | null;
  title: string | null;
  basis: string;
  httpStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  notified: number;
  nextCheckAt: Date;
};

async function loadWatchers(targetId: string): Promise<WatcherRow[]> {
  return await query<WatcherRow>(
    `select pu.id as product_url_id, pu.product_id, pu.price_alert_active, pu.price_alert_seq,
            pu.error_alert_active, pu.error_alert_seq,
            p.user_id, p.name as product_name, p.target_price, p.notify_enabled, p.sale_starts_at,
            s.name as store_name,
            us.timezone, us.quiet_enabled, us.quiet_start, us.quiet_end
       from hiiragi.product_urls pu
       join hiiragi.products p on p.id = pu.product_id
       left join hiiragi.stores s on s.id = pu.store_id
       left join hiiragi.user_settings us on us.user_id = p.user_id
      where pu.target_id = $1 and pu.is_active and p.monitoring_enabled`,
    [targetId],
  );
}

function earliestSaleStart(watchers: WatcherRow[]): Date | null {
  const dates = watchers
    .map((w) => w.sale_starts_at)
    .filter((d): d is Date => d instanceof Date);
  if (dates.length === 0) return null;
  return new Date(Math.min(...dates.map((d) => d.getTime())));
}

function allWatchersQuiet(watchers: WatcherRow[], now: Date): boolean {
  if (watchers.length === 0) return false;
  return watchers.every((w) => {
    if (!w.quiet_enabled) return false;
    return isWithinQuietHours(
      now,
      w.timezone ?? "Asia/Tokyo",
      w.quiet_start ?? "22:00",
      w.quiet_end ?? "06:00",
    );
  });
}

async function insertNotification(row: {
  userId: string;
  productId: string;
  productUrlId: string | null;
  kind: string;
  title: string;
  body: string;
  price: number | null;
  storeName: string;
  linkUrl: string;
  eventKey: string;
}): Promise<boolean> {
  const inserted = await query(
    `insert into hiiragi.notifications
       (user_id, product_id, product_url_id, kind, title, body, price, store_name, link_url, event_key)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     on conflict (user_id, event_key) do nothing
     returning id`,
    [
      row.userId,
      row.productId,
      row.productUrlId,
      row.kind,
      row.title,
      row.body,
      row.price,
      row.storeName,
      row.linkUrl,
      row.eventKey,
    ],
  );
  return inserted.length > 0;
}

function yen(value: number | null): string {
  return value === null ? "価格不明" : `${value.toLocaleString("ja-JP")}円`;
}

/** 監視対象を1件チェックする。force=true なら間隔を無視して必ず見に行く（登録直後の初回取得など）。 */
export async function checkTarget(target: TargetRow, now = new Date()): Promise<CheckOutcome> {
  const adapter = adapterByName(target.adapter);
  const watchers = await loadWatchers(target.id);

  // robots.txt は週に1回だけ確認する
  let robotsAllowed = target.robots_allowed;
  const robotsStale =
    target.robots_checked_at === null ||
    now.getTime() - new Date(target.robots_checked_at).getTime() > ROBOTS_TTL_MS;
  if (robotsAllowed === null || robotsStale) {
    const robots = await checkRobots(target.url);
    robotsAllowed = robots.allowed;
    await query(
      `update hiiragi.monitor_targets set robots_allowed = $2, robots_checked_at = now() where id = $1`,
      [target.id, robots.allowed],
    );
    if (!robots.allowed) {
      await query(
        `update hiiragi.monitor_targets
            set is_active = false, disabled_reason = $2, last_status = 'error',
                last_error_code = 'robots_disallowed', last_error_message = $2,
                last_checked_at = now()
          where id = $1`,
        [target.id, robots.reason],
      );
      await recordResult(target.id, {
        status: "error",
        price: null,
        title: null,
        httpStatus: null,
        adapter: adapter.name,
        errorCode: "robots_disallowed",
        errorMessage: robots.reason,
        note: "robots.txt の指示に従い監視を停止しました",
      });
      return {
        targetId: target.id,
        status: "error",
        price: null,
        title: null,
        basis: "robots.txt",
        httpStatus: null,
        errorCode: "robots_disallowed",
        errorMessage: robots.reason,
        notified: 0,
        nextCheckAt: now,
      };
    }
  }

  const fetched = await fetchPage(target.url);
  const prevStatus = target.last_status;

  let status: StockStatus;
  let price: number | null = null;
  let title: string | null = null;
  let basis = "";
  let errorCode: string | null = null;
  let errorMessage: string | null = null;
  const httpStatus = fetched.ok ? fetched.status : fetched.status;

  if (!fetched.ok) {
    status = "error";
    errorCode = fetched.code;
    errorMessage = fetched.message;
    basis = "取得エラー";
  } else {
    const result = analyze(fetched.html, adapter);
    status = result.status;
    price = result.price;
    title = result.title;
    basis = result.basis;
  }

  const consecutiveErrors = status === "error" ? target.consecutive_errors + 1 : 0;
  const isRestock = status === "in_stock" && prevStatus !== null && prevStatus !== "in_stock";
  const restockSeq = isRestock ? target.restock_seq + 1 : target.restock_seq;

  const { intervalSec } = computeInterval({
    now,
    saleStartsAt: earliestSaleStart(watchers),
    consecutiveErrors,
    quiet: allWatchersQuiet(watchers, now),
    minIntervalSec: target.min_interval_sec,
  });
  const nextCheckAt = new Date(now.getTime() + intervalSec * 1000);

  await query(
    `update hiiragi.monitor_targets
        set last_checked_at = now(),
            next_check_at = $2,
            last_status = $3,
            last_price = coalesce($4, last_price),
            last_title = coalesce($5, last_title),
            last_success_at = case when $3 <> 'error' then now() else last_success_at end,
            last_error_code = $6,
            last_error_message = $7,
            consecutive_errors = $8,
            restock_seq = $9
      where id = $1`,
    [
      target.id,
      nextCheckAt,
      status,
      price,
      title,
      errorCode,
      errorMessage,
      consecutiveErrors,
      restockSeq,
    ],
  );

  await recordResult(target.id, {
    status,
    price,
    title,
    httpStatus,
    adapter: adapter.name,
    errorCode,
    errorMessage,
    note: basis,
  });

  const notified = await notifyWatchers({
    target,
    watchers,
    status,
    prevStatus,
    price,
    isRestock,
    restockSeq,
    consecutiveErrors,
    errorMessage,
  });

  return {
    targetId: target.id,
    status,
    price,
    title,
    basis,
    httpStatus,
    errorCode,
    errorMessage,
    notified,
    nextCheckAt,
  };
}

async function recordResult(
  targetId: string,
  row: {
    status: StockStatus;
    price: number | null;
    title: string | null;
    httpStatus: number | null;
    adapter: string;
    errorCode: string | null;
    errorMessage: string | null;
    note: string;
  },
): Promise<void> {
  await query(
    `insert into hiiragi.monitor_results
       (target_id, stock_status, price, title, http_status, adapter, error_code, error_message, note)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      targetId,
      row.status,
      row.price,
      row.title,
      row.httpStatus,
      row.adapter,
      row.errorCode,
      row.errorMessage,
      row.note,
    ],
  );
}

async function notifyWatchers(input: {
  target: TargetRow;
  watchers: WatcherRow[];
  status: StockStatus;
  prevStatus: StockStatus | null;
  price: number | null;
  isRestock: boolean;
  restockSeq: number;
  consecutiveErrors: number;
  errorMessage: string | null;
}): Promise<number> {
  const { target, watchers, status, prevStatus, price, isRestock, restockSeq } = input;
  let count = 0;

  for (const w of watchers) {
    const storeName = w.store_name ?? target.host;

    // ① 在庫あり になった
    if (isRestock && w.notify_enabled) {
      const created = await insertNotification({
        userId: w.user_id,
        productId: w.product_id,
        productUrlId: w.product_url_id,
        kind: "back_in_stock",
        title:
          prevStatus === "out_of_stock"
            ? `${w.product_name} の在庫が復活しました`
            : `${w.product_name} が購入できる状態になりました`,
        body: `${storeName} で在庫ありを確認しました（${yen(price)}）。購入手続きはご自身で商品ページから行ってください。`,
        price,
        storeName,
        linkUrl: target.url,
        eventKey: `stock:${target.id}:${restockSeq}`,
      });
      if (created) count += 1;
    }

    // ② 希望価格を下回った
    const priceConditionMet =
      price !== null && w.target_price !== null && price <= w.target_price && status !== "error";
    if (priceConditionMet && !w.price_alert_active) {
      const seq = w.price_alert_seq + 1;
      await query(
        `update hiiragi.product_urls set price_alert_active = true, price_alert_seq = $2 where id = $1`,
        [w.product_url_id, seq],
      );
      if (w.notify_enabled) {
        const created = await insertNotification({
          userId: w.user_id,
          productId: w.product_id,
          productUrlId: w.product_url_id,
          kind: "price_drop",
          title: `${w.product_name} が希望価格以下になりました`,
          body: `${storeName} の価格が ${yen(price)}（希望 ${yen(w.target_price)} 以下）になりました。`,
          price,
          storeName,
          linkUrl: target.url,
          eventKey: `price:${w.product_url_id}:${seq}`,
        });
        if (created) count += 1;
      }
    } else if (!priceConditionMet && w.price_alert_active) {
      await query(`update hiiragi.product_urls set price_alert_active = false where id = $1`, [
        w.product_url_id,
      ]);
    }

    // ③ エラーが続いている
    if (input.consecutiveErrors >= 3 && !w.error_alert_active) {
      const seq = w.error_alert_seq + 1;
      await query(
        `update hiiragi.product_urls set error_alert_active = true, error_alert_seq = $2 where id = $1`,
        [w.product_url_id, seq],
      );
      if (w.notify_enabled) {
        const created = await insertNotification({
          userId: w.user_id,
          productId: w.product_id,
          productUrlId: w.product_url_id,
          kind: "error",
          title: `${w.product_name} の監視でエラーが続いています`,
          body: `${storeName} のページを${input.consecutiveErrors}回続けて確認できませんでした。${input.errorMessage ?? ""}`,
          price: null,
          storeName,
          linkUrl: target.url,
          eventKey: `error:${w.product_url_id}:${seq}`,
        });
        if (created) count += 1;
      }
    } else if (input.consecutiveErrors === 0 && w.error_alert_active) {
      await query(`update hiiragi.product_urls set error_alert_active = false where id = $1`, [
        w.product_url_id,
      ]);
    }
  }
  return count;
}

/** 販売開始が1時間以内に迫っている商品を知らせる（監視URLが無くても通知する）。 */
export async function notifyUpcomingSales(): Promise<number> {
  const rows = await query<{
    id: string;
    user_id: string;
    name: string;
    sale_starts_at: Date;
    sale_note: string;
  }>(
    `select id, user_id, name, sale_starts_at, sale_note
       from hiiragi.products
      where notify_enabled
        and sale_starts_at is not null
        and sale_starts_at > now()
        and sale_starts_at <= now() + interval '1 hour'
        and (sale_soon_notified_at is null or sale_soon_notified_at < sale_starts_at - interval '2 hours')`,
  );

  let count = 0;
  for (const row of rows) {
    const startsAt = new Date(row.sale_starts_at);
    const created = await insertNotification({
      userId: row.user_id,
      productId: row.id,
      productUrlId: null,
      kind: "sale_soon",
      title: `${row.name} の販売開始予定時刻が近づいています`,
      body: `販売開始予定：${startsAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}${row.sale_note ? `／${row.sale_note}` : ""}`,
      price: null,
      storeName: "",
      linkUrl: "",
      eventKey: `sale_soon:${row.id}:${startsAt.toISOString()}`,
    });
    await query(`update hiiragi.products set sale_soon_notified_at = now() where id = $1`, [row.id]);
    if (created) count += 1;
  }
  return count;
}

/** 履歴が無限に増えないよう、古いものを削る（無料枠の節約）。 */
export async function pruneHistory(): Promise<number> {
  const rows = await query<{ count: string }>(
    `with deleted as (
       delete from hiiragi.monitor_results r
        where r.checked_at < now() - interval '30 days'
           or r.id not in (
             select id from (
               select id, row_number() over (partition by target_id order by checked_at desc) as rn
                 from hiiragi.monitor_results
             ) ranked where rn <= 200
           )
       returning 1
     )
     select count(*)::text as count from deleted`,
  );
  return Number(rows[0]?.count ?? "0");
}

export type RunSummary = {
  checked: number;
  errors: number;
  notified: number;
  targets: { url: string; status: StockStatus; price: number | null }[];
};

/** 期限が来た監視対象をまとめて確認する。GitHub Actions から定期的に呼ばれる。 */
export async function runDueChecks(limit = 20, source = "cron"): Promise<RunSummary> {
  const run = await queryOne<{ id: string }>(
    `insert into hiiragi.monitor_runs (source) values ($1) returning id`,
    [source],
  );

  const due = await query<TargetRow>(
    `select t.id, t.url, t.host, t.adapter, t.min_interval_sec, t.is_active,
            t.robots_allowed, t.robots_checked_at, t.last_status, t.last_price,
            t.consecutive_errors, t.restock_seq
       from hiiragi.monitor_targets t
      where t.is_active
        and t.next_check_at <= now()
        and exists (
          select 1 from hiiragi.product_urls pu
            join hiiragi.products p on p.id = pu.product_id
           where pu.target_id = t.id and pu.is_active and p.monitoring_enabled
        )
      order by t.next_check_at asc
      limit $1`,
    [limit],
  );

  const summary: RunSummary = { checked: 0, errors: 0, notified: 0, targets: [] };

  for (const target of due) {
    try {
      const outcome = await checkTarget(target, new Date());
      summary.checked += 1;
      if (outcome.status === "error") summary.errors += 1;
      summary.notified += outcome.notified;
      summary.targets.push({ url: target.url, status: outcome.status, price: outcome.price });
    } catch {
      summary.errors += 1;
    }
  }

  summary.notified += await notifyUpcomingSales();
  if (Math.random() < 0.05) await pruneHistory();

  if (run) {
    await query(
      `update hiiragi.monitor_runs
          set finished_at = now(), checked = $2, errors = $3, notified = $4
        where id = $1`,
      [run.id, summary.checked, summary.errors, summary.notified],
    );
  }
  return summary;
}

export async function loadTarget(targetId: string): Promise<TargetRow | null> {
  return await queryOne<TargetRow>(
    `select id, url, host, adapter, min_interval_sec, is_active, robots_allowed, robots_checked_at,
            last_status, last_price, consecutive_errors, restock_seq
       from hiiragi.monitor_targets where id = $1`,
    [targetId],
  );
}

