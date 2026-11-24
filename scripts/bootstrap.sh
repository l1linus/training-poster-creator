#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${1:-4173}"

log() { echo "$*" >&2; }

node_major() {
  "$1" -v 2>/dev/null | sed 's/v\([0-9]*\).*/\1/'
}

NODE_BIN="$(command -v node || true)"
if [ -n "$NODE_BIN" ] && [ "$(node_major "$NODE_BIN")" -ge 20 ]; then
  log "Using Node: $NODE_BIN"
else
  log "Node.js 20+ not found. Downloading portable Node.js v22.14.0..."
  VERSION="v22.14.0"
  OS="$(uname -s)"
  ARCH="$(uname -m)"

  if [ "$OS" = "Darwin" ]; then
    if [ "$ARCH" = "arm64" ]; then
      PKG="darwin-arm64"
    else
      PKG="darwin-x64"
    fi
    EXT="tar.gz"
  else
    if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
      PKG="linux-arm64"
    else
      PKG="linux-x64"
    fi
    EXT="tar.xz"
  fi

  RUNTIME="$ROOT/.runtime"
  NODE_DIR="$RUNTIME/node"
  mkdir -p "$RUNTIME"
  ARCHIVE="$RUNTIME/node.$EXT"
  URL="https://npmmirror.com/mirrors/node/$VERSION/node-$VERSION-$PKG.$EXT"

  log "Downloading $URL"
  if command -v curl >/dev/null 2>&1; then
    curl -fL "$URL" -o "$ARCHIVE" || { log "Download failed. Check network and retry."; exit 1; }
  elif command -v wget >/dev/null 2>&1; then
    wget "$URL" -O "$ARCHIVE" || { log "Download failed. Check network and retry."; exit 1; }
  else
    log "Neither curl nor wget is available."
    exit 1
  fi

  rm -rf "$RUNTIME/unzip" "$NODE_DIR"
  mkdir -p "$RUNTIME/unzip"
  tar -xf "$ARCHIVE" -C "$RUNTIME/unzip"
  INNER="$(find "$RUNTIME/unzip" -maxdepth 1 -type d -name 'node-*' | head -n 1)"
  mv "$INNER" "$NODE_DIR"
  rm -rf "$RUNTIME/unzip" "$ARCHIVE"
  NODE_BIN="$NODE_DIR/bin/node"
  log "Using Node: $NODE_BIN"
fi

exec "$NODE_BIN" scripts/open-ui.mjs --port "$PORT" --no-open
