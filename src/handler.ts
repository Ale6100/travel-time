import { Config, getConfig } from './config.js';
import { computeTransitRoute, RouteComputationResult } from './services/routes.js';
import { sendTelegramNotification } from './services/telegram.js';

export interface HandlerRequest {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  body?: any;
}

export interface HandlerResponse {
  statusCode: number;
  body: Record<string, any>;
}

export async function processTravelTime(
  req: HandlerRequest,
  options: {
    config?: Config;
    now?: Date;
    fetchFn?: typeof fetch;
  } = {}
): Promise<HandlerResponse> {
  const config = options.config || getConfig();
  const now = options.now || new Date();
  const fetchFn = options.fetchFn || fetch;

  // 1. Ubicación de origen (del GPS opcional si se envía, o fijo en casa)
  const reqLat = parseFloat(req.body?.lat || (req.query?.lat as string));
  const reqLng = parseFloat(req.body?.lng || (req.query?.lng as string));

  const hasReqCoords = !isNaN(reqLat) && !isNaN(reqLng);
  const originLat = hasReqCoords ? reqLat : config.origin.lat;
  const originLng = hasReqCoords ? reqLng : config.origin.lng;
  const originName = hasReqCoords ? 'Ubicación actual (GPS)' : config.origin.name;

  if (!config.googleMapsApiKey) {
    return {
      statusCode: 500,
      body: { error: 'Falta configurar GOOGLE_MAPS_API_KEY en las variables de entorno' },
    };
  }

  // 2. Cálculo con Google Maps Routes API
  let routeResult: RouteComputationResult;
  try {
    routeResult = await computeTransitRoute({
      origin: { lat: originLat, lng: originLng },
      destination: { lat: config.destination.lat, lng: config.destination.lng },
      apiKey: config.googleMapsApiKey,
      now,
      fetchFn,
    });
  } catch (err: any) {
    return {
      statusCode: 502,
      body: { error: 'Error calculando ruta con Google Maps', details: err?.message },
    };
  }

  // 3. Notificación por Telegram
  try {
    await sendTelegramNotification({
      token: config.telegramBotToken,
      chatId: config.telegramChatId,
      route: routeResult,
      originName,
      destinationName: config.destination.name,
      fetchFn,
    });
  } catch (err: any) {
    return {
      statusCode: 500,
      body: {
        error: 'Ruta calculada pero falló el envío a Telegram',
        details: err?.message,
        route: routeResult,
      },
    };
  }

  return {
    statusCode: 200,
    body: {
      success: true,
      sent: true,
      durationMinutes: routeResult.durationMinutes,
      eta: routeResult.etaString,
      distanceKm: routeResult.distanceKm,
      hasLine105: routeResult.hasLine105,
      mapsUrl: routeResult.mapsUrl,
    },
  };
}
