#!/bin/sh
# docker-entrypoint.sh
#
# Substitutes MEALIE_INTERNAL_URL and MEALIE_API_TOKEN into the nginx config
# templates, then starts nginx. Running envsubst ourselves (rather than relying
# on the nginx image's built-in template mechanism) lets us explicitly control
# which variables are substituted, leaving all nginx $variables (e.g. $host,
# $mealie, $uri) untouched.

set -e

: "${MEALIE_INTERNAL_URL:?MEALIE_INTERNAL_URL must be set}"
: "${MEALIE_API_TOKEN:?MEALIE_API_TOKEN must be set}"

envsubst '${MEALIE_INTERNAL_URL} ${MEALIE_API_TOKEN}' \
  < /etc/nginx/conf-templates/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf

envsubst '${MEALIE_INTERNAL_URL} ${MEALIE_API_TOKEN}' \
  < /etc/nginx/conf-templates/mealie-proxy-headers.conf.template \
  > /etc/nginx/conf.d/mealie-proxy-headers.conf

echo "nginx config written — starting nginx"
exec nginx -g "daemon off;"
