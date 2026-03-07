#!/usr/bin/env bash
set -euo pipefail

version="$1"
awk -v ver="$version" '
  BEGIN { capture=0 }
  $0 ~ "^## " ver "$" { capture=1; next }
  capture && $0 ~ "^## " { exit }
  capture { print }
' CHANGELOG.md
