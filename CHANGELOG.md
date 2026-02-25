# Changelog

Alle nennenswerten Änderungen an diesem Home Assistant Add-on werden in dieser Datei dokumentiert.

## 2.1.1

- Aktualisierung auf Node.js 20 (LTS) als Laufzeitbasis.
- Verbesserte Home Assistant Add-on Kompatibilität und aktualisierte Add-on Metadaten.
- Stabilitäts- und Logging-Verbesserungen für den Betrieb mit MQTT und WMS-USB-Stick.

## Unreleased

- Fix #14: Doppelstart durch parallelen service.d-Start entfernt (run.sh wird nur noch einmal gestartet).
- Fix #14: HA-Restart (`homeassistant/status=online`) setzt Registrierungen zurück, entfernt alte Blind-Registrierungen in der WMS-Library und publiziert Discovery erneut.
- Fix #14: MQTT Discovery-Configs werden retained publiziert; Bridge-State wird bei Connect aktiv als retained `online` gesetzt.
- Fix #14: `warema/bridge/state` wird nicht mehr als Gerätetopic interpretiert.

## 2.1.0

- Überarbeitete Konfiguration für den Betrieb mit aktuellen Home Assistant Versionen.
- Verbesserungen bei der Geräteerkennung und MQTT-Integration.

## 2.0.0

- Größere Modernisierung des Add-ons inklusive Architektur- und Laufzeitanpassungen.
- Vorbereitung für Multi-Arch-Builds und robusteren Betrieb im Add-on Umfeld.

## Weitere Informationen

Weitere Informationen, Quellcode und Support:

- GitHub: https://github.com/chha25/addon-warema-bridge
