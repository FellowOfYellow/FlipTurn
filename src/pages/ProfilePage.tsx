import { useState } from 'react'
import { Avatar, Button, EmptyState, Field, PageHeader, PhotoField, Section, Sheet, inputClass } from '../components/ui'
import {
  LOCAL_COACH_ID,
  coachIdFor,
  deleteCoach,
  findMyCoach,
  newId,
  photoFor,
  saveCoach,
  setPhoto,
  setSchoolName,
  updateTeam,
  yearsCoaching,
} from '../data/actions'
import { useData, wasSignedIn } from '../data/DataProvider'
import { FOLDER_NAME } from '../data/drive'
import { sortSizes, teamFinSizes } from '../data/gear'
import { pickerAvailable } from '../data/picker'
import type { Coach } from '../data/types'

type Draft = Omit<Coach, 'updatedAt'>

export default function ProfilePage() {
  const { data, update, user } = useData()
  const [editing, setEditing] = useState<Draft | null>(null)
  const [inviting, setInviting] = useState(false)
  const team = data.team.find((t) => t.id === 'team')
  const saved = team?.schoolName ?? ''
  const me = findMyCoach(data, user?.email ?? null)
  const myDraft: Draft = me ?? {
    id: user ? coachIdFor(user.email) : LOCAL_COACH_ID,
    name: user?.name ?? '',
    title: 'Head Coach',
    startYear: null,
    email: user?.email ?? '',
  }
  const staff = data.coaches.filter((c) => !c.deleted).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <PageHeader title="Profile" />

      <Section title="My profile">
        <div className="flex max-w-xl items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <Avatar id={myDraft.id} name={myDraft.name || '?'} size="md" />
          <div className="min-w-0 flex-1">
            {me ? (
              <>
                <div className="truncate text-lg font-semibold">{me.name}</div>
                <div className="text-sm text-slate-600">{me.title}</div>
                <div className="text-sm text-slate-500">{coachingLine(me.startYear)}</div>
              </>
            ) : (
              <div className="text-sm text-slate-600">Add your name, title and photo so the team knows who's coaching.</div>
            )}
          </div>
          <Button variant="secondary" onClick={() => setEditing(myDraft)}>
            {me ? 'Edit' : 'Set up'}
          </Button>
        </div>
      </Section>

      <Section
        title="Coaching staff"
        action={
          <Button variant="secondary" onClick={() => setInviting(true)}>
            Add coach
          </Button>
        }
      >
        {staff.length === 0 ? (
          <EmptyState>No coaches yet. Set up your profile above, then add the rest of your staff.</EmptyState>
        ) : (
          <ul className="max-w-xl space-y-2">
            {staff.map((coach) => (
              <li key={coach.id}>
                <button
                  type="button"
                  onClick={() => setEditing(coach)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-white px-3 py-2 text-left shadow-sm ring-1 ring-slate-200 hover:ring-brand-500"
                >
                  <Avatar id={coach.id} name={coach.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {coach.name}
                      {coach.id === me?.id && <span className="ml-2 text-xs font-medium text-slate-500">You</span>}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {[coach.title, coachingLine(coach.startYear, true)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Team">
        <div className="max-w-xl rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          {/* Keyed on the saved name so a change synced from another coach resets the field. */}
          <SchoolField key={saved} saved={saved} onSave={(name) => update(setSchoolName(name))} />
          <p className="mt-2 text-xs text-slate-500">Shared by every coach on the team.</p>
          <TeamExtras key={`${team?.updatedAt ?? 0}`} />
        </div>
      </Section>

      <DriveSection />

      <p className="px-4 py-6 text-center text-xs text-slate-500">
        <a className="underline" href="https://fellowofyellow.github.io/FlipTurn/privacy.html" target="_blank" rel="noreferrer">
          Privacy policy
        </a>
      </p>

      {editing && (
        <CoachForm
          coach={editing}
          isMe={editing.id === myDraft.id}
          isNew={!data.coaches.some((c) => c.id === editing.id && !c.deleted)}
          photo={photoFor(data, editing.id)}
          onSave={(coach, photo) => {
            update((d) => setPhoto(coach.id, photo)(saveCoach(coach)(d)))
            setEditing(null)
          }}
          onDelete={() => {
            update(deleteCoach(editing.id))
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {inviting && (
        <InviteSheet
          onAddProfile={() => {
            setInviting(false)
            setEditing({ id: newId(), name: '', title: 'Assistant Coach', startYear: null, email: '' })
          }}
          onClose={() => setInviting(false)}
        />
      )}
    </>
  )
}

function coachingLine(startYear: number | null, short = false): string {
  const years = yearsCoaching(startYear)
  if (years === null) return short ? '' : 'Years coaching not set'
  const label = `${years} year${years === 1 ? '' : 's'}`
  return short ? label : `${label} coaching the team (since ${startYear})`
}

function SchoolField({ saved, onSave }: { saved: string; onSave: (name: string) => void }) {
  const [school, setSchool] = useState(saved)
  return (
    <Field label="School name">
      <input
        id="school-name"
        className={inputClass}
        value={school}
        placeholder="e.g. Lincoln High School"
        onChange={(e) => setSchool(e.target.value)}
        onBlur={() => school.trim() !== saved && onSave(school.trim())}
      />
    </Field>
  )
}

function CoachForm({
  coach,
  isMe,
  isNew,
  photo: initialPhoto,
  onSave,
  onDelete,
  onClose,
}: {
  coach: Draft
  isMe: boolean
  isNew: boolean
  photo: string | null
  onSave: (coach: Draft, photo: string | null) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState(coach)
  const [photo, setPhotoValue] = useState(initialPhoto)
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [thisYear] = useState(() => new Date().getFullYear())
  const years = Array.from({ length: 41 }, (_, i) => thisYear - i)
  const valid = form.name.trim() !== ''
  const submit = () => valid && onSave({ ...form, name: form.name.trim(), title: form.title.trim() }, photo)

  return (
    <Sheet
      title={isMe ? 'My profile' : isNew ? 'Add coach' : `Edit ${coach.name}`}
      onClose={onClose}
      footer={
        confirmingRemove ? (
          <>
            <Button variant="secondary" onClick={() => setConfirmingRemove(false)}>
              Cancel
            </Button>
            <Button variant="danger" className="flex-1" onClick={onDelete}>
              Yes, remove {coach.name}
            </Button>
          </>
        ) : (
          <>
            {!isNew && !isMe && (
              <Button variant="danger" onClick={() => setConfirmingRemove(true)}>
                Remove
              </Button>
            )}
            <Button className="flex-1" disabled={!valid} onClick={submit}>
              Save
            </Button>
          </>
        )
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <PhotoField name={form.name} value={photo} onChange={setPhotoValue} />
        <Field label="Name">
          <input
            id="coach-name"
            className={inputClass}
            value={form.name}
            autoComplete="off"
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>
        <Field label="Title">
          <input
            id="coach-title"
            className={inputClass}
            value={form.title}
            placeholder="e.g. Head Coach, Assistant Coach, Diving Coach"
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </Field>
        <Field label="First season coaching this team">
          <select
            id="coach-startYear"
            className={inputClass}
            value={form.startYear ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, startYear: e.target.value ? Number(e.target.value) : null }))}
          >
            <option value="">Not set</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}–{String(y + 1).slice(2)}
              </option>
            ))}
          </select>
        </Field>
        {form.startYear && <p className="text-sm text-slate-500">{coachingLine(form.startYear)}</p>}
        {form.email && <p className="text-xs text-slate-500">Linked to the Google account {form.email}</p>}
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}

function InviteSheet({ onAddProfile, onClose }: { onAddProfile: () => void; onClose: () => void }) {
  const { folderId } = useData()
  return (
    <Sheet
      title="Add a coach"
      onClose={onClose}
      footer={
        <Button className="flex-1" variant="secondary" onClick={onAddProfile}>
          Add a profile without sharing
        </Button>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        To let another coach see and edit the team's data, share the {FOLDER_NAME} folder with them:
      </p>
      <ol className="list-inside list-decimal space-y-2 text-sm text-slate-800">
        <li>
          {folderId ? (
            <a className="font-semibold text-brand-700 underline" href={`https://drive.google.com/drive/folders/${folderId}`} target="_blank" rel="noreferrer">
              Open the {FOLDER_NAME} folder in Google Drive
            </a>
          ) : (
            <>Open the {FOLDER_NAME} folder in Google Drive</>
          )}
          .
        </li>
        <li>
          Tap <strong>Share</strong>, add the coach's Gmail address, and make them an <strong>Editor</strong>.
        </li>
        <li>
          They open FlipTurn, tap <strong>Sign in with Google</strong>, then <strong>Join a team</strong> and choose the folder.
        </li>
      </ol>
      <p className="mt-4 text-sm text-slate-500">Their profile appears in Coaching staff the first time they sign in.</p>
    </Sheet>
  )
}

function DriveSection() {
  const { status, error, folderId, user, signIn, signOut, forgetDevice, startNewTeam, joinTeam } = useData()
  const [confirmingNew, setConfirmingNew] = useState(false)
  const [confirmingForget, setConfirmingForget] = useState(false)
  const forget = confirmingForget ? (
    <div className="space-y-2 rounded-xl bg-slate-50 p-3">
      <p className="text-sm">
        This removes the team's data from this device. Anything that hasn't been saved to Google Drive yet will be lost. The
        team's data in Drive isn't touched.
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setConfirmingForget(false)}>
          Back
        </Button>
        <Button
          className="flex-1"
          onClick={() => {
            setConfirmingForget(false)
            forgetDevice()
          }}
        >
          Remove data from this device
        </Button>
      </div>
    </div>
  ) : (
    <button type="button" className="min-h-11 text-sm font-semibold text-slate-600 underline" onClick={() => setConfirmingForget(true)}>
      Remove team data from this device
    </button>
  )
  const connected = status === 'synced' || status === 'syncing' || status === 'error'

  return (
    <Section title="Google Drive">
      <div className="max-w-xl space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        {status === 'local-only' ? (
          <p className="text-sm text-slate-600">
            Google sign-in isn't set up for this copy of FlipTurn yet, so data is saved on this device only.
          </p>
        ) : status === 'choose-team' ? (
          <>
            <p className="text-sm text-slate-600">
              Signed in as <strong>{user?.email}</strong>. Is this a new team, or are you joining a team another coach already set up?
            </p>
            {error && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{error}</p>}
            {confirmingNew ? (
              <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                <p className="text-sm">
                  This creates a {FOLDER_NAME} folder in your Google Drive with everything on this device. If another coach already
                  shared a team with you, join it instead.
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setConfirmingNew(false)}>
                    Back
                  </Button>
                  <Button className="flex-1" onClick={() => void startNewTeam()}>
                    Create the team folder
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="flex-1" onClick={() => setConfirmingNew(true)}>
                  Start a new team
                </Button>
                <Button className="flex-1" variant="secondary" onClick={() => void joinTeam()} disabled={!pickerAvailable}>
                  Join a team
                </Button>
              </div>
            )}
            {!pickerAvailable && <p className="text-xs text-slate-500">Joining a shared team needs the Google API key, which isn't set up yet.</p>}
            <p className="text-xs text-slate-500">Joining replaces what's on this device with the team's data.</p>
          </>
        ) : connected ? (
          <>
            <p className="text-sm text-slate-600">
              Signed in as <strong>{user?.email}</strong>. Team data is saved in the <strong>{FOLDER_NAME}</strong> folder in Google Drive.
            </p>
            <p className="text-sm text-slate-500">{status === 'syncing' ? 'Saving…' : status === 'error' ? error : 'All changes saved.'}</p>
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
            <Button variant="secondary" onClick={() => void signOut()} disabled={status === 'syncing'}>
              Sign out
            </Button>
            <p className="text-xs text-slate-500">Signing out removes the team's data from this device. It stays in Google Drive.</p>
            {status === 'error' && forget}
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600">Sign in to save team data to Google Drive and share it with other coaches.</p>
            {error && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{error}</p>}
            <Button onClick={() => void signIn()} disabled={status === 'connecting'}>
              {status === 'connecting' ? 'Connecting…' : 'Sign in with Google'}
            </Button>
            {wasSignedIn() && status !== 'connecting' && forget}
          </>
        )}
      </div>
    </Section>
  )
}

// Fin sizes and team notes. Keyed on the team record so a synced change from
// another coach refreshes the fields.
function TeamExtras() {
  const { data, update } = useData()
  const team = data.team.find((t) => t.id === 'team')
  const sizes = teamFinSizes(data)
  const [sizeText, setSizeText] = useState(sizes.join(', '))
  const [notes, setNotes] = useState(team?.notes ?? '')
  const saveSizes = () => {
    const list = sortSizes(sizeText.split(',').map((s) => s.trim()).filter(Boolean))
    if (list.join() !== sizes.join()) update(updateTeam({ finSizes: list }))
    setSizeText(list.join(', '))
  }
  return (
    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      <Field label="Fin sizes (separate with commas)">
        <input id="team-finSizes" className={inputClass} value={sizeText} onChange={(e) => setSizeText(e.target.value)} onBlur={saveSizes} />
      </Field>
      <p className="text-xs text-slate-500">Used for swimmer fin sizes and gear counts, e.g. 4.5-5, 6-7, 7.5-9.</p>
      <Field label="Team notes">
        <textarea
          id="team-notes"
          className={`${inputClass} h-32 py-2 font-mono text-sm`}
          value={notes}
          placeholder="Anything the whole staff should know"
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (team?.notes ?? '') && update(updateTeam({ notes }))}
        />
      </Field>
    </div>
  )
}
