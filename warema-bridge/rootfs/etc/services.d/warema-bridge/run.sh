#!/usr/bin/with-contenv bashio

set -e

MQTT_SERVER=${MQTT_SERVER:-"mqtt://core-mosquitto:1883"}
SERIAL_PORT=${SERIAL_PORT:-"/dev/ttyUSB0"}
LOG_LEVEL=${LOG_LEVEL:-"info"}

echo "Starting Warema WMS Bridge addon..."
echo "MQTT_SERVER=${MQTT_SERVER}"
echo "SERIAL_PORT=${SERIAL_PORT}"

if [ ! -e "${SERIAL_PORT}" ] ; then
  echo "Device ${SERIAL_PORT} not present. Waiting up to 30s..."
  for i in $(seq 1 30); do
    if [ -e "${SERIAL_PORT}" ]; then break; fi
    sleep 1
  done
fi

exec npm run start
