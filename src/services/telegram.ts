import { RouteComputationResult, TwoLegRouteResult } from './routes.js';

export interface TelegramParams {
  token: string;
  chatId: string;
  route: RouteComputationResult;
  originName: string;
  destinationName: string;
  fetchFn?: typeof fetch;
}

export interface ReturnTelegramParams {
  token: string;
  chatId: string;
  twoLegRoute: TwoLegRouteResult;
  originName: string;
  transferName: string;
  destinationName: string;
  fetchFn?: typeof fetch;
}

export function buildTelegramMessage(params: {
  route: RouteComputationResult;
  originName: string;
  destinationName: string;
}): string {
  const { route, originName, destinationName } = params;

  const transitStep = route.steps.find((s) => s.type === 'TRANSIT');
  const lineText = route.hasLine105
    ? 'Línea 105'
    : (transitStep?.line ? `Línea ${transitStep.line}` : 'Colectivo');

  let warningsText = '';
  if (route.warnings && route.warnings.length > 0) {
    warningsText = `\n- Aviso: ${route.warnings.join(' | ')}`;
  }

  return (
    `Salida al trabajo\n\n` +
    `- De: ${originName}\n` +
    `- A: ${destinationName}\n` +
    `- Tiempo estimado: *~${route.durationMinutes} min* (${route.distanceKm} km)\n` +
    `- Hora estimada de llegada: *${route.etaString}*\n` +
    `- Transporte: ${lineText}` +
    `${warningsText}\n\n` +
    `[Abrir ruta en Google Maps](${route.mapsUrl})`
  );
}

export function buildReturnTelegramMessage(params: {
  twoLegRoute: TwoLegRouteResult;
  originName: string;
  transferName: string;
  destinationName: string;
}): string {
  const { twoLegRoute, originName, transferName, destinationName } = params;

  const leg1Transit = twoLegRoute.leg1.steps.find((s) => s.type === 'TRANSIT');
  const leg1Line = leg1Transit?.line ? `Línea ${leg1Transit.line}` : 'Línea 71';

  const leg2Transit = twoLegRoute.leg2.steps.find((s) => s.type === 'TRANSIT');
  const leg2Line = leg2Transit?.line ? `Línea ${leg2Transit.line}` : 'Línea 110';

  let warningsText = '';
  if (twoLegRoute.warnings && twoLegRoute.warnings.length > 0) {
    warningsText = `\n- Aviso: ${twoLegRoute.warnings.join(' | ')}`;
  }

  return (
    `Vuelta a casa\n\n` +
    `- De: ${originName}\n` +
    `- Transbordo: ${transferName}\n` +
    `- A: ${destinationName}\n` +
    `- Tiempo estimado: *~${twoLegRoute.totalDurationMinutes} min* (${twoLegRoute.totalDistanceKm} km)\n` +
    `- Hora estimada de llegada: *${twoLegRoute.etaString}*\n` +
    `- Tramo 1: ${leg1Line} (~${twoLegRoute.leg1.durationMinutes} min)\n` +
    `- Tramo 2: ${leg2Line} (~${twoLegRoute.leg2.durationMinutes} min)` +
    `${warningsText}\n\n` +
    `[Abrir ruta en Google Maps](${twoLegRoute.mapsUrl})`
  );
}

async function postTelegramMessage(token: string, chatId: string, text: string, fetchFn: typeof fetch): Promise<void> {
  const response = await fetchFn(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram API error (${response.status}): ${errorText}`);
  }
}

export async function sendTelegramNotification(params: TelegramParams): Promise<void> {
  const { token, chatId, route, originName, destinationName, fetchFn = fetch } = params;

  if (!token || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no configurados');
  }

  const text = buildTelegramMessage({ route, originName, destinationName });
  await postTelegramMessage(token, chatId, text, fetchFn);
}

export async function sendReturnTelegramNotification(params: ReturnTelegramParams): Promise<void> {
  const { token, chatId, twoLegRoute, originName, transferName, destinationName, fetchFn = fetch } = params;

  if (!token || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no configurados');
  }

  const text = buildReturnTelegramMessage({ twoLegRoute, originName, transferName, destinationName });
  await postTelegramMessage(token, chatId, text, fetchFn);
}
