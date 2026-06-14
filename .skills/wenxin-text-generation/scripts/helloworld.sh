#!/bin/bash

################################################################################
# Hello World 测试脚本
# 
# 用途：测试 wenxin-text-generation skill 的 scripts 目录功能
# 作者：Miaoda Skills Team
# 日期：2026-04-25
################################################################################

set -e  # 遇到错误立即退出
set -u  # 使用未定义变量时报错

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 主函数
main() {
    print_info "======================================"
    print_info "  Wenxin Text Generation Skill Test"
    print_info "======================================"
    echo ""
    
    # 显示环境信息
    print_info "脚本路径: $0"
    print_info "当前目录: $(pwd)"
    print_info "执行时间: $(date '+%Y-%m-%d %H:%M:%S')"
    print_info "执行用户: $(whoami)"
    echo ""
    
    # 检查 skill 目录结构
    print_info "检查 Skill 目录结构..."
    SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
    print_info "Skill 根目录: $SKILL_DIR"
    
    if [ -f "$SKILL_DIR/SKILL.md" ]; then
        print_success "✓ SKILL.md 文件存在"
    else
        print_error "✗ SKILL.md 文件不存在"
        exit 1
    fi
    
    if [ -d "$SKILL_DIR/references" ]; then
        print_success "✓ references 目录存在"
        REFS_COUNT=$(find "$SKILL_DIR/references" -type f | wc -l | tr -d ' ')
        print_info "  包含 $REFS_COUNT 个参考文档"
    else
        print_warning "✗ references 目录不存在"
    fi
    
    if [ -d "$SKILL_DIR/scripts" ]; then
        print_success "✓ scripts 目录存在"
        SCRIPTS_COUNT=$(find "$SKILL_DIR/scripts" -type f -name "*.sh" -o -name "*.py" | wc -l | tr -d ' ')
        print_info "  包含 $SCRIPTS_COUNT 个脚本文件"
    fi
    echo ""
    
    # 读取 skill 基本信息
    print_info "读取 Skill 基本信息..."
    if command -v grep >/dev/null 2>&1; then
        SKILL_NAME=$(grep "^name:" "$SKILL_DIR/SKILL.md" | sed 's/name: *//' || echo "unknown")
        SKILL_DESC=$(grep "^description:" "$SKILL_DIR/SKILL.md" | sed 's/description: *//' || echo "N/A")
        
        print_success "Skill 名称: $SKILL_NAME"
        print_info "Skill 描述: $SKILL_DESC"
    fi
    echo ""
    
    # 测试环境变量（可选）
    print_info "检查环境变量..."
    if [ -n "${INTEGRATIONS_API_KEY:-}" ]; then
        print_success "✓ INTEGRATIONS_API_KEY 已设置"
        KEY_LENGTH=${#INTEGRATIONS_API_KEY}
        print_info "  密钥长度: $KEY_LENGTH 字符"
    else
        print_warning "✗ INTEGRATIONS_API_KEY 未设置（某些功能可能需要）"
    fi
    echo ""
    
    # 模拟测试任务
    print_info "执行模拟测试..."
    for i in {1..3}; do
        echo -n "  测试步骤 $i/3... "
        sleep 0.5
        echo "完成"
    done
    print_success "✓ 所有测试步骤执行完毕"
    echo ""
    
    # 输出总结
    print_success "======================================"
    print_success "  Hello World 测试成功！"
    print_success "======================================"
    echo ""
    print_info "提示: 这是一个测试脚本，用于验证 scripts 目录功能"
    print_info "你可以在此基础上添加更多测试逻辑"
    
    return 0
}

# 错误处理
trap 'print_error "脚本执行失败，退出码: $?"' ERR

# 执行主函数
main "$@"
