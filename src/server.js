import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { runImport } from './importer.js';
import { clearChoiceMenu } from './choice/clear-menu.js';
import { interpretCommand } from './command-router.js';
import { runAssistant } from './ai-menu-assistant.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');
const port = Number(process.env.PORT || 3000);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function createCaptureLogger() {
  const logs = [];
  return {
    logs,
    log(message) { logs.push({ level: 'info', message }); },
    info(message) { logs.push({ level: 'info', message }); },
    warn(message) { logs.push({ level: 'warn', message }); },
    error(message) { logs.push({ level: 'error', message }); },
    summary(summary) { logs.push({ level: 'summary', message: 'Import summary', summary }); },
  };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1024 * 64) {
      throw Object.assign(new Error('Request body is too large.'), { statusCode: 413 });
    }
  }

  if (!body.trim()) return {};
  if (String(request.headers['content-type'] || '').includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(body));
  }
  return JSON.parse(body);
}

async function handleImport(request, response) {
  try {
    const body = await readJsonBody(request);
    const prompt = String(body.prompt || '').trim();

    if (!prompt) {
      sendJson(response, 400, { error: 'Enter a command.' });
      return;
    }

    const command = await interpretCommand(prompt);
    const results = [];

    for (const action of command.actions) {
      const logger = createCaptureLogger();
      logger.info(`Command source: ${command.source}`);
      if (command.parserError) {
        logger.warn(command.parserError);
      }
      logger.info(`Action: ${action.type}`);
      if (action.instructions) {
        logger.info(`Instructions: ${action.instructions}`);
      }

      try {
        const config = loadConfig();
        if (action.type === 'sync_menu') {
          for (const marketplaceUrl of action.urls) {
            logger.info(`Queued URL: ${marketplaceUrl}`);
            const result = await runImport({
              marketplaceUrl,
              config,
              logger,
            });
            logger.summary(result.summary);
            results.push({
              action: action.type,
              url: marketplaceUrl,
              ok: true,
              summary: result.summary,
              logs: [...logger.logs],
            });
          }
        } else if (action.type === 'clear_menu') {
          await clearChoiceMenu({ config, logger });
          results.push({
            action: action.type,
            ok: true,
            summary: {
              status: config.dryRun ? 'dry-run' : 'cleared',
            },
            logs: logger.logs,
          });
        } else if (action.type === 'ai_menu_command') {
          const result = await runAssistant(
            { text: action.instructions, force: false, rollbackDir: 'rollback', logDir: 'logs' },
            { logger },
          );
          if (!result.ok) {
            throw Object.assign(
              new Error(result.clarification || result.errors?.join(', ') || `Menu assistant: ${result.status}`),
              { code: result.status },
            );
          }
          results.push({
            action: action.type,
            ok: true,
            summary: { status: result.status, changes: result.changes?.length || 0 },
            logs: logger.logs,
          });
        } else {
          throw new Error('Unknown command. Enter a marketplace URL, "clear menu", or a menu editing instruction.');
        }
      } catch (error) {
        logger.error(error.message);
        results.push({
          action: action.type,
          url: action.urls?.[0],
          ok: false,
          error: error.message,
          code: error.code,
          logs: logger.logs,
        });
      }
    }

    const ok = results.every((result) => result.ok);
    sendJson(response, ok ? 200 : 207, { ok, results });
  } catch (error) {
    const statusCode = error.statusCode || (error instanceof SyntaxError ? 400 : 500);
    sendJson(response, statusCode, { error: error.message || 'Import failed.' });
  }
}

async function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const requestedPath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  const safePath = path.normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const extension = path.extname(filePath);
    const shouldCache = !['.html', '.js', '.css'].includes(extension);
    response.writeHead(200, {
      'Content-Type': contentTypes[extension] || 'application/octet-stream',
      'Cache-Control': shouldCache ? 'public, max-age=3600' : 'no-store',
    });
    response.end(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(500);
    response.end('Server error');
  }
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === 'POST' && request.url === '/api/import') {
    await handleImport(request, response);
    return;
  }

  if (request.method === 'GET' || request.method === 'HEAD') {
    await serveStatic(request, response);
    return;
  }

  response.writeHead(405, { Allow: 'GET, HEAD, POST' });
  response.end('Method not allowed');
});

server.listen(port, () => {
  console.log(`Menu sync interface listening on port ${port}`);
});
