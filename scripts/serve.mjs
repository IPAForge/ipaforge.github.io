// Serves dist/ the way GitHub Pages does: /install/ serves install/index.html, unknown paths get 404.html.
//   npm run preview   (then open http://localhost:4321)
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = resolve(fileURLToPath(new URL('../dist', import.meta.url)))
const PORT = Number(process.env.PORT ?? 4321)
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8'
}

const fileFor = (url) => {
  const path = normalize(decodeURIComponent(new URL(url, 'http://x').pathname))
  const file = join(DIST, path)
  if (!file.startsWith(DIST)) return undefined
  if (existsSync(file) && statSync(file).isDirectory()) return existsSync(join(file, 'index.html')) ? join(file, 'index.html') : undefined
  return existsSync(file) ? file : undefined
}

createServer((request, response) => {
  const file = fileFor(request.url)
  const status = file ? 200 : 404
  const served = file ?? join(DIST, '404.html')
  response.writeHead(status, { 'content-type': TYPES[extname(served)] ?? 'application/octet-stream' })
  createReadStream(served).pipe(response)
}).listen(PORT, () => console.log(`http://localhost:${PORT}`))
