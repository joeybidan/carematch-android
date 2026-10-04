import { createHandler } from './handler.mjs'

const url = Deno.env.get('SUPABASE_URL')!
const publicKeys = Object.values(JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}')) as string[]
const secrets = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
const secret = secrets.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const anon = Deno.env.get('SUPABASE_ANON_KEY')
if (anon) publicKeys.push(anon)

async function rpc(name: string, args: object) {
  const headers: Record<string, string> = { apikey: secret, 'Content-Type': 'application/json' }
  if (!secret.startsWith('sb_secret_')) headers.Authorization = `Bearer ${secret}`
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST', headers, body: JSON.stringify(args), signal: AbortSignal.timeout(8000),
  })
  const data = await response.json()
  if (!response.ok) throw data
  return data
}

Deno.serve(createHandler({ rpc, publicKeys, ipSecret: secret }))
