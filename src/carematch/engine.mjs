// Pure, deterministic CareMatch rules.
export const RULES_VERSION = 1
export const DIRECTIONS = ['left', 'right', 'up', 'down']
export const NAMES = ['Rosa', 'Ben', 'Maya', 'Leo', 'Ana', 'Sam', 'Joy', 'Noah', 'Eva', 'Max', 'Lily', 'Kai']
const clone = (value) => JSON.parse(JSON.stringify(value))

function random(state) {
  let x = state.rng >>> 0
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5
  state.rng = x >>> 0
  return state.rng / 4294967296
}

function spawn(state) {
  const empty = state.board.flatMap((value, index) => value ? [] : [index])
  if (!empty.length) return
  const index = empty[Math.floor(random(state) * empty.length)]
  state.board[index] = random(state) < 0.85 ? 2 : 4
}

function request(state) {
  const pool = state.moves < 10 ? [2, 2, 4] : state.moves < 30 ? [2, 4, 4, 8] : [2, 4, 4, 8, 8, 16]
  const hours = pool[Math.floor(random(state) * pool.length)]
  return {
    id: state.nextId++,
    name: NAMES[Math.floor(random(state) * NAMES.length)],
    hours,
    left: 8 + Math.log2(hours) * 2 + Math.floor(random(state) * 3),
  }
}

export function slide(board, direction) {
  if (!DIRECTIONS.includes(direction)) return { board, points: 0, changed: false }
  const next = [...board]
  let points = 0

  for (let line = 0; line < 4; line++) {
    const indexes = Array.from({ length: 4 }, (_, n) => {
      if (direction === 'left') return line * 4 + n
      if (direction === 'right') return line * 4 + 3 - n
      if (direction === 'up') return n * 4 + line
      return (3 - n) * 4 + line
    })

    const values = indexes.map((i) => board[i]).filter(Boolean)
    const merged = []

    for (let i = 0; i < values.length; i++) {
      if (values[i] < 16 && values[i] === values[i + 1]) {
        merged.push(values[i] * 2)
        points += values[i] * 10
        i++
      } else {
        merged.push(values[i])
      }
    }

    indexes.forEach((index, n) => {
      next[index] = merged[n] || 0
    })
  }

  return {
    board: next,
    points,
    changed: next.some((value, i) => value !== board[i]),
  }
}

export function canAssign(state) {
  return state.requests.some((r) => r && state.board.some((v) => v >= r.hours))
}

function updateEnd(state) {
  if (state.missed >= 3) {
    state.ended = true
    state.reason = 'Three requests missed'
  } else if (state.moves >= 60 && !canAssign(state)) {
    state.ended = true
    state.reason = 'Shift complete'
  } else if (!canAssign(state) && !DIRECTIONS.some((d) => slide(state.board, d).changed)) {
    state.ended = true
    state.reason = 'No moves available'
  }
  return state
}

export function newGame(seed) {
  const state = {
    version: RULES_VERSION,
    seed: seed >>> 0,
    rng: (seed >>> 0) || 1,
    board: Array(16).fill(0),
    requests: [],
    nextId: 1,
    moves: 0,
    score: 0,
    supported: 0,
    exact: 0,
    missed: 0,
    streak: 0,
    undoUsed: false,
    previous: null,
    ended: false,
    reason: '',
    message: 'Select a member, then assign a coverage tile.',
  }

  for (let i = 0; i < 3; i++) spawn(state)
  state.requests = Array.from({ length: 3 }, () => request(state))
  return state
}

export function assignmentPoints(state, memberIndex, tileIndex) {
  const member = state.requests[memberIndex]
  const hours = state.board[tileIndex]
  if (!member || !hours || hours < member.hours) return null

  const exact = hours === member.hours
  const base = member.hours * 50 + (exact ? 100 : 0) + (member.left >= 3 ? 50 : 0)
  const streak = (state.streak + 1) % 3 === 0 ? ((state.streak + 1) / 3) * 150 : 0
  return { exact, base, streak, total: base + streak }
}

export function applyAction(current, action) {
  if (!current || !action || typeof action !== 'object') return current

  if (action.type === 'undo') {
    if (current.undoUsed || !current.previous) return current
    return {
      ...clone(current.previous),
      previous: null,
      undoUsed: true,
      message: 'Last action undone. Same next tile.',
    }
  }

  if (current.ended) return current

  const state = clone(current)
  const previous = { ...clone(current), previous: null }

  if (action.type === 'move') {
    if (state.moves >= 60) return current
    const moved = slide(state.board, action.direction)
    if (!moved.changed) return current

    state.board = moved.board
    state.score += moved.points
    state.moves++

    let misses = 0
    state.requests = state.requests.map((member) => {
      if (!member) return null
      member.left--
      if (member.left > 0) return member
      state.missed++
      misses++
      return state.moves < 60 ? request(state) : null
    })

    if (misses) state.streak = 0
    spawn(state)
    state.message = misses
      ? 'Request expired. Placement streak reset.'
      : moved.points
        ? `Merged coverage! +${moved.points}`
        : 'Find your next match.'
  } else if (action.type === 'assign') {
    if (!Number.isInteger(action.member) || !Number.isInteger(action.tile)) return current

    const reward = assignmentPoints(state, action.member, action.tile)
    if (!reward) return current

    const name = state.requests[action.member].name
    state.score += reward.total
    state.supported++
    state.streak++
    if (reward.exact) state.exact++

    state.board[action.tile] = 0
    state.requests[action.member] = state.moves < 60 ? request(state) : null
    state.message = `${name}: care arranged! +${reward.total}${reward.streak ? ' · STREAK BONUS!' : ''}`
  } else if (action.type === 'finish' && state.moves >= 60) {
    state.ended = true
    state.reason = 'Shift complete'
  } else {
    return current
  }

  state.previous = previous
  return updateEnd(state)
}

export function replay(seed, actions) {
  if (
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 4294967295 ||
    !Array.isArray(actions) ||
    actions.length > 200
  ) {
    throw new Error('Invalid round')
  }

  let state = newGame(seed)
  for (const action of actions) {
    const next = applyAction(state, action)
    if (next === state) throw new Error('Invalid move history')
    state = next
  }
  return state
}
