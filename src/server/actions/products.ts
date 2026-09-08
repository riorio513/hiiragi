"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseLocalDateTime } from "@/lib/format";
import { ensureTarget, runInitialCheck } from "../targets";
import { normalizeUrl } from "../monitor/url";
import { loadTarget, checkTarget } from "../monitor/runner";

export type FormState = { error?: string; ok?: string };

function text(formData: FormData, key: string, max = 500): string {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

function optionalPrice(value: string): number | null | "invalid" {
  if (!value) return null;
  const cleaned = value.replace(/[,\s円¥￥]/g, "");
  if (!/^\d{1,9}$/.test(cleaned)) return "invalid";
  return Number(cleaned);
}

function optionalImageUrl(value: string): string | "invalid" {
  if (!value) return "";
  const check = normalizeUrl(value);
  return check.ok ? check.url : "invalid";
}

async function ownProduct(userId: string, productId: string): Promise<boolean> {
  const row = await queryOne(`select 1 from hiiragi.products where id = $1 and user_id = $2`, [
    productId,
    userId,
  ]);
  return row !== null;
}

export async function createProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const name = text(formData, "name", 120);
  if (!name) return { error: "商品名を入れてください。" };

  const price = optionalPrice(text(formData, "targetPrice", 20));
  if (price === "invalid") return { error: "希望価格は数字で入れてください（例：2980）。" };

  const imageUrl = optionalImageUrl(text(formData, "imageUrl", 800));
  if (imageUrl === "invalid") return { error: "商品画像URLの形が正しくありません。" };

  const startsAt = parseLocalDateTime(text(formData, "saleStartsAt", 20));
  const endsAt = parseLocalDateTime(text(formData, "saleEndsAt", 20));
  if (startsAt && endsAt && endsAt < startsAt) {
    return { error: "販売終了予定は、販売開始予定より後の日時にしてください。" };
  }

  const product = await queryOne<{ id: string }>(
    `insert into hiiragi.products
       (user_id, name, description, image_url, target_price, sale_starts_at, sale_ends_at, sale_note)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
    [
      user.id,
      name,
      text(formData, "description", 1000),
      imageUrl,
      price,
      startsAt,
      endsAt,
      text(formData, "saleNote", 300),
    ],
  );
  if (!product) return { error: "商品を登録できませんでした。" };

  // 最初のURLが入力されていれば、そのまま監視まで始める
  const firstUrl = text(formData, "firstUrl", 1000);
  let urlMessage = "";
  if (firstUrl) {
    const result = await attachUrl({
      userId: user.id,
      productId: product.id,
      rawUrl: firstUrl,
      storeId: text(formData, "storeId", 60),
      newStoreName: text(formData, "newStoreName", 80),
      label: "",
    });
    if (!result.ok) urlMessage = result.message;
  }

  revalidatePath("/dashboard");
  redirect(`/products/${product.id}${urlMessage ? `?urlError=${encodeURIComponent(urlMessage)}` : "?added=1"}`);
}

export async function updateProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const productId = text(formData, "productId", 60);
  if (!(await ownProduct(user.id, productId))) return { error: "商品が見つかりません。" };

  const name = text(formData, "name", 120);
  if (!name) return { error: "商品名を入れてください。" };

  const price = optionalPrice(text(formData, "targetPrice", 20));
  if (price === "invalid") return { error: "希望価格は数字で入れてください（例：2980）。" };

  const imageUrl = optionalImageUrl(text(formData, "imageUrl", 800));
  if (imageUrl === "invalid") return { error: "商品画像URLの形が正しくありません。" };

  const startsAt = parseLocalDateTime(text(formData, "saleStartsAt", 20));
  const endsAt = parseLocalDateTime(text(formData, "saleEndsAt", 20));
  if (startsAt && endsAt && endsAt < startsAt) {
    return { error: "販売終了予定は、販売開始予定より後の日時にしてください。" };
  }

  await query(
    `update hiiragi.products
        set name = $3, description = $4, image_url = $5, target_price = $6,
            sale_starts_at = $7, sale_ends_at = $8, sale_note = $9, updated_at = now()
      where id = $1 and user_id = $2`,
    [
      productId,
      user.id,
      name,
      text(formData, "description", 1000),
      imageUrl,
      price,
      startsAt,
      endsAt,
      text(formData, "saleNote", 300),
    ],
  );

  // 希望価格を変えたら、価格通知の状態をいったん戻す（新しい条件で通知できるように）
  await query(
    `update hiiragi.product_urls set price_alert_active = false where product_id = $1`,
    [productId],
  );

  revalidatePath(`/products/${productId}`);
  revalidatePath("/dashboard");
  redirect(`/products/${productId}?saved=1`);
}

export async function toggleProductFlagAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const productId = text(formData, "productId", 60);
  const field = text(formData, "field", 20);
  if (field !== "monitoring_enabled" && field !== "notify_enabled") return;
  if (!(await ownProduct(user.id, productId))) return;

  await query(
    `update hiiragi.products set ${field} = not ${field}, updated_at = now()
      where id = $1 and user_id = $2`,
    [productId, user.id],
  );
  revalidatePath(`/products/${productId}`);
  revalidatePath("/dashboard");
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const productId = text(formData, "productId", 60);
  if (!(await ownProduct(user.id, productId))) return;
  await query(`delete from hiiragi.products where id = $1 and user_id = $2`, [productId, user.id]);
  revalidatePath("/dashboard");
  redirect("/dashboard?deleted=1");
}

type AttachInput = {
  userId: string;
  productId: string;
  rawUrl: string;
  storeId: string;
  newStoreName: string;
  label: string;
};

async function attachUrl(input: AttachInput): Promise<{ ok: true } | { ok: false; message: string }> {
  const ensured = await ensureTarget(input.rawUrl);
  if (!ensured.ok) return { ok: false, message: ensured.message };

  let storeId: string | null = input.storeId || null;
  if (storeId) {
    const owned = await queryOne(`select 1 from hiiragi.stores where id = $1 and user_id = $2`, [
      storeId,
      input.userId,
    ]);
    if (!owned) storeId = null;
  }
  if (!storeId && input.newStoreName) {
    const store = await queryOne<{ id: string }>(
      `insert into hiiragi.stores (user_id, name, url, kind) values ($1,$2,$3,'other') returning id`,
      [input.userId, input.newStoreName, `${new URL(ensured.target.url).origin}`],
    );
    storeId = store?.id ?? null;
  }
  if (!storeId) {
    // 店舗を選んでいない場合は、ドメイン名で自動的に作る（入力の手間を減らす）
    const host = ensured.target.host;
    const found = await queryOne<{ id: string }>(
      `select id from hiiragi.stores where user_id = $1 and lower(name) = lower($2) limit 1`,
      [input.userId, host],
    );
    if (found) storeId = found.id;
    else {
      const store = await queryOne<{ id: string }>(
        `insert into hiiragi.stores (user_id, name, url, kind) values ($1,$2,$3,'other') returning id`,
        [input.userId, host, `https://${host}`],
      );
      storeId = store?.id ?? null;
    }
  }

  await query(
    `insert into hiiragi.product_urls (product_id, store_id, target_id, label)
     values ($1,$2,$3,$4)
     on conflict (product_id, target_id) do update set is_active = true, store_id = excluded.store_id`,
    [input.productId, storeId, ensured.target.id, input.label],
  );

  await runInitialCheck(ensured.target.id);
  return { ok: true };
}

export async function addProductUrlAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const productId = text(formData, "productId", 60);
  if (!(await ownProduct(user.id, productId))) return { error: "商品が見つかりません。" };

  const rawUrl = text(formData, "url", 1000);
  if (!rawUrl) return { error: "商品ページのURLを入れてください。" };

  const result = await attachUrl({
    userId: user.id,
    productId,
    rawUrl,
    storeId: text(formData, "storeId", 60),
    newStoreName: text(formData, "newStoreName", 80),
    label: text(formData, "label", 80),
  });
  if (!result.ok) return { error: result.message };

  revalidatePath(`/products/${productId}`);
  revalidatePath("/dashboard");
  return { ok: "商品ページを登録し、最初の確認を行いました。" };
}

export async function removeProductUrlAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const productUrlId = text(formData, "productUrlId", 60);
  const row = await queryOne<{ product_id: string }>(
    `select pu.product_id from hiiragi.product_urls pu
       join hiiragi.products p on p.id = pu.product_id
      where pu.id = $1 and p.user_id = $2`,
    [productUrlId, user.id],
  );
  if (!row) return;
  await query(`delete from hiiragi.product_urls where id = $1`, [productUrlId]);
  revalidatePath(`/products/${row.product_id}`);
  revalidatePath("/dashboard");
}

export async function toggleProductUrlAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const productUrlId = text(formData, "productUrlId", 60);
  const row = await queryOne<{ product_id: string }>(
    `select pu.product_id from hiiragi.product_urls pu
       join hiiragi.products p on p.id = pu.product_id
      where pu.id = $1 and p.user_id = $2`,
    [productUrlId, user.id],
  );
  if (!row) return;
  await query(`update hiiragi.product_urls set is_active = not is_active where id = $1`, [
    productUrlId,
  ]);
  revalidatePath(`/products/${row.product_id}`);
  revalidatePath("/dashboard");
}

/** いま確認する（手動）。1つのURLだけを対象にする。 */
export async function recheckNowAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const productUrlId = text(formData, "productUrlId", 60);
  const row = await queryOne<{ product_id: string; target_id: string }>(
    `select pu.product_id, pu.target_id from hiiragi.product_urls pu
       join hiiragi.products p on p.id = pu.product_id
      where pu.id = $1 and p.user_id = $2`,
    [productUrlId, user.id],
  );
  if (!row) return;
  const target = await loadTarget(row.target_id);
  if (target) {
    try {
      await checkTarget(target);
    } catch {
      // 失敗は履歴とエラー表示に残るので、ここでは黙って戻す
    }
  }
  revalidatePath(`/products/${row.product_id}`);
  revalidatePath("/dashboard");
}

export async function linkAccountAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const productId = text(formData, "productId", 60);
  const accountId = text(formData, "accountId", 60);
  if (!(await ownProduct(user.id, productId))) return;
  const owned = await queryOne(
    `select 1 from hiiragi.official_accounts where id = $1 and user_id = $2`,
    [accountId, user.id],
  );
  if (!owned) return;
  await query(
    `insert into hiiragi.product_accounts (product_id, account_id) values ($1,$2)
     on conflict do nothing`,
    [productId, accountId],
  );
  revalidatePath(`/products/${productId}`);
}

export async function unlinkAccountAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const productId = text(formData, "productId", 60);
  const accountId = text(formData, "accountId", 60);
  if (!(await ownProduct(user.id, productId))) return;
  await query(
    `delete from hiiragi.product_accounts where product_id = $1 and account_id = $2`,
    [productId, accountId],
  );
  revalidatePath(`/products/${productId}`);
}
