# DeepResearch 完整调用工作流

## 目录

1. [完整流程图](#完整流程图)
2. [Python 实现示例](#python-实现示例)
3. [Go 实现要点](#go-实现要点)
4. [并发压测模式](#并发压测模式)
5. [常见问题排查](#常见问题排查)

---

## 完整流程图

```
用户输入研究问题
       ↓
[Step 1] POST /create → 获取 conversation_id
       ↓
[Step 2] POST /run (初始 query) → 读 SSE 流
       ↓
[Step 3] 从 SSE 事件中提取：
  - interrupt_id（/toolcall/interrupt 的 text.data 嵌套JSON）
  - structured_outline（/toolcall/structured_outline 的 text.data 嵌套JSON）
       ↓
[Step 4] POST /run (query="确认" + interrupt_id + structured_outline)
  → 读 SSE 流，直到收到 .html 文件事件
       ↓
  提取报告文件下载链接（.md 和 .html）
```

---

## Python 实现示例

```python
import json
import requests
import time

BASE_URL = "https://app-cblk1rqa5fk1-api-ELbWqrZ1krJY-gateway.appmiaoda.com/v2"
API_KEY = "your-api-key"
AGENT_ID = "your-agent-id"

HEADERS = {
    "X-Gateway-Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "Accept-Encoding": "identity",  # 禁用 gzip，确保 SSE 正常接收
}

IDLE_TIMEOUT = 600  # 10 分钟空闲超时


def create_conversation():
    """Step 1: 创建会话，获取 conversation_id"""
    resp = requests.post(
        f"{BASE_URL}/agent/deepresearch/create",
        headers=HEADERS,
        json={"agent_id": AGENT_ID},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["result"]["conversation_id"]


def stream_sse(payload, early_stop=None):
    """
    发送 POST /run 并读取 SSE 流，返回所有事件列表。
    early_stop: callable(event) -> bool，返回 True 时提前退出
    """
    events = []
    with requests.post(
        f"{BASE_URL}/agent/deepresearch/run",
        headers=HEADERS,
        json=payload,
        stream=True,
        timeout=None,  # 不设整体超时，用空闲超时控制
    ) as resp:
        resp.raise_for_status()
        last_data_time = time.time()

        for line in resp.iter_lines(decode_unicode=True):
            # 检查空闲超时
            if time.time() - last_data_time > IDLE_TIMEOUT:
                raise TimeoutError("SSE idle timeout (10 min)")

            if not line:
                continue

            last_data_time = time.time()

            # 解析 SSE 行
            if line.startswith("data:"):
                raw = line[5:].strip()
            elif line.startswith("data:{"):
                raw = line[4:].strip()
            else:
                continue

            if raw == "[DONE]":
                break

            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                continue

            events.append(event)

            # 检查结束信号
            if event.get("status") == "interrupt":
                break

            for content in event.get("content", []):
                ev_info = content.get("event") or {}
                if ev_info.get("is_end") and ev_info.get("is_stop"):
                    return events

            # 提前退出回调
            if early_stop and early_stop(event):
                break

    return events


def extract_interrupt_id(events):
    """从事件流中提取 interrupt_id（注意嵌套JSON）"""
    for event in events:
        if event.get("status") == "interrupt":
            for content in event.get("content", []):
                if content.get("type") == "json":
                    ev_info = content.get("event") or {}
                    if ev_info.get("name") == "/toolcall/interrupt":
                        text = content.get("text", {})
                        # 嵌套JSON：text.data 是字符串
                        if "data" in text:
                            inner = json.loads(text["data"])
                            if inner.get("interrupt_id"):
                                return inner["interrupt_id"]
    return None


def extract_structured_outline(events):
    """从事件流中提取 structured_outline（注意嵌套JSON）"""
    for event in events:
        for content in event.get("content", []):
            if content.get("type") == "json":
                ev_info = content.get("event") or {}
                if ev_info.get("name") == "/toolcall/structured_outline":
                    text = content.get("text", {})
                    if "data" in text:
                        return json.loads(text["data"])
    return None


def extract_files(events):
    """从事件流中提取生成的文件信息"""
    files = {}
    for event in events:
        for content in event.get("content", []):
            if content.get("type") == "files":
                text = content.get("text", {})
                filename = text.get("filename", "")
                if filename.endswith(".md") and "md" not in files:
                    files["md"] = text
                elif filename.endswith(".html") and "html" not in files:
                    files["html"] = text
    return files


def run_deepresearch(query):
    """执行一次完整的深度研究流程"""
    # Step 1: 创建会话
    conversation_id = create_conversation()
    print(f"conversation_id: {conversation_id}")

    # Step 2: 发起初始查询
    init_payload = {
        "query": query,
        "agent_id": AGENT_ID,
        "conversation_id": conversation_id,
    }
    events = stream_sse(init_payload)
    print(f"初始查询完成，收到 {len(events)} 个事件")

    # Step 3: 提取大纲数据
    interrupt_id = extract_interrupt_id(events)
    outline = extract_structured_outline(events)
    if not interrupt_id or not outline:
        raise ValueError("未能从事件流中提取 interrupt_id 或 structured_outline")
    print(f"大纲标题: {outline.get('title')}")
    print(f"interrupt_id: {interrupt_id}")

    # Step 4: 确认大纲，生成报告
    def is_html_file(event):
        for content in event.get("content", []):
            if content.get("type") == "files":
                filename = content.get("text", {}).get("filename", "")
                if filename.endswith(".html"):
                    return True
        return False

    confirm_payload = {
        "query": "确认",
        "agent_id": AGENT_ID,
        "conversation_id": conversation_id,
        "interrupt_id": interrupt_id,
        "structured_outline": outline,
    }
    events = stream_sse(confirm_payload, early_stop=is_html_file)
    print(f"报告生成完成，收到 {len(events)} 个事件")

    # 提取文件下载链接
    files = extract_files(events)
    print(f"MD 文件: {files.get('md', {}).get('download_url')}")
    print(f"HTML 文件: {files.get('html', {}).get('download_url')}")
    return files


if __name__ == "__main__":
    result = run_deepresearch("研究2025年全球AI市场规模与发展趋势")
```

---

## Go 实现要点

参考压测代码（`main.go`）的关键设计：

### HTTP Client 配置

```go
client := &http.Client{
    // 不设 Timeout！SSE 长连接下会被提前关闭
    Transport: &http.Transport{
        DisableCompression: true,  // 禁用 gzip，与 curl 行为一致
        ForceAttemptHTTP2:  false, // 强制 HTTP/1.1
        TLSNextProto:       make(map[string]func(authority string, c *tls.Conn) http.RoundTripper),
        DialContext: (&net.Dialer{
            Timeout:   30 * time.Second,
            KeepAlive: 30 * time.Second,
        }).DialContext,
    },
}
```

### SSE 空闲超时控制

```go
const idleTimeout = 10 * time.Minute
idleTimer := time.AfterFunc(idleTimeout, func() { cancel() })
defer idleTimer.Stop()

// 收到任意数据时重置计时器
idleTimer.Reset(idleTimeout)
```

### SSE 行读取（兼容两种格式）

```go
scanner := bufio.NewScanner(resp.Body)
scanner.Buffer(make([]byte, 10*1024*1024), 10*1024*1024) // 10MB buffer
for scanner.Scan() {
    line := scanner.Text()
    var raw string
    if strings.HasPrefix(line, "data: ") {
        raw = strings.TrimPrefix(line, "data: ")
    } else if strings.HasPrefix(line, "data:{") {
        raw = strings.TrimPrefix(line, "data:")
    } else {
        continue
    }
    if raw == "[DONE]" { break }
    // 解析 JSON...
}
```

---

## 并发压测模式

参考 `main.go` 的并发控制设计：

```python
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

def run_benchmark(queries, concurrency=5, total_requests=10):
    """并发压测"""
    results = []
    counter = 0
    lock = threading.Lock()

    def worker(idx):
        nonlocal counter
        query = queries[idx % len(queries)]

        # 请求间隔防限流
        with lock:
            nonlocal counter
            counter += 1
            n = counter
        if n > 1:
            time.sleep(0.1)  # 100ms 间隔

        start = time.time()
        try:
            files = run_deepresearch(query)
            duration = time.time() - start
            return {"success": True, "duration": duration, "files": files, "query": query}
        except Exception as e:
            duration = time.time() - start
            return {"success": False, "error": str(e), "duration": duration, "query": query}

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(worker, i) for i in range(total_requests)]
        for future in as_completed(futures):
            results.append(future.result())

    # 统计
    success = [r for r in results if r["success"]]
    print(f"总请求: {total_requests}, 成功: {len(success)}, 失败: {total_requests - len(success)}")
    if success:
        durations = [r["duration"] for r in success]
        print(f"平均耗时: {sum(durations)/len(durations):.1f}s")
        print(f"P99耗时: {sorted(durations)[int(len(durations)*0.99)]:.1f}s")
    return results
```

### 并发配置建议

| 场景       | concurrency | request_interval_ms |
| ---------- | ----------- | ------------------- |
| 功能测试   | 1           | 0                   |
| 轻度压测   | 3-5         | 100                 |
| 中度压测   | 10          | 200                 |
| 高并发压测 | 20+         | 500                 |

---

## 常见问题排查

### 1. SSE 流提前断开（context canceled）

- **原因**: 设置了整体 HTTP 超时或代理的连接超时
- **解决**: 使用空闲超时代替整体超时，超时时间 ≥ 10 分钟

### 2. 找不到 interrupt_id

- **原因**: 大纲阶段的 `text` 字段是嵌套 JSON 字符串，未做二次解析
- **解决**: 先解析 `text.data` 字段（字符串），再解析其中的 JSON

### 3. 报告生成超时（耗时 >10 分钟）

- **原因**: 深度研究任务耗时较长，服务端长时间未推送数据（已知问题）
- **解决**: 增大空闲超时时间，或监控报告生成任务状态

### 4. HTTP 400 / 401 错误

- **401**: API Key 无效或格式错误，检查 `X-Gateway-Authorization: Bearer {api_key}` 格式
- **400**: 请求参数错误，常见原因：`agent_id` 未传或 `interrupt_id` 不匹配