import test from 'node:test';
import assert from 'node:assert';
import { processTravelTime } from './handler.js';
import { Config } from './config.js';

const baseConfig: Config = {
  googleMapsApiKey: 'fake-gmaps-key',
  telegramBotToken: 'fake-tg-token',
  telegramChatId: '123456',
  origin: {
    lat: -34.6033,
    lng: -58.4611,
    name: 'Espinosa 1447',
  },
  destination: {
    lat: -34.6098637,
    lng: -58.3677932,
    name: 'Edificio Libertador',
  },
  returnOrigin: {
    lat: -34.5194,
    lng: -58.5164,
    name: 'Virtualisa',
  },
  returnTransfer: {
    lat: -34.5511,
    lng: -58.4914,
    name: 'Transbordo 71-110',
  },
  returnDestination: {
    lat: -34.6070,
    lng: -58.4548,
    name: 'Casa',
  },
};

test('processTravelTime devuelve error 500 si falta GOOGLE_MAPS_API_KEY', async () => {
  const configWithoutKey: Config = {
    ...baseConfig,
    googleMapsApiKey: '',
  };

  const res = await processTravelTime(
    { method: 'POST' },
    { config: configWithoutKey }
  );

  assert.strictEqual(res.statusCode, 500);
  assert.match(res.body.error, /GOOGLE_MAPS_API_KEY/);
});

test('processTravelTime ejecuta cálculo y envío directamente', async () => {
  let telegramCalled = false;
  let googleMapsCalled = false;

  const mockFetch: typeof fetch = async (input) => {
    const urlStr = String(input);
    if (urlStr.includes('routes.googleapis.com')) {
      googleMapsCalled = true;
      return new Response(
        JSON.stringify({
          routes: [
            {
              duration: '2400s',
              distanceMeters: 8000,
              legs: [
                {
                  steps: [
                    {
                      travelMode: 'TRANSIT',
                      staticDuration: '2400s',
                      transitDetails: { transitLine: { nameShort: '105' } },
                    },
                  ],
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (urlStr.includes('api.telegram.org')) {
      telegramCalled = true;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Not found', { status: 404 });
  };

  const res = await processTravelTime(
    { method: 'GET' },
    { config: baseConfig, fetchFn: mockFetch }
  );

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.sent, true);
  assert.strictEqual(googleMapsCalled, true);
  assert.strictEqual(telegramCalled, true);
});

test('processTravelTime ejecuta vuelta a casa con 2 tramos si direction=home', async () => {
  let googleMapsCallCount = 0;
  let telegramCalled = false;
  let telegramMessage = '';

  const mockFetch: typeof fetch = async (input, init) => {
    const urlStr = String(input);
    if (urlStr.includes('routes.googleapis.com')) {
      googleMapsCallCount++;
      return new Response(
        JSON.stringify({
          routes: [
            {
              duration: '1200s', // 20 min
              distanceMeters: 5000,
              legs: [
                {
                  steps: [
                    {
                      travelMode: 'TRANSIT',
                      staticDuration: '1200s',
                      transitDetails: {
                        transitLine: { nameShort: googleMapsCallCount === 1 ? '71' : '110' },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (urlStr.includes('api.telegram.org')) {
      telegramCalled = true;
      const body = JSON.parse(init?.body as string);
      telegramMessage = body.text;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Not found', { status: 404 });
  };

  const res = await processTravelTime(
    { method: 'GET', query: { direction: 'home' } },
    { config: baseConfig, fetchFn: mockFetch }
  );

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.sent, true);
  assert.strictEqual(res.body.direction, 'home');
  assert.strictEqual(res.body.durationMinutes, 40); // 20 + 20
  assert.strictEqual(googleMapsCallCount, 2);
  assert.strictEqual(telegramCalled, true);
  assert.match(telegramMessage, /Vuelta a casa/);
  assert.match(telegramMessage, /Virtualisa/);
  assert.match(telegramMessage, /Transbordo 71-110/);
  assert.match(telegramMessage, /Casa/);
  assert.match(telegramMessage, /Línea 71/);
  assert.match(telegramMessage, /Línea 110/);
});
