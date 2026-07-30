#!/usr/bin/env bash
set -euo pipefail

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable
    corepack prepare pnpm@11.18.0 --activate
  else
    echo "pnpm is required. Install pnpm 11.18.0 or enable Corepack." >&2
    exit 1
  fi
fi

pnpm install --frozen-lockfile=false
