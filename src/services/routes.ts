export interface LocationCoord {
  lat: number;
  lng: number;
}

export interface TransitStepSummary {
  type: 'WALK' | 'TRANSIT';
  line?: string;
  headsign?: string;
  departureStop?: string;
  arrivalStop?: string;
  durationMinutes: number;
  description: string;
}

export interface RouteComputationResult {
  durationMinutes: number;
  distanceKm: number;
  etaString: string;
  steps: TransitStepSummary[];
  hasLine105: boolean;
  mapsUrl: string;
  warnings: string[];
}

function parseDurationSeconds(durationStr?: string): number {
  if (!durationStr) return 0;
  const match = durationStr.match(/^(\d+(?:\.\d+)?)s$/);
  if (match && match[1]) {
    return Math.round(parseFloat(match[1]));
  }
  return 0;
}

function formatEta(departureDate: Date, durationSeconds: number): string {
  const arrivalDate = new Date(departureDate.getTime() + durationSeconds * 1000);
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(arrivalDate);
}

export async function computeTransitRoute(params: {
  origin: LocationCoord;
  destination: LocationCoord;
  apiKey: string;
  now?: Date;
  fetchFn?: typeof fetch;
}): Promise<RouteComputationResult> {
  const { origin, destination, apiKey, now = new Date(), fetchFn = fetch } = params;

  const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
  const fieldMask = 'routes.duration,routes.distanceMeters,routes.legs.steps.transitDetails,routes.legs.steps.travelMode,routes.legs.steps.navigationInstruction,routes.legs.steps.staticDuration,routes.warnings';

  const body = {
    origin: {
      location: {
        latLng: {
          latitude: origin.lat,
          longitude: origin.lng,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: destination.lat,
          longitude: destination.lng,
        },
      },
    },
    travelMode: 'TRANSIT',
    transitPreferences: {
      allowedTravelModes: ['BUS'],
    },
    computeAlternativeRoutes: true,
  };

  const response = await fetchFn(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Maps Routes API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const routes = data.routes || [];

  if (routes.length === 0) {
    throw new Error('Google Maps Routes API no encontró rutas en transporte público disponibles');
  }

  // Si hay varias rutas, priorizamos una que contenga la línea 105; si no, la primera
  let chosenRoute = routes[0];
  for (const route of routes) {
    const steps = route.legs?.[0]?.steps || [];
    const has105 = steps.some((s: any) => {
      const line = s.transitDetails?.transitLine?.nameShort || s.transitDetails?.transitLine?.name || '';
      return line.includes('105');
    });
    if (has105) {
      chosenRoute = route;
      break;
    }
  }

  const totalDurationSeconds = parseDurationSeconds(chosenRoute.duration);
  const totalDurationMinutes = Math.max(1, Math.round(totalDurationSeconds / 60));
  const distanceMeters = chosenRoute.distanceMeters || 0;
  const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
  const etaString = formatEta(now, totalDurationSeconds);

  const rawSteps = chosenRoute.legs?.[0]?.steps || [];
  const parsedSteps: TransitStepSummary[] = [];
  let foundLine105 = false;

  for (const s of rawSteps) {
    const stepDurationSeconds = parseDurationSeconds(s.staticDuration);
    const stepDurationMinutes = Math.max(1, Math.round(stepDurationSeconds / 60));

    if (s.travelMode === 'TRANSIT') {
      const lineShort = s.transitDetails?.transitLine?.nameShort || s.transitDetails?.transitLine?.name || 'Colectivo';
      const headsign = s.transitDetails?.headsign || '';
      const departureStop = s.transitDetails?.stopDetails?.departureStop?.name || '';
      const arrivalStop = s.transitDetails?.stopDetails?.arrivalStop?.name || '';

      if (lineShort.includes('105')) {
        foundLine105 = true;
      }

      parsedSteps.push({
        type: 'TRANSIT',
        line: lineShort,
        headsign,
        departureStop,
        arrivalStop,
        durationMinutes: stepDurationMinutes,
        description: `Subir al colectivo ${lineShort}${headsign ? ` (${headsign})` : ''} en ${departureStop || 'la parada'} hasta ${arrivalStop || 'destino'}`,
      });
    } else {
      const instructions = s.navigationInstruction?.instructions || 'Caminar hacia la parada';
      parsedSteps.push({
        type: 'WALK',
        durationMinutes: stepDurationMinutes,
        description: instructions,
      });
    }
  }

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=transit`;
  const warnings: string[] = chosenRoute.warnings || [];

  return {
    durationMinutes: totalDurationMinutes,
    distanceKm,
    etaString,
    steps: parsedSteps,
    hasLine105: foundLine105,
    mapsUrl,
    warnings,
  };
}
