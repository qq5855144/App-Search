---
name: image-to-video
description: Generate short videos from a static image using the Kling AI image-to-video API. Use this skill whenever the user wants to animate an image, create a video from a photo, turn a picture into a video clip, or generate AI video from an uploaded image.
license: MIT
---

# Image to Video

Use Kling AI to generate a short video (5 or 10 seconds) from a single image. Supports multiple model versions and optional text prompts to guide the generated content. The API is asynchronous — submit a task and then poll for status until completion.

## Capability Overview

| Item | Details |
|------|---------|
| Submit endpoint | `POST https://api-rY7JZvg0dqdL@api-singapore.klingai.com/v1/videos/image2video` |
| Query endpoint | `GET https://api-oYA6Z8wDBRDa@api-singapore.klingai.com/v1/videos/image2video/{id}` |
| Processing mode | Async — submit then poll, maximum wait 10 minutes |
| Video duration | `"5"` or `"10"` seconds |
| Image requirements | JPG/JPEG/PNG, ≤ 10 MB, minimum dimension ≥ 300 px, aspect ratio 1:2.5 ~ 2.5:1 |
| Billing | Original price ¥91.00 / request, discounted price ¥70.00 / request (only the submit endpoint is billed; query is free) |

### Response Example

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "task_id": "task_abc123",
    "task_status": "succeed",
    "task_result": {
      "videos": [
        {
          "id": "video_123",
          "url": "https://example.com/video.mp4",
          "duration": "5.0"
        }
      ]
    }
  }
}
```

## End-to-End Workflow (Async Polling)

```
1. Submit task (POST /v1/videos/image2video)  →  obtain task_id
2. Poll status (GET /v1/videos/image2video/{task_id})  →  every 7 seconds
3. When task_status === "succeed"  →  retrieve video URL from task_result.videos[0].url
4. Download the video URL to local storage / Supabase Storage
```

### Polling Pattern Code (SKILL.md Main Workflow)

```typescript
async function generateAndWait(
  submitFn: () => Promise<{ taskId: string }>
): Promise<{ videoUrl: string; duration: string }> {
  const { taskId } = await submitFn();

  const POLL_INTERVAL_MS = 7000;         // poll every 7 seconds
  const TIMEOUT_MS = 10 * 60 * 1000;    // maximum 10 minutes
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryTask(taskId);
    if (result.task_status === "succeed") {
      const video = result.task_result.videos[0];
      return { videoUrl: video.url, duration: video.duration };
    }
    if (result.task_status === "failed") {
      throw new Error(`Task failed: ${result.task_status_msg ?? "unknown reason"}`);
    }
    // submitted / processing → continue polling
  }
  throw new Error(`Task ${taskId} timed out after 10 minutes`);
}
```

## Generation-Time Usage (Agent Direct Call)

For full parameter documentation and generation-time code, refer to:

- `references/submit-api.md` — Submit task endpoint (POST)
- `references/query-api.md` — Query task endpoint (GET)

**Generation-time file download (required):**

The video URL returned by the API is a temporary CDN link. Once the URL is obtained, **you must immediately download the file to local storage using the Bash tool** so the user can view the result.

```bash
curl -L -o ./output_video.mp4 "<generated video URL>"
```

**Complete generation-time workflow (including download step):**

1. Call the submit function to obtain `task_id`
2. Poll the query endpoint until `task_status === "succeed"`
3. Retrieve `task_result.videos[0].url`
4. Use the Bash tool to run `curl -L -o ./output_video.mp4 "<url>"` to download the video locally
5. Inform the user that the file has been saved to the corresponding path

> **Note**: Upstream CDN links are time-limited. Download immediately after obtaining the URL — do not delay.

## Post-Generation Usage (In-App via Edge Function)

In-app integration requires two Edge Functions: one to submit the task and one to query status and download the video. For complete Edge Function code and frontend call examples, refer to:

- `references/submit-api.md` — Submit task Edge Function and frontend call
- `references/query-api.md` — Query task Edge Function (including Supabase Storage video transfer) and frontend call

## Notes

- **Key security**: `INTEGRATIONS_API_KEY` must only be read server-side in Edge Functions — never expose it to the frontend.
- **Base64 image format**: When using Base64, provide only the pure Base64 string — **do not** include the `data:image/png;base64,` prefix.
- **Error handling**: Always handle 429 (quota exceeded) and 402 (insufficient balance).
- **Billing**: The submit endpoint is billed per request (discounted price ¥70.00 / request); the query endpoint is free. Avoid unnecessary repeated submissions caused by parameter errors.
- **Concurrency limit**: For the same account, keep concurrent submission counts under control to avoid rate limiting.
