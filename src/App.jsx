import { useEffect, useState } from 'react'
import CareMatch from './carematch/CareMatch.jsx'

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const image = document.querySelector('#studio-intro img')
    // A brief studio credit; never wait on a network connection to play.
    const started = performance.now()
    let timer
    const finish = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setReady(true), Math.max(0, 1500 - (performance.now() - started)))
    }
    const watchdog = setTimeout(() => setReady(true), 4500)
    if (!image || image.complete) finish()
    else {
      image.addEventListener('load', finish, { once: true })
      image.addEventListener('error', finish, { once: true })
    }
    return () => {
      clearTimeout(timer)
      clearTimeout(watchdog)
      image?.removeEventListener('load', finish)
      image?.removeEventListener('error', finish)
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    const intro = document.getElementById('studio-intro')
    intro?.classList.add('is-leaving')
    const timer = setTimeout(() => intro?.remove(), 240)
    return () => clearTimeout(timer)
  }, [ready])

  if (!ready) return null

  return (
    <main className="app-shell">
      <div className="app-frame">
        <CareMatch />
      </div>
    </main>
  )
}
