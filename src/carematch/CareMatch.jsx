import { useRef, useState } from 'react'
import { newGame, applyAction, assignmentPoints } from './engine.mjs'
import './carematch.css'

const NAME_KEY = 'carematch:name'
const BOARD_KEY = 'carematch:local-top5'
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

function Ranking({ rows }) {
  return (
    <ol className="cm-ranking" aria-label="Local Top 5">
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

  const [name, setName] = useState(() => read(NAME_KEY) || '')
  const [state, setState] = useState(null)
  const [selectedMember, setSelectedMember] = useState(null)
  const [selectedTile, setSelectedTile] = useState(null)
  const [board, setBoard] = useState(loadBoard)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const game = state || newGame(1024)
  const request = selectedMember !== null ? game.requests[selectedMember] : null
  const reward =
    selectedTile !== null && selectedMember !== null
      ? assignmentPoints(game, selectedMember, selectedTile)
      : null
  const active = Boolean(state && !state.ended)

  function start() {
    const cleanName = name.trim().toUpperCase()
    if (!/^[\p{L}\p{N} _.-]{1,12}$/u.test(cleanName)) {
      setError('Enter an alias of up to 12 characters.')
      return
    }

    const seed = crypto.getRandomValues(new Uint32Array(1))[0]
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

    setState(next)
    setSelectedMember(null)
    setSelectedTile(null)
    setNotice('')
    setError('')
  }

  function saveScore() {
    if (!state?.ended) return

    const nextBoard = [...board, {
      name: name.trim().toUpperCase(),
      score: state.score,
      savedAt: Date.now(),
    }]
      .sort((a, b) => b.score - a.score || a.savedAt - b.savedAt)
      .slice(0, 5)

    setBoard(nextBoard)
    write(BOARD_KEY, JSON.stringify(nextBoard))

    const rank = nextBoard.findIndex(
      (row) => row.name === name.trim().toUpperCase() && row.score === state.score,
    )

    setNotice(rank >= 0 ? `LOCAL TOP 5! Rank #${rank + 1}.` : 'Round saved locally.')
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
              <button className="cm-primary" onClick={start}>PLAY</button>
            </div>
            <p className="cm-phase-note">Phase 1 browser build · scores are stored on this device only.</p>
          </div>
        )}

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
            <button className="cm-primary" onClick={saveScore}>SAVE SCORE</button>
            <button className="cm-link" onClick={start}>Play again</button>
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
          <h2>LOCAL TOP 5</h2>
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
        </div>
        <Ranking rows={board} />
      </div>
    </section>
  )
}
