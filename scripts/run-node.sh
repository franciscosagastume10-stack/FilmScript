#!/bin/sh
set -eu

# Keep local commands on the Node versions supported by FilmScript. Codex's
# bundled runtime is also compatible with the native SQLite dependency.
NODE_BIN="$(command -v node)"
NODE_MAJOR="$($NODE_BIN -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ] || [ "$NODE_MAJOR" -ge 25 ]; then
  BUNDLED_NODE="${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
  if [ -x "$BUNDLED_NODE" ]; then
    NODE_BIN="$BUNDLED_NODE"
  else
    echo "FilmScript requires Node 22, 23, or 24 (the current Node is ${NODE_MAJOR})." >&2
    exit 1
  fi
fi

exec "$NODE_BIN" "$@"
