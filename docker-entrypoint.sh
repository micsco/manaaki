#!/bin/sh
set -eu

su-exec nginx node /app/server.js &
node_pid=$!

nginx -g 'daemon off;' &
nginx_pid=$!

terminate() {
  kill -TERM "$nginx_pid" "$node_pid" 2>/dev/null || true
}
trap terminate INT TERM

while kill -0 "$node_pid" 2>/dev/null && kill -0 "$nginx_pid" 2>/dev/null; do
  sleep 1
done

terminate
wait "$node_pid" 2>/dev/null || true
wait "$nginx_pid" 2>/dev/null || true
exit 1
