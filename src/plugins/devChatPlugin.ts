import type { Plugin, ViteDevServer } from 'vite';
import fs from 'fs';
import path from 'path';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  context?: unknown;
  attachments?: string[]; // filenames in .dev-chat/attachments/
}

/**
 * Vite dev plugin: bidirectional chat bridge between browser widget and Copilot.
 * - Browser sends messages → saved to .dev-chat/messages.json
 * - Copilot writes responses → widget polls and displays them
 * - Supports image/file uploads saved to .dev-chat/attachments/
 */
export function devChatPlugin(): Plugin {
  const chatDir = '.dev-chat';
  const attachDir = path.join(chatDir, 'attachments');
  const messagesFile = path.join(chatDir, 'messages.json');

  function ensureDir() {
    if (!fs.existsSync(chatDir)) fs.mkdirSync(chatDir, { recursive: true });
    if (!fs.existsSync(attachDir)) fs.mkdirSync(attachDir, { recursive: true });
  }

  function readMessages(): ChatMessage[] {
    try {
      if (fs.existsSync(messagesFile)) {
        return JSON.parse(fs.readFileSync(messagesFile, 'utf-8'));
      }
    } catch { /* ignore */ }
    return [];
  }

  function writeMessages(msgs: ChatMessage[]) {
    ensureDir();
    fs.writeFileSync(messagesFile, JSON.stringify(msgs, null, 2), 'utf-8');
  }

  function readBody(req: import('http').IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => resolve(body));
    });
  }

  function readRawBody(req: import('http').IncomingMessage): Promise<Buffer> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  return {
    name: 'dev-chat-plugin',
    apply: 'serve',

    configureServer(server: ViteDevServer) {
      ensureDir();

      server.middlewares.use(async (req, res, next) => {
        // ─── POST message from widget ───
        if (req.url === '/__dev-chat' && req.method === 'POST') {
          try {
            const body = await readBody(req);
            const msg = JSON.parse(body);
            const messages = readMessages();
            messages.push({
              role: msg.role || 'user',
              content: msg.content,
              timestamp: new Date().toISOString(),
              context: msg.context || null,
              attachments: msg.attachments || undefined,
            });
            writeMessages(messages);

            const icon = msg.role === 'system' ? '🔴' : '📨';
            console.log(`\n${icon} [DevChat]`, msg.content.slice(0, 200));
            if (msg.attachments?.length) {
              console.log('   📎 Attachments:', msg.attachments.join(', '));
            }
            if (msg.context?.pickedElement) {
              console.log('   🎯 Picked:', msg.context.pickedElement.selector);
            }
            if (msg.context?.url) {
              console.log('   📍 Page:', msg.context.url);
            }
            console.log('');

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, count: messages.length }));
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
          return;
        }

        // ─── GET messages (widget polls this) ───
        if (req.url === '/__dev-chat' && req.method === 'GET') {
          const messages = readMessages();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(messages));
          return;
        }

        // ─── Poll: return message count + last timestamp (lightweight) ───
        if (req.url === '/__dev-chat/poll' && req.method === 'GET') {
          const messages = readMessages();
          const last = messages[messages.length - 1];
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            count: messages.length,
            lastRole: last?.role || null,
            lastTimestamp: last?.timestamp || null,
          }));
          return;
        }

        // ─── Upload attachment (screenshot / file) ───
        if (req.url === '/__dev-chat/upload' && req.method === 'POST') {
          try {
            const rawBody = await readRawBody(req);
            const contentType = req.headers['content-type'] || '';
            const filename = (req.headers['x-filename'] as string) || `upload-${Date.now()}.png`;
            const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

            // Handle base64 JSON upload
            if (contentType.includes('application/json')) {
              const data = JSON.parse(rawBody.toString());
              const base64 = data.data.replace(/^data:[^;]+;base64,/, '');
              const buffer = Buffer.from(base64, 'base64');
              const fname = data.filename || safeName;
              const safeFname = fname.replace(/[^a-zA-Z0-9._-]/g, '_');
              fs.writeFileSync(path.join(attachDir, safeFname), buffer);
              console.log('   📸 [DevChat] Screenshot saved:', safeFname);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, filename: safeFname }));
              return;
            }

            // Handle raw binary upload
            fs.writeFileSync(path.join(attachDir, safeName), rawBody);
            console.log('   📎 [DevChat] File saved:', safeName);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, filename: safeName }));
          } catch {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Upload failed' }));
          }
          return;
        }

        // ─── Serve attachment images ───
        if (req.url?.startsWith('/__dev-chat/attachments/') && req.method === 'GET') {
          const filename = decodeURIComponent(req.url.replace('/__dev-chat/attachments/', ''));
          const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
          const filePath = path.join(attachDir, safeName);
          if (fs.existsSync(filePath)) {
            const ext = path.extname(safeName).toLowerCase();
            const mimeTypes: Record<string, string> = {
              '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
              '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
            };
            res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
            res.end(fs.readFileSync(filePath));
          } else {
            res.writeHead(404);
            res.end('Not found');
          }
          return;
        }

        // ─── Clear chat history ───
        if (req.url === '/__dev-chat/clear' && req.method === 'POST') {
          writeMessages([]);
          // Also clear attachments
          if (fs.existsSync(attachDir)) {
            for (const f of fs.readdirSync(attachDir)) {
              fs.unlinkSync(path.join(attachDir, f));
            }
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        next();
      });
    },
  };
}
