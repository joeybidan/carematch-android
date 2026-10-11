// Shared client/server policy. Keep this small and review reported bypasses regularly.
export const TERMS_VERSION = '2026-10-11'
export const SUPPORT_EMAIL = 'joeybidanstudiosupport@gmail.com'
export const LEGAL_BASE = 'https://ctsdocutool.netlify.app/carematch'
export const REPORT_REASONS = ['Offensive alias', 'Harassment or hate', 'Impersonation', 'Suspected cheating', 'Other safety concern']
const prohibited = ['fuck', 'shit', 'bitch', 'cunt', 'asshole', 'motherfucker', 'dick', 'cock', 'pussy', 'nigger', 'nigga', 'faggot', 'rape', 'porn', 'nazi', 'hitler', 'putangina', 'puta', 'gago', 'tangina', 'yawa', 'pakyu', 'buang']
const leet = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't' }
const homoglyphs = { 'а':'a', 'е':'e', 'о':'o', 'р':'p', 'с':'c', 'х':'x', 'і':'i', 'ј':'j', 'Α':'a', 'Β':'b', 'Ε':'e', 'Ι':'i', 'Κ':'k', 'Μ':'m', 'Ν':'n', 'Ο':'o', 'Ρ':'p', 'Τ':'t', 'Χ':'x' }
export function normalizeAlias(value) { return typeof value === 'string' ? value.normalize('NFKC').trim().toUpperCase() : '' }
export function aliasError(value) {
  const alias = normalizeAlias(value)
  if (!/^[A-Z0-9][A-Z0-9 _.-]{0,11}$/.test(alias)) return 'Use 1–12 English letters or numbers, with spaces, dots, dashes or underscores.'
  if (isOffensiveAlias(alias)) return 'Choose a respectful alias without offensive words.'
  return ''
}
export function isOffensiveAlias(value) {
  const compact = String(value).normalize('NFKD').replace(/\p{M}/gu, '').replace(/[аеорсхіјΑΒΕΙΚΜΝΟΡΤΧ]/g, c => homoglyphs[c]).toLowerCase().replace(/[013457]/g, c => leet[c]).replace(/[^a-z]/g, '')
  return prohibited.some(word => compact.includes(word))
}
export const validDeviceToken = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
