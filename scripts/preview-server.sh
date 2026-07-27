#!/bin/sh
set -eu

# The workspace dependencies may be compiled for the bundled Node runtime
# even when the system shell exposes an older Node. Prefer the system binary
# when it satisfies the package engine, otherwise use Codex's bundled runtime
# if it is available on this machine.
NODE_BIN="$(command -v node)"
NODE_MAJOR="$($NODE_BIN -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  BUNDLED_NODE="${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
  if [ -x "$BUNDLED_NODE" ]; then
    NODE_BIN="$BUNDLED_NODE"
  else
    echo "FilmScript requires Node 22+ (the current Node is ${NODE_MAJOR})." >&2
    exit 1
  fi
fi

exec env FILMSCRIPT_PREVIEW_MODE=true FILMSCRIPT_PREVIEW_DATA_DIR="${FILMSCRIPT_PREVIEW_DATA_DIR:-./data-preview}" \
  "$NODE_BIN" --env-file=.env server.js
