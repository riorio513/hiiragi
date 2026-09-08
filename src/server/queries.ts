import { query } from "@/lib/db";
import type { StockStatus } from "@/lib/types";

export type DashboardProduct = {
  id: string;
  name: string;
  image_url: string;
  target_price: number | null;
  monitoring_enabled: boolean;
  notify_enabled: boolean;
  sale_starts_at: Date | null;
  is_demo: boolean;
  unread: number;
  url_count: number;
  in_stock_count: number;
  out_of_stock_count: number;
  unknown_count: number;
  error_count: number;
  min_price: number | null;
  last_checked_at: Date | null;
  next_check_at: Date | null;
};

type Row = Omit<
  DashboardProduct,
  "unread" | "url_count" | "in_stock_count" | "out_of_stock_count" | "unknown_count" | "error_count"
> & {
  unread: string;
  url_count: string;
  in_stock_count: string;
  out_of_stock_count: string;
  unknown_count: string;
  error_count: string;
};

export async function listDashboardProducts(userId: string): Promise<DashboardProduct[]> {
  const rows = await query<Row>(
    `select p.id, p.name, p.image_url, p.target_price, p.monitoring_enabled, p.notify_enabled,
            p.sale_starts_at, p.is_demo,
            coalesce(n.unread, 0)::text as unread,
            coalesce(agg.url_count, 0)::text as url_count,
            coalesce(agg.in_stock_count, 0)::text as in_stock_count,
            coalesce(agg.out_of_stock_count, 0)::text as out_of_stock_count,
            coalesce(agg.unknown_count, 0)::text as unknown_count,
            coalesce(agg.error_count, 0)::text as error_count,
            agg.min_price, agg.last_checked_at, agg.next_check_at
       from hiiragi.products p
       left join lateral (
         select count(*) as url_count,
                count(*) filter (where t.last_status = 'in_stock') as in_stock_count,
                count(*) filter (where t.last_status = 'out_of_stock') as out_of_stock_count,
                count(*) filter (where t.last_status is null or t.last_status = 'unknown') as unknown_count,
                count(*) filter (where t.last_status = 'error') as error_count,
                min(t.last_price) as min_price,
                max(t.last_checked_at) as last_checked_at,
                min(t.next_check_at) as next_check_at
           from hiiragi.product_urls pu
           join hiiragi.monitor_targets t on t.id = pu.target_id
          where pu.product_id = p.id and pu.is_active
       ) agg on true
       left join lateral (
         select count(*) as unread from hiiragi.notifications nn
          where nn.product_id = p.id and nn.user_id = p.user_id and not nn.is_read
       ) n on true
      where p.user_id = $1
      order by p.created_at desc`,
    [userId],
  );

  return rows.map((r) => ({
    ...r,
    unread: Number(r.unread),
    url_count: Number(r.url_count),
    in_stock_count: Number(r.in_stock_count),
    out_of_stock_count: Number(r.out_of_stock_count),
    unknown_count: Number(r.unknown_count),
    error_count: Number(r.error_count),
  }));
}

export function productStatus(p: DashboardProduct): StockStatus | null {
  if (p.url_count === 0) return null;
  if (p.in_stock_count > 0) return "in_stock";
  if (p.out_of_stock_count > 0 && p.unknown_count === 0 && p.error_count === 0) return "out_of_stock";
  if (p.error_count > 0 && p.out_of_stock_count === 0 && p.unknown_count === 0) return "error";
  if (p.out_of_stock_count > 0) return "out_of_stock";
  return "unknown";
}

/** 大事なものほど上に出す。並び順は「買える → 値下がり → 販売開始が近い → エラー → その他」。 */
export function dashboardRank(p: DashboardProduct): number {
  const status = productStatus(p);
  if (status === "in_stock") return 0;
  if (p.target_price !== null && p.min_price !== null && p.min_price <= p.target_price) return 1;
  if (p.sale_starts_at) {
    const diff = new Date(p.sale_starts_at).getTime() - Date.now();
    if (diff > -3600_000 && diff < 86_400_000) return 2;
  }
  if (p.error_count > 0) return 3;
  if (p.unread > 0) return 4;
  if (!p.monitoring_enabled) return 7;
  if (status === "out_of_stock") return 6;
  return 5;
}
