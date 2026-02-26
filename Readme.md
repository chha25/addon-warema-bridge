# Warema WMS Bridge Add-on

## Deutsch

Diese Bridge bindet Warema-WMS-Geräte per MQTT in Home Assistant ein und ist mit aktuellen Home-Assistant-Add-on-Standards sowie Node.js 24 (LTS) kompatibel.

### Funktionen

- Bindet Warema-WMS-Jalousien, Wetterstationen und weitere Geräte in Home Assistant ein.
- Kommunikation über MQTT (z. B. mit `core-mosquitto`).
- Automatische Erkennung und Registrierung von Geräten.
- Retained Discovery- und Availability-Topics für robustes Recovery nach Home-Assistant-Neustarts.
- Unterstützung für mehrere Architekturen: `amd64`, `aarch64`, `armv7`, `armhf`.
- Konfigurierbar über Home-Assistant-Add-on-Optionen.
- Serielle Verbindung zu einem WMS-USB-Stick.

### Installation

#### Voraussetzungen

- Home Assistant ab Version `2023.10.0`
- MQTT-Broker (z. B. `core-mosquitto`)
- Warema-WMS-USB-Stick am Host (z. B. `/dev/ttyUSB0`)

#### Add-on-Installation

1. Dieses Repository in Home Assistant als Add-on-Quelle hinzufügen.
2. Das Add-on über den Add-on-Store installieren.

#### Konfiguration

Passe die Optionen im Add-on an:

| Option            | Beschreibung                         | Standardwert                  |
|-------------------|--------------------------------------|-------------------------------|
| `mqtt_server`     | Adresse des MQTT-Brokers             | `mqtt://core-mosquitto:1883`  |
| `mqtt_user`       | MQTT-Benutzername                    | (leer)                        |
| `mqtt_password`   | MQTT-Passwort                        | (leer)                        |
| `log_level`       | Log-Level                            | `info`                        |
| `wms_serial_port` | Pfad zum USB-Stick                   | `/dev/ttyUSB0`                |
| `wms_key`         | WMS-Schlüssel                        | (leer)                        |
| `wms_pan_id`      | WMS-PAN-ID                           | `FFFF`                        |
| `wms_channel`     | WMS-Kanal                            | `17`                          |
| `ignored_devices` | Kommagetrennte Geräte-IDs ignorieren | (leer)                        |
| `force_devices`   | Kommagetrennte Geräte-IDs erzwingen  | (leer)                        |

#### Logging

Das Add-on unterstützt konfigurierbares Logging über die Option `log_level`.

Unterstützte Level: `trace`, `debug`, `info`, `notice`, `warning`, `error`, `fatal`

Das Bridge-Logging wird einheitlich mit Zeitstempel und Level ausgegeben (z. B. `[2026-01-01T12:00:00.000Z] [INFO] Connected to MQTT`).

### Entwicklung und Standalone-Nutzung

#### Docker (Standalone)

```sh
docker build -f Dockerfile.standalone -t warema-bridge .
docker run --rm -it --device=/dev/ttyUSB0 warema-bridge
```

#### Docker Compose (lokaler Test mit USB-Dongle)

```sh
docker compose up -d --build
docker compose logs -f warema-bridge
```

Hinweise:

- Der Fehler `not a directory` beim Mount von `mosquitto.conf` tritt auf, wenn die Datei auf dem Host nicht existiert oder der Pfad auf ein Verzeichnis zeigt.
- Stelle sicher, dass die Datei `./mosquitto.conf` im Projektordner vorhanden ist (wird mitgeliefert).
- Falls dein Stick nicht unter `/dev/ttyUSB0` verfügbar ist, passe in `docker-compose.yml` sowohl `devices` als auch `WMS_SERIAL_PORT` an (z. B. `/dev/ttyACM0`).
- Für Windows: [Verbinden von USB-Geräten](https://learn.microsoft.com/de-de/windows/wsl/connect-usb)

#### Lokale Entwicklung

1. Node.js 24 (LTS, empfohlen: aktuellste 24.x) installieren (`>=24.0.0 <25`).
2. In das Verzeichnis `warema-bridge/rootfs/srv` wechseln:

```sh
npm install
node bridge.js
```

### Projektstruktur

- `config.yaml` – Home-Assistant-Add-on-Konfiguration
- `Dockerfile.standalone` – Dockerfile für Standalone-Betrieb
- `warema-bridge/rootfs/srv/bridge.js` – Hauptlogik der Bridge
- `warema-bridge/rootfs/srv/package.json` – Node.js-Abhängigkeiten
- `warema-bridge/rootfs/etc/services.d/warema-bridge/run` – Startskript des Add-on-Services (über `/init`)

## English

This bridge integrates Warema WMS devices into Home Assistant via MQTT and is compatible with current Home Assistant add-on standards and Node.js 24 (LTS).

### Features

- Integrates Warema WMS blinds, weather stations, and other devices into Home Assistant.
- MQTT communication (e.g. with `core-mosquitto`).
- Automatic device discovery and registration.
- Retained discovery and availability topics for robust Home Assistant restart recovery.
- Multi-architecture support: `amd64`, `aarch64`, `armv7`, `armhf`.
- Configurable through Home Assistant add-on options.
- Serial connection to a WMS USB dongle.

### Installation

#### Requirements

- Home Assistant version `2023.10.0` or newer
- MQTT broker (e.g. `core-mosquitto`)
- Warema WMS USB dongle on the host (e.g. `/dev/ttyUSB0`)

#### Add-on installation

1. Add this repository as an add-on source in Home Assistant.
2. Install the add-on from the add-on store.

#### Configuration

Configure these add-on options:

| Option            | Description                          | Default value                 |
|-------------------|--------------------------------------|-------------------------------|
| `mqtt_server`     | MQTT broker address                  | `mqtt://core-mosquitto:1883`  |
| `mqtt_user`       | MQTT username                        | (empty)                       |
| `mqtt_password`   | MQTT password                        | (empty)                       |
| `log_level`       | Log level                            | `info`                        |
| `wms_serial_port` | USB dongle path                      | `/dev/ttyUSB0`                |
| `wms_key`         | WMS key                              | (empty)                       |
| `wms_pan_id`      | WMS PAN ID                           | `FFFF`                        |
| `wms_channel`     | WMS channel                          | `17`                          |
| `ignored_devices` | Comma-separated device IDs to ignore | (empty)                       |
| `force_devices`   | Comma-separated device IDs to force  | (empty)                       |

#### Logging

Configurable logging is available through the `log_level` option.

Supported levels: `trace`, `debug`, `info`, `notice`, `warning`, `error`, `fatal`

Bridge logs are printed in a consistent timestamp + level format (e.g. `[2026-01-01T12:00:00.000Z] [INFO] Connected to MQTT`).

### Development and standalone usage

#### Docker (standalone)

```sh
docker build -f Dockerfile.standalone -t warema-bridge .
docker run --rm -it --device=/dev/ttyUSB0 warema-bridge
```

#### Docker Compose (local test with USB dongle)

```sh
docker compose up -d --build
docker compose logs -f warema-bridge
```

Notes:

- The `not a directory` mount error for `mosquitto.conf` usually happens if the host file does not exist or the path points to a directory.
- Make sure `./mosquitto.conf` exists in the project folder (it is included in this repository).
- If your dongle is not available at `/dev/ttyUSB0`, adjust both `devices` and `WMS_SERIAL_PORT` in `docker-compose.yml` (e.g. `/dev/ttyACM0`).
- For Windows: [Connect USB devices](https://learn.microsoft.com/windows/wsl/connect-usb)

#### Local development

1. Install Node.js 24 LTS (recommended: latest 24.x) (`>=24.0.0 <25`).
2. Switch to `warema-bridge/rootfs/srv`:

```sh
npm install
node bridge.js
```

### Project structure

- `config.yaml` – Home Assistant add-on configuration
- `Dockerfile.standalone` – Dockerfile for standalone usage
- `warema-bridge/rootfs/srv/bridge.js` – Main bridge logic
- `warema-bridge/rootfs/srv/package.json` – Node.js dependencies
- `warema-bridge/rootfs/etc/services.d/warema-bridge/run` – Add-on service startup script (via `/init`)

## Danksagung / Acknowledgement and origin

Vielen Dank an das Originalprojekt und alle bisherigen Beitragenden.  
Thanks to the original project and all contributors.

- Original repository: https://github.com/giannello/addon-warema-bridge

Dieses Repository unterstützt eine kontinuierliche Aktualisierung und Weiterentwicklung mit Unterstützung durch KI.  
This repository supports continuous updates and further development with AI assistance.

## Lizenz / License

MIT License

---

**Hinweis / Note:**  
Dieses Add-on ist ein Community-Projekt und wird nicht offiziell von Warema unterstützt.  
This add-on is a community project and is not officially supported by Warema.
