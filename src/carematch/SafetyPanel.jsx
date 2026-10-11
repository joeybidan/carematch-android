import { useEffect, useRef, useState } from 'react'
import { LEGAL_BASE, SUPPORT_EMAIL, REPORT_REASONS } from './safety.mjs'
import { deleteDeviceData, reportAlias } from './leaderboard.mjs'
import { getDeviceToken, clearPlayerStorage, DEVICE_KEY } from './player.mjs'

export default function SafetyPanel({ storage, blocked, onUnblock, onDeleted, busy, reportTarget, closeReport, acceptRules, accepted, settle, onBusy }) {
  const dialog = useRef(null)
  const [document, setDocument] = useState('')
  const [reason, setReason] = useState(REPORT_REASONS[0])
  const [message, setMessage] = useState('')
  const [working, setWorking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  useEffect(() => { if (reportTarget) { setReason(REPORT_REASONS[0]); setMessage('') } }, [reportTarget])
  function openDocument(value) { setDocument(value); dialog.current.showModal() }
  async function sendReport() {
    setWorking(true); setMessage('')
    try {
      await reportAlias(reportTarget, reason, getDeviceToken(storage))
      setMessage('Report received. Joey Bidan Studios can review it. You can also block this alias.')
    } catch (error) { setMessage(`Report not sent: ${error.message} You can retry or email support.`) }
    finally { setWorking(false) }
  }
  async function erase() {
    onBusy(true)
    setWorking(true); setMessage('')
    try {
      const token = storage.getItem(DEVICE_KEY)
      await settle()
      if (token) await deleteDeviceData(token)
      clearPlayerStorage(storage)
      onDeleted()
      setMessage('Device data cleared and online rounds linked to this installation deleted. Older app scores may need a support request.')
      setConfirmDelete(false); setConfirmed(false)
    } catch (error) { setMessage(`Online deletion did not finish: ${error.message} Your device key is kept so you can retry.`) }
    finally { setWorking(false); onBusy(false) }
  }
  return <>
    <details className="cm-safety" open={Boolean(reportTarget)}>
      <summary>Privacy &amp; Support</summary>
      <p>CareMatch: Shift Arcade · Joey Bidan Studios</p>
      <div className="cm-safety-links">
        <button onClick={() => openDocument('privacy')}>Privacy Policy</button>
        <button onClick={() => openDocument('terms')}>Terms &amp; Player Rules</button>
        <a href={`mailto:${SUPPORT_EMAIL}?subject=CareMatch%20support`}>Email support</a>
        <a href={`${LEGAL_BASE}/support.html`} target="_blank" rel="noreferrer">Support &amp; deletion webpage</a>
      </div>
      <p className="cm-small">Use a nickname, never patient information or your real contact details. Online scores publish your alias. No login is required. Blocks are saved on this device and hide all scores using the blocked alias; aliases are not verified identities.</p>
      {reportTarget && <fieldset className="cm-report">
        <legend>Report {reportTarget}</legend>
        <label htmlFor="cm-report-reason">Reason</label>
        <select id="cm-report-reason" value={reason} onChange={e => setReason(e.target.value)}>{REPORT_REASONS.map(value => <option key={value}>{value}</option>)}</select>
        {!accepted && <label className="cm-consent"><input type="checkbox" checked={accepted} onChange={e => acceptRules(e.target.checked)} />I accept the Terms &amp; Player Rules to send a report.</label>}
        <button className="cm-primary" disabled={working || !accepted} onClick={sendReport}>{working ? 'Sending…' : 'Send report'}</button>
        <button className="cm-link" disabled={working} onClick={closeReport}>Close report</button>
      </fieldset>}
      <details><summary>Blocked aliases ({blocked.length})</summary>
        {blocked.length ? blocked.map(alias => <div className="cm-blocked-row" key={alias}><span>{alias}</span><button disabled={busy || working} onClick={() => onUnblock(alias)}>Unblock</button></div>) : <p>No blocked aliases.</p>}
      </details>
      <p className="cm-small">Deleting removes rounds and scores linked to this installation, submitted reports, saved scores, pending uploads, blocks, alias and rules acceptance. Keep this installation until deletion finishes. For old versions, a lost device key or other data, use the support webpage.</p>
      {!confirmDelete ? <button disabled={busy || working} onClick={() => { setConfirmDelete(true); setMessage('') }}>Delete my game data</button> : <fieldset>
        <legend>Confirm permanent deletion</legend>
        <p>This also ends your current shift. You cannot undo deletion. Scores submitted from other installations remain.</p>
        <label className="cm-consent"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Delete my local and linked online game data.</label>
        <button className="cm-danger" disabled={!confirmed || busy || working} onClick={erase}>{working ? 'Deleting…' : 'Confirm deletion'}</button>
        <button disabled={working} onClick={() => { setConfirmDelete(false); setConfirmed(false) }}>Cancel</button>
      </fieldset>}
      {message && <p role="status">{message}</p>}
      <p className="cm-small"><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a><br />Reports are reviewed by the studio; sending a report does not automatically ban a player.</p>
    </details>
    <dialog ref={dialog} className="cm-legal-dialog" aria-label={document === 'privacy' ? 'Privacy Policy' : 'Terms and Player Rules'}>
      <button autoFocus onClick={() => dialog.current.close()}>Close</button>
      {document && <iframe title={document === 'privacy' ? 'Privacy Policy' : 'Terms and Player Rules'} src={`./carematch/${document}.html`} />}
    </dialog>
  </>
}
