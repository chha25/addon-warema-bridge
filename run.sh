#!/usr/bin/with-contenv bashio

set -euo pipefail

MQTT_SERVER="$(bashio::config 'mqtt_server')"
MQTT_USER="$(bashio::config 'mqtt_user')"
MQTT_PASSWORD="$(bashio::config 'mqtt_password')"
SERIAL_PORT="$(bashio::config 'wms_serial_port')"
LOG_LEVEL="$(bashio::config 'log_level')"
WMS_KEY="$(bashio::config 'wms_key')"
WMS_PAN_ID="$(bashio::config 'wms_pan_id')"
WMS_CHANNEL="$(bashio::config 'wms_channel')"
IGNORED_DEVICES="$(bashio::config 'ignored_devices')"
FORCE_DEVICES="$(bashio::config 'force_devices')"

MQTT_SERVER="${MQTT_SERVER:-mqtt://core-mosquitto:1883}"
SERIAL_PORT="${SERIAL_PORT:-/dev/ttyUSB0}"
LOG_LEVEL="${LOG_LEVEL:-info}"

export MQTT_SERVER
export MQTT_USER
export MQTT_PASSWORD
export SERIAL_PORT
export LOG_LEVEL
export WMS_KEY
export WMS_PAN_ID
export WMS_CHANNEL
export IGNORED_DEVICES
export FORCE_DEVICES

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
