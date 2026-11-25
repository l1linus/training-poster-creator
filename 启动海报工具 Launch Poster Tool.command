#!/bin/bash
cd "$(dirname "$0")" || exit 1
file=$(ls *.html 2>/dev/null | grep -v -- '-en\.html$' | head -n 1)
if [ -n "$file" ]; then
  open "$file"
else
  echo "没有找到 HTML 文件，请确认压缩包已完整解压。"
  echo "No HTML file found. Please make sure the archive is fully extracted."
  read -n 1 -s -r -p "按任意键退出 / Press any key to exit..."
fi
