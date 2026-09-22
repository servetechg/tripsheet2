import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const backendDir = resolve(__dirname, '../backend')

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (val === '' && out[key] !== undefined) continue
    out[key] = val
  }
  return out
}

function loadBackendDotEnv(): Record<string, string> {
  const path = resolve(backendDir, '.env')
  if (!existsSync(path)) return {}
  return parseEnvFile(readFileSync(path, 'utf8'))
}

/** backend/.env first, then Vite env files in frontend/ (frontend wins). */
function mergedViteEnv(mode: string): Record<string, string> {
  const fromBackend = loadBackendDotEnv()
  const fromFrontend = loadEnv(mode, __dirname, '')
  const merged = { ...fromBackend, ...fromFrontend }
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && value !== '') merged[key] = value
  }
  return merged
}

export default defineConfig(({ mode }) => {
  const env = mergedViteEnv(mode)
  const defineEnv: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('VITE_')) {
      defineEnv[`import.meta.env.${key}`] = JSON.stringify(value)
    }
  }

  return {
    plugins: [react()],
    define: defineEnv,
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@tripsheet/shared': resolve(__dirname, '../shared/src'),
      },
    },
  }
})
