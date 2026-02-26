# Changelog

Alle nennenswerten Änderungen an diesem Home Assistant Add-on werden in dieser Datei dokumentiert.

## 2.1.3

- Korrektur für s6-Startfehler: `services.d`-Run-Script ohne `with-contenv` (behebt `s6-overlay-suexec: fatal: can only run as pid 1`).

## 2.1.2

- Fix #14: Doppelstart beseitigt und Start auf Home-Assistant-Standard (`/init` + `services.d`) umgestellt.
- Fix #14: HA-Restart-Recovery und MQTT-Topic-Handling für `warema/bridge/state` verbessert.
- Fix Startproblem unter s6: Service-Run-Script ohne `with-contenv`, damit kein `s6-overlay-suexec: ... can only run as pid 1` auftritt.

## 2.1.1

- Aktualisierung auf Node.js 20 (LTS) als Laufzeitbasis.
- Verbesserte Home Assistant Add-on Kompatibilität und aktualisierte Add-on Metadaten.
- Stabilitäts- und Logging-Verbesserungen für den Betrieb mit MQTT und WMS-USB-Stick.

## Unreleased

- Fix #14: Doppelstart durch parallelen service.d-Start entfernt (run.sh wird nur noch einmal gestartet).
- Fix #14: HA-Restart (`homeassistant/status=online`) setzt Registrierungen zurück, entfernt alte Blind-Registrierungen in der WMS-Library und publiziert Discovery erneut.
- Fix #14: MQTT Discovery-Configs werden retained publiziert; Bridge-State wird bei Connect aktiv als retained `online` gesetzt.
- Fix #14: `warema/bridge/state` wird nicht mehr als Gerätetopic interpretiert.
- Fix #14: MQTT-Command-Subscriptions auf `warema/+/set`, `warema/+/set_position`, `warema/+/set_tilt` eingegrenzt, damit Bridge-Statusmeldungen nicht als Gerätekommando verarbeitet werden.

## 2.1.0

- Überarbeitete Konfiguration für den Betrieb mit aktuellen Home Assistant Versionen.
- Verbesserungen bei der Geräteerkennung und MQTT-Integration.

## 2.0.0

- Größere Modernisierung des Add-ons inklusive Architektur- und Laufzeitanpassungen.
- Vorbereitung für Multi-Arch-Builds und robusteren Betrieb im Add-on Umfeld.

## Weitere Informationen

Weitere Informationen, Quellcode und Support:

- GitHub: https://github.com/chha25/addon-warema-bridge
