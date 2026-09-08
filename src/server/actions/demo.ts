"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { appBaseUrl, DEMO_ITEMS, DEMO_PRODUCT_NAME, DEMO_STORE_NAME } from "../demo";
import { ensureTarget, runInitialCheck } from "../targets";
import { checkTarget, loadTarget } from "../monitor/runner";

/** 練習用のデータ一式を作る。何度押しても増えないようにする。 */
export async function seedDemoAction(): Promise<void> {
  const user = await requireUser();
  const base = await appBaseUrl();

  for (const item of DEMO_ITEMS) {
    await query(
      `insert into hiiragi.demo_shop_items (slug, name, price, in_stock)
       values ($1,$2,$3,$4) on conflict (slug) do nothing`,
      [item.slug, item.name, item.price, item.slug === "sample-b"],
    );
  }

  let store = await queryOne<{ id: string }>(
    `select id from hiiragi.stores where user_id = $1 and name = $2 limit 1`,
    [user.id, DEMO_STORE_NAME],
  );
  if (!store) {
    store = await queryOne<{ id: string }>(
      `insert into hiiragi.stores (user_id, name, url, kind, note)
       values ($1,$2,$3,'other',$4) returning id`,
      [
        user.id,
        DEMO_STORE_NAME,
        `${base}/demo/shop`,
        "練習用の模擬ショップです。実在しません。ここから購入はできません。",
      ],
    );
  }

  let product = await queryOne<{ id: string }>(
    `select id from hiiragi.products where user_id = $1 and is_demo and name = $2 limit 1`,
    [user.id, DEMO_PRODUCT_NAME],
  );
  if (!product) {
    product = await queryOne<{ id: string }>(
      `insert into hiiragi.products
         (user_id, name, description, target_price, is_demo, sale_note)
       values ($1,$2,$3,$4,true,$5) returning id`,
      [
        user.id,
        DEMO_PRODUCT_NAME,
        "使い方を試すための練習データです。実在する商品ではありません。",
        3000,
        "デモ：在庫を切り替えると通知が届きます",
      ],
    );
  }
  if (!product || !store) return;

  const ensured = await ensureTarget(`${base}/demo/shop/${DEMO_ITEMS[0].slug}`);
  if (ensured.ok) {
    await query(
      `insert into hiiragi.product_urls (product_id, store_id, target_id, label)
       values ($1,$2,$3,'デモ用の商品ページ')
       on conflict (product_id, target_id) do update set is_active = true`,
      [product.id, store.id, ensured.target.id],
    );
    await runInitialCheck(ensured.target.id);
  }

  revalidatePath("/dashboard");
  redirect(`/products/${product.id}?demo=1`);
}

/** 模擬ショップの在庫を切り替えて、すぐに監視を走らせる（通知が届くところまで体験できる）。 */
export async function toggleDemoStockAction(formData: FormData): Promise<void> {
  await requireUser();
  const slug = String(formData.get("slug") ?? "").slice(0, 40);
  const updated = await queryOne<{ slug: string }>(
    `update hiiragi.demo_shop_items set in_stock = not in_stock, updated_at = now()
      where slug = $1 returning slug`,
    [slug],
  );
  if (!updated) return;

  const base = await appBaseUrl();
  const target = await queryOne<{ id: string }>(
    `select id from hiiragi.monitor_targets where url = $1`,
    [`${base}/demo/shop/${slug}`],
  );
  if (target) {
    const full = await loadTarget(target.id);
    if (full) {
      try {
        await checkTarget(full);
      } catch {
        // 失敗しても画面は開けるようにする
      }
    }
  }
  revalidatePath("/demo/shop");
  revalidatePath(`/demo/shop/${slug}`);
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
}
