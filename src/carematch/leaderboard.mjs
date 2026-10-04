import config from './online-config.json' with { type: 'json' }

export class LeaderboardError extends Error {
  constructor(message, status = 0) { super(message); this.status = status }
  get retryable() { return !this.status || this.status === 429 || this.status >= 500 }
}

async function request(body, timeout = 8000) {
  try {
    const response = await fetch(config.endpoint, {
      method: body ? 'POST' : 'GET',
      headers: { apikey: config.publishableKey, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(timeout),
    })
    const data = await response.json()
    if (!response.ok) throw new LeaderboardError(data.error || 'Leaderboard unavailable.', response.status)
    return data
  } catch (error) {
    if (error instanceof LeaderboardError) throw error
    throw new LeaderboardError('Connection unavailable. Your local game still works.')
  }
}

export const fetchRankings = () => request()
export const startRound = (alias) => request({ action: 'start', alias }, 4000)
export const submitRound = (round) => request({ action: 'submit', ...round })

export function createSubmissionQueue(storage, submit = submitRound) {
  const key = 'carematch:pending-rounds:v1'
  let running
  function read() {
    try {
      const rows = JSON.parse(storage.getItem(key) || '[]')
      return Array.isArray(rows) ? rows.filter((row) => row && typeof row.roundId === 'string').slice(0, 5) : []
    } catch { return [] }
  }
  function write(rows) { try { storage.setItem(key, JSON.stringify(rows)) } catch { /* Storage is optional. */ } }
  return {
    count: () => read().length,
    add(round) {
      const rows = read()
      if (rows.some((row) => row.roundId === round.roundId)) return true
      if (rows.length >= 5) return false
      rows.push(round)
      write(rows)
      return read().some((row) => row.roundId === round.roundId)
    },
    flush() {
      if (running) return running
      running = (async () => {
        const report = { sent: 0, dropped: 0, pending: 0 }
        for (const round of read()) {
          if (Date.parse(round.expiresAt) <= Date.now()) {
            write(read().filter((row) => row.roundId !== round.roundId)); report.dropped++; continue
          }
          try {
            await submit(round)
            write(read().filter((row) => row.roundId !== round.roundId)); report.sent++
          } catch (error) {
            if (error.retryable !== false) break
            write(read().filter((row) => row.roundId !== round.roundId)); report.dropped++
          }
        }
        report.pending = read().length
        return report
      })().finally(() => { running = null })
      return running
    },
  }
}
