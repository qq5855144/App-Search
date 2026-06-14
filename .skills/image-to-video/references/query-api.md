# Query Image-to-Video Task

## API Overview

| Item | Details |
|------|---------|
| Endpoint | `GET https://api-oYA6Z8wDBRDa@api-singapore.klingai.com/v1/videos/image2video/{id}` |
| Authentication | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/json` |
| Billing | Not billed |

> **Note**: This is a GET request. Parameters are passed via the URL path (`{id}`) and cannot be sent through the request body.

## Request Parameters

| Parameter | Type | Location | Required | Description |
|-----------|------|----------|----------|-------------|
| `id` | `string` | Path | Yes | Task ID (`task_id`) or external task ID (`external_task_id`) |

## Response Fields

| Field path | Type | Description |
|------------|------|-------------|
| `code` | `number` | Status code; `0` indicates success |
| `message` | `string` | Status description |
| `request_id` | `string` | Unique request identifier |
| `data.task_id` | `string` | Task ID |
| `data.task_status` | `string` | Task status — see table below |
| `data.task_status_msg` | `string?` | Error message when task has failed |
| `data.task_info` | `object` | Task metadata object |
| `data.task_info.external_task_id` | `string` | External task ID associated with the task |
| `data.created_at` | `number` | Task creation time (millisecond timestamp) |
| `data.updated_at` | `number` | Task last updated time (millisecond timestamp) |
| `data.task_result.videos` | `array?` | List of videos on success; present only when status is `succeed` |
| `data.task_result.videos[].id` | `string` | Video ID |
| `data.task_result.videos[].url` | `string` | Video CDN URL (temporary link — download or transfer immediately) |
| `data.task_result.videos[].duration` | `string` | Video duration in seconds, e.g. `"5.0"` |

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

interface VideoInfo {
  id: string;
  url: string;
  duration: string;
}

interface QueryResponse {
  task_id: string;
  task_status: "submitted" | "processing" | "succeed" | "failed";
  task_status_msg?: string;
  task_info: {
    external_task_id: string;
  };
  created_at: number;
  updated_at: number;
  task_result?: {
    videos: VideoInfo[];
  };
}

async function queryImageToVideoTask(taskId: string): Promise<QueryResponse> {
  const response = await fetch(
    `https://api-oYA6Z8wDBRDa@api-singapore.klingai.com/v1/videos/image2video/${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${AUTH_VALUE}`,
      },
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 0) throw new Error(`API error ${json.code}: ${json.message}`);

  return json.data as QueryResponse;
}
```

**Generation-time file download (required):**

The video URL returned by the API is a temporary CDN link. Once the URL is obtained in the generation-time scenario (Agent direct call), **you must immediately download the file to local storage using the Bash tool** so the user can view the result.

```bash
curl -L -o ./output_video.mp4 "<generated video URL>"
```

**Complete generation-time workflow (including download step):**

1. Call `submitImageToVideo()` to obtain `task_id` (see `submit-api.md`)
2. Call `queryImageToVideoTask(taskId)` every 7 seconds to poll status
3. When `task_status === "succeed"`, retrieve `task_result.videos[0].url`
4. Use the Bash tool to run `curl -L -o ./output_video.mp4 "<url>"` to download the video locally
5. Inform the user that the file has been saved to the corresponding path

> **Note**: Upstream CDN links are time-limited. Download immediately after obtaining the URL — do not delay.

---

## Post-Generation Usage (In-App via Edge Function)

### Edge Function — `edge-functions/image-to-video-query.ts`

The query Edge Function also handles transferring the video from the upstream CDN to Supabase Storage to prevent temporary link expiry.

```typescript
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/**
 * Stream a remote video directly into Supabase Storage.
 */
async function streamVideoToStorage(
  videoUrl: string,
  bucketName: string,
): Promise<{ success: true; path: string; publicUrl: string } | { success: false; error: string }> {
  try {
    new URL(videoUrl); // validate format
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }
    const contentType = response.headers.get("content-type") ?? "video/mp4";
    const ext = contentType.split("/")[1]?.split(";")[0] ?? "mp4";
    const filePath = `uploads/${crypto.randomUUID()}.${ext}`;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, response.body!, { contentType, cacheControl: "no-cache", upsert: false });

    if (error) throw error;

    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return { success: true, path: data.path, publicUrl: urlData.publicUrl };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Parse client request ---
  let taskId: string;
  try {
    const body = await req.json();
    taskId = body.task_id;
    if (!taskId) throw new Error("Missing task_id");
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

  // --- Call upstream query API ---
  const upstream = await fetch(
    `https://api-oYA6Z8wDBRDa@api-singapore.klingai.com/v1/videos/image2video/${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
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

  // --- Transfer video to Supabase Storage when task succeeds ---
  if (
    data.code === 0 &&
    data.data?.task_status === "succeed" &&
    data.data?.task_result?.videos?.length > 0
  ) {
    const videos = data.data.task_result.videos as Array<{
      id: string;
      url: string;
      duration: string;
    }>;

    // Transfer each video URL to Supabase Storage
    const transferredVideos = await Promise.all(
      videos.map(async (video) => {
        const transfer = await streamVideoToStorage(video.url, "generated-media");
        if (transfer.success) {
          return { ...video, url: transfer.publicUrl };
        }
        // Fall back to original URL if transfer fails
        console.error(`Storage transfer failed for video ${video.id}: ${transfer.error}`);
        return video;
      })
    );

    data.data.task_result.videos = transferredVideos;
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

### Frontend Call — Polling Query

**Recommended approach (when supabase client is available):**

```typescript
async function queryImageToVideoTask(taskId: string) {
  const { data, error } = await supabase.functions.invoke("image-to-video-query", {
    body: { task_id: taskId },
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API error ${data.code}: ${data.message}`);
  return data.data;
}
```

**Fallback approach (when supabase client is unavailable):**

```typescript
async function queryImageToVideoTask(taskId: string) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-to-video-query`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId }),
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

**Complete frontend polling flow example:**

```typescript
async function waitForVideo(taskId: string): Promise<string> {
  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryImageToVideoTask(taskId);

    if (result.task_status === "succeed") {
      // URL has been transferred to Supabase Storage by the Edge Function — use directly
      return result.task_result.videos[0].url;
    }
    if (result.task_status === "failed") {
      throw new Error(`Video generation failed: ${result.task_status_msg ?? "unknown reason"}`);
    }
    // submitted / processing → continue polling
  }
  throw new Error(`Task ${taskId} timed out after 10 minutes`);
}
```
