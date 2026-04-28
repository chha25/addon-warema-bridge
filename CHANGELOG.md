# Changelog

All notable changes to this Home Assistant add-on are documented in this file.

## 3.0.1

- Fix #30: Keep the existing WMS USB stick instance across MQTT reconnects so the serial connection is not reinitialized repeatedly.
- Diagnostics: Added MQTT lifecycle, WMS stick initialization/reuse, command, and WMS command-result logging to improve debugging of intermittent move timeouts.

## 3.0.0

- Breaking: MQTT cover position values now use Home Assistant/Matter semantics (`0 = closed`, `100 = open`) instead of Warema's internal direction.
- Breaking: MQTT cover tilt values now use the normalized Home Assistant/Matter range (`0..100`) instead of Warema's internal `-100..100` angle range.
- MQTT Cover: Added `device_class: blind` to shading discovery payloads so Raffstores are exposed as lift + tilt capable blinds.
- MQTT Cover: Updated discovery metadata to publish `position_open: 100`, `position_closed: 0`, `tilt_min: 0`, `tilt_max: 100`, `tilt_closed_value: 0`, and `tilt_opened_value: 100`.
- MQTT runtime: Added bidirectional mapping so Warema API calls still receive the expected internal position and tilt values while Home Assistant/Matter sees normalized values.
- Compatibility: Existing MQTT topic names remain unchanged, but automations that read or write raw `position`, `tilt`, `set_position`, or `set_tilt` values may need to be updated.
- Note: If Home Assistant or Matter Hub keeps using stale entity metadata, delete the retained MQTT discovery message and restart the add-on to republish discovery.

## 2.1.6

- MQTT Cover: Added `state_topic` discovery for covers, including `open`, `opening`, `closed`, `closing`, and `stopped` states for better Home Assistant compatibility.
- MQTT Cover: Set `availability_mode` to `all` when publishing multiple availability topics, so bridge and device availability are evaluated consistently.
- MQTT runtime: Improved command handling so `set_position` still works without a cached tilt value and state updates are published more reliably during movement.
- Tests: Expanded Jest coverage for MQTT discovery payloads, movement state publishing, and command fallback behavior.

## 2.1.5

- Fix #23: Updated the Home Assistant add-on build for the current BuildKit-based build process (`Dockerfile` as the single source of truth).
- Fix #23: The add-on image now uses `ghcr.io/home-assistant/base:latest` directly, so the build no longer depends on an external `BUILD_FROM` argument.
- Maintenance: Temporary native build tools are removed from the runtime image after `npm ci --omit=dev`.
- Maintenance: Updated supported add-on architectures to `amd64` and `aarch64`.
- Documentation: Added local test steps for the Home Assistant add-on image.

## 2.1.4

- Maintenance: Aligned Node.js LTS support with the currently supported LTS lines (22/24, 24 recommended), including the CI matrix.
- Maintenance: Tooling and documentation updates (`engines`, `.nvmrc`, standalone image, README).
- No changes to the bridge runtime logic.

## 2.1.3

- Fix: Removed `CMD ["/init"]` from the add-on Dockerfile so `/init` is not started as a subprocess (error: `s6-overlay-suexec: fatal: can only run as pid 1`).

## 2.1.2

- Fix #14: Removed duplicate startup and switched startup to the Home Assistant standard (`/init` + `services.d`).
- Fix #14: Improved Home Assistant restart recovery and MQTT topic handling for `warema/bridge/state`.

## 2.1.1

- Updated the runtime base to Node.js 20 (LTS).
- Improved Home Assistant add-on compatibility and updated add-on metadata.
- Stability and logging improvements for operation with MQTT and a WMS USB dongle.

## Unreleased

- Fix #14: Removed duplicate startup caused by parallel `services.d` startup (`run.sh` is started only once).
- Fix #14: Home Assistant restart (`homeassistant/status=online`) resets registrations, removes old blind registrations from the WMS library, and republishes discovery.
- Fix #14: MQTT discovery configs are published as retained messages; bridge state is actively set to retained `online` on connect.
- Fix #14: `warema/bridge/state` is no longer interpreted as a device topic.
- Fix #14: MQTT command subscriptions are limited to `warema/+/set`, `warema/+/set_position`, and `warema/+/set_tilt`, so bridge status messages are not processed as device commands.

## 2.1.0

- Revised configuration for operation with current Home Assistant versions.
- Improvements to device discovery and MQTT integration.

## 2.0.0

- Major add-on modernization, including architecture and runtime adjustments.
- Prepared for multi-architecture builds and more robust operation in the add-on environment.

## More Information

More information, source code, and support:

- GitHub: https://github.com/chha25/addon-warema-bridge
