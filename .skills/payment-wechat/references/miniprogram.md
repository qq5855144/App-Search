<TRANSACTION_REQUIREMENTS>
Design Principles:
1. ** IMPORTANT **：Think minimal pages, complete flow for payment and refund.
    - Analyze user requirements to determine the MINIMAL page set needed for complete workflow
    - MUST ensure workflow is complete and closed-loop, but avoid unnecessary pages
    - Only if the user requires partial refund, you MUST pay attention to partial refund and mention it in `todo.md`
2. Required items > User requirements > Recommended items.
3. Orders/refunds modified only by edge functions with a server role. User-level permissions prohibited.
4. **NO PLACEHOLDER PAGES**: No TODO items—all payment and refund code must be production-complete. NO placeholder content.
5. Idempotency: Use optimistic locking, check affected rows > 0 before triggering business logic.
6. Transaction atomicity: Operations in same TX must succeed or fail together.
7. Environment check: WeChat Payment only works in "WEAPP". Display "非微信小程序环境无法发起支付，请在正式版微信小程序中使用此功能" if not in WEAPP.
8. Authentication & OpenID requirements:
    - Payment and refund require openid
    - Follow Requirements in <AUTHORIZATION_AND_AUTHENTICATION> for login method selection
    - When user submits order:
        - **If not logged in**: use unified redirect mechanism to login page
        - **If logged in**: get openid and proceed with payment
    - Use auth system's unified redirect (loginRedirectPath storage) to return to payment flow after login
    - **Auth state initialization**: Before querying orders in payment/order pages, call `await supabase.auth.getUser()` to ensure auth token is restored (prevents auth.uid() = null in RLS checks)
9. **Trigger Conditions**:
    - **Refund trigger**: Do NOT implement refund if user only asks for payment/purchase functionality

Edge Functions to create and deploy:
1. `create_wechat_payment` - Create payment order and return payment params
2. `wechat_payment_callback` - Handle WeChat payment success callback
3. `get_wechat_openid` - Get openid for logged-in users (non-WeChat login) who don't have openid. Without this, username-password users cannot pay.
4. `refund_order` - Create refund request (only if refund required)
5. `wechat_refund_callback` - Handle WeChat refund result callback (only if refund required)

<SILENT_LOGIN>
Required Items (Silent Login):
1. Silent login is used to obtain openid for logged-in users (non-wechat login) who don't directly get openid.
2. Edge function `get_wechat_openid` implementation:
```typescript
const APP_ID = Deno.env.get('THIRD_PARTY_LOGIN_APP_ID') || '';
const AUTHORIZATION = Deno.env.get('WX_OPEN_CFC_JWT_TOKEN') || '';
const URL = 'https://ct6gb7rg8n0rf.cfc-execute.bj.baidubce.com/get_openid';

Deno.serve(async (req: Request) => {
  try {
    const { code } = await req.json();

    const res = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': AUTHORIZATION
      },
      body: JSON.stringify({
        appid: APP_ID,
        jscode: code
      })
    });

    const data = await res.json();

    if (!data.openid) {
      console.error(`[WeChatLogin FAILED] response=${JSON.stringify(data)}`);
      return Response.json({ success: false, error: 'Failed to get openid' });
    }

    console.log(`[WeChatLogin SUCCESS] openid=${data.openid}`);
    return Response.json({ success: true, openid: data.openid });
  } catch (err) {
    console.error(`[WeChatLogin ERROR] error=${err?.message || String(err)}`);
    return Response.json({ success: false, error: err?.message || String(err) });
  }
});
```
3. Frontend workflow:
    1. Call taro.login() to get jscode
    2. Call `get_wechat_openid` edge function to get openid
    3. Proceed with payment using this openid
    4. Call when user submits order (before payment)
</SILENT_LOGIN>

<PAYMENT_REQUIREMENTS>
Required Items (Payment):
1. Frontend: payment button → call create_wechat_payment → receive params → call `Taro.requestPayment()`.
2. Orders must link to purchaser openid.
3. **create_wechat_payment** (TX1):
   - Calculate total
   - [TX1] Inventory freeze + order save (pending)
   - Call WeChat prepay API (post-TX1)
   - Return payment params (timeStamp, nonceStr, package, signType, paySign)
   - WeChat fail = order pending (auto-cancel)
4. **wechat_payment_callback** (TX2):
   - Decrypt + verify payment (check: trade_state='SUCCESS', amount matches order)
   - [TX2] Order update (pending→paid) + inventory convert (reserved→sold)
   - **State change thinking**: UPDATE should constrain current state in WHERE clause
   - **Idempotency thinking**: Check affected rows. 0 = duplicate callback (skip logic, return SUCCESS). >0 = first callback (execute logic)
   - Return SUCCESS for duplicate callbacks or successful updates. Return failure only for retriable errors
5. Use WeChat Pay **JSAPI API** exclusively. Secrets (exact names, configured via Plugin Center): MERCHANT_ID, MERCHANT_APP_ID, MCH_CERT_SERIAL_NO, MCH_PRIVATE_KEY, WECHAT_PAY_PUBLIC_KEY_ID, WECHAT_PAY_PUBLIC_KEY, MCH_API_V3_KEY
6. If secrets are missing or WeChat API fails: frontend must display detailed error prompting user to check configuration.
7. Utility functions below must be used unmodified.
```typescript
// create_wechat_payment
import Wechatpay, { Formatter, Rsa } from "npm:wechatpay-axios-plugin@0.9.4";
import ShortUniqueId from "npm:short-unique-id";

const generateOrderNo = () => `ORD-${new Date().toISOString().slice(2,10).replace(/-/g,"")}-${new ShortUniqueId({length:8}).rnd()}`;
async function createWechatPrepay(MERCHANT_ID, MERCHANT_APP_ID, MCH_CERT_SERIAL_NO, MCH_PRIVATE_KEY, WECHAT_PAY_PUBLIC_KEY_ID, WECHAT_PAY_PUBLIC_KEY, outTradeNo, amount, openid, notifyUrl, description) {
  try {
    const wxpay = new Wechatpay({
      mchid: MERCHANT_ID,
      serial: MCH_CERT_SERIAL_NO,
      privateKey: MCH_PRIVATE_KEY,
      certs: { [WECHAT_PAY_PUBLIC_KEY_ID]: WECHAT_PAY_PUBLIC_KEY },
    });

    const { data } = await wxpay.v3.pay.transactions.jsapi.post({
      mchid: MERCHANT_ID,
      appid: MERCHANT_APP_ID,
      description: description || '商品购买',
      out_trade_no: outTradeNo,
      notify_url: notifyUrl,
      amount: { total: Math.round(amount * 100), currency: 'CNY' },
      payer: { openid },
    }, { headers: { 'Wechatpay-Serial': WECHAT_PAY_PUBLIC_KEY_ID } });

    if (data.prepay_id) {
      const nonceStr = Formatter.nonce();
      const timeStamp = '' + Formatter.timestamp();
      const packageStr = 'prepay_id=' + data.prepay_id;
      const paySign = Rsa.sign(
        Formatter.joinedByLineFeed(MERCHANT_APP_ID, timeStamp, nonceStr, packageStr),
        Rsa.from(MCH_PRIVATE_KEY)
      );
      return new Response(JSON.stringify({ success: true, paymentParams: { timeStamp, nonceStr, package: packageStr, signType: 'RSA', paySign } }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      return new Response(JSON.stringify({ success: false, error: "发起支付失败" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (err) {
    console.error(`[WeChatPay ERROR] outTradeNo=${outTradeNo}, error=${err?.message || String(err)}`);
    return new Response(JSON.stringify({ success: false, error: err?.message || String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// wechat_payment_callback
import { Aes } from "npm:wechatpay-axios-plugin@0.9.4";

async function decryptTradeState(MCH_API_V3_KEY: string, associatedData: string, nonce: string, ciphertext: string): Promise<{ tradeState: string; outTradeNo: string; transactionId: string }> {
  const plaintext = await Aes.AesGcm.decrypt(ciphertext, MCH_API_V3_KEY, nonce, associatedData);
  const obj = JSON.parse(plaintext);
  return {
    tradeState: (obj.trade_state ?? "") === "SUCCESS" ? "SUCCESS" : "OTHERS",
    outTradeNo: obj.out_trade_no ?? "",
    transactionId: obj.transaction_id ?? ""
  };
}
```

Recommended Items (Payment):
1. **Polling mechanism**: Even though mini-program has Taro.requestPayment callback, implement polling every 2 seconds on order detail page to check order status as backup. If payment is successful, auto-redirect to next business flow.
2. For inventory management, encapsulate all data mutations in RPC functions as atomic transactions to maintain consistency.
3. Display detailed error messages to developers on the frontend when SECRETS are misconfigured or WeChat Pay API calls fail.
</PAYMENT_REQUIREMENTS>

<REFUND_REQUIREMENTS>
Required Items (Refund):

1. **MANDATORY PAGE**:
   - Admin refund management page - Implement the following tabs as needed:
       **Refund Requests Tab**: Review pending user refund applications (approve/reject)
       **Order Refunds Tab**: Direct Admin refunds on paid orders
2. **REFUNDABLE AMOUNT CALCULATION**:
   - Real-time refundable amount calculation
   - Display remaining refundable amount to user
   - Reject refund applications exceeding remaining refundable amount
   - Create get_refundable_amount() and update_item_refund_amount() RPC functions to handle calculation and updates
3. **IMPORTANT REFUND FLOW**:
   - **User applies**: Create refund record with status='pending_review', refund_no=NULL, reason, item_index, refund_amount
   - **System validation**: Check if refund_amount ≤ remaining refundable amount for specified item
   - **Admin actions**: In admin management pages, only admin can:
       - Approve user refund: Call refund_order edge function with existing user refund record
       - Reject user refund: Update status='closed' with rejection reason (no edge function call needed)
       - Admin direct refund: Call refund_order edge function without existing user refund record
   - **Multiple applications**: User can reapply for same item until fully refunded or order closes
   - **Partial refund state management**: Check refundable amount before allowing refund applications. Only orders with remaining refundable balance > 0 allow new refund requests. Refresh order state after each refund completion.
5. **refund_order edge function**: Execute refund processing logic:
   - **Pre-validation**: Call get_refundable_amount() to check remaining refundable amount for specified item
   - **Reject if insufficient**: Reject if requested amount exceeds refundable limit
   - Generate refund_no, update status='processing'
   - Call WeChat refund API with validated refund amount
   - Return refund result to admin page
6. **wechat_refund_callback edge function** (TX3 - Atomic), handled by refund_status:
   - **SUCCESS**: [TX3] Update refund status + Call update_item_refund_amount() + Update order status + inventory.
   - **CLOSED**: Update to closed, notify admin
   - **ABNORMAL**: Update to abnormal, notify admin
7. RLS: Users can INSERT refund or orders table. UPDATE operations handled by edge functions with server role.

```typescript
// refund_order edge function
import Wechatpay from "npm:wechatpay-axios-plugin@0.9.4";
import ShortUniqueId from "npm:short-unique-id";

const generateRefundOrderNo = () => `REF-${new Date().toISOString().slice(2,10).replace(/-/g,"")}-${new ShortUniqueId({length:8}).rnd()}`;
const outRefundNo = generateRefundOrderNo();

async function createWechatRefund(MERCHANT_ID, MCH_CERT_SERIAL_NO, MCH_PRIVATE_KEY, WECHAT_PAY_PUBLIC_KEY_ID, WECHAT_PAY_PUBLIC_KEY, outTradeNo, outRefundNo, refund_amount, total_amount, reason, notifyUrl) {
  try {
    const wxpay = new Wechatpay({
      mchid: MERCHANT_ID,
      serial: MCH_CERT_SERIAL_NO,
      privateKey: MCH_PRIVATE_KEY,
      certs: { [WECHAT_PAY_PUBLIC_KEY_ID]: WECHAT_PAY_PUBLIC_KEY },
    });

    const { data } = await wxpay.v3.refund.domestic.refunds.post({
      out_trade_no: outTradeNo,
      out_refund_no: outRefundNo,
      reason: reason || "退款",
      notify_url: notifyUrl,
      amount: {
        refund: Math.round(refund_amount * 100),
        total: Math.round(total_amount * 100),
        currency: "CNY"
      }
    }, { headers: { "Wechatpay-Serial": WECHAT_PAY_PUBLIC_KEY_ID } });

    if (data.refund_id) {
      return new Response(JSON.stringify({ success: true, refundId: data.refund_id, status: data.status }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      console.error(`[WeChatRefund FAILED] outRefundNo=${outRefundNo}, error=发起退款失败`);
      return new Response(JSON.stringify({ success: false, error: "发起退款失败" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (err) {
    console.error(`[WeChatRefund ERROR] outRefundNo=${outRefundNo}, error=${err?.message || String(err)}`);
    return new Response(JSON.stringify({ success: false, error: err?.message || String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// refund_callback edge function
import { Aes } from "npm:wechatpay-axios-plugin@0.9.4";
async function decryptRefundState(MCH_API_V3_KEY: string, associatedData: string, nonce: string, ciphertext: string): Promise<{ refundStatus: string; outTradeNo: string; outRefundNo: string }> {
  const plaintext = await Aes.AesGcm.decrypt(ciphertext, MCH_API_V3_KEY, nonce, associatedData);
  const obj = JSON.parse(plaintext);
  return {
    refundStatus: obj.refund_status ?? "",
    outTradeNo: obj.out_trade_no ?? "",
    outRefundNo: obj.out_refund_no ?? ""
  };
}
```
</REFUND_REQUIREMENTS>

<DB_SCHEMA>
```sql
create type order_status as enum ('pending','paid','shipped','completed','cancelled','refunded');
create type refund_status as enum ('pending_review','processing','completed','closed','abnormal');

create table public.sku (
  id uuid primary key default gen_random_uuid(),
  sku_code text unique not null, name text not null, price numeric(10,2) not null,
  stock_available int default 0, stock_reserved int default 0, stock_sold int default 0,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint stock_nonneg check (stock_available>=0 and stock_reserved>=0 and stock_sold>=0)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text unique not null,
  user_id uuid not null references auth.users(id),
  openid text not null,
  status order_status default 'pending',
  items jsonb not null default '[]',
  /*
    items 结构：
    [{
      "sku_code": "SKU001",
      "sku_snapshot": {...},
      "quantity": 2,
      "unit_price": 10.00,
      "subtotal": 20.00,
      "refunded_quantity": 0,
      "refunded_amount": 0
    }, ...]
  */
  total_amount numeric(12,2) not null,
  refunded_amount numeric(12,2) default 0,
  wechat_transaction_id text,
  version int default 0,
  paid_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  refund_no text unique,
  order_no text not null references public.orders(order_no),
  item_index int not null,  -- items 数组索引（从 0 开始）
  user_id uuid not null references auth.users(id),
  initiated_by text not null default 'user',
  status refund_status default 'pending_review',
  refund_quantity int not null default 1,     -- 本次退款数量
  refund_amount numeric(12,2) not null,       -- 本次退款金额
  reason text,
  wechat_refund_id text,
  version int default 0,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```
</DB_SCHEMA>
</TRANSACTION_REQUIREMENTS>
