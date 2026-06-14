# Submit Image-to-Video Task

## API Overview

| Item | Details |
|------|---------|
| Endpoint | `POST https://api-rY7JZvg0dqdL@api-singapore.klingai.com/v1/videos/image2video` |
| Authentication | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/json` |
| Billing | Discounted price ¥70.00 / request (billed on submission regardless of final result) |

## Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model_name` | `string` | Yes | Model version: `kling-v1` / `kling-v1-5` / `kling-v1-6` / `kling-v2-master` / `kling-v2-1` / `kling-v2-1-master` / `kling-v2-5-turbo` |
| `image` | `string` | Yes | Reference image. Can be an image URL or a pure Base64 string (without prefix — see format notes below) |
| `prompt` | `string` | No | Text prompt to guide video generation content |
| `duration` | `string` | Yes | Video duration in seconds: `"5"` or `"10"` |

### Base64 Image Format Notes

- Provide only the pure Base64 string — **do not** include the `data:image/png;base64,` prefix
- Supported formats: `.jpg` / `.jpeg` / `.png`
- File size: ≤ 10 MB
- Minimum dimensions: width and height both ≥ 300 px
- Aspect ratio: 1:2.5 ~ 2.5:1

```
// Correct
iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4...

// Incorrect (includes prefix)
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAA...
```

## Response Fields

| Field path | Type | Description |
|------------|------|-------------|
| `code` | `number` | Status code; `0` indicates success |
| `message` | `string` | Status description |
| `request_id` | `string` | Unique request identifier |
| `data.task_id` | `string` | Task ID used for subsequent polling |
| `data.task_status` | `string` | Initial status, typically `submitted` |
| `data.task_info` | `object` | Task metadata object |
| `data.task_info.external_task_id` | `string` | External task ID associated with the task |
| `data.created_at` | `number` | Task creation time (millisecond timestamp) |
| `data.updated_at` | `number` | Task last updated time (millisecond timestamp) |

### Task Status Values

| Status | Meaning |
|--------|---------|
| `submitted` | Submitted, waiting to be processed |
| `processing` | Currently being processed |
| `succeed` | Succeeded, video result is available |
| `failed` | Failed, `task_status_msg` contains the reason |

---

## Generation-Time Usage (Agent Direct Call)

```typescript
const AUTH_VALUE = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed — injected by platform

interface SubmitResponse {
  taskId: string;
}

async function submitImageToVideo(params: {
  modelName: string;
  image: string;       // pure Base64 string or image URL
  prompt?: string;
  duration: "5" | "10";
}): Promise<SubmitResponse> {
  const body: Record<string, string> = {
    model_name: params.modelName,
    image: params.image,
    duration: params.duration,
  };
  if (params.prompt) body.prompt = params.prompt;

  const response = await fetch(
    "https://api-rY7JZvg0dqdL@api-singapore.klingai.com/v1/videos/image2video",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${AUTH_VALUE}`,
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 0) throw new Error(`API error ${json.code}: ${json.message}`);

  return { taskId: json.data.task_id };
}
```

---

## Post-Generation Usage (In-App via Edge Function)

### Edge Function — `edge-functions/image-to-video-submit.ts`

```typescript
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Parse client request ---
  let modelName: string;
  let image: string;
  let duration: string;
  let prompt: string | undefined;

  try {
    const body = await req.json();
    modelName = body.model_name;
    image = body.image;
    duration = body.duration;
    prompt = body.prompt;
    if (!modelName) throw new Error("Missing model_name");
    if (!image) throw new Error("Missing image");
    if (!duration) throw new Error("Missing duration");
    if (duration !== "5" && duration !== "10") throw new Error("duration must be '5' or '10'");
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Inject platform key (never expose to client) ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Call upstream ---
  const requestBody: Record<string, string> = { model_name: modelName, image, duration };
  if (prompt) requestBody.prompt = prompt;

  const upstream = await fetch(
    "https://api-rY7JZvg0dqdL@api-singapore.klingai.com/v1/videos/image2video",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    }
  );

  // Forward quota/balance errors verbatim
  if (upstream.status === 429 || upstream.status === 402) {
    const errText = await upstream.text();
    return new Response(errText, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!upstream.ok) {
    return new Response(
      JSON.stringify({ error: `Upstream error: ${upstream.status}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const data = await upstream.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

### Frontend Call — Submit Task

**Recommended approach (when supabase client is available):**

```typescript
async function submitImageToVideo(params: {
  model_name: string;
  image: string;
  duration: "5" | "10";
  prompt?: string;
}) {
  const { data, error } = await supabase.functions.invoke("image-to-video-submit", {
    body: params,
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API error ${data.code}: ${data.message}`);
  return data.data; // { task_id, task_status, ... }
}
```

**Fallback approach (when supabase client is unavailable):**

```typescript
async function submitImageToVideo(params: {
  model_name: string;
  image: string;
  duration: "5" | "10";
  prompt?: string;
}) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-to-video-submit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    }
  );

  if (res.status === 429) {
    const err = await res.json();
    throw new Error(`Quota exceeded: ${err.message ?? res.statusText}`);
  }
  if (res.status === 402) {
    const err = await res.json();
    throw new Error(`Insufficient balance: ${err.message ?? res.statusText}`);
  }
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);

  const json = await res.json();
  if (json.code !== 0) throw new Error(`API error ${json.code}: ${json.message}`);
  return json.data;
}
```
