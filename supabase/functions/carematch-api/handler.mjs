import { replay, RULES_VERSION } from './engine.mjs'
import { aliasError, normalizeAlias, isOffensiveAlias, TERMS_VERSION, REPORT_REASONS, validDeviceToken } from './safety.mjs'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})
const hex = (bytes) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
export const digest = async (value) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Dependencies are injected so the production request handler can also run in Node tests.
export function createHandler({ rpc, publicKeys, ipSecret }) {
  async function ipHash(req) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(ipSecret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip)))
  }

  return async function handle(req) {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
    // Publishable API keys aren't JWTs. Authenticate them here rather than the gateway JWT check.
    if (!publicKeys.includes(req.headers.get('apikey'))) return json({ error: 'Invalid app key.' }, 401)
    try {
      await rpc('carematch_cleanup', {})
      if (req.method === 'GET') return json(await rpc('carematch_rankings', { p_excluded: [] }))
      if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
      const text = await req.text()
      if (new TextEncoder().encode(text).length > 24000) return json({ error: 'Round is too large.' }, 413)
      let body
      try { body = JSON.parse(text) } catch { return json({ error: 'Invalid request.' }, 400) }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request.' }, 400)

      if (body.action === 'rankings') {
        const excluded = Array.isArray(body.excluded) ? body.excluded : []
        if (excluded.length > 200 || excluded.some(a => typeof a !== 'string' || a.length > 12)) return json({ error: 'Invalid blocked list.' }, 400)
        return json(await rpc('carematch_rankings', { p_excluded: excluded.map(normalizeAlias) }))
      }
      if (['report', 'start'].includes(body.action)) {
        if (body.termsVersion !== TERMS_VERSION) return json({ error: 'Accept the current Player Rules before using online features.' }, 428)
        if (!validDeviceToken(body.deviceToken)) return json({ error: 'Update the app to use private device identification.' }, 400)
      }
      if (body.action === 'report') {
        const alias = normalizeAlias(body.alias)
        if (!alias || alias.length > 12 || !REPORT_REASONS.includes(body.reason)) return json({ error: 'Choose a player and report reason.' }, 400)
        const report = await rpc('carematch_report_alias', { p_alias: alias, p_reason: body.reason,
          p_reporter_hash: await digest(body.deviceToken), p_ip_hash: await ipHash(req) })
        return json({ reported: true, id: report.id })
      }
      if (body.action === 'delete') {
        if (!validDeviceToken(body.deviceToken)) return json({ error: 'Invalid device key.' }, 400)
        const result = await rpc('carematch_delete_device', { p_player_hash: await digest(body.deviceToken) })
        return json({ deleted: true, ...result })
      }
      if (body.action === 'start') {
        const alias = normalizeAlias(body.alias)
        const error = aliasError(alias)
        if (error) return json({ error }, 400)
        const token = hex(crypto.getRandomValues(new Uint8Array(32)))
        const seed = crypto.getRandomValues(new Uint32Array(1))[0]
        const round = await rpc('carematch_start_round', {
          p_alias: alias, p_seed: seed, p_token_hash: await digest(token), p_ip_hash: await ipHash(req),
          p_player_hash: await digest(body.deviceToken), p_terms_version: TERMS_VERSION,
        })
        return json({ ...round, seed, token, version: RULES_VERSION })
      }

      if (body.action === 'submit') {
        if (!uuid.test(body.roundId) || typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) {
          return json({ error: 'Invalid round ticket.' }, 400)
        }
        const tokenHash = await digest(body.token)
        const round = await rpc('carematch_get_round', { p_id: body.roundId, p_token_hash: tokenHash })
        if (!round) return json({ error: 'Round ticket expired or invalid.' }, 410)
        if (isOffensiveAlias(round.alias)) return json({ error: 'This alias cannot be published. Choose a respectful alias.' }, 422)
        let result
        try { result = replay(round.seed, body.actions) } catch { return json({ error: 'Invalid move history.' }, 422) }
        if (!result.ended || result.version !== RULES_VERSION || result.score !== body.score) {
          return json({ error: 'Score does not match a completed round.' }, 422)
        }
        const saved = await rpc('carematch_save_score', {
          p_id: body.roundId, p_token_hash: tokenHash, p_score: result.score,
          p_supported: result.supported, p_moves: result.moves,
        })
        if (!saved) return json({ error: 'Round ticket expired or invalid.' }, 410)
        return json({ saved: true, score: saved.score, alias: saved.alias })
      }
      return json({ error: 'Unknown action.' }, 400)
    } catch (error) {
      if (error.code === 'P0001' && error.message === 'carematch_rate_limit') {
        return json({ error: 'Too many new rounds. Try again shortly.' }, 429)
      }
      if (error.code === 'P0001' && error.message === 'carematch_alias_banned') return json({ error: 'This alias is restricted. Choose another alias or contact support.' }, 403)
      if (error.code === 'P0001' && error.message === 'carematch_report_limit') return json({ error: 'Report limit reached. Try again later or email support.' }, 429)
      // Never expose database errors, keys, tokens, or submitted histories.
      console.error('CareMatch backend request failed', error.code || 'upstream')
      return json({ error: 'Leaderboard unavailable. Your local game still works.' }, 503)
    }
  }
}
