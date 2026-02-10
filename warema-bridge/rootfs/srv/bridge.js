const { WaremaWmsVenetianBlinds } = require('warema-wms-venetian-blinds');
const mqtt = require('mqtt');

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

const ignoredDevices = (process.env.IGNORED_DEVICES || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const forceDevices = (process.env.FORCE_DEVICES || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const settingsPar = {
  wmsChannel: Number(process.env.WMS_CHANNEL || 17),
  wmsKey: process.env.WMS_KEY || '00112233445566778899AABBCCDDEEFF',
  wmsPanid: process.env.WMS_PAN_ID || 'FFFF',
  wmsSerialPort: process.env.WMS_SERIAL_PORT || '/dev/ttyUSB0',
};

const registeredShades = new Set();
const shadePosition = {};

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
      console.log(`Unrecognized device type: ${type}`);
      return null;
  }
};

const registerShade = (serialNumber) => {
  stickUsb.vnBlindAdd(Number(serialNumber), serialNumber);
  registeredShades.add(serialNumber);
  client.publish(buildAvailabilityTopic(serialNumber), 'online', { retain: true });
};

function registerDevice(element) {
  const serialNumber = element.snr.toString();
  const configTopic = buildCoverConfigTopic(serialNumber);

  console.log(`Registering ${serialNumber}`);

  const deviceConfig = getPayloadByDeviceType(serialNumber, element.type);
  if (!deviceConfig) {
    return;
  }

  if (ignoredDevices.includes(serialNumber)) {
    console.log(`Ignoring and removing device ${serialNumber} (type ${element.type})`);
  } else {
    console.log(`Adding device ${serialNumber} (type ${element.type})`);
    registerShade(serialNumber);
  }

  client.publish(configTopic, JSON.stringify(deviceConfig.payload));
}

function registerDevices() {
  if (forceDevices.length > 0) {
    forceDevices.forEach((serialNumber) => {
      registerDevice({ snr: serialNumber, type: DEVICE_TYPES.VERTICAL_AWNING });
    });
    return;
  }

  console.log('Scanning...');
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
    console.log(`ERROR: ${err}`);
  }

  if (!msg) {
    return;
  }

  switch (msg.topic) {
    case 'wms-vb-init-completion':
      console.log('Warema init completed');
      registerDevices();
      stickUsb.setPosUpdInterval(POSITION_UPDATE_INTERVAL_MS);
      break;
    case 'wms-vb-rcv-weather-broadcast':
      handleWeatherBroadcast(msg.payload.weather);
      break;
    case 'wms-vb-blind-position-update':
      handleBlindPositionUpdate(msg.payload);
      break;
    case 'wms-vb-scanned-devices':
      console.log('Scanned devices.');
      msg.payload.devices.forEach((element) => registerDevice(element));
      console.log(stickUsb.vnBlindsList());
      break;
    default:
      console.log(`UNKNOWN MESSAGE: ${JSON.stringify(msg)}`);
  }
}

const client = mqtt.connect(process.env.MQTT_SERVER, {
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASSWORD,
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

const handleWaremaMessage = (topic, message) => {
  const [, serialNumber, command] = topic.split('/');
  const deviceId = Number(serialNumber);
  const stringMessage = message.toString();

  switch (command) {
    case 'set':
      handleSetCommand(deviceId, stringMessage);
      break;
    case 'set_position': {
      const currentAngle = resolveCurrentAngle(serialNumber);
      if (currentAngle !== undefined) {
        stickUsb.vnBlindSetPosition(deviceId, Number.parseInt(stringMessage, 10), Number.parseInt(currentAngle, 10));
      }
      break;
    }
    case 'set_tilt': {
      const currentPosition = resolveCurrentPosition(serialNumber);
      if (currentPosition !== undefined) {
        stickUsb.vnBlindSetPosition(deviceId, Number.parseInt(currentPosition, 10), Number.parseInt(stringMessage, 10));
      }
      break;
    }
    default:
      break;
  }
};

client.on('connect', () => {
  console.log('Connected to MQTT');
  client.subscribe(MQTT_TOPICS.waremaWildcard);
  client.subscribe(MQTT_TOPICS.homeAssistantStatus);

  stickUsb = new WaremaWmsVenetianBlinds({
    serialPort: settingsPar.wmsSerialPort,
    channel: settingsPar.wmsChannel,
    panid: settingsPar.wmsPanid,
    key: settingsPar.wmsKey,
    callback,
  });
});

client.on('error', (error) => {
  console.log(`MQTT Error: ${error.toString()}`);
});

client.on('message', (topic, message) => {
  const [scope, subtopic] = topic.split('/');

  if (scope === 'warema') {
    handleWaremaMessage(topic, message);
    return;
  }

  if (scope === 'homeassistant' && subtopic === 'status' && message.toString() === 'online') {
    registerDevices();
  }
});

module.exports = {
  registerDevice,
  registerDevices,
  callback,
};
