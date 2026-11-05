import http from 'node:http';
import { parse as parseUrl } from 'node:url';
import { processTravelTime } from './handler.js';

const PORT = parseInt(process.env.PORT || '3000', 10);

const server = http.createServer(async (req, res) => {
  const parsedUrl = parseUrl(req.url || '', true);
  const pathname = parsedUrl.pathname;

  if (pathname !== '/api/travel-time') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Ruta no encontrada. Usar /api/travel-time' }));
    return;
  }

  let body = {};
  if (req.method === 'POST') {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const rawBody = Buffer.concat(chunks).toString();
      if (rawBody.trim()) {
        body = JSON.parse(rawBody);
      }
    } catch {
      // Ignorar error de parseo si no es JSON válido
    }
  }

  const result = await processTravelTime({
    method: req.method,
    headers: req.headers,
    query: parsedUrl.query,
    body,
  });

  res.writeHead(result.statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result.body, null, 2));
});

server.listen(PORT, () => {
  console.log(`Servidor local corriendo en http://localhost:${PORT}/api/travel-time`);
});
