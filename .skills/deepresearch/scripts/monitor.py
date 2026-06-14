#!/usr/bin/env python3
"""
DeepResearch 进度监控脚本（单次检查模式）

每次调用只读取日志文件的新增内容并打印，然后立即退出。
通过 <log_file>.pos 状态文件记录上次读取的字节位置，下次调用时从断点续读。

调用方式（由模型循环执行，每次 sleep 时间递增）：
    python3 scripts/monitor.py --log-file /tmp/deepresearch_xxx.log [--pid 12345]

退出码：
    0 — 正常（任务仍在运行 或 任务已完成），通过最后一行的 STATUS 标记区分：
          [MONITOR] STATUS: RUNNING — 继续监控
          [MONITOR] STATUS: DONE    — 任务完成，停止监控
    1 — 任务出错或进程意外退出，停止监控
"""

import argparse
import os
import sys
import time

sys.stdout.reconfigure(line_buffering=True)


def read_pos(log_file: str) -> int:
    """读取上次读取位置，不存在则返回 0。"""
    pos_file = log_file + ".pos"
    if not os.path.exists(pos_file):
        return 0
    try:
        with open(pos_file, "r") as f:
            return int(f.read().strip())
    except (ValueError, OSError):
        return 0


def write_pos(log_file: str, pos: int) -> None:
    """持久化当前读取位置。"""
    try:
        with open(log_file + ".pos", "w") as f:
            f.write(str(pos))
    except OSError:
        pass


def is_process_alive(pid: int) -> bool:
    """检查进程是否还在运行。"""
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def main():
    parser = argparse.ArgumentParser(description="DeepResearch 进度监控工具（单次检查）")
    parser.add_argument("--log-file", required=True, help="日志文件路径")
    parser.add_argument("--pid", type=int, default=None, help="被监控的进程 PID")
    args = parser.parse_args()

    log_file = args.log_file
    pid = args.pid

    # 读取上次位置，读取新增内容
    last_pos = read_pos(log_file)
    new_lines = []

    if os.path.exists(log_file):
        with open(log_file, "r", encoding="utf-8") as f:
            f.seek(last_pos)
            content = f.read()
            new_pos = f.tell()
        new_lines = [l for l in content.splitlines() if l.strip()]
        write_pos(log_file, new_pos)

    # 打印新增进度
    if new_lines:
        print(f"[{time.strftime('%H:%M:%S')}] 进度更新:")
        for line in new_lines:
            print(f"  {line}")
    else:
        print(f"[{time.strftime('%H:%M:%S')}] 暂无新进度...")
    sys.stdout.flush()

    # 检查整个日志文件是否含终止标记（覆盖之前轮次已读内容）
    all_done = False
    all_error = False
    if os.path.exists(log_file):
        try:
            with open(log_file, "r", encoding="utf-8") as f:
                full = f.read()
            all_done = "[DONE]" in full
            all_error = "[ERROR]" in full
        except OSError:
            pass

    if all_error:
        print("[MONITOR] STATUS: ERROR", flush=True)
        sys.exit(1)

    if all_done:
        print("[MONITOR] STATUS: DONE", flush=True)
        sys.exit(0)

    # 检查进程是否意外退出
    if pid is not None and not is_process_alive(pid):
        print(f"[{time.strftime('%H:%M:%S')}] 进程 {pid} 已退出，但未见 [DONE] 标记")
        print("[MONITOR] STATUS: ERROR", flush=True)
        sys.exit(1)

    # 仍在运行，通知模型继续监控
    print("[MONITOR] STATUS: RUNNING", flush=True)
    sys.exit(0)


if __name__ == "__main__":
    main()
