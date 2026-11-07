# travel-time

Servicio serverless (desplegado en Vercel) para notificar por Telegram el tiempo estimado y estado del viaje al trabajo y el regreso a casa en transporte público, disparado por webhook desde Android (MacroDroid / Tasker).

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

- `GET /api/travel-time` (o `POST`): Procesa el viaje de ida al trabajo (origen en casa, destino en Edificio Libertador, priorizando colectivo 105).
- `GET /api/travel-home` (o `GET /api/travel-time?direction=home`): Procesa la vuelta a casa en dos tramos (Virtualisa $\rightarrow$ Transbordo 71-110 en colectivo 71, y Transbordo 71-110 $\rightarrow$ Casa en colectivo 110).

## Tests

Tests unitarios automatizados con el test runner nativo de Node (`node:test`) y `tsx`. Todas las llamadas HTTP a Google Maps y Telegram se simulan mediante mocks de `fetch`, sin consumir cuotas de APIs externas ni requerir credenciales activas.
