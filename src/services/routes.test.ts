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
