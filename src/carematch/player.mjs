import { TERMS_VERSION } from './safety.mjs'
export const DEVICE_KEY = 'carematch:device-key:v1'
export const CONSENT_KEY = 'carematch:terms:v1'
export const BLOCK_KEY = 'carematch:blocked:v1'
export function getDeviceToken(storage) {
  let token = storage.getItem(DEVICE_KEY)
  if (!/^[a-f0-9]{64}$/.test(token || '')) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
    storage.setItem(DEVICE_KEY, token)
    if (storage.getItem(DEVICE_KEY) !== token) throw new Error('Device storage is unavailable. Play offline, or allow storage to use online features.')
  }
  return token
}
export function loadBlocks(storage) {
  try { const values = JSON.parse(storage.getItem(BLOCK_KEY) || '[]'); return Array.isArray(values) ? values.filter(v => typeof v === 'string').slice(0, 200) : [] } catch { return [] }
}
export const hasAcceptedTerms = storage => storage.getItem(CONSENT_KEY) === TERMS_VERSION
export function clearPlayerStorage(storage) {
  for (const key of ['carematch:name', 'carematch:local-top5', 'carematch:global-top5:v1', 'carematch:pending-rounds:v1', DEVICE_KEY, CONSENT_KEY, BLOCK_KEY]) storage.removeItem(key)
}
