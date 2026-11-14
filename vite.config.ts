import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Local API proxy for data services that need a key and block browser
 * (CORS) calls. Keys are read from .env on the server side and are never
 * sent to the browser. Works with `npm run dev` and `npm run preview`.
 *
 *   /api/nass/...    -> https://quickstats.nass.usda.gov/api/...   (NASS_API_KEY)
 *   /api/openet/...  -> https://openet-api.org/...                   (OPENET_API_KEY)
 */
function dataProxy(env: Record<string, string>): Plugin {
  const routes = [
    {
      prefix: '/api/nass/',
      target: 'https://quickstats.nass.usda.gov/api/',
      key: env.NASS_API_KEY,
      keyName: 'NASS_API_KEY',
      signup: 'https://quickstats.nass.usda.gov/api',
      // Quick Stats takes the key as a query parameter.
      authorize: (url: URL, _headers: Record<string, string>) => {
        url.searchParams.set('key', env.NASS_API_KEY)
      },
    },
    {
      prefix: '/api/openet/',
      target: 'https://openet-api.org/',
      key: env.OPENET_API_KEY,
      keyName: 'OPENET_API_KEY',
      signup: 'https://etdata.org/api/',
      // OpenET takes the key in the Authorization header.
      authorize: (_url: URL, headers: Record<string, string>) => {
        headers.Authorization = env.OPENET_API_KEY
      },
    },
  ]

  const readBody = (req: IncomingMessage) =>
    new Promise<string>((resolve, reject) => {
      let data = ''
      req.on('data', (chunk) => (data += chunk))
      req.on('end', () => resolve(data))
      req.on('error', reject)
    })

  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(body))
  }

  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const route = routes.find((r) => req.url?.startsWith(r.prefix))
    if (!route) return next()
    if (!route.key) {
      return send(res, 503, {
        configured: false,
        error: `Add ${route.keyName} to .env (free key: ${route.signup}) and restart npm run dev`,
      })
    }
    try {
      const url = new URL(route.target + req.url!.slice(route.prefix.length))
      const headers: Record<string, string> = { Accept: 'application/json' }
      route.authorize(url, headers)
      const init: RequestInit = { method: req.method, headers }
      if (req.method === 'POST') {
        headers['Content-Type'] = 'application/json'
        init.body = await readBody(req)
      }
      const upstream = await fetch(url, init)
      const text = await upstream.text()
      res.statusCode = upstream.status
      res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json')
      res.end(text)
    } catch (error) {
      send(res, 502, { error: `Upstream request failed: ${(error as Error).message}` })
    }
  }

  return {
    name: 'agrocycle-data-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => void handler(req, res, next))
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => void handler(req, res, next))
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), dataProxy(env)],
  }
})
