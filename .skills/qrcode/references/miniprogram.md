# QR Code — Mini Program

WeChat Mini Program cannot generate QR codes on the frontend (no Canvas-based QR library support). Use an Edge Function to generate and store the QR image.

## Generation (Edge Function + Storage)

```typescript
// supabase/functions/generate-qrcode/index.ts
import QRCode from 'npm:qrcode'
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const { text } = await req.json()
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const pngBuffer = await QRCode.toBuffer(text, { type: 'png', width: 300 })
  const filename = `${crypto.randomUUID()}.png`
  await supabase.storage.from('qrcodes').upload(filename, pngBuffer, { contentType: 'image/png' })
  const { data } = supabase.storage.from('qrcodes').getPublicUrl(filename)
  return Response.json({ url: data.publicUrl })
})
```

## Setup

- Create `qrcodes` bucket in migration SQL (public read, no auth required for display)
- Deploy with `supabase_deploy_edge_function`

## Frontend Display

```typescript
const { data } = await supabase.functions.invoke('generate-qrcode', { body: { text } })
// render: <Image src={data.url} mode="aspectFit" />
```

## In-App Scanner Page

Always pair QR generation with a scanner page:
- Use `Taro.scanCode()` to read QR content
- Query DB with the scanned value
- Display the result with role-based access control per the app's role schema
