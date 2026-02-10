// Mocked dependencies
jest.mock('mqtt', () => ({
  connect: jest.fn()
}));
jest.mock('warema-wms-venetian-blinds', () => ({
  WaremaWmsVenetianBlinds: jest.fn()
}));

describe('bridge.js', () => {
  let clientMock, stickUsbMock, bridge, registerDevice, registerDevices, callback, handlers;

  const setupBridge = ({ ignoredDevices = '', forceDevices = '', wmsChannel = '17', wmsPanId = 'FFFF', wmsKey = '' } = {}) => {
    jest.resetModules();
    process.removeAllListeners('SIGINT');
    process.env.IGNORED_DEVICES = ignoredDevices;
    process.env.FORCE_DEVICES = forceDevices;
    process.env.MQTT_SERVER = 'mqtt://localhost';
    process.env.MQTT_USER = 'user';
    process.env.MQTT_PASSWORD = 'password';
    process.env.WMS_CHANNEL = wmsChannel;
    process.env.WMS_PAN_ID = wmsPanId;
    process.env.WMS_KEY = wmsKey;

    handlers = {};
    clientMock = {
      publish: jest.fn(),
      subscribe: jest.fn(),
      on: jest.fn((event, handler) => {
        handlers[event] = handler;
      }),
      connect: jest.fn()
    };
    stickUsbMock = {
      vnBlindAdd: jest.fn(),
      scanDevices: jest.fn(),
      setPosUpdInterval: jest.fn(),
      vnBlindSetPosition: jest.fn(),
      vnBlindStop: jest.fn(),
      vnBlindsList: jest.fn()
    };

    require('mqtt').connect.mockReturnValue(clientMock);
    require('warema-wms-venetian-blinds').WaremaWmsVenetianBlinds.mockImplementation(() => stickUsbMock);

    bridge = require('../bridge.js');
    registerDevice = bridge.registerDevice;
    registerDevices = bridge.registerDevices;
    callback = bridge.callback;
    handlers.connect();
  };

  beforeEach(() => {
    setupBridge();
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.removeAllListeners('SIGINT');
  });

  test('registerDevice should publish config for known device', () => {
    const element = { snr: 12345, type: 25 };
    registerDevice(element);
    expect(clientMock.publish).toHaveBeenCalledWith(
      'homeassistant/cover/12345/12345/config',
      expect.any(String)
    );
    expect(stickUsbMock.vnBlindAdd).toHaveBeenCalledWith(12345, '12345');
  });

  test('registerDevice should ignore device in ignoredDevices', () => {
    setupBridge({ ignoredDevices: '12345' });
    const element = { snr: 12345, type: 25 };
    registerDevice(element);
    expect(stickUsbMock.vnBlindAdd).not.toHaveBeenCalled();
    expect(clientMock.publish).toHaveBeenCalledWith(
      'homeassistant/cover/12345/12345/config',
      expect.any(String)
    );
  });

  test('registerDevices should scan devices if forceDevices is empty', () => {
    process.env.FORCE_DEVICES = '';
    registerDevices();
    expect(stickUsbMock.scanDevices).toHaveBeenCalledWith({ autoAssignBlinds: false });
  });

  test('registerDevices should register forced devices', () => {
    setupBridge({ forceDevices: '111,222' });
    registerDevices();
    expect(clientMock.publish).toHaveBeenCalledWith(
      'homeassistant/cover/111/111/config',
      expect.any(String)
    );
    expect(clientMock.publish).toHaveBeenCalledWith(
      'homeassistant/cover/222/222/config',
      expect.any(String)
    );
  });

  test('callback should handle wms-vb-init-completion', () => {
    const msg = { topic: 'wms-vb-init-completion' };
    callback(null, msg);
    expect(stickUsbMock.setPosUpdInterval).toHaveBeenCalledWith(30000);
  });

  test('callback should handle wms-vb-blind-position-update', () => {
    const msg = { topic: 'wms-vb-blind-position-update', payload: { snr: 12345, position: 50, angle: 10 } };
    callback(null, msg);
    expect(clientMock.publish).toHaveBeenCalledWith('warema/12345/position', '50');
    expect(clientMock.publish).toHaveBeenCalledWith('warema/12345/tilt', '10');
  });

  test('callback should handle wms-vb-rcv-weather-broadcast for new station', () => {
    const msg = {
      topic: 'wms-vb-rcv-weather-broadcast',
      payload: { weather: { snr: 999, lumen: 123, temp: 24 } }
    };
    callback(null, msg);
    expect(clientMock.publish).toHaveBeenCalledWith(
      'homeassistant/sensor/999/illuminance/config',
      expect.any(String)
    );
    expect(clientMock.publish).toHaveBeenCalledWith(
      'homeassistant/sensor/999/temperature/config',
      expect.any(String)
    );
    expect(clientMock.publish).toHaveBeenCalledWith('warema/999/availability', 'online', { retain: true });
  });

  test('callback should handle wms-vb-scanned-devices', () => {
    const msg = { topic: 'wms-vb-scanned-devices', payload: { devices: [{ snr: 222, type: 25 }] } };
    callback(null, msg);
    expect(clientMock.publish).toHaveBeenCalledWith(
      'homeassistant/cover/222/222/config',
      expect.any(String)
    );
    expect(stickUsbMock.vnBlindsList).toHaveBeenCalled();
  });

  test('callback should handle unknown message', () => {
    const msg = { topic: 'unknown-topic', payload: {} };
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    callback(null, msg);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('UNKNOWN MESSAGE'));
    consoleSpy.mockRestore();
  });

  test('connect handler should subscribe and initialize stick', () => {
    expect(clientMock.subscribe).toHaveBeenCalledWith('warema/#');
    expect(clientMock.subscribe).toHaveBeenCalledWith('homeassistant/status');
    expect(require('warema-wms-venetian-blinds').WaremaWmsVenetianBlinds).toHaveBeenCalledWith(
      expect.objectContaining({
        serialPort: '/dev/ttyUSB0',
        channel: 17,
        panid: 'FFFF'
      })
    );
  });

  test('message handler should control blinds', () => {
    callback(null, {
      topic: 'wms-vb-blind-position-update',
      payload: { snr: 12345, position: 20, angle: 30 }
    });
    handlers.message('warema/12345/set', Buffer.from('CLOSE'));
    expect(stickUsbMock.vnBlindSetPosition).toHaveBeenCalledWith(12345, 100);
    handlers.message('warema/12345/set', Buffer.from('OPEN'));
    expect(stickUsbMock.vnBlindSetPosition).toHaveBeenCalledWith(12345, 0);
    handlers.message('warema/12345/set', Buffer.from('STOP'));
    expect(stickUsbMock.vnBlindStop).toHaveBeenCalledWith(12345);
    handlers.message('warema/12345/set_position', Buffer.from('55'));
    expect(stickUsbMock.vnBlindSetPosition).toHaveBeenCalledWith(12345, 55, 30);
    handlers.message('warema/12345/set_tilt', Buffer.from('10'));
    expect(stickUsbMock.vnBlindSetPosition).toHaveBeenCalledWith(12345, 20, 10);
  });

  test('message handler should rescan when homeassistant online', () => {
    handlers.message('homeassistant/status', Buffer.from('online'));
    expect(stickUsbMock.scanDevices).toHaveBeenCalledWith({ autoAssignBlinds: false });
  });


  test('message handler should ignore out-of-range numeric payloads', () => {
    callback(null, {
      topic: 'wms-vb-blind-position-update',
      payload: { snr: 12345, position: 20, angle: 30 }
    });

    handlers.message('warema/12345/set_position', Buffer.from('200'));
    handlers.message('warema/12345/set_tilt', Buffer.from('-101'));

    expect(stickUsbMock.vnBlindSetPosition).not.toHaveBeenCalledWith(12345, 200, 30);
    expect(stickUsbMock.vnBlindSetPosition).not.toHaveBeenCalledWith(12345, 20, -101);
  });

  test('message handler should ignore invalid serial topic', () => {
    handlers.message('warema/not-a-number/set', Buffer.from('OPEN'));
    expect(stickUsbMock.vnBlindSetPosition).not.toHaveBeenCalled();
    expect(stickUsbMock.vnBlindStop).not.toHaveBeenCalled();
  });

  test('connect handler should sanitize invalid WMS settings', () => {
    setupBridge({ wmsChannel: '99', wmsPanId: 'bad-pan', wmsKey: 'bad-key' });
    expect(require('warema-wms-venetian-blinds').WaremaWmsVenetianBlinds).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 17,
        panid: 'FFFF',
        key: '00112233445566778899AABBCCDDEEFF'
      })
    );
  });
});
