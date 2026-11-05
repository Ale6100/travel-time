export interface LocationPoint {
  lat: number;
  lng: number;
  name: string;
}

export const DEFAULT_ORIGIN: LocationPoint = {
  lat: -34.60682113511237,
  lng: -58.45478119187296,
  name: 'Espinosa 1447',
};

export const DEFAULT_DESTINATION: LocationPoint = {
  lat: -34.60973457896118,
  lng: -58.36741124400293,
  name: 'Edificio Libertador',
};

export interface Config {
  googleMapsApiKey: string;
  telegramBotToken: string;
  telegramChatId: string;
  origin: LocationPoint;
  destination: LocationPoint;
}

export function getConfig(): Config {
  try {
    process.loadEnvFile?.();
  } catch {
    // Si no existe .env (por ejemplo en Vercel), se ignoran los errores y se usa process.env
  }

  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const telegramChatId = process.env.TELEGRAM_CHAT_ID || '';

  return {
    googleMapsApiKey,
    telegramBotToken,
    telegramChatId,
    origin: DEFAULT_ORIGIN,
    destination: DEFAULT_DESTINATION,
  };
}
