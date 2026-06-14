#!/usr/bin/env python3
"""
DeepResearch Agent API 调用脚本

用法:
    python deepresearch.py --query "研究小米汽车发展历程"

参数也可通过环境变量提供:
    export INTEGRATIONS_API_KEY="bce-v3/ALTAK-..."
    python deepresearch.py --query "研究小米汽车发展历程"
"""

import argparse
import json
import os
import sys
import time
import traceback
from typing import Tuple, Dict

# 禁用输出缓冲，确保 print 立即显示（等同于 python -u 或 PYTHONUNBUFFERED=1）
sys.stdout.reconfigure(line_buffering=True)

try:
    import requests
except ImportError:
    print("缺少依赖: pip install requests", file=sys.stderr)
    sys.exit(1)

# 网关模式配置
BASE_URL = "https://app-cblk1rqa5fk1-api-ELbWqrZ1krJY-gateway.appmiaoda.com/v2"
IDLE_TIMEOUT = 600  # 10 分钟空闲超时

# 从 SKILL.md 中读取固定的 agent_id
AGENT_ID = "2735b18b-c945-472b-ad10-b58576158e40"

# ── 进度日志 ──────────────────────────────────────────────

_LOG_FILE: str = None  # 由 main() 初始化


def log_progress(message: str) -> None:
    """将带时间戳的进度日志追加写入日志文件。"""
    if not _LOG_FILE:
        return
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    try:
        with open(_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"{timestamp} {message}\n")
    except OSError:
        pass


# ── 参数解析 ──────────────────────────────────────────────

def parse_args():
    """解析命令行参数。"""
    parser = argparse.ArgumentParser(description="DeepResearch Agent API 调用工具")
    parser.add_argument("--query", required=True, help="研究问题")
    parser.add_argument("--output-file", default=None, help="结果写入的 JSON 文件路径（供主脚本读取）")
    parser.add_argument("--log-file", default=None, help="进度日志写入的文件路径（供监控脚本读取）")
    return parser.parse_args()


def check_params(args):
    """检查必要的环境参数是否已设置。"""
    if not os.environ.get("INTEGRATIONS_API_KEY"):
        print("缺少必要参数：INTEGRATIONS_API_KEY 环境变量未设置", file=sys.stderr)
        sys.exit(1)


# ── 网关注入 URL 解析 ──────────────────────────────

def resolve_gateway_url(original_url: str) -> Tuple[str, Dict[str, str]]:
    """网关模式：使用固定的网关 endpoint 和认证 header"""
    api_key = os.environ.get("INTEGRATIONS_API_KEY")
    if not api_key:
        raise ValueError("未设置 API Key，请通过环境变量 INTEGRATIONS_API_KEY 设置或使用")

    headers = {
        "Content-Type": "application/json",
        "Accept-Encoding": "identity",
        "X-Gateway-Authorization": f"Bearer {api_key}",
    }
    return original_url, headers


# ── Step 1: 创建会话 ──────────────────────────────────────

def create_conversation(agent_id):
    """创建 DeepResearch 会话并返回 conversation_id。"""
    print("[Step 1] 创建会话...")
    url, headers = resolve_gateway_url(f"{BASE_URL}/agent/deepresearch/create")
    resp = requests.post(
        url,
        headers=headers,
        json={"agent_id": agent_id},
        timeout=30,
    )
    resp.raise_for_status()
    conversation_id = resp.json()["result"]["conversation_id"]
    print(f"         conversation_id: {conversation_id}")
    return conversation_id


# ── SSE 流读取 ────────────────────────────────────────────

def stream_sse(agent_id, payload, label="", early_stop=None):
    """
    发送 POST /run 并读取 SSE 流，返回所有事件列表。
    early_stop: callable(event) -> bool，返回 True 时提前退出
    """
    events = []
    url, headers = resolve_gateway_url(f"{BASE_URL}/agent/deepresearch/run")

    with requests.post(
        url,
        headers=headers,
        json=payload,
        stream=True,
        timeout=None,  # 不设整体超时，通过 IDLE_TIMEOUT 控制
    ) as resp:
        resp.raise_for_status()

        # 用 iter_content 逐字节读取，避免 iter_lines 在某些版本/环境下
        # 对超长行（>chunk_size）的拼接行为不一致。
        # SSE 协议：空行分隔事件，data: 行可连续多行（内容拼接后一起解析）。
        pending_data: list = []
        buf = b""

        def _process_event(raw_json: str) -> bool:
            """解析并处理一个完整 SSE 事件，返回 True 表示需要退出循环"""
            nonlocal events
            if raw_json == "[DONE]":
                return True
            try:
                event = json.loads(raw_json)
            except json.JSONDecodeError:
                return False
            events.append(event)
            _print_event_progress(event, label)
            if event.get("status") == "interrupt":
                return True
            for content in event.get("content", []):
                ev_info = content.get("event") or {}
                if ev_info.get("is_end") and ev_info.get("is_stop"):
                    return True
            if early_stop and early_stop(event):
                return True
            return False

        done = False
        for chunk in resp.iter_content(chunk_size=4096):
            if not chunk:
                continue
            last_data_time = time.time()
            buf += chunk

            # 按行处理 buf 中已完整的行（以 \n 结尾）
            while b"\n" in buf:
                if time.time() - last_data_time > IDLE_TIMEOUT:
                    raise TimeoutError(f"SSE 空闲超时（{IDLE_TIMEOUT}s 无数据）")

                line_bytes, buf = buf.split(b"\n", 1)
                line = line_bytes.rstrip(b"\r").decode("utf-8", errors="replace")

                if not line:
                    # 空行 = 事件边界
                    if pending_data:
                        raw = "".join(pending_data)
                        pending_data.clear()
                        if _process_event(raw):
                            done = True
                            break
                    continue

                if line.startswith("data: "):
                    pending_data.append(line[6:])
                elif line.startswith("data:"):
                    pending_data.append(line[5:])

            if done:
                break

        # 流结束时若还有未处理的 data
        if not done and pending_data:
            raw = "".join(pending_data)
            _process_event(raw)

    return events


def _print_event_progress(event, label):
    """打印所有收到的 SSE 事件，并同步写入日志文件。"""
    prefix = f"[{label}] " if label else ""
    role = event.get("role", "")
    status = event.get("status", "")
    contents = event.get("content", [])
    if not contents:
        msg = f"  {prefix}[SSE] role={role} status={status} | (no content)"
        print(msg, flush=True)
        log_progress(msg.strip())
        return
    for content in contents:
        ev_info = content.get("event") or {}
        ename = ev_info.get("name", "")
        estatus = ev_info.get("status", "")
        ctype = content.get("type", "")
        text = content.get("text")
        if isinstance(text, dict):
            text_str = json.dumps(text, ensure_ascii=False)
        elif isinstance(text, str):
            text_str = text
        else:
            text_str = str(text)

        print(
            f"  {prefix}[SSE] role={role} status={status} | type={ctype} "
            f"event.name={ename!r} event.status={estatus!r} | text={text_str}",
            flush=True,
        )
        # 日志文件中截断过长的 text，避免单行过大
        text_log = text_str if len(text_str) <= 200 else text_str[:200] + "...(truncated)"
        log_progress(
            f"[SSE] {prefix}role={role} status={status} | type={ctype} "
            f"event.name={ename!r} event.status={estatus!r} | text={text_log}"
        )


# ── 事件解析工具 ──────────────────────────────────────────

def extract_interrupt_id(events):
    """从事件流中提取 interrupt_id（text.data 是嵌套 JSON 字符串，需二次解析）"""
    for event in events:
        if event.get("status") == "interrupt":
            for content in event.get("content", []):
                if content.get("type") == "json":
                    ev_info = content.get("event") or {}
                    if ev_info.get("name") == "/toolcall/interrupt":
                        text = content.get("text") or {}
                        data_str = text.get("data", "")
                        if data_str:
                            try:
                                inner = json.loads(data_str)
                                if inner.get("interrupt_id"):
                                    return inner["interrupt_id"]
                            except json.JSONDecodeError:
                                pass
    return None


def extract_structured_outline(events):
    """从事件流中提取 structured_outline（text.data 是嵌套 JSON 字符串，需二次解析）。

    服务端推送顺序：
      1. status=preparing，event.name=/toolcall/structured_outline（title 为空，占位）
      2. status=done，    event.name=/toolcall/structured_outline（title 非空，完整大纲）
      3. status=interrupt，event.name=/toolcall/interrupt（等待用户确认）

    脚本收到 interrupt 时 break，因此 done 事件必须在 interrupt 之前到达才能被收集到。
    正常情况下 done 先于 interrupt，所以这里只需找 title 非空的事件即可。
    """
    for event in events:
        for content in event.get("content", []):
            if content.get("type") != "json":
                continue
            ev_info = content.get("event") or {}
            if ev_info.get("name") != "/toolcall/structured_outline":
                continue
            text = content.get("text") or {}
            data_str = text.get("data", "")
            if not data_str:
                continue
            try:
                outline = json.loads(data_str)
            except json.JSONDecodeError:
                continue
            if outline.get("title"):
                return outline
    return None


def extract_files(events):
    """从事件流中提取生成的文件信息"""
    files = {}
    for event in events:
        for content in event.get("content", []):
            if content.get("type") == "files":
                text = content.get("text") or {}
                filename = text.get("filename", "")
                if filename.endswith(".md") and "md" not in files:
                    files["md"] = text
                elif filename.endswith(".html") and "html" not in files:
                    files["html"] = text
    return files


# ── 主流程 ────────────────────────────────────────────────

def run_deepresearch(query, agent_id):
    """执行完整的深度研究流程，返回生成的文件信息"""

    # Step 1: 创建会话
    log_progress("[STEP1] 创建会话...")
    conversation_id = create_conversation(agent_id)
    log_progress(f"[STEP1] 会话创建完成 | conversation_id={conversation_id}")

    # Step 2: 发起初始查询
    log_progress(f"[STEP2] 发起初始查询 | query={query!r}")
    print(f"\n[Step 2] 发起研究: {query}")
    init_payload = {
        "query": query,
        "agent_id": agent_id,
        "conversation_id": conversation_id,
    }
    events = stream_sse(agent_id, init_payload, label="初始查询")
    print()
    log_progress("[STEP2] 初始查询 SSE 流结束，等待大纲生成")

    # Step 3: 提取大纲数据
    log_progress("[STEP3] 提取大纲数据...")
    print("\n[Step 3] 提取大纲数据...")
    interrupt_id = extract_interrupt_id(events)
    outline = extract_structured_outline(events)

    if not interrupt_id:
        log_progress("[ERROR] 未找到 interrupt_id，任务失败")
        print("错误: 未找到 interrupt_id", file=sys.stderr)
        sys.exit(1)
    if not outline:
        log_progress("[ERROR] 未找到完整的 structured_outline（title 为空），任务失败")
        print("错误: 未找到完整的 structured_outline（title 为空）")
        print("诊断: 收到的 structured_outline 事件如下：")
        for ev in events:
            for c in ev.get("content", []):
                evt = c.get("event") or {}
                if evt.get("name") == "/toolcall/structured_outline":
                    text = c.get("text") or {}
                    print(f"  event.status={evt.get('status')!r}  text.data={text.get('data', '')[:100]!r}")
        print("可能原因: 服务端 done 事件（完整大纲）未推送，请重试")
        sys.exit(1)

    chapters = len(outline.get("sub_chapters", []))
    log_progress(f"[STEP3] 大纲提取完成 | title={outline.get('title')!r} | chapters={chapters} | interrupt_id={interrupt_id}")
    print(f"         大纲标题: {outline.get('title')}")
    print(f"         章节数量: {chapters}")
    print(f"         interrupt_id: {interrupt_id}")

    # Step 4: 确认大纲，生成报告
    log_progress("[STEP4] 确认大纲，开始生成报告（约 10~30 分钟）...")
    print("\n[Step 4] 确认大纲，开始生成报告（可能需要 10~30 分钟）...")

    def is_html_file(event):
        for content in event.get("content", []):
            if content.get("type") == "files":
                filename = (content.get("text") or {}).get("filename", "")
                if filename.endswith(".html"):
                    return True
        return False

    confirm_payload = {
        "query": "确认",
        "agent_id": agent_id,
        "conversation_id": conversation_id,
        "interrupt_id": interrupt_id,
        "structured_outline": outline,
    }
    events = stream_sse(agent_id, confirm_payload, label="生成报告", early_stop=is_html_file)
    print()
    log_progress("[STEP4] 报告生成 SSE 流结束")

    # 提取文件下载链接
    files = extract_files(events)
    return files


# ── 入口 ──────────────────────────────────────────────────

def main():
    """入口函数：解析参数并执行深度研究流程。"""
    global _LOG_FILE
    args = parse_args()
    check_params(args)

    _LOG_FILE = args.log_file
    log_progress(f"[START] DeepResearch 启动 | query={args.query!r}")

    print("=" * 60)
    print("DeepResearch Agent API")
    print("=" * 60)

    start = time.time()
    try:
        files = run_deepresearch(
            query=args.query,
            agent_id=AGENT_ID,
        )
    except KeyboardInterrupt:
        log_progress("[ERROR] 用户中断")
        print("\n\n用户中断")
        sys.exit(1)
    except Exception as e:
        tb = traceback.format_exc()
        log_progress(f"[ERROR] {e}\n{tb}")
        print(f"\n错误: {e}", file=sys.stderr)
        print(tb, file=sys.stderr)
        sys.exit(1)

    elapsed = time.time() - start
    print("=" * 60)
    print(f"完成！总耗时: {elapsed:.1f}s")

    if files:
        md_url = files.get("md", {}).get("download_url", "")
        html_url = files.get("html", {}).get("download_url", "")
        log_progress(f"[DONE] 报告生成完成 | 耗时={elapsed:.1f}s | md={md_url} | html={html_url}")
        if "md" in files:
            print(f"\nMarkdown 报告:")
            print(f"  文件名: {files['md'].get('filename')}")
            print(f"  下载:   {files['md'].get('download_url')}")
        if "html" in files:
            print(f"\nHTML 报告:")
            print(f"  文件名: {files['html'].get('filename')}")
            print(f"  下载:   {files['html'].get('download_url')}")
    else:
        log_progress("[DONE] 任务完成，但未获取到报告文件")
        print("\n未获取到报告文件（任务可能仍在后台运行）")

    print("=" * 60)

    # 若指定了输出文件，将结果写入供主脚本读取
    if args.output_file and files:
        with open(args.output_file, "w", encoding="utf-8") as f:
            json.dump(files, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
