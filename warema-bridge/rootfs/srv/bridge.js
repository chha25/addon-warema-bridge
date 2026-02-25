const waremaModule = require('warema-wms-venetian-blinds');
const mqtt = require('mqtt');

const WaremaWmsVenetianBlinds = waremaModule.WaremaWmsVenetianBlinds
  || waremaModule.default
  || waremaModule;

process.on('SIGINT', () => {
  process.exit(0);
});

const MQTT_TOPICS = {
  bridgeState: 'warema/bridge/state',
  waremaWildcard: 'warema/#',
  homeAssistantStatus: 'homeassistant/status',
};

const DEVICE_TYPES = {
  WEATHER_STATION: 6,
  WEBCONTROL_PRO: 9,
  PLUG_RECEIVER: 20,
  ACTUATOR_UP: 21,
  VERTICAL_AWNING: 25,
};

const POSITION_UPDATE_INTERVAL_MS = 30000;
const DEFAULT_WMS_KEY = '00112233445566778899AABBCCDDEEFF';
const MQTT_PAYLOAD_LIMIT = 1024;

const LOG_LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  notice: 40,
  warning: 50,
  error: 60,
  fatal: 70,
};

const resolveLogLevel = (rawLevel) => {
  const level = (rawLevel || 'info').toLowerCase();
  return LOG_LEVELS[level] ? level : 'info';
};

const activeLogLevel = resolveLogLevel(process.env.LOG_LEVEL);
const activeLogPriority = LOG_LEVELS[activeLogLevel];

const log = (level, message, ...args) => {
  if (LOG_LEVELS[level] < activeLogPriority) {
    return;
  }

  const timestamp = new Date().toISOString();
  const payload = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  if (level === 'error' || level === 'fatal') {
    console.error(payload, ...args);
    return;
  }

  console.log(payload, ...args);
};

const ignoredDevices = (process.env.IGNORED_DEVICES || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const forceDevices = (process.env.FORCE_DEVICES || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const sanitizeWmsKey = (rawKey) => {
  const normalizedKey = (rawKey || DEFAULT_WMS_KEY).trim().toUpperCase();
  const isValid = /^[0-9A-F]{32}$/.test(normalizedKey);

  if (!isValid) {
    log('warning', 'WMS key has invalid format. Falling back to default key.');
    return DEFAULT_WMS_KEY;
  }

  if (normalizedKey === DEFAULT_WMS_KEY) {
    log('warning', 'Using default WMS key. Configure wms_key to harden your setup.');
  }

  return normalizedKey;
};

const sanitizeWmsChannel = (rawChannel) => {
  const parsedChannel = Number.parseInt(rawChannel, 10);
  if (Number.isNaN(parsedChannel) || parsedChannel < 0 || parsedChannel > 26) {
    log('warning', `Invalid WMS channel "${rawChannel}". Falling back to channel 17.`);
    return 17;
  }

  return parsedChannel;
};

const sanitizeWmsPanid = (rawPanid) => {
  const normalizedPanid = (rawPanid || 'FFFF').trim().toUpperCase();
  if (!/^[0-9A-F]{4}$/.test(normalizedPanid)) {
    log('warning', `Invalid WMS PAN ID "${rawPanid}". Falling back to FFFF.`);
    return 'FFFF';
  }

  return normalizedPanid;
};

const settingsPar = {
  wmsChannel: sanitizeWmsChannel(process.env.WMS_CHANNEL || '17'),
  wmsKey: sanitizeWmsKey(process.env.WMS_KEY),
  wmsPanid: sanitizeWmsPanid(process.env.WMS_PAN_ID),
  wmsSerialPort: process.env.WMS_SERIAL_PORT || '/dev/ttyUSB0',
};

const registeredShades = new Set();
const registeredBlindsInLibrary = new Set();
const shadePosition = {};

const resetLocalRegistrationState = () => {
  registeredShades.clear();
  registeredBlindsInLibrary.clear();
  Object.keys(shadePosition).forEach((serialNumber) => {
    delete shadePosition[serialNumber];
  });
};

const resetRegisteredBlindsInLibrary = () => {
  if (!stickUsb || typeof stickUsb.vnBlindRemove !== 'function') {
    return;
  }

  registeredBlindsInLibrary.forEach((serialNumber) => {
    const deviceId = Number(serialNumber);
    if (!Number.isInteger(deviceId)) {
      return;
    }

    stickUsb.vnBlindRemove(deviceId);
  });
};

const handleHomeAssistantOnline = () => {
  log('info', 'Home Assistant is online. Resetting registrations and re-publishing discovery.');
  resetRegisteredBlindsInLibrary();
  resetLocalRegistrationState();
  registerDevices();
};

const buildAvailabilityTopic = (serialNumber) => `warema/${serialNumber}/availability`;
const buildCoverConfigTopic = (serialNumber) => `homeassistant/cover/${serialNumber}/${serialNumber}/config`;

const createBasePayload = (serialNumber) => ({
  name: serialNumber,
  availability: [{ topic: MQTT_TOPICS.bridgeState }, { topic: buildAvailabilityTopic(serialNumber) }],
  unique_id: serialNumber,
});

const createBaseDevice = (serialNumber) => ({
  identifiers: serialNumber,
  manufacturer: 'Warema',
  name: serialNumber,
});

const createTiltConfig = () => ({
  tilt_status_topic: 'tilt',
  tilt_command_topic: 'set_tilt',
  tilt_closed_value: -100,
  tilt_opened_value: 100,
  tilt_min: -100,
  tilt_max: 100,
});

const createShadingPayload = (serialNumber, model, supportsTilt) => ({
  ...createBasePayload(serialNumber),
  device: {
    ...createBaseDevice(serialNumber),
    model,
  },
  position_open: 0,
  position_closed: 100,
  command_topic: `warema/${serialNumber}/set`,
  position_topic: `warema/${serialNumber}/position`,
  set_position_topic: `warema/${serialNumber}/set_position`,
  ...(supportsTilt
    ? {
      ...Object.fromEntries(
        Object.entries(createTiltConfig()).map(([key, value]) => [
          key,
          typeof value === 'string' ? `warema/${serialNumber}/${value}` : value,
        ]),
      ),
    }
    : {}),
});

const getPayloadByDeviceType = (serialNumber, type) => {
  switch (Number(type)) {
    case DEVICE_TYPES.WEATHER_STATION:
      return {
        payload: {
          ...createBasePayload(serialNumber),
          device: {
            ...createBaseDevice(serialNumber),
            model: 'Weather station',
          },
        },
      };
    case DEVICE_TYPES.WEBCONTROL_PRO:
      return null;
    case DEVICE_TYPES.PLUG_RECEIVER:
      return { payload: createShadingPayload(serialNumber, 'Plug receiver', true) };
    case DEVICE_TYPES.ACTUATOR_UP:
      return { payload: createShadingPayload(serialNumber, 'Actuator UP', true) };
    case DEVICE_TYPES.VERTICAL_AWNING:
      return { payload: createShadingPayload(serialNumber, 'Vertical awning', false) };
    default:
      log('warning', `Unrecognized device type: ${type}`);
      return null;
  }
};

const registerShade = (serialNumber) => {
  stickUsb.vnBlindAdd(Number(serialNumber), serialNumber);
  registeredShades.add(serialNumber);
  registeredBlindsInLibrary.add(serialNumber);
  client.publish(buildAvailabilityTopic(serialNumber), 'online', { retain: true });
};

function registerDevice(element) {
  const serialNumber = element.snr.toString();
  const configTopic = buildCoverConfigTopic(serialNumber);

  log('debug', `Registering ${serialNumber}`);

  const deviceConfig = getPayloadByDeviceType(serialNumber, element.type);
  if (!deviceConfig) {
    return;
  }

  if (ignoredDevices.includes(serialNumber)) {
    log('info', `Ignoring and removing device ${serialNumber} (type ${element.type})`);
  } else {
    log('info', `Adding device ${serialNumber} (type ${element.type})`);
    registerShade(serialNumber);
  }

  client.publish(configTopic, JSON.stringify(deviceConfig.payload), { retain: true });
}

function registerDevices() {
  if (forceDevices.length > 0) {
    forceDevices.forEach((serialNumber) => {
      registerDevice({ snr: serialNumber, type: DEVICE_TYPES.VERTICAL_AWNING });
    });
    return;
  }

  log('info', 'Scanning...');
  stickUsb.scanDevices({ autoAssignBlinds: false });
}

const publishWeatherDiscovery = (weather) => {
  const serialNumber = weather.snr.toString();
  const availabilityTopic = buildAvailabilityTopic(serialNumber);
  const basePayload = {
    name: serialNumber,
    availability: [{ topic: MQTT_TOPICS.bridgeState }, { topic: availabilityTopic }],
    device: {
      identifiers: serialNumber,
      manufacturer: 'Warema',
      model: 'Weather Station',
      name: serialNumber,
    },
    force_update: true,
  };

  client.publish(
    `homeassistant/sensor/${serialNumber}/illuminance/config`,
    JSON.stringify({
      ...basePayload,
      state_topic: `warema/${serialNumber}/illuminance/state`,
      device_class: 'illuminance',
      unique_id: `${serialNumber}_illuminance`,
      unit_of_measurement: 'lm',
    }),
    { retain: true },
  );

  client.publish(
    `homeassistant/sensor/${serialNumber}/temperature/config`,
    JSON.stringify({
      ...basePayload,
      state_topic: `warema/${serialNumber}/temperature/state`,
      device_class: 'temperature',
      unique_id: `${serialNumber}_temperature`,
      unit_of_measurement: 'C',
    }),
    { retain: true },
  );

  client.publish(availabilityTopic, 'online', { retain: true });
  registeredShades.add(serialNumber);
};

const handleWeatherBroadcast = (weather) => {
  const serialNumber = weather.snr.toString();
  if (registeredShades.has(serialNumber)) {
    client.publish(`warema/${serialNumber}/illuminance/state`, weather.lumen.toString());
    client.publish(`warema/${serialNumber}/temperature/state`, weather.temp.toString());
    return;
  }

  publishWeatherDiscovery(weather);
};

const handleBlindPositionUpdate = (payload) => {
  if (!payload || typeof payload.snr === 'undefined') {
    log('warning', 'Ignoring blind update without serial number');
    return;
  }

  if (!Number.isFinite(payload.position) || !Number.isFinite(payload.angle)) {
    log('warning', `Ignoring blind update with invalid values for ${payload.snr}`);
    return;
  }

  const serialNumber = payload.snr.toString();
  client.publish(`warema/${serialNumber}/position`, payload.position.toString());
  client.publish(`warema/${serialNumber}/tilt`, payload.angle.toString());

  shadePosition[serialNumber] = {
    position: payload.position,
    angle: payload.angle,
  };
};

function callback(err, msg) {
  if (err) {
    log('error', `WMS callback error: ${err}`);
  }

  if (!msg) {
    return;
  }

  switch (msg.topic) {
    case 'wms-vb-init-completion':
      log('info', 'Warema init completed');
      registerDevices();
      stickUsb.setPosUpdInterval(POSITION_UPDATE_INTERVAL_MS);
      break;
    case 'wms-vb-rcv-weather-broadcast':
      if (msg.payload?.weather) {
        handleWeatherBroadcast(msg.payload.weather);
      }
      break;
    case 'wms-vb-blind-position-update':
      handleBlindPositionUpdate(msg.payload);
      break;
    case 'wms-vb-scanned-devices':
      log('info', 'Scanned devices.');
      if (Array.isArray(msg.payload?.devices)) {
        msg.payload.devices.forEach((element) => registerDevice(element));
      }
      log('debug', 'Registered blind list', stickUsb.vnBlindsList());
      break;
    default:
      log('warning', `UNKNOWN MESSAGE: ${JSON.stringify(msg)}`);
  }
}

const client = mqtt.connect(process.env.MQTT_SERVER, {
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASSWORD,
  reconnectPeriod: 5000,
  connectTimeout: 30_000,
  will: {
    topic: MQTT_TOPICS.bridgeState,
    payload: 'offline',
    retain: true,
  },
});

let stickUsb;

const resolveCurrentPosition = (serialNumber) => shadePosition[serialNumber]?.position;
const resolveCurrentAngle = (serialNumber) => shadePosition[serialNumber]?.angle;

const handleSetCommand = (deviceId, command) => {
  if (command === 'CLOSE') {
    stickUsb.vnBlindSetPosition(deviceId, 100);
  } else if (command === 'OPEN') {
    stickUsb.vnBlindSetPosition(deviceId, 0);
  } else if (command === 'STOP') {
    stickUsb.vnBlindStop(deviceId);
  }
};

const parseNumericPayload = (value, min, max) => {
  const parsedValue = Number.parseInt(value, 10);
  if (Number.isNaN(parsedValue) || parsedValue < min || parsedValue > max) {
    return null;
  }

  return parsedValue;
};

const handleWaremaMessage = (topic, message) => {
  if (topic === MQTT_TOPICS.bridgeState) {
    return;
  }

  const [, serialNumber, command] = topic.split('/');
  const deviceId = Number(serialNumber);
  if (!Number.isInteger(deviceId)) {
    log('warning', `Ignoring command for invalid serial number in topic "${topic}"`);
    return;
  }

  const stringMessage = message.toString().trim().toUpperCase();

  if (stringMessage.length > MQTT_PAYLOAD_LIMIT) {
    log('warning', `Ignoring oversized MQTT payload (${stringMessage.length} bytes) on ${topic}`);
    return;
  }

  switch (command) {
    case 'set':
      handleSetCommand(deviceId, stringMessage);
      break;
    case 'set_position': {
      const currentAngle = resolveCurrentAngle(serialNumber);
      const requestedPosition = parseNumericPayload(stringMessage, 0, 100);
      if (currentAngle !== undefined && requestedPosition !== null) {
        stickUsb.vnBlindSetPosition(deviceId, requestedPosition, Number.parseInt(currentAngle, 10));
      } else if (requestedPosition === null) {
        log('warning', `Ignoring invalid position payload for ${serialNumber}: ${stringMessage}`);
      }
      break;
    }
    case 'set_tilt': {
      const currentPosition = resolveCurrentPosition(serialNumber);
      const requestedAngle = parseNumericPayload(stringMessage, -100, 100);
      if (currentPosition !== undefined && requestedAngle !== null) {
        stickUsb.vnBlindSetPosition(deviceId, Number.parseInt(currentPosition, 10), requestedAngle);
      } else if (requestedAngle === null) {
        log('warning', `Ignoring invalid tilt payload for ${serialNumber}: ${stringMessage}`);
      }
      break;
    }
    default:
      break;
  }
};

client.on('connect', () => {
  log('info', `Connected to MQTT (log level: ${activeLogLevel})`);
  client.publish(MQTT_TOPICS.bridgeState, 'online', { retain: true });
  client.subscribe(MQTT_TOPICS.waremaWildcard);
  client.subscribe(MQTT_TOPICS.homeAssistantStatus);

  stickUsb = new WaremaWmsVenetianBlinds(
    settingsPar.wmsSerialPort,
    settingsPar.wmsChannel,
    settingsPar.wmsPanid,
    settingsPar.wmsKey,
    {},
    callback,
  );
});

client.on('error', (error) => {
  log('error', `MQTT Error: ${error.toString()}`);
});

client.on('message', (topic, message) => {
  const [scope, subtopic] = topic.split('/');

  if (scope === 'warema') {
    handleWaremaMessage(topic, message);
    return;
  }

  if (scope === 'homeassistant' && subtopic === 'status' && message.toString() === 'online') {
    handleHomeAssistantOnline();
  }
});

module.exports = {
  registerDevice,
  registerDevices,
  callback,
};
