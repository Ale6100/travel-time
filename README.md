# travel-time

Servicio serverless (desplegado en Vercel) para notificar por Telegram el tiempo estimado y estado del viaje al trabajo en transporte público (colectivo 105), disparado por webhook desde Android (MacroDroid / Tasker).

## Requisitos

- Node.js >= 20
- Cuenta de Google Cloud con Routes API habilitada
- Bot de Telegram

## Instalación y scripts

```bash
npm install
```

- `npm run dev`: Inicia el servidor HTTP local en `http://localhost:3000`.
- `npm test`: Ejecuta los tests unitarios con el test runner nativo de Node.
- `npm run typecheck`: Valida tipos de TypeScript sin emitir archivos.

## Variables de entorno

Definidas en `.env` (en local) o en el panel de Vercel (en producción):

- `GOOGLE_MAPS_API_KEY`: Clave de API de Google Cloud con acceso a Routes API.
- `TELEGRAM_BOT_TOKEN`: Token de autenticación del bot de Telegram.
- `TELEGRAM_CHAT_ID`: Identificador del chat o usuario receptor del mensaje.

## Despliegue en Vercel

```bash
npx vercel --prod
```

## API

- `GET /api/travel-time` (o `POST`): Procesa el cálculo de ruta y envía el reporte a Telegram.
