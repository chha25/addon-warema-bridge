# Warema WMS Bridge Add-on

Bridge für Warema WMS Geräte mit MQTT-Unterstützung – kompatibel mit aktuellen Home Assistant Add-on Standards und Node.js 22.

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

| Option         | Beschreibung                        | Standardwert                    |
|----------------|-------------------------------------|---------------------------------|
| MQTT_SERVER    | Adresse des MQTT-Brokers            | mqtt://core-mosquitto:1883      |
| MQTT_USER      | MQTT Benutzername                   | (leer)                          |
| MQTT_PASSWORD  | MQTT Passwort                       | (leer)                          |
| SERIAL_PORT    | Pfad zum USB-Stick                  | /dev/ttyUSB0                    |
| LOG_LEVEL      | Log-Level                           | info                            |

## Entwicklung & Standalone-Nutzung

### Docker (Standalone)

Du kannst das Projekt auch eigenständig mit Docker und Node.js 22 ausführen:

```sh
docker build -f Dockerfile.standalone -t warema-bridge .
docker run --rm -it --device=/dev/ttyUSB0 warema-bridge
```

### Lokale Entwicklung

1. Node.js 22 installieren
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