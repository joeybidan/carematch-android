import { useEffect, useRef, useState } from 'react'
import { newGame, applyAction, assignmentPoints, RULES_VERSION } from './engine.mjs'
import { createSubmissionQueue, fetchRankings, startRound, submitRound } from './leaderboard.mjs'
import './carematch.css'

const NAME_KEY = 'carematch:name'
const BOARD_KEY = 'carematch:local-top5'
const CACHE_KEY = 'carematch:global-top5:v1'
const queue = createSubmissionQueue({ getItem: read, setItem: write })
const format = (value) => value.toLocaleString('en-US')

function read(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Local storage is optional.
  }
}

function loadBoard() {
  try {
    const value = JSON.parse(read(BOARD_KEY) || '[]')
    return Array.isArray(value) ? value.slice(0, 5) : []
  } catch {
    return []
  }
}

function loadRankings() {
  try {
    const value = JSON.parse(read(CACHE_KEY) || 'null')
    if (Array.isArray(value?.weekly) && Array.isArray(value?.allTime)) {
      return Date.parse(value.weekEnd) <= Date.now() ? { ...value, weekly: [] } : value
    }
  } catch { /* An unavailable cache is harmless. */ }
  return null
}

function Ranking({ rows, label }) {
  return (
    <ol className="cm-ranking" aria-label={label}>
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i}>
          <span className="cm-rank">{String(i + 1).padStart(2, '0')}</span>
          <span className="cm-player">{rows[i]?.name || '—'}</span>
          <strong>{rows[i] ? format(rows[i].score) : '—'}</strong>
        </li>
      ))}
    </ol>
  )
}

export default function CareMatch() {
  const gameRef = useRef(null)
  const touch = useRef(null)
  const skipClick = useRef(false)
  const actions = useRef([])
  const round = useRef(null)
  const localSaved = useRef(false)
  const startingRef = useRef(false)
  const savingRef = useRef(false)
  const refreshing = useRef(null)

  const [name, setName] = useState(() => read(NAME_KEY) || '')
  const [state, setState] = useState(null)
  const [selectedMember, setSelectedMember] = useState(null)
  const [selectedTile, setSelectedTile] = useState(null)
  const [board, setBoard] = useState(loadBoard)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [roundMode, setRoundMode] = useState('')
  const [rankings, setRankings] = useState(loadRankings)
  const [boardMode, setBoardMode] = useState('weekly')
  const [boardStatus, setBoardStatus] = useState('Connecting…')
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(queue.count)

  function refresh() {
    if (refreshing.current) return refreshing.current
    setLoading(true)
    refreshing.current = (async () => {
      const report = await queue.flush()
      setPending(report.pending)
      if (report.sent) setNotice('Saved online. Global rankings updated.')
      if (report.dropped) setNotice('An online submission expired or was rejected. Your local scores remain saved.')
      try {
        const next = await fetchRankings()
        setRankings(next)
        write(CACHE_KEY, JSON.stringify(next))
        setBoardStatus('Connected · shared across devices')
      } catch {
        setBoardStatus('Offline or unavailable · showing last downloaded rankings')
      }
    })().finally(() => { setLoading(false); refreshing.current = null })
    return refreshing.current
  }

  useEffect(() => {
    refresh()
    const reconnect = () => refresh()
    const visible = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('online', reconnect)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.removeEventListener('online', reconnect)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [])

  const game = state || newGame(1024)
  const request = selectedMember !== null ? game.requests[selectedMember] : null
  const reward =
    selectedTile !== null && selectedMember !== null
      ? assignmentPoints(game, selectedMember, selectedTile)
      : null
  const active = Boolean(state && !state.ended)

  async function start() {
    if (startingRef.current || savingRef.current) return
    const cleanName = name.trim().toUpperCase()
    if (!/^[\p{L}\p{N} _.-]{1,12}$/u.test(cleanName)) {
      setError('Enter an alias of up to 12 characters.')
      return
    }

    startingRef.current = true
    setStarting(true)
    setError('')
    round.current = null
    let seed = crypto.getRandomValues(new Uint32Array(1))[0]
    try {
      const ticket = await startRound(cleanName)
      if (ticket.version !== RULES_VERSION) throw new Error('Update needed')
      round.current = ticket
      seed = ticket.seed
      setRoundMode('Online round · eligible for global Top 5')
    } catch {
      setRoundMode('Offline round · local score only')
    } finally {
      startingRef.current = false
      setStarting(false)
    }
    actions.current = []
    localSaved.current = false
    setSaved(false)
    setState(newGame(seed))
    setName(cleanName)
    write(NAME_KEY, cleanName)
    setSelectedMember(null)
    setSelectedTile(null)
    setNotice('')
    setError('')
    setTimeout(() => gameRef.current?.focus(), 0)
  }

  function act(action) {
    if (!active) return
    const next = applyAction(game, action)
    if (next === game) return

    actions.current.push(action)
    setState(next)
    setSelectedMember(null)
    setSelectedTile(null)
    setNotice('')
    setError('')
  }

  async function saveScore() {
    if (!state?.ended || savingRef.current || saved) return
    savingRef.current = true
    setSaving(true)
    setError('')

    if (!localSaved.current) {
      const nextBoard = [...board, {
        name: name.trim().toUpperCase(),
        score: state.score,
        savedAt: Date.now(),
      }]
        .sort((a, b) => b.score - a.score || a.savedAt - b.savedAt)
        .slice(0, 5)

      setBoard(nextBoard)
      write(BOARD_KEY, JSON.stringify(nextBoard))
      localSaved.current = true
    }
    try {
      if (!round.current) {
        setNotice('Saved locally. Start your next round while connected to compete globally.')
        setSaved(true)
        return
      }
      const submission = {
        roundId: round.current.id, token: round.current.token, expiresAt: round.current.expiresAt,
        score: state.score, actions: [...actions.current],
      }
      if (queue.add(submission)) {
        const report = await queue.flush()
        setPending(report.pending)
        setSaved(true)
        setNotice(report.dropped ? 'Saved locally. The online submission expired or was rejected.'
          : report.pending ? 'Saved locally · online submission pending. Reconnect and tap Refresh to retry.'
          : 'Saved online! Check the weekly and all-time Top 5 below.')
        await refresh()
      } else {
        // If storage is full or blocked, still try the server without losing the local result.
        await submitRound(submission)
        setSaved(true)
        setNotice('Saved online!')
        await refresh()
      }
    } catch {
      setNotice('Saved locally. Keep this round open and tap Save Score again to retry online.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  function keyDown(event) {
    if (event.target.closest('input, textarea, select') || !active) return
    const direction = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
    }[event.key]

    if (direction) {
      event.preventDefault()
      act({ type: 'move', direction })
    }
  }

  return (
    <section
      className="cm-card"
      aria-label="CareMatch arcade"
      onKeyDown={keyDown}
      ref={gameRef}
      tabIndex={-1}
    >
      <header className="cm-header">
        <div>
          <span className="cm-kicker">CAREGIVER MATCHING ARCADE</span>
          <h1><span aria-hidden="true">♥</span> CARE<span>MATCH</span></h1>
        </div>
        <div className="cm-score">
          <small>SCORE</small>
          <strong>{format(game.score)}</strong>
        </div>
      </header>

      <div className="cm-body">
        <div className="cm-stats">
          <span><b>{60 - game.moves}</b> moves</span>
          <span><b>{game.supported}</b> helped</span>
          <span><b>{game.missed}/3</b> missed</span>
        </div>

        {!state && (
          <div className="cm-start">
            <p>Merge caregiver hours. Match members. Build the highest score you can.</p>
            <label htmlFor="cm-name">Arcade alias</label>
            <div className="cm-start-row">
              <input
                id="cm-name"
                value={name}
                maxLength={12}
                autoComplete="off"
                spellCheck="false"
                placeholder="YOUR NAME"
                onChange={(event) =>
                  setName(event.target.value.toUpperCase().replace(/[^\p{L}\p{N} _.-]/gu, ''))
                }
              />
              <button className="cm-primary" disabled={starting} onClick={start}>{starting ? 'CONNECTING…' : 'PLAY'}</button>
            </div>
            <p className="cm-phase-note">Play online for global rankings, or offline for local scores.</p>
          </div>
        )}

        {state && <p className="cm-phase-note cm-round-mode">{roundMode}</p>}

        <h2 className="cm-caption">
          MEMBERS WAITING
          <span>SELECT A MEMBER, THEN HOURS</span>
        </h2>

        <div className="cm-members">
          {game.requests.map((member, index) => (
            <button
              key={index}
              disabled={!member || !active}
              onClick={() => {
                setSelectedMember(index)
                setSelectedTile(null)
              }}
              aria-pressed={selectedMember === index}
              className={`cm-member ${selectedMember === index ? 'is-selected' : ''} ${member?.left <= 3 ? 'is-urgent' : ''}`}
            >
              {member ? (
                <>
                  <strong>{member.name}</strong>
                  <b>{member.hours}h</b>
                  <small>{member.left} moves</small>
                </>
              ) : (
                <>
                  <strong>✓</strong>
                  <small>All set</small>
                </>
              )}
            </button>
          ))}
        </div>

        <div
          className="cm-board"
          role="group"
          aria-label="Caregiver hours board, four rows and four columns"
          onPointerDown={(event) => {
            skipClick.current = false
            touch.current = { x: event.clientX, y: event.clientY }
          }}
          onPointerCancel={() => {
            touch.current = null
          }}
          onPointerUp={(event) => {
            if (!touch.current || !active) return

            const dx = event.clientX - touch.current.x
            const dy = event.clientY - touch.current.y
            touch.current = null

            if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return

            skipClick.current = true
            act({
              type: 'move',
              direction:
                Math.abs(dx) > Math.abs(dy)
                  ? dx > 0 ? 'right' : 'left'
                  : dy > 0 ? 'down' : 'up',
            })
          }}
        >
          {game.board.map((hours, i) => (
            <button
              key={i}
              disabled={!active}
              onClick={() => {
                if (skipClick.current) {
                  skipClick.current = false
                  return
                }
                if (request && hours >= request.hours) setSelectedTile(i)
              }}
              className={`cm-tile cm-tile-${hours} ${request && hours >= request.hours ? hours === request.hours ? 'is-fit' : 'is-oversize' : ''} ${selectedTile === i ? 'is-selected' : ''}`}
              aria-label={`Row ${Math.floor(i / 4) + 1}, column ${i % 4 + 1}: ${hours ? hours + ' hours' : 'empty'}`}
            >
              {hours || ''}
            </button>
          ))}
        </div>

        {reward && active ? (
          <button
            className="cm-primary cm-assign"
            onClick={() => act({ type: 'assign', member: selectedMember, tile: selectedTile })}
          >
            ASSIGN {request.name.toUpperCase()} · +{reward.total}{reward.exact ? ' PERFECT' : ''}
          </button>
        ) : (
          <p className="cm-feedback" role="status" aria-live="polite">
            {state ? game.message : 'Swipe or tap arrows to merge equal hours.'}
          </p>
        )}

        {active && (
          <div className="cm-actions">
            <button
              className="cm-undo"
              disabled={game.undoUsed || !game.previous}
              onClick={() => act({ type: 'undo' })}
            >
              ↶ Undo
            </button>
            <div className="cm-directions" aria-label="Move controls">
              {[
                ['left', '←'],
                ['up', '↑'],
                ['down', '↓'],
                ['right', '→'],
              ].map(([direction, glyph]) => (
                <button
                  key={direction}
                  aria-label={`Move ${direction}`}
                  onClick={() => act({ type: 'move', direction })}
                >
                  {glyph}
                </button>
              ))}
            </div>
          </div>
        )}

        {active && game.moves >= 60 && (
          <button className="cm-link" onClick={() => act({ type: 'finish' })}>
            Finish shift
          </button>
        )}

        {game.ended && state && (
          <div className="cm-results">
            <strong>SHIFT COMPLETE · {game.supported} HELPED</strong>
            <small>{game.reason} · {game.exact} exact matches</small>
            <button className="cm-primary" disabled={saving || saved} onClick={saveScore}>{saving ? 'SAVING…' : saved ? 'SCORE SAVED' : 'SAVE SCORE'}</button>
            <button className="cm-link" disabled={saving || starting} onClick={start}>{starting ? 'Connecting…' : 'Play again'}</button>
          </div>
        )}

        {notice && <p className="cm-success" role="status">{notice}</p>}
        {error && <p className="cm-error" role="alert">{error}</p>}

        <details className="cm-help">
          <summary>How to play</summary>
          <p>
            Swipe or use arrows to merge equal hours. Select a member, tap enough hours,
            then assign. Exact and early matches earn extra points. Three missed requests
            end the shift; you get 60 moves.
          </p>
        </details>

        <div className="cm-ranking-heading">
          <h2>{boardMode === 'local' ? 'LOCAL' : 'GLOBAL'} TOP 5</h2>
          {boardMode === 'local' ? (
            <button
              className="cm-link"
              onClick={() => {
                write(BOARD_KEY, '[]')
                setBoard([])
                setNotice('Local scores cleared.')
              }}
            >
              Clear
            </button>
          ) : <button className="cm-link" disabled={loading} onClick={refresh}>{loading ? 'Loading…' : 'Refresh'}</button>}
        </div>
        <div className="cm-board-tabs" role="group" aria-label="Leaderboard period">
          {[['weekly', 'This week'], ['allTime', 'All time'], ['local', 'On device']].map(([key, label]) => (
            <button key={key} aria-pressed={boardMode === key} onClick={() => setBoardMode(key)}>{label}</button>
          ))}
        </div>
        <p className="cm-board-status" role="status">
          {boardMode === 'local' ? 'Scores saved on this device only.' : boardStatus}
        </p>
        {pending > 0 && <p className="cm-board-status">{pending} online {pending === 1 ? 'score' : 'scores'} pending · <button className="cm-link" disabled={loading} onClick={refresh}>Retry sync</button></p>}
        <Ranking rows={boardMode === 'local' ? board : rankings?.[boardMode] || []} label={`${boardMode === 'weekly' ? 'Weekly global' : boardMode === 'allTime' ? 'All-time global' : 'Local'} Top 5`} />
        {boardMode !== 'local' && <p className="cm-board-status">Best score per alias. Weeks start Monday, 12:00 AM Philippine time. Choose a distinctive alias; names aren't reserved.</p>}
      </div>
    </section>
  )
}
