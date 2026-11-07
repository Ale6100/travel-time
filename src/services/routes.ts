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
  matchedLine?: string;
  mapsUrl: string;
  warnings: string[];
}

export interface TwoLegRouteResult {
  totalDurationMinutes: number;
  totalDistanceKm: number;
  etaString: string;
  leg1: RouteComputationResult;
  leg2: RouteComputationResult;
  warnings: string[];
  mapsUrl: string;
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
  departureTime?: Date;
  preferredLines?: string[];
  fetchFn?: typeof fetch;
}): Promise<RouteComputationResult> {
  const {
    origin,
    destination,
    apiKey,
    now = new Date(),
    departureTime,
    preferredLines = ['105'],
    fetchFn = fetch,
  } = params;

  const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
  const fieldMask = 'routes.duration,routes.distanceMeters,routes.legs.steps.transitDetails,routes.legs.steps.travelMode,routes.legs.steps.navigationInstruction,routes.legs.steps.staticDuration,routes.warnings';

  const body: Record<string, any> = {
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

  if (departureTime) {
    body.departureTime = departureTime.toISOString();
  }

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

  let chosenRoute = routes[0];
  let matchedLine: string | undefined;

  for (const route of routes) {
    const steps = route.legs?.[0]?.steps || [];
    const foundLine = steps
      .filter((s: any) => s.travelMode === 'TRANSIT')
      .map((s: any) => s.transitDetails?.transitLine?.nameShort || s.transitDetails?.transitLine?.name || '')
      .find((lineName: string) => preferredLines.some((p) => lineName.includes(p)));

    if (foundLine) {
      chosenRoute = route;
      matchedLine = foundLine;
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
      if (!matchedLine && preferredLines.some((p) => lineShort.includes(p))) {
        matchedLine = lineShort;
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
    matchedLine,
    mapsUrl,
    warnings,
  };
}

export async function computeTwoLegTransitRoute(params: {
  origin: LocationCoord;
  transfer: LocationCoord;
  destination: LocationCoord;
  apiKey: string;
  now?: Date;
  leg1PreferredLines?: string[];
  leg2PreferredLines?: string[];
  fetchFn?: typeof fetch;
}): Promise<TwoLegRouteResult> {
  const {
    origin,
    transfer,
    destination,
    apiKey,
    now = new Date(),
    leg1PreferredLines = ['71'],
    leg2PreferredLines = ['110'],
    fetchFn = fetch,
  } = params;

  const leg1 = await computeTransitRoute({
    origin,
    destination: transfer,
    apiKey,
    now,
    preferredLines: leg1PreferredLines,
    fetchFn,
  });

  const leg2Departure = new Date(now.getTime() + leg1.durationMinutes * 60 * 1000);
  const leg2 = await computeTransitRoute({
    origin: transfer,
    destination,
    apiKey,
    now: leg2Departure,
    departureTime: leg2Departure,
    preferredLines: leg2PreferredLines,
    fetchFn,
  });

  const totalDurationMinutes = leg1.durationMinutes + leg2.durationMinutes;
  const totalDistanceKm = Math.round((leg1.distanceKm + leg2.distanceKm) * 10) / 10;
  const etaString = formatEta(now, totalDurationMinutes * 60);
  const warnings = Array.from(new Set([...leg1.warnings, ...leg2.warnings]));
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=transit`;

  return {
    totalDurationMinutes,
    totalDistanceKm,
    etaString,
    leg1,
    leg2,
    warnings,
    mapsUrl,
  };
}
