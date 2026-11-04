import { useState } from 'react'
import { Button, Field, PageHeader, Section, inputClass } from '../components/ui'
import { setSchoolName } from '../data/actions'
import { useData } from '../data/DataProvider'
import { FOLDER_NAME } from '../data/drive'

export default function ProfilePage() {
  const { data, update, status, folderId, signIn, signOut } = useData()
  const saved = data.team.find((t) => t.id === 'team')?.schoolName ?? ''
  const connected = status === 'synced' || status === 'syncing' || status === 'error'

  return (
    <>
      <PageHeader title="Profile" />
      <Section title="Team">
        <div className="max-w-md rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          {/* Keyed on the saved name so a change synced from another coach resets the field. */}
          <SchoolField key={saved} saved={saved} onSave={(name) => update(setSchoolName(name))} />
          <p className="mt-2 text-xs text-slate-500">Shared by every coach on the team.</p>
        </div>
      </Section>
      <Section title="Google Drive">
        <div className="max-w-md space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          {status === 'local-only' ? (
            <p className="text-sm text-slate-600">
              Google sign-in isn't set up for this copy of FlipTurn yet, so data is saved on this device only.
            </p>
          ) : connected ? (
            <>
              <p className="text-sm text-slate-600">
                Team data is saved in the <strong>{FOLDER_NAME}</strong> folder in your Google Drive.
              </p>
              {folderId && (
                <a
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 underline"
                  href={`https://drive.google.com/drive/folders/${folderId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open the {FOLDER_NAME} folder
                </a>
              )}
              <Button variant="secondary" onClick={signOut}>Sign out</Button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">Sign in to save team data to your Google Drive and share it with other coaches.</p>
              <Button onClick={() => void signIn()} disabled={status === 'connecting'}>
                {status === 'connecting' ? 'Connecting…' : 'Sign in with Google'}
              </Button>
            </>
          )}
        </div>
      </Section>
      <Section title="Coach profiles">
        <p className="max-w-md text-sm text-slate-500">Your profile and the coaching staff list arrive in Phase 2.</p>
      </Section>
    </>
  )
}

function SchoolField({ saved, onSave }: { saved: string; onSave: (name: string) => void }) {
  const [school, setSchool] = useState(saved)
  return (
    <Field label="School name">
      <input
        className={inputClass}
        value={school}
        placeholder="e.g. Lincoln High School"
        onChange={(e) => setSchool(e.target.value)}
        onBlur={() => school.trim() !== saved && onSave(school.trim())}
      />
    </Field>
  )
}
