import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
};

/**
 * Serves files from `roots` (first match wins), replacing the Dart StaticFileHandler.
 * "/" maps to index.html. Paths can't escape the roots.
 */
export function createStaticHandler(roots: string[]) {
  const absoluteRoots = roots.map((root) => resolve(root));

  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }

    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    } catch {
      response.writeHead(400).end("400 - Bad Request");
      return;
    }
    const relative = normalize(pathname === "/" ? "index.html" : pathname.replace(/^\/+/, ""));

    for (const root of absoluteRoots) {
      const file = join(root, relative);
      if (file !== root && !file.startsWith(root + sep)) continue; // traversal attempt
      const info = await stat(file).catch(() => undefined);
      if (!info?.isFile()) continue;

      response.writeHead(200, {
        "Content-Type": MIME_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
        "Content-Length": info.size,
        "Cache-Control": relative.startsWith(`assets${sep}`)
          ? "public, max-age=31536000, immutable"
          : "no-cache",
      });
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      createReadStream(file)
        .on("error", () => response.destroy())
        .pipe(response);
      return;
    }

    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("404 - File Not Found");
  };
}
