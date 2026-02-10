# Warema WMS Bridge Add-on

Bridge für Warema WMS Geräte mit MQTT-Unterstützung – kompatibel mit aktuellen Home Assistant Add-on Standards und Node.js 20 (LTS).

## Features

- Bindet Warema WMS Jalousien, Wetterstationen und andere Geräte in Home Assistant ein
- Kommunikation über MQTT (z.B. mit core-mosquitto)
- Automatische Erkennung und Registrierung von Geräten
- Unterstützung für mehrere Architekturen: `amd64`, `aarch64`, `armv7`, `armhf`
- Konfigurierbar über Home Assistant Add-on Optionen
- Serielle Verbindung zu WMS USB-Stick

## Installation

### Voraussetzungen

- Home Assistant ab Version 2023.10.0
- MQTT-Broker (z.B. core-mosquitto)
- Warema WMS USB-Stick am Host (`/dev/ttyUSB0`)

### Add-on Installation

1. Füge das Repository zu Home Assistant hinzu
2. Installiere das Add-on über den Add-on Store

### Konfiguration

Passe die Optionen im Add-on an:

| Option           | Beschreibung                        | Standardwert                    |
|------------------|-------------------------------------|---------------------------------|
| mqtt_server      | Adresse des MQTT-Brokers            | mqtt://core-mosquitto:1883      |
| mqtt_user        | MQTT Benutzername                   | (leer)                          |
| mqtt_password    | MQTT Passwort                       | (leer)                          |
| log_level        | Log-Level                           | info                            |
| wms_serial_port  | Pfad zum USB-Stick                  | /dev/ttyUSB0                    |
| wms_key          | WMS-Schlüssel                       | (leer)                          |
| wms_pan_id       | WMS PAN ID                          | FFFF                            |
| wms_channel      | WMS Kanal                           | 17                              |
| ignored_devices  | Kommagetrennte Geräte-IDs ignorieren| (leer)                          |
| force_devices    | Kommagetrennte Geräte-IDs erzwingen | (leer)                          |

### Logging

Das Add-on unterstützt konfigurierbares Logging über die Option `log_level`.

Unterstützte Level: `trace`, `debug`, `info`, `notice`, `warning`, `error`, `fatal`

Das Bridge-Logging wird einheitlich mit Zeitstempel und Level ausgegeben (z.B. `[2026-01-01T12:00:00.000Z] [INFO] Connected to MQTT`).

## Entwicklung & Standalone-Nutzung

### Docker (Standalone)

Du kannst das Projekt auch eigenständig mit Docker und Node.js 20 (LTS) ausführen:

```sh
docker build -f Dockerfile.standalone -t warema-bridge .
docker run --rm -it --device=/dev/ttyUSB0 warema-bridge
```

### Docker Compose (lokaler Test mit USB-Dongle)

Für einen lokalen Test mit MQTT + Bridge liegt eine fertige `docker-compose.yml` und eine passende `mosquitto.conf` im Repository.

```sh
docker compose up -d --build
docker compose logs -f warema-bridge
```

Hinweise:

- Der Fehler `not a directory` beim Mount von `mosquitto.conf` tritt auf, wenn die Datei auf dem Host nicht existiert oder der Pfad auf ein Verzeichnis zeigt.
- Stelle sicher, dass die Datei `./mosquitto.conf` im Projektordner vorhanden ist (wird mitgeliefert).
- Falls dein Stick nicht unter `/dev/ttyUSB0` verfügbar ist, passe in `docker-compose.yml` sowohl `devices` als auch `WMS_SERIAL_PORT` an (z.B. `/dev/ttyACM0`).
- Für Windows: [Verbinden von USB-Geräten](https://learn.microsoft.com/de-de/windows/wsl/connect-usb)
  
### Lokale Entwicklung

1. Node.js 20 (LTS) installieren
2. Im Verzeichnis `warema-bridge/rootfs/srv`:
   ```sh
   npm install
   node bridge.js
   ```

## Projektstruktur

- `config.yaml` – Home Assistant Add-on Konfiguration
- `Dockerfile.standalone` – Dockerfile für Standalone-Betrieb
- `rootfs/srv/bridge.js` – Hauptlogik der Bridge
- `rootfs/srv/package.json` – Node.js Abhängigkeiten
- `run.sh` – Startskript für das Add-on

## Lizenz

MIT License

---

**Hinweis:**  
Dieses Add-on ist ein Community-Projekt und nicht offiziell von Warema unterstützt.  
Für Fragen oder Beiträge nutze bitte die GitHub Issues oder Pull
