import type { IncomingMessage, ServerResponse } from 'node:http';
import { createSqliteAccountRepository } from './account-repository.js';
import { createAccountApplication } from './account-application.js';
export function accountService(filename: string) {
  const repository = createSqliteAccountRepository(filename);
  const application = createAccountApplication(repository);
  return {
    close: () => repository.close(),
    async handle(req: IncomingMessage, res: ServerResponse, url: URL) {
      const send = (status: number, data: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(data));
      };
      try {
        if (
          req.headers.origin &&
          req.headers.origin !== `http://${req.headers.host}` &&
          req.headers.origin !== `https://${req.headers.host}`
        ) {
          send(403, { error: 'Origin rejected' });
          return;
        }
        let body: Record<string, unknown> = {};
        if (req.method === 'POST' || req.method === 'PUT') {
          let raw = '';
          for await (const chunk of req) {
            raw += String(chunk);
            if (Buffer.byteLength(raw) > 262144) {
              send(413, { error: 'Request too large' });
              return;
            }
          }
          try {
            body = JSON.parse(raw) as Record<string, unknown>;
            if (!body || typeof body !== 'object') throw new Error();
          } catch {
            send(400, { error: 'Invalid JSON' });
            return;
          }
        }
        application.execute(
          req.method || 'GET',
          url.pathname,
          body,
          req.headers.cookie || '',
          send,
          (value) => res.setHeader('Set-Cookie', value),
        );
      } catch {
        if (!res.headersSent) send(500, { error: 'Account service unavailable' });
      }
    },
  };
}
