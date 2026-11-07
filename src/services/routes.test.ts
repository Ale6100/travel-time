import test from 'node:test';
import assert from 'node:assert';
import { computeTransitRoute } from './routes.js';

test('computeTransitRoute procesa correctamente la respuesta de Routes API con línea 105', async () => {
  const mockApiResponse = {
    routes: [
      {
        duration: '2700s', // 45 minutos
        distanceMeters: 8500, // 8.5 km
        warnings: ['Desvío temporal por obras en la traza'],
        legs: [
          {
            steps: [
              {
                travelMode: 'WALK',
                staticDuration: '240s',
                navigationInstruction: { instructions: 'Caminar 4 min hacia parada' },
              },
              {
                travelMode: 'TRANSIT',
                staticDuration: '2100s',
                transitDetails: {
                  transitLine: { nameShort: '105' },
                  headsign: 'Correo Central',
                  stopDetails: {
                    departureStop: { name: 'Av. San Martín 2100' },
                    arrivalStop: { name: 'Av. de Mayo y Perú' },
                  },
                },
              },
              {
                travelMode: 'WALK',
                staticDuration: '360s',
                navigationInstruction: { instructions: 'Caminar hacia Azopardo 250' },
              },
            ],
          },
        ],
      },
    ],
  };

  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify(mockApiResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  const fixedNow = new Date('2026-11-09T10:00:00Z'); // 07:00 ART
  const result = await computeTransitRoute({
    origin: { lat: -34.6033, lng: -58.4611 },
    destination: { lat: -34.6098637, lng: -58.3677932 },
    apiKey: 'test-key',
    now: fixedNow,
    fetchFn: mockFetch,
  });

  assert.strictEqual(result.durationMinutes, 45);
  assert.strictEqual(result.distanceKm, 8.5);
  assert.strictEqual(result.hasLine105, true);
  assert.strictEqual(result.etaString, '07:45');
  assert.strictEqual(result.steps.length, 3);
  assert.strictEqual(result.steps[1].type, 'TRANSIT');
  assert.strictEqual(result.steps[1].line, '105');
  assert.deepStrictEqual(result.warnings, ['Desvío temporal por obras en la traza']);
  assert.ok(result.mapsUrl.includes('travelmode=transit'));
});

test('computeTransitRoute prioriza ruta con línea 105 si hay alternativas', async () => {
  const mockApiResponse = {
    routes: [
      {
        duration: '2600s',
        distanceMeters: 8000,
        legs: [
          {
            steps: [
              {
                travelMode: 'TRANSIT',
                staticDuration: '2400s',
                transitDetails: { transitLine: { nameShort: '146' } },
              },
            ],
          },
        ],
      },
      {
        duration: '2700s',
        distanceMeters: 8500,
        legs: [
          {
            steps: [
              {
                travelMode: 'TRANSIT',
                staticDuration: '2500s',
                transitDetails: { transitLine: { nameShort: '105' } },
              },
            ],
          },
        ],
      },
    ],
  };

  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify(mockApiResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  const result = await computeTransitRoute({
    origin: { lat: -34.6033, lng: -58.4611 },
    destination: { lat: -34.6098637, lng: -58.3677932 },
    apiKey: 'test-key',
    fetchFn: mockFetch,
  });

  assert.strictEqual(result.hasLine105, true);
  assert.deepStrictEqual(result.warnings, []);
});

test('computeTwoLegTransitRoute calcula tramos encadenados para la vuelta a casa', async () => {
  const calls: { url: string; body: any }[] = [];

  const mockFetch: typeof fetch = async (input, init) => {
    const body = JSON.parse(init?.body as string);
    calls.push({ url: String(input), body });

    if (calls.length === 1) {
      return new Response(
        JSON.stringify({
          routes: [
            {
              duration: '1500s',
              distanceMeters: 6000,
              warnings: ['Alerta tramo 1'],
              legs: [
                {
                  steps: [
                    {
                      travelMode: 'TRANSIT',
                      staticDuration: '1500s',
                      transitDetails: { transitLine: { nameShort: '71' } },
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

    return new Response(
      JSON.stringify({
        routes: [
          {
            duration: '1800s',
            distanceMeters: 7000,
            warnings: ['Alerta tramo 2'],
            legs: [
              {
                steps: [
                  {
                    travelMode: 'TRANSIT',
                    staticDuration: '1800s',
                    transitDetails: { transitLine: { nameShort: '110' } },
                  },
                ],
              },
            ],
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const fixedNow = new Date('2026-11-09T21:00:00Z');
  const { computeTwoLegTransitRoute } = await import('./routes.js');
  const twoLegResult = await computeTwoLegTransitRoute({
    origin: { lat: -34.5194, lng: -58.5164 },
    transfer: { lat: -34.5511, lng: -58.4914 },
    destination: { lat: -34.6070, lng: -58.4548 },
    apiKey: 'test-key',
    now: fixedNow,
    fetchFn: mockFetch,
  });

  assert.strictEqual(calls.length, 2);
  assert.strictEqual(twoLegResult.totalDurationMinutes, 55);
  assert.strictEqual(twoLegResult.totalDistanceKm, 13.0);
  assert.strictEqual(twoLegResult.etaString, '18:55');
  assert.strictEqual(twoLegResult.leg1.steps[0].line, '71');
  assert.strictEqual(twoLegResult.leg2.steps[0].line, '110');
  assert.deepStrictEqual(twoLegResult.warnings, ['Alerta tramo 1', 'Alerta tramo 2']);

  const leg2Departure = calls[1].body.departureTime;
  assert.ok(leg2Departure);
  const diffMinutes = (new Date(leg2Departure).getTime() - fixedNow.getTime()) / (60 * 1000);
  assert.strictEqual(diffMinutes, 25);
});
