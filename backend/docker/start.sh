#!/bin/sh
set -eu

PORT_TO_USE="${PORT:-8000}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"

sed -ri "s!/var/www/html!${APACHE_DOCUMENT_ROOT}!g" /etc/apache2/sites-available/*.conf /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf
sed -ri "s/Listen 80/Listen ${PORT_TO_USE}/" /etc/apache2/ports.conf
sed -ri "s/:80>/:${PORT_TO_USE}>/" /etc/apache2/sites-available/000-default.conf

php artisan config:clear

if [ "${RUN_MIGRATIONS}" = "true" ]; then
  php artisan migrate --force
fi

exec apache2-foreground
