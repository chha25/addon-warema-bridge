// Only the hardware dependency is replaced. MQTT.js uses a real TCP connection.
const hardwarePath = require.resolve('warema-wms-venetian-blinds');
const report = (event) => process.send(event);
let wmsCallback;
let initializations = 0;

class MockStick {
  constructor(port, channel, panid, key, options, callback) {
    initializations += 1;
    wmsCallback = callback;
    setImmediate(() => callback(null, { topic: 'wms-vb-init-completion' }));
  }

  vnBlindAdd() {}
  vnBlindRemove() {}
  scanDevices() {
    setImmediate(() => wmsCallback(null, {
      topic: 'wms-vb-scanned-devices',
      payload: { devices: [{ snr: 12345, type: 20 }] },
    }));
  }
  setPosUpdInterval() {}
  vnBlindsList() { return []; }
  vnBlindSetPosition(...args) { report({ type: 'position', args }); }
  vnBlindStop(...args) { report({ type: 'stop', args }); }
}

require.cache[hardwarePath] = {
  id: hardwarePath,
  filename: hardwarePath,
  loaded: true,
  exports: { WaremaWmsVenetianBlinds: MockStick },
};

require('../../bridge.js');

process.on('message', ({ id, action, payload }) => {
  if (action === 'callback') {
    wmsCallback(null, payload);
  }
  report({ type: 'reply', id, initializations });
});

process.on('disconnect', () => process.exit(0));
