#!/usr/bin/env bash
# scripts/reset-to-stable.sh
# 一键回滚到上一个稳定 tag
# 用法: ./scripts/reset-to-stable.sh [tag_name]
#       不带参数则列出可用 tag

set -e

cd "$(git rev-parse --show-toplevel)"

if [ $# -eq 0 ]; then
  echo "可用稳定版本:"
  git tag --list 'v*' --sort=-creatordate | head -10
  echo ""
  echo "用法: $0 <tag_name>"
  exit 0
fi

TARGET="$1"

if ! git rev-parse "$TARGET" >/dev/null 2>&1; then
  echo "错误: tag '$TARGET' 不存在"
  exit 1
fi

echo "⚠️  即将回滚到 $TARGET"
echo "当前分支: $(git branch --show-current)"
echo "未提交的改动将会丢失!"
read -p "确认? (y/N) " CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "已取消"
  exit 0
fi

git reset --hard "$TARGET"
echo "✅ 已回滚到 $TARGET"
echo "如需恢复, 运行: git reflog"
