import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHandler } from '../supabase/functions/carematch-api/handler.mjs'
import { newGame, applyAction, replay } from '../src/carematch/engine.mjs'
import { createSubmissionQueue, LeaderboardError } from '../src/carematch/leaderboard.mjs'

function finished(seed) {
  let state = newGame(seed)
  const actions = []
  while (!state.ended && actions.length < 200) {
    const choices = ['left', 'up', 'right', 'down'].map((direction) => ({ type: 'move', direction }))
    const action = choices.find((candidate) => applyAction(state, candidate) !== state)
    assert.ok(action)
    state = applyAction(state, action)
    actions.push(action)
  }
  assert.ok(state.ended)
  return { actions, score: state.score }
}

function fixture() {
  const rounds = new Map(), scores = new Map()
  let limited = false
  const rpc = async (name, args) => {
    if (name === 'carematch_rankings') return { weekly: [...scores.values()], allTime: [...scores.values()] }
    if (name === 'carematch_start_round') {
      if (limited) throw { code: 'P0001', message: 'carematch_rate_limit' }
      const id = crypto.randomUUID()
      const row = { id, seed: args.p_seed, alias: args.p_alias, hash: args.p_token_hash, expiresAt: new Date(Date.now() + 86400000).toISOString() }
      rounds.set(id, row)
      return { id, expiresAt: row.expiresAt }
    }
    const round = rounds.get(args.p_id)
    if (!round || round.hash !== args.p_token_hash) return null
    if (name === 'carematch_get_round') return round
    if (!scores.has(round.id)) scores.set(round.id, { alias: round.alias, score: args.p_score })
    return scores.get(round.id)
  }
  const handle = createHandler({ rpc, publicKeys: ['public-test-key'], ipSecret: 'server-test-secret' })
  const request = (body, key = 'public-test-key') => handle(new Request('https://example.com/carematch-api', {
    method: body ? 'POST' : 'GET', headers: { apikey: key, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }))
  return { request, handle, scores, limit: () => { limited = true } }
}

test('deployed engine source exactly matches the app engine', () => {
  assert.equal(readFileSync(new URL('../src/carematch/engine.mjs', import.meta.url), 'utf8'),
    readFileSync(new URL('../supabase/functions/carematch-api/engine.mjs', import.meta.url), 'utf8'))
})

test('server accepts a completed replay, binds the alias, and retries without duplicate scores', async () => {
  const f = fixture()
  const ticket = await (await f.request({ action: 'start', alias: 'joey' })).json()
  const result = finished(ticket.seed)
  const body = { action: 'submit', roundId: ticket.id, token: ticket.token, alias: 'SPOOFED', ...result }
  assert.equal((await f.request(body)).status, 200)
  assert.equal((await (await f.request(body)).json()).alias, 'JOEY')
  assert.equal(f.scores.size, 1)
})

test('server rejects forged scores, unfinished runs, invalid histories, and bad tickets', async () => {
  const f = fixture()
  const ticket = await (await f.request({ action: 'start', alias: 'QA' })).json()
  const result = finished(ticket.seed)
  const body = { action: 'submit', roundId: ticket.id, token: ticket.token, ...result }
  assert.equal((await f.request({ ...body, score: result.score + 1 })).status, 422)
  assert.equal((await f.request({ ...body, actions: [], score: 0 })).status, 422)
  assert.equal((await f.request({ ...body, actions: [{ type: 'move', direction: 'fake' }] })).status, 422)
  assert.equal((await f.request({ ...body, actions: Array(201).fill({ type: 'undo' }) })).status, 422)
  assert.equal((await f.request({ ...body, token: '0'.repeat(64) })).status, 410)
  assert.equal(f.scores.size, 0)
})

test('API authentication, alias validation, rate-limit response, and CORS preflight', async () => {
  const f = fixture()
  const options = await f.handle(new Request('https://example.com/carematch-api', { method: 'OPTIONS' }))
  assert.equal(options.status, 200)
  assert.equal(options.headers.get('access-control-allow-origin'), '*')
  assert.equal((await f.request(null, 'wrong')).status, 401)
  assert.equal((await f.request({ action: 'start', alias: '<script>' })).status, 400)
  f.limit()
  assert.equal((await f.request({ action: 'start', alias: 'QA' })).status, 429)
})

test('queue preserves disconnected rounds, deduplicates, and sends them when connection returns', async () => {
  const data = new Map(), sent = []
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) }
  let disconnected = true
  const queue = createSubmissionQueue(storage, async (round) => {
    if (disconnected) throw new LeaderboardError('Offline')
    sent.push(round.roundId)
  })
  const round = { roundId: 'round-one', expiresAt: new Date(Date.now() + 60000).toISOString() }
  assert.equal(queue.add(round), true)
  queue.add(round)
  assert.equal(queue.count(), 1)
  assert.equal((await queue.flush()).pending, 1)
  disconnected = false
  const [a, b] = await Promise.all([queue.flush(), queue.flush()])
  assert.equal(a.sent, 1)
  assert.equal(b.sent, 1)
  assert.deepEqual(sent, ['round-one'])
  assert.equal(queue.count(), 0)
})

test('queue removes expired and permanently rejected tickets, but retains transient failures', async () => {
  const data = new Map()
  const queue = createSubmissionQueue({ getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) },
    async () => { throw new LeaderboardError('Rejected', 422) })
  queue.add({ roundId: 'expired', expiresAt: new Date(0).toISOString() })
  queue.add({ roundId: 'rejected', expiresAt: new Date(Date.now() + 60000).toISOString() })
  assert.deepEqual(await queue.flush(), { sent: 0, dropped: 2, pending: 0 })
})

test('replay preserves successful assignment and undo scoring', () => {
  let state = newGame(1024)
  const member = state.requests.findIndex((r) => state.board.some((v) => v >= r.hours))
  const tile = state.board.findIndex((v) => v >= state.requests[member].hours)
  const actions = [{ type: 'assign', member, tile }, { type: 'undo' }]
  for (const action of actions) state = applyAction(state, action)
  assert.deepEqual(replay(1024, actions), state)
  assert.equal(state.score, 0)
  assert.equal(state.undoUsed, true)
})
