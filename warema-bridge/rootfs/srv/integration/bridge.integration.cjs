const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawn, fork } = require('node:child_process');
const { once } = require('node:events');
const { mkdtemp, writeFile, rm } = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const mqtt = require('mqtt');

const TIMEOUT = 15000;
const DISCOVERY = 'homeassistant/cover/12345/12345/config';
const BRIDGE_STATE = 'warema/bridge/state';

// Install listeners before triggering an action; retain history to avoid races.
function inbox(emitter, event) {
  const messages = [];
  const waiters = new Set();
  emitter.on(event, (...args) => {
    messages.push(args);
    for (const check of [...waiters]) check();
  });
  return {
    mark: () => messages.length,
    wait(predicate, from = 0) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiters.delete(check);
          reject(new Error(`Timed out waiting for ${event}`));
        }, TIMEOUT);
        const check = () => {
          const match = messages.slice(from).find((args) => predicate(...args));
          if (match) {
            clearTimeout(timer);
            waiters.delete(check);
            resolve(match);
          }
        };
        waiters.add(check);
        check();
      });
    },
  };
}

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGKILL');
  await exited;
}

async function startBroker(config) {
  const child = spawn(process.env.MOSQUITTO_BIN || 'mosquitto', ['-c', config, '-v'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error(`Broker startup timed out: ${output}`)), TIMEOUT);
      const finish = (error) => {
        clearTimeout(timer);
        child.removeListener('error', onError);
        child.removeListener('exit', onExit);
        error ? reject(error) : resolve();
      };
      const onError = (error) => finish(new Error(
        `Cannot start Mosquitto. Install it or set MOSQUITTO_BIN. ${error.message}`
      ));
      const onExit = (code) => finish(new Error(`Broker exited (${code}): ${output}`));
      child.once('error', onError);
      child.once('exit', onExit);
      const onData = (chunk) => {
        output += chunk.toString();
        if (output.includes(' running')) finish();
      };
      child.stdout.on('data', onData);
      child.stderr.on('data', onData);
    });
    return child;
  } catch (error) {
    await stop(child);
    throw error;
  }
}

async function connectObserver(url) {
  const client = mqtt.connect(url, { reconnectPeriod: 0, connectTimeout: 5000 });
  const messages = inbox(client, 'message');
  // Errors during cleanup/restart must not become unhandled EventEmitter errors.
  client.on('error', () => {});
  try {
    await once(client, 'connect', { signal: AbortSignal.timeout(TIMEOUT) });
    await new Promise((resolve, reject) => client.subscribe('#', { qos: 1 }, (error, grants) => {
      if (error) return reject(error);
      if (grants.some(({ qos }) => qos === 128)) return reject(new Error('Subscription rejected'));
      resolve();
    }));
    return { client, messages };
  } catch (error) {
    client.end(true);
    throw error;
  }
}

function publish(client, topic, payload, options = {}) {
  return new Promise((resolve, reject) => client.publish(topic, payload, { qos: 1, ...options }, (error) => {
    error ? reject(error) : resolve();
  }));
}

async function setup(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'warema-mqtt-'));
  const clients = [];
  let broker;
  let bridge;
  t.after(async () => {
    for (const client of clients) await new Promise((resolve) => client.end(true, {}, resolve));
    await stop(bridge);
    await stop(broker);
    await rm(directory, { recursive: true, force: true });
  });
  const port = await unusedPort();
  const config = path.join(directory, 'mosquitto.conf');
  await writeFile(config, `listener ${port} 127.0.0.1\nallow_anonymous true\npersistence false\n`);
  const url = `mqtt://127.0.0.1:${port}`;
  broker = await startBroker(config);
  const observer = await connectObserver(url);
  clients.push(observer.client);
  bridge = fork(path.join(__dirname, 'fixtures/bridge-process.cjs'), [], {
    env: {
      ...process.env,
      MQTT_SERVER: url,
      MQTT_USER: '',
      MQTT_PASSWORD: '',
      IGNORED_DEVICES: '',
      FORCE_DEVICES: '',
      LOG_LEVEL: 'error',
      WMS_CHANNEL: '17',
      WMS_PAN_ID: 'FFFF',
      WMS_KEY: '0123456789ABCDEF0123456789ABCDEF',
      WMS_SERIAL_PORT: 'mock-only',
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  let logs = '';
  bridge.stdout.on('data', (chunk) => { logs += chunk; });
  bridge.stderr.on('data', (chunk) => { logs += chunk; });
  t.after(() => { if (t.signal.aborted) console.error(logs); });
  const events = inbox(bridge, 'message');
  // Discovery follows the bridge's SUBSCRIBE packets on the same TCP stream.
  await observer.messages.wait((topic) => topic === DISCOVERY);
  let requestId = 0;
  const request = async (action, payload) => {
    const id = ++requestId;
    bridge.send({ id, action, payload });
    const [reply] = await events.wait((event) => event.type === 'reply' && event.id === id);
    return reply;
  };
  return {
    ...observer,
    events,
    request,
    async observer() {
      const next = await connectObserver(url);
      clients.push(next.client);
      return next;
    },
    killBridge: () => stop(bridge),
    async restartBroker() {
      await stop(broker);
      broker = await startBroker(config);
      return this.observer();
    },
  };
}

test('real MQTT bridge integration', { timeout: 120000 }, async (t) => {
  await t.test('retains discovery and bridge/device availability for late subscribers', async (t) => {
    const fixture = await setup(t);
    const late = await fixture.observer();
    for (const topic of [BRIDGE_STATE, 'warema/12345/availability', DISCOVERY]) {
      const [, payload, packet] = await late.messages.wait((received) => received === topic);
      assert.equal(packet.retain, true);
      if (topic === DISCOVERY) {
        const discovery = JSON.parse(payload);
        assert.equal(discovery.set_position_topic, 'warema/12345/set_position');
        assert.equal(discovery.position_open, 100);
        assert.equal(discovery.position_closed, 0);
        assert.equal(discovery.availability_mode, 'all');
      } else {
        assert.equal(payload.toString(), 'online');
      }
    }
  });

  await t.test('delivers position commands to the mocked stick with Warema coordinates', async (t) => {
    const fixture = await setup(t);
    await publish(fixture.client, 'warema/12345/set_position', '75');
    const [event] = await fixture.events.wait((event) => event.type === 'position');
    assert.deepEqual(event.args, [12345, 25]);
  });

  await t.test('rejects invalid input before the next valid command reaches hardware', async (t) => {
    const fixture = await setup(t);
    const from = fixture.events.mark();
    await publish(fixture.client, 'warema/12345/set_position', '101');
    await publish(fixture.client, 'warema/not-a-number/set', 'OPEN');
    // Without the size guard parseInt would accept this as position 25.
    await publish(fixture.client, 'warema/12345/set_position', '25' + 'X'.repeat(1024));
    await publish(fixture.client, 'warema/12345/set_position', '50');
    // The valid command is a processing barrier: all previous packets on this
    // connection were handled first. No arbitrary negative-assertion sleep.
    const [event] = await fixture.events.wait((event) => event.type === 'position', from);
    assert.deepEqual(event.args, [12345, 50]);
  });

  await t.test('publishes confirmed position, tilt and cover state from WMS callbacks', async (t) => {
    const fixture = await setup(t);
    const from = fixture.messages.mark();
    await fixture.request('callback', {
      topic: 'wms-vb-blind-position-update',
      payload: { snr: 12345, position: 25, angle: -50 },
    });
    for (const [topic, expected] of [
      ['warema/12345/position', '75'],
      ['warema/12345/tilt', '25'],
      ['warema/12345/state', 'STOPPED'],
    ]) {
      const [, payload] = await fixture.messages.wait((received) => received === topic, from);
      assert.equal(payload.toString(), expected);
    }
  });

  await t.test('republishes discovery when Home Assistant comes online', async (t) => {
    const fixture = await setup(t);
    const from = fixture.messages.mark();
    await publish(fixture.client, 'homeassistant/status', 'online');
    const [, payload, packet] = await fixture.messages.wait((topic) => topic === DISCOVERY, from);
    assert.equal(JSON.parse(payload).unique_id, '12345');
    assert.equal(packet.retain, false); // Live delivery, not retained replay.
  });

  await t.test('reconnects after broker restart and keeps the existing WMS stick', async (t) => {
    const fixture = await setup(t);
    const observer = await fixture.restartBroker();
    await observer.messages.wait((topic, payload) => topic === BRIDGE_STATE && payload.toString() === 'online');
    // Retain HA status so it also reaches a bridge whose SUBSCRIBE packets are
    // still in flight. Discovery then confirms its subscriptions are ready.
    await publish(observer.client, 'homeassistant/status', 'online', { retain: true });
    await observer.messages.wait((topic) => topic === DISCOVERY);
    const from = fixture.events.mark();
    await publish(observer.client, 'warema/12345/set_position', '80');
    const [event] = await fixture.events.wait((event) => event.type === 'position', from);
    assert.deepEqual(event.args, [12345, 20]);
    assert.equal((await fixture.request('snapshot')).initializations, 1);
  });

  await t.test('publishes and retains the offline Last Will after an abrupt bridge exit', async (t) => {
    const fixture = await setup(t);
    const from = fixture.messages.mark();
    await fixture.killBridge();
    await fixture.messages.wait((topic, payload) => topic === BRIDGE_STATE && payload.toString() === 'offline', from);
    const late = await fixture.observer();
    const [, payload, packet] = await late.messages.wait((topic) => topic === BRIDGE_STATE);
    assert.equal(payload.toString(), 'offline');
    assert.equal(packet.retain, true);
  });
});
