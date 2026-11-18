// Hue & Seek server entry: Express (REST + static client) + Socket.IO realtime.
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { Server } from 'socket.io';
import { config } from './config';
import { initDb } from './database/db';
import { apiRouter } from './api/routes';
import { RoomManager } from './rooms/RoomManager';
import { attachSockets } from './network/socket';
import { presence } from './players/presence';

async function main() {
  await initDb();

  const app = express();
  if (config.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: config.corsOrigin ? { origin: config.corsOrigin.split(',') } : undefined,
    maxHttpBufferSize: 256 * 1024,
    pingInterval: 10_000,
    pingTimeout: 8_000,
  });
  presence.io = io;

  const rooms = new RoomManager({ toSocket: (sid, ev, data) => io.to(sid).emit(ev, data) });
  rooms.start();
  attachSockets(io, rooms);

  app.use('/api', apiRouter(rooms));

  // Serve the built client in production.
  const clientDist = [path.resolve(process.cwd(), 'client/dist'), path.resolve(process.cwd(), '../client/dist')].find((p) => fs.existsSync(p));
  if (clientDist) {
    app.use(express.static(clientDist, { maxAge: '1h', index: false }));
    app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[http] error', err);
    res.status(500).json({ error: 'Server error' });
  });

  server.listen(config.port, () => {
    console.log(`[server] Hue & Seek listening on http://localhost:${config.port}${config.fastTimers ? ' (FAST_TIMERS)' : ''}`);
  });

  const shutdown = () => {
    console.log('[server] shutting down');
    rooms.stop();
    io.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
