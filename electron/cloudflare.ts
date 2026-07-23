import { randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'
import { getDb } from './db'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Dev: electron/cloudflare.ts is compiled into dist-electron/, so the worker source
// sits one level up at <repo>/cloudflare-worker/worker.js. Packaged: electron-builder
// copies cloudflare-worker/ into resources/ verbatim (see package.json "extraResources").
const WORKER_SOURCE_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'cloudflare-worker/worker.js')
  : path.join(__dirname, '../cloudflare-worker/worker.js')
const API_BASE = 'https://api.cloudflare.com/client/v4'
const SCRIPT_NAME = 'omniflow-sync'
const DO_CLASS_NAME = 'SyncRoom'
const DO_BINDING_NAME = 'SYNC_DO'
const SECRET_NAME = 'SYNC_SECRET'

class CloudflareApiError extends Error {}

async function cf(apiToken: string, endpoint: string, init: { method?: string; body?: BodyInit; extraHeaders?: Record<string, string> } = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...init.extraHeaders,
    },
    body: init.body,
  })
  const json = (await res.json()) as { success: boolean; result: unknown; errors: { message: string }[] }
  if (!json.success) {
    throw new CloudflareApiError(json.errors?.map((e) => e.message).join('; ') || `Cloudflare API error (${res.status})`)
  }
  return json.result
}

function buildMultipart(parts: { name: string; filename?: string; contentType: string; data: string }[]) {
  const boundary = `----omniflow${randomBytes(16).toString('hex')}`
  const chunks: string[] = []
  for (const part of parts) {
    chunks.push(`--${boundary}\r\n`)
    const disposition = part.filename
      ? `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n`
      : `Content-Disposition: form-data; name="${part.name}"\r\n`
    chunks.push(disposition)
    chunks.push(`Content-Type: ${part.contentType}\r\n\r\n`)
    chunks.push(part.data)
    chunks.push('\r\n')
  }
  chunks.push(`--${boundary}--\r\n`)
  return { body: chunks.join(''), contentType: `multipart/form-data; boundary=${boundary}` }
}

export async function discoverAccountId(apiToken: string): Promise<string> {
  const accounts = (await cf(apiToken, '/accounts')) as { id: string; name: string }[]
  if (!accounts.length) throw new CloudflareApiError('No Cloudflare accounts are accessible with this API token.')
  return accounts[0].id
}

async function ensureWorkersSubdomain(apiToken: string, accountId: string): Promise<string> {
  const existing = (await cf(apiToken, `/accounts/${accountId}/workers/subdomain`)) as { subdomain: string }
  if (existing?.subdomain) return existing.subdomain
  const generated = `omniflow-${randomBytes(4).toString('hex')}`
  const created = (await cf(apiToken, `/accounts/${accountId}/workers/subdomain`, {
    method: 'PUT',
    body: JSON.stringify({ subdomain: generated }),
    extraHeaders: { 'Content-Type': 'application/json' },
  })) as { subdomain: string }
  return created.subdomain
}

async function uploadWorkerScript(apiToken: string, accountId: string, syncSecret: string) {
  const source = await fs.readFile(WORKER_SOURCE_PATH, 'utf-8')
  const metadata = {
    main_module: 'worker.js',
    compatibility_date: '2026-07-01',
    bindings: [
      { type: 'durable_object_namespace', name: DO_BINDING_NAME, class_name: DO_CLASS_NAME },
      { type: 'secret_text', name: SECRET_NAME, text: syncSecret },
    ],
    migrations: {
      new_tag: 'v1',
      new_sqlite_classes: [DO_CLASS_NAME],
    },
  }
  const { body, contentType } = buildMultipart([
    { name: 'metadata', contentType: 'application/json', data: JSON.stringify(metadata) },
    { name: 'worker.js', filename: 'worker.js', contentType: 'application/javascript+module', data: source },
  ])
  await cf(apiToken, `/accounts/${accountId}/workers/scripts/${SCRIPT_NAME}`, {
    method: 'PUT',
    body,
    extraHeaders: { 'Content-Type': contentType },
  })
}

async function enableSubdomainRouting(apiToken: string, accountId: string) {
  await cf(apiToken, `/accounts/${accountId}/workers/scripts/${SCRIPT_NAME}/subdomain`, {
    method: 'POST',
    body: JSON.stringify({ enabled: true, previews_enabled: false }),
    extraHeaders: { 'Content-Type': 'application/json' },
  })
}

export interface ProvisionResult {
  workerUrl: string
  syncSecret: string
}

export async function provisionCloudflareSync(apiToken: string): Promise<ProvisionResult> {
  const accountId = await discoverAccountId(apiToken)
  const subdomain = await ensureWorkersSubdomain(apiToken, accountId)
  const syncSecret = randomBytes(24).toString('base64url')

  await uploadWorkerScript(apiToken, accountId, syncSecret)
  await enableSubdomainRouting(apiToken, accountId)

  const workerUrl = `https://${SCRIPT_NAME}.${subdomain}.workers.dev`

  const db = await getDb()
  db.data.settings.cloudflareWorkerUrl = workerUrl
  db.data.settings.cloudflareSyncSecret = syncSecret
  await db.write()

  return { workerUrl, syncSecret }
}

// Re-uploads worker.js under the existing secret/URL, for when the Worker
// source has changed (e.g. new endpoints) but devices are already paired
// and shouldn't need to re-pair with a fresh secret.
export async function redeployCloudflareSync(apiToken: string): Promise<void> {
  const db = await getDb()
  const { cloudflareSyncSecret } = db.data.settings
  if (!cloudflareSyncSecret) throw new Error('No existing sync backend to redeploy - use "create backend" instead.')
  const accountId = await discoverAccountId(apiToken)
  await uploadWorkerScript(apiToken, accountId, cloudflareSyncSecret)
  await enableSubdomainRouting(apiToken, accountId)
}

export async function pairExistingWorker(workerUrl: string, syncSecret: string) {
  const db = await getDb()
  db.data.settings.cloudflareWorkerUrl = workerUrl.replace(/\/+$/, '')
  db.data.settings.cloudflareSyncSecret = syncSecret
  await db.write()
}

export async function disconnectCloudflareSync() {
  const db = await getDb()
  db.data.settings.cloudflareWorkerUrl = null
  db.data.settings.cloudflareSyncSecret = null
  await db.write()
}

export async function getCloudflareSyncConfig() {
  const db = await getDb()
  return {
    workerUrl: db.data.settings.cloudflareWorkerUrl,
    syncSecret: db.data.settings.cloudflareSyncSecret,
  }
}
