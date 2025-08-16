const sinon = require('sinon');
const mqtt = require('mqtt');
const { WaremaWmsVenetianBlinds } = require('warema-wms-venetian-blinds');

// Mocked dependencies
jest.mock('mqtt', () => ({
  connect: jest.fn()
}));
jest.mock('warema-wms-venetian-blinds', () => ({
  WaremaWmsVenetianBlinds: jest.fn()
}));

describe('bridge.js', () => {
  let clientMock, stickUsbMock, bridge, registerDevice, registerDevices, callback;


beforeEach(() => {
  jest.resetModules(); 

  clientMock = {
    publish: jest.fn(),
    subscribe: jest.fn(),
    on: jest.fn(),
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

  const bridge = require('../bridge.js');
  registerDevice = bridge.registerDevice;
  registerDevices = bridge.registerDevices;
  callback = bridge.callback;
});

  afterEach(() => {
    jest.clearAllMocks();
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
    process.env.IGNORED_DEVICES = '12345';
    const element = { snr: 12345, type: 25 };
    registerDevice(element);
    expect(clientMock.publish).not.toHaveBeenCalledWith(
      'homeassistant/cover/12345/12345/config',
      expect.any(String)
    );
    process.env.IGNORED_DEVICES = '';
  });

  test('registerDevices should scan devices if forceDevices is empty', () => {
    process.env.FORCE_DEVICES = '';
    registerDevices();
    expect(stickUsbMock.scanDevices).toHaveBeenCalledWith({ autoAssignBlinds: false });
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

  test('callback should handle unknown message', () => {
    const msg = { topic: 'unknown-topic', payload: {} };
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    callback(null, msg);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('UNKNOWN MESSAGE'));
    consoleSpy.mockRestore();
  });
});