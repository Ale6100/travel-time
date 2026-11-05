import type { IncomingMessage, ServerResponse } from 'node:http';
import { processTravelTime } from '../src/handler.js';

export interface VercelRequestLike extends IncomingMessage {
  query?: Record<string, string | string[] | undefined>;
  body?: any;
}

export interface VercelResponseLike extends ServerResponse {
  status: (code: number) => VercelResponseLike;
  json: (data: any) => void;
}

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  try {
    const result = await processTravelTime({
      method: req.method,
      headers: req.headers,
      query: req.query,
      body: req.body,
    });

    res.status(result.statusCode).json(result.body);
  } catch (error: any) {
    res.status(500).json({
      error: 'Error interno no controlado',
      message: error?.message,
    });
  }
}
