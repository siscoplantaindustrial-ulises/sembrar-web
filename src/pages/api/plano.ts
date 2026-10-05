import type { APIRoute } from 'astro';
import { put } from '@vercel/blob';

export const prerender = false;

const MAX = 4 * 1024 * 1024; // Vercel limita el body de funciones a 4.5 MB
const TIPOS: Record<string, { ext: string; mime: string; ok: (b: Uint8Array) => boolean }> = {
  pdf: { ext: 'pdf', mime: 'application/pdf', ok: b => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
  png: { ext: 'png', mime: 'image/png', ok: b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  jpg: { ext: 'jpg', mime: 'image/jpeg', ok: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
};

// ponytail: rate limit en memoria por instancia (best-effort); usar Upstash/Vercel KV si hay abuso real.
const hits = new Map<string, number[]>();
const LIMIT = 5, WINDOW = 10 * 60_000;

const json = (body: object, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // Solo desde nuestro propio sitio (bloquea formularios/scripts de otros orígenes).
  const origin = request.headers.get('origin');
  if (!origin || new URL(origin).host !== new URL(request.url).host) return json({ error: 'Origen no permitido' }, 403);

  const now = Date.now();
  const recent = (hits.get(clientAddress) ?? []).filter(t => now - t < WINDOW);
  if (recent.length >= LIMIT) return json({ error: 'Demasiados intentos, probá más tarde' }, 429);
  hits.set(clientAddress, [...recent, now]);
  if (hits.size > 5000) hits.clear();

  const declared = Number(request.headers.get('content-length'));
  if (!declared || declared > MAX) return json({ error: 'Archivo demasiado grande (máx. 4 MB)' }, 413);

  const buf = new Uint8Array(await request.arrayBuffer());
  if (!buf.length || buf.length > MAX) return json({ error: 'Archivo inválido o demasiado grande (máx. 4 MB)' }, 413);

  // Tipo por contenido real (magic bytes); se ignora nombre y Content-Type del cliente.
  const tipo = Object.values(TIPOS).find(t => t.ok(buf));
  if (!tipo) return json({ error: 'Solo PDF, PNG o JPG' }, 415);

  try {
    // Nombre aleatorio generado acá; URL no adivinable; nunca se sobrescribe.
    const blob = await put(`planos/${crypto.randomUUID()}.${tipo.ext}`, buf, {
      access: 'public', contentType: tipo.mime, addRandomSuffix: true, allowOverwrite: false,
    });
    return json({ url: blob.downloadUrl }, 200); // downloadUrl fuerza descarga, no render en el dominio del blob
  } catch {
    return json({ error: 'No se pudo subir el archivo' }, 502);
  }
};
