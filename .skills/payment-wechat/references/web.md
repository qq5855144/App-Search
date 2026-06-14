<PAYMENT_REQUIREMENTS>
Design Principles:
Ensure full payment loop: pre-purchase, payment, order and business status.
Required items override user requests; recommended items are lower priority.
Orders must operate using server-role permissions; Users may only view their own orders.
Because payment is involved, absolutely no TODO items can be left behind. No matter how long the task takes, all production code must be fully completed to ensure a complete payment logic closed loop.

<Payment System>
Required Items:
1. Orders must be associated with the purchaser. If the scenario does not require login to complete payment, use the phone number as the purchaser ID
2. Frontend purchase button → Invoke create_wechat_payment → Navigate to the order details page.
3. Design an order details page that displays different content based on the order status:
Pending: Display payment QR code. Poll order status every 2s until it is no longer pending, silently without any user-facing indication.
Paid: Display corresponding functions (e.g., refund button)
4. Edge functions: create_payment_order, wechat_payment_webhook
5. create_wechat_payment must:
  - Validate purchaser info
  - Calculate total
  - Generate WeChat Native payment URL
  - Save to order
  - return order_no
6. wechat_payment_webhook must:
  - Decrypt WeChat callback + verify payment
  - Update order status using optimistic locking
  - Trigger post-payment logic only once after successful update
7. Inventory changes should be atomic RPCs.
8. Secrets must follow exact names: MERCHANT_ID, MERCHANT_APP_ID, MCH_CERT_SERIAL_NO, MCH_PRIVATE_KEY, WECHAT_PAY_PUBLIC_KEY_ID, WECHAT_PAY_PUBLIC_KEY, MCH_API_V3_KEY. Notify users via Plugin Center.
9. If key missing or createWechatPayUrl fails → frontend prompts user to check keys.
10. Utility functions (createWechatPayUrl, decryptTradeState) must be used unmodified.
```
import { Wechatpay } from 'npm:wechatpay-axios-plugin';
async function createWechatPayUrl(MERCHANT_ID, MERCHANT_APP_ID, MCH_CERT_SERIAL_NO, MCH_PRIVATE_KEY, WECHAT_PAY_PUBLIC_KEY_ID， WECHAT_PAY_PUBLIC_KEY, outTradeNo, amount, notifyUrl) {
  try {
    const wxpay = new Wechatpay({
      mchid: MERCHANT_ID,
      serial: MCH_CERT_SERIAL_NO,
      privateKey: MCH_PRIVATE_KEY,
      certs: {[WECHAT_PAY_PUBLIC_KEY_ID]: WECHAT_PAY_PUBLIC_KEY}
    });
    const res = await wxpay.v3.pay.transactions.native.post({
      mchid: MERCHANT_ID,
      out_trade_no: outTradeNo,
      appid: MERCHANT_APP_ID,
      description: '调用用途描述',
      notify_url: notifyUrl,
      amount: { total: Math.round(amount * 100) }
    }, { headers: { 'Wechatpay-Serial': WECHAT_PAY_PUBLIC_KEY_ID } });
    if (res.data.code_url) {
      console.log(`[WeChatPay SUCCESS] outTradeNo=${outTradeNo}, url=${res.data.code_url}`);
      return { success: true, url: res.data.code_url };
    } else {
      console.error(`[WeChatPay FAILED] outTradeNo=${outTradeNo}, error=${res.data.message || JSON.stringify(data)}`);
      return { success: false, error: res.data.message || JSON.stringify(res.data) };
    }
  } catch (err) {
    console.error(`[WeChatPay ERROR] outTradeNo=${outTradeNo}, error=${err?.message || String(err)}`);
    return { success: false, error: err?.message || String(err) };
  }
}

import { Aes } from "npm:wechatpay-axios-plugin";
async function decryptTradeState(MCH_API_V3_KEY: string, associatedData: string, nonce: string, ciphertext: string): Promise<string> {
  const plaintext = await Aes.AesGcm.decrypt(ciphertext, apiV3Key, nonce, aad);
  const obj = JSON.parse(plaintext);
  return {
    status: (obj.trade_state ?? "").toString() === "SUCCESS" ? "SUCCESS" : "OTHERS",
    order_no: obj.out_trade_no ?? ""
  };
}
```

Recommended Items:
1. Suggested order number generation:
```
import ShortUniqueId from "npm:short-unique-id";
function generateOrderNo() {
  const uid = new ShortUniqueId({ length: 8 });
  const yymmdd = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return `ORD-${yymmdd}-${uid.rnd()}`;
}
```
2. Suggested DB schema:
```sql
create type order_status as enum ('pending', 'paid', 'shipped', 'completed', 'cancelled', 'refunded', 'partial_refunded');

-- SKU 表
create table public.sku (
    id uuid primary key default gen_random_uuid(),
    sku_code text not null unique,
    name text not null,
    price numeric(10,2) not null,
    inventory_total int not null default 0,
    inventory_available int not null default 0,
    inventory_reserved int not null default 0,
    inventory_sold int not null default 0,
    create_by uuid not null references auth.users(id),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
alter table public.sku
  add constraint sku_inventory_available_nonneg check (inventory_available >= 0),
  add constraint sku_inventory_reserved_nonneg  check (inventory_reserved  >= 0),
  add constraint sku_inventory_sold_nonneg      check (inventory_sold      >= 0);

-- 订单表
create table public.orders (
    id uuid primary key default gen_random_uuid(),
    order_no text unique not null,
    user_id uuid not null references auth.users(id),
    status order_status not null default 'pending'::order_status,
    wechat_pay_url text,
    total_amount numeric(12,2) not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
-- 订单明细表
create table public.order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id) on delete cascade,
    sku_code text not null references public.sku(sku_code),
    quantity int not null check (quantity > 0),
    unit_price numeric(10,2) not null,
    total_price numeric(12,2) not null,
    sku_snapshot jsonb not null,
    created_at timestamptz default now()
);

create or replace function public.manage_sku_inventory(
  sku_code_in text,
  qty_in int,
  action text  -- 'order' | 'pay_success' | 'pay_cancel'
) returns sku
language plpgsql
as $$
declare
  result sku;
begin
  if qty_in is null or qty_in <= 0 then
    result := null;
    return result;
  end if;

  if action = 'order' then
    -- 下单冻结：可售减少，冻结增加
    update sku
    set inventory_available = inventory_available - qty_in,
        inventory_reserved = inventory_reserved + qty_in,
        updated_at = now()
    where sku_code = sku_code_in
      and inventory_available >= qty_in
    returning * into result;

  elsif action = 'pay_success' then
    -- 支付成功：冻结转已售
    update sku
    set inventory_reserved = inventory_reserved - qty_in,
        inventory_sold = inventory_sold + qty_in,
        updated_at = now()
    where sku_code = sku_code_in
      and inventory_reserved >= qty_in
    returning * into result;

  elsif action = 'pay_cancel' then
    -- 支付取消/超时：释放冻结回可售
    update sku
    set inventory_available = inventory_available + qty_in,
        inventory_reserved = inventory_reserved - qty_in,
        updated_at = now()
    where sku_code = sku_code_in
      and inventory_reserved >= qty_in
    returning * into result;
  elsif action = 'refund' then
    -- 支付成功后退款：释放已售回可售
    update sku
    set inventory_available = inventory_available + qty_in,
        inventory_sold = inventory_sold - qty_in,
        updated_at = now()
    where sku_code = sku_code_in
      and inventory_sold >= qty_in
    returning * into result;
  else
    result := null;
  end if;

  return result;
end;
$$;
-- If users don't need the concept of inventory, set the default stock to 999999.
```
</Payment System>
</Refund System>
Refund detection:
Scenarios where refunds are NOT needed:
- Scenarios involving donations or other non-refundable cases
- User explicitly mentions that refunds are not needed or refund implementation should be postponed
- Review the refund policy to determine whether refund functionality is required and how refunds should be handled.
- examples: **退款政策**：明确支付后不支持退款的规则
Refunds are recommended for all other scenarios.

Required Items:
1. Must include **Payment System**
2. All refunds require merchant authorization:
User-initiated refund
Merchant-initiated refund
3. Determine refund type based on scenario and user input:
Full refund
Partial refund
Both options available
4. Design refund frontend page interactions
  - ensure refund buttons are displayed on order details page
  - ensure admin backend pages have no missing or incomplete features
5. If an order can contain multiple products, a (product and quantity selection box) must be designed in any refund page
6. Edge functions: execute_refund_after_approval/execute_refund_directly, wechat_refund_webhook
```
// This function must be used as-is and must not be modified.
async function createWechatRefund(wxpay, outTradeNo, outRefundNo, refundAmount, totalAmount, notifyUrl, reason) {
  try {
    const { data } = await wxpay.v3.refund.domestic.refunds.post(
      {
        out_trade_no: outTradeNo,
        out_refund_no: outRefundNo,
        reason: reason || '退款',
        notify_url: notifyUrl,
        amount: {
          refund: Math.round(refundAmount * 100),
          total: Math.round(totalAmount * 100),
          currency: 'CNY'
        }
      },
      { headers: { "Wechatpay-Serial": WECHAT_PAY_PUBLIC_KEY_ID } }
    );
    console.log(`[WeChatPay REFUND SUCCESS] outTradeNo=${outTradeNo}, outRefundNo=${outRefundNo}, refundId=${data.refund_id}`);
    return {success: true, data};
  } catch (err) {
    const status = err?.response?.status;
    const wxError = err?.response?.data;
    console.error(`[WeChatPay REFUND ERROR] outTradeNo=${outTradeNo} outRefundNo=${outRefundNo} wxpayError=${wxError ? JSON.stringify(wxError) : 'N/A'} message=${err?.message || String(err)}`
    );
    return {success: false, error: wxError || err?.message || String(err)};
  }
}

import { Aes } from "npm:wechatpay-axios-plugin";
async function decryptRefundState(MCH_API_V3_KEY: string, associatedData: string, nonce: string, ciphertext: string): Promise<{ refundStatus: string; outTradeNo: string; outRefundNo: string }> {
  const plaintext = await Aes.AesGcm.decrypt(ciphertext, MCH_API_V3_KEY, nonce, associatedData);
  const obj = JSON.parse(plaintext);
  return {
    refundStatus: (obj.refund_status ?? "").toString() === "SUCCESS" ? "SUCCESS" : "OTHERS",
    outTradeNo: obj.out_trade_no ?? "",
    outRefundNo: obj.out_refund_no ?? ""
  };
}
```
<Partial Item Refund>
On the refund page (whether initiated by the user or directly by the merchant), the following must be designed:
** A detailed item selection component(User-Initiated) **
** A custom refund amount input field(Merchant-Initiated) **
Only when the entire amount is refunded will the order status change to "Refunded"; otherwise, it is possible to continue refunding the remaining unpaid portion.
</Partial Item Refund>
<User-Initiated Refund>
User applies → Merchant approves
1. Edge Function: create_refund_request, execute_refund_after_approval
  - create_refund_request:
    - generate a refund order number
    - Calculate the refund amount
    - Add refund application record
  - execute_refund_after_approval:
    - Handle the refund logic
2. add refund button on order details page
3. Create a refund application page that includes an order item selector.
4. Create a merchant approval page.
</User-Initiated Refund>
<Merchant-Initiated Refund>
Merchant views orders → Merchant issues refund directly
1. Edge Function: execute_refund_directly
2. Add a page to view all orders. On this page, you can process refunds for orders.
</Merchant-Initiated Refund>
</Refund System>
</PAYMENT_REQUIREMENTS>
