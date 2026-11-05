import { RouteComputationResult } from './routes.js';

export interface TelegramParams {
  token: string;
  chatId: string;
  route: RouteComputationResult;
  originName: string;
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

export async function sendTelegramNotification(params: TelegramParams): Promise<void> {
  const { token, chatId, route, originName, destinationName, fetchFn = fetch } = params;

  if (!token || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no configurados');
  }

  const text = buildTelegramMessage({ route, originName, destinationName });

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
