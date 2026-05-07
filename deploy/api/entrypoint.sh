#!/bin/sh
# Ensure SSH key exists before starting the API.
set -e

SSH_DIR="${SSH_KEY_DIR:-/home/node/.ssh}"
SSH_KEY_NAME="${SSH_KEY_NAME:-id_ed25519_dashboard}"
SSH_KEY="$SSH_DIR/$SSH_KEY_NAME"

mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR" || true

if [ ! -f "$SSH_KEY" ]; then
  echo "[entrypoint] generating SSH key at $SSH_KEY"
  ssh-keygen -t ed25519 -N "" -C "dashboard@api" -f "$SSH_KEY"
fi
chmod 600 "$SSH_KEY" || true
chmod 644 "${SSH_KEY}.pub" || true

echo "[entrypoint] SSH pubkey:"
cat "${SSH_KEY}.pub" || true

exec node server.js
