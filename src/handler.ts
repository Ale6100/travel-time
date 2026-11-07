import { Config, getConfig } from './config.js';
import {
  computeTransitRoute,
  computeTwoLegTransitRoute,
  RouteComputationResult,
  TwoLegRouteResult,
} from './services/routes.js';
import {
  sendReturnTelegramNotification,
  sendTelegramNotification,
} from './services/telegram.js';

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

  if (!config.googleMapsApiKey) {
    return {
      statusCode: 500,
      body: { error: 'Falta configurar GOOGLE_MAPS_API_KEY en las variables de entorno' },
    };
  }

  const directionParam = (
    req.query?.direction ||
    req.body?.direction ||
    req.query?.trip ||
    req.body?.trip ||
    ''
  )
    .toString()
    .toLowerCase();

  const isReturnToHome =
    directionParam === 'home' || directionParam === 'return' || directionParam === 'vuelta';

  const reqLat = parseFloat(req.body?.lat || (req.query?.lat as string));
  const reqLng = parseFloat(req.body?.lng || (req.query?.lng as string));
  const hasReqCoords = !isNaN(reqLat) && !isNaN(reqLng);

  if (isReturnToHome) {
    const originLat = hasReqCoords ? reqLat : config.returnOrigin.lat;
    const originLng = hasReqCoords ? reqLng : config.returnOrigin.lng;
    const originName = hasReqCoords ? 'Ubicación actual (GPS)' : config.returnOrigin.name;

    let twoLegResult: TwoLegRouteResult;
    try {
      twoLegResult = await computeTwoLegTransitRoute({
        origin: { lat: originLat, lng: originLng },
        transfer: { lat: config.returnTransfer.lat, lng: config.returnTransfer.lng },
        destination: { lat: config.returnDestination.lat, lng: config.returnDestination.lng },
        apiKey: config.googleMapsApiKey,
        now,
        leg1PreferredLines: ['71'],
        leg2PreferredLines: ['110'],
        fetchFn,
      });
    } catch (err: any) {
      return {
        statusCode: 502,
        body: { error: 'Error calculando ruta con Google Maps', details: err?.message },
      };
    }

    try {
      await sendReturnTelegramNotification({
        token: config.telegramBotToken,
        chatId: config.telegramChatId,
        twoLegRoute: twoLegResult,
        originName,
        transferName: config.returnTransfer.name,
        destinationName: config.returnDestination.name,
        fetchFn,
      });
    } catch (err: any) {
      return {
        statusCode: 500,
        body: {
          error: 'Ruta calculada pero falló el envío a Telegram',
          details: err?.message,
          twoLegRoute: twoLegResult,
        },
      };
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        sent: true,
        direction: 'home',
        durationMinutes: twoLegResult.totalDurationMinutes,
        eta: twoLegResult.etaString,
        distanceKm: twoLegResult.totalDistanceKm,
        leg1: {
          durationMinutes: twoLegResult.leg1.durationMinutes,
          distanceKm: twoLegResult.leg1.distanceKm,
        },
        leg2: {
          durationMinutes: twoLegResult.leg2.durationMinutes,
          distanceKm: twoLegResult.leg2.distanceKm,
        },
        mapsUrl: twoLegResult.mapsUrl,
      },
    };
  }

  const originLat = hasReqCoords ? reqLat : config.origin.lat;
  const originLng = hasReqCoords ? reqLng : config.origin.lng;
  const originName = hasReqCoords ? 'Ubicación actual (GPS)' : config.origin.name;

  let routeResult: RouteComputationResult;
  try {
    routeResult = await computeTransitRoute({
      origin: { lat: originLat, lng: originLng },
      destination: { lat: config.destination.lat, lng: config.destination.lng },
      apiKey: config.googleMapsApiKey,
      now,
      preferredLines: ['105'],
      fetchFn,
    });
  } catch (err: any) {
    return {
      statusCode: 502,
      body: { error: 'Error calculando ruta con Google Maps', details: err?.message },
    };
  }

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
      direction: 'work',
      durationMinutes: routeResult.durationMinutes,
      eta: routeResult.etaString,
      distanceKm: routeResult.distanceKm,
      hasLine105: routeResult.hasLine105,
      mapsUrl: routeResult.mapsUrl,
    },
  };
}
