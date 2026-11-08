# Arbeitsanleitung für Coding Agents

Diese Datei gilt für das gesamte Repository und richtet sich an Codex und andere Coding Agents.

## Projekt und Einstiegspunkte

Die Warema WMS Bridge verbindet einen WMS-USB-Stick über MQTT mit Home Assistant.
Sie unterstützt Beschattung und Wetterstationen und läuft als Home-Assistant-Add-on
oder als eigenständiger Docker-Container.

- `warema-bridge/rootfs/srv/bridge.js`: Laufzeit, MQTT Discovery, WMS-Callbacks,
  Gerätezustand, Eingabevalidierung und Logging.
- `warema-bridge/rootfs/srv/__tests__/bridge.test.js`: Jest-Tests mit gemocktem MQTT
  und WMS-Stick; zuerst lesen, wenn sich Bridge-Verhalten ändert.
- `config.yaml`: Add-on-Optionen, Schema, Gerätezugriff und unterstützte Architekturen.
- `warema-bridge/rootfs/etc/services.d/warema-bridge/run`: bashio-Startskript;
  übersetzt Add-on-Optionen in Umgebungsvariablen.
- `Dockerfile`: Home-Assistant-Image mit s6-/bashio-Umgebung.
- `Dockerfile.standalone` und `docker-compose.yml`: eigenständiger Betrieb und lokaler MQTT-Broker.
- `Readme.md`: Installation und Bedienung auf Deutsch und Englisch.
- `.github/workflows/tests.yml`: verbindlicher CI-Ablauf auf Node.js 22 und 24.
- `.github/workflows/release.yml`: Versionsprüfung und Veröffentlichung bei Release-Tags.

## Entwicklung und Prüfungen

Verwende Node.js 24 gemäß `.nvmrc`; unterstütze weiterhin Node.js 22 und 24
gemäß `package.json` und CI. npm muss mindestens Version 10 haben.
Das npm-Projekt liegt **nicht im Repository-Root**. Führe dort aus:

```sh
cd warema-bridge/rootfs/srv
npm ci
npm run lint
npm run build
npm test -- --runInBand
npm run smoke
```

`lint`, `build` und `smoke` führen derzeit jeweils nur `node --check bridge.js`
aus. Sie ersetzen keine Verhaltenstests. Für reine Dokumentationsänderungen
genügen die Prüfung der beschriebenen Pfade und Befehle sowie `git diff --check`.

Für gezielte Tests: `npm test -- --runInBand -t "Testname"` im npm-Verzeichnis.
Nutze die vorhandenen MQTT-/WMS-Mocks für Regressionstests. Beim erneuten Laden
des Moduls müssen Modulcache, Umgebungsvariablen und Signal-Listener wie im
bestehenden Test-Setup berücksichtigt werden.

`bridge.js` initialisiert beim Laden MQTT und anschließend den USB-Stick.
`npm start` und `node bridge.js` sind daher keine hardwarefreien Smoke-Tests.
Tests mit echter Hardware oder einem produktiven Broker können Jalousien bewegen;
führe sie nur im ausdrücklich autorisierten Testaufbau aus.

## Änderungen am Code

- Behalte CommonJS (`require`/`module.exports`) und den bestehenden Stil mit
  zwei Leerzeichen, einfachen Anführungszeichen und Semikolons bei.
- Halte Änderungen auf die Aufgabe begrenzt. Ergänze bei Verhaltensänderungen
  aussagekräftige Tests in der bestehenden Jest-Suite.
- Verwende den vorhandenen Logger mit Log-Level und Zeitstempel.
  Zugangsdaten und WMS-Schlüssel gehören weder in Logs noch in Commits.
- Bei Abhängigkeitsänderungen aktualisiere `package.json` und `package-lock.json`
  gemeinsam. Beide Dockerfiles installieren anhand der Lockdatei mit `npm ci`.
- Bei neuen Konfigurationsoptionen gleiche `config.yaml` (Optionen und Schema),
  das bashio-Startskript, die Auswertung in `bridge.js` und beide Sprachabschnitte
  der `Readme.md` ab. Prüfe auch die Standalone-Konfiguration.

## Kompatibilität der Bridge

Bewahre diese Verträge, sofern die Aufgabe keine ausdrückliche Änderung verlangt:

- MQTT-Topics, Discovery-IDs und Gerätekennungen bleiben stabil, damit bestehende
  Home-Assistant-Entitäten und Automationen weiter funktionieren.
- Discovery und Availability verwenden retained Nachrichten. MQTT-Reconnects
  initialisieren den WMS-Stick nicht erneut; `homeassistant/status = online`
  löst die erneute Registrierung und Veröffentlichung der Discovery aus.
- Home-Assistant-Position: `0` geschlossen, `100` offen. Warema-Position:
  `0` offen, `100` geschlossen. Lamellenwinkel werden zwischen Warema
  `-100..100` und Home Assistant `0..100` umgerechnet.
- Cover-Zustände sind `OPEN`, `OPENING`, `CLOSED`, `CLOSING`, `STOPPED`.
  Bestätigte Positionsupdates lösen optimistische Bewegungszustände ab;
  ausstehende Positionsbefehle bleiben bis zur Bestätigung von der zuletzt
  bestätigten Position getrennt.
- Wetterstationen, insbesondere Weather Station Pro (Typ `63`), werden als
  Wettergeräte registriert. Die Pro-Windnormalisierung und deren Tests sind
  bei Änderungen an Messwerten zu beachten.
- MQTT-Eingaben werden vor Hardwareaufrufen auf gültige Gerätekennungen,
  Payload-Größe und Wertebereiche geprüft.

## Container und Releases

Bei Containeränderungen prüfe die jeweils betroffene Betriebsart. Native serielle
Abhängigkeiten benötigen Build-Werkzeuge; diese werden nach der Installation
aus dem Runtime-Image entfernt. Erhalte den Add-on-Start über `/init` und das
Service-Skript sowie den direkten Node-Einstieg des Standalone-Images.

Hardwarefreie Containerprüfungen aus dem Repository-Root, sofern Docker verfügbar ist:

```sh
docker buildx build --check .
docker buildx build --load --tag addon-warema-bridge:local --platform linux/amd64 .
docker run --rm --entrypoint node addon-warema-bridge:local --check /srv/bridge.js
docker run --rm --entrypoint node addon-warema-bridge:local -e "require('serialport')"
docker build -f Dockerfile.standalone -t warema-bridge:local .
```

Für Docker-ARM64-Builds lautet die Plattform `linux/arm64`; `aarch64` ist die
Architekturbezeichnung in der Home-Assistant-Konfiguration.

Bei einem beauftragten Release müssen `config.yaml`, `repository.json` und der
zugehörige Abschnitt in `CHANGELOG.md` dieselbe Version verwenden. Ein Tag
`vX.Y.Z` löst die Veröffentlichung aus. Erstelle oder pushe Release-Tags nur
im Rahmen eines ausdrücklich beauftragten Releases.

## Abschluss einer Aufgabe

Prüfe den Diff auf unbeabsichtigte Änderungen und respektiere vorhandene lokale
Änderungen. Berichte knapp, was geändert wurde, welche Prüfungen tatsächlich
ausgeführt wurden und welche Prüfungen wegen fehlender Werkzeuge oder Hardware
offenbleiben. Unterscheide gemockte Tests von einem echten Integrationstest.
