#!/usr/bin/env bash
# Backwards-compat shim: forwards to `telltale __hook`. Once the user's
# ~/.claude/settings.json points at `telltale __hook` directly, this can go.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$DIR/telltale" __hook
