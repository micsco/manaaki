#!/bin/sh
set -eu

envsubst '${MEALIE_INTERNAL_URL}' \
  < /etc/nginx/conf-templates/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf

node /app/server.js &

exec nginx -g 'daemon off;'
