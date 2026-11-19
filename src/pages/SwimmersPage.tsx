import { useState, type ReactNode } from 'react'
import { Avatar, Button, Chips, EmptyState, Field, PageHeader, PhotoField, Section, Sheet, inputClass } from '../components/ui'
import { deleteSwimmer, newId, photoFor, saveSwimmer, setPhoto, today } from '../data/actions'
import { competitionHistory, focusStrokes } from '../data/competitions'
import { useData } from '../data/DataProvider'
import { describeItem, openLoans, teamFinSizes } from '../data/gear'
import { withSwimmerDefaults } from '../data/merge'
import { GRADES, PADDLE_SIZES, REGISTRATION, SWIMMER_LEVELS, type Swimmer, type SwimmerLevel } from '../data/types'
import { formatLongDate } from '../lib/format'

type Filter = 'active' | 'inactive' | 'all'
type Draft = Omit<Swimmer, 'updatedAt'>

export default function SwimmersPage() {
  const { data, update } = useData()
  const [filter, setFilter] = useState<Filter>('active')
  const [level, setLevel] = useState<SwimmerLevel | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const [editing, setEditing] = useState<Draft | null>(null)

  const swimmers = data.swimmers
    .filter((s) => !s.deleted)
    .filter((s) => filter === 'all' || s.active === (filter === 'active'))
    .filter((s) => !level || s.level === level)
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))

  const viewed = data.swimmers.find((s) => s.id === viewing && !s.deleted)

  return (
    <>
      <PageHeader
        title="Swimmers"
        action={
          <Button onClick={() => setEditing(withSwimmerDefaults({ id: newId(), updatedAt: 0, dateJoined: today() }))}>
            Add swimmer
          </Button>
        }
      />
      <Section title={`${swimmers.length} swimmer${swimmers.length === 1 ? '' : 's'}`}>
        <div className="mb-3 flex flex-wrap gap-2">
          <Chips options={['active', 'inactive', 'all'] as const} value={filter} onChange={(v) => setFilter(v ?? 'active')} />
          <span className="mx-1 w-px self-stretch bg-slate-200" />
          <Chips options={SWIMMER_LEVELS} value={level} onChange={setLevel} allowNone />
        </div>
        {swimmers.length === 0 ? (
          <EmptyState>
            {data.swimmers.some((s) => !s.deleted) ? 'No swimmers match these filters.' : 'Add your roster to start tracking gear.'}
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {swimmers.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setViewing(s.id)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-white px-3 py-2 text-left shadow-sm ring-1 ring-slate-200 hover:ring-brand-500"
                >
                  <Avatar id={s.id} name={`${s.firstName} ${s.lastName}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold">
                        {s.firstName} {s.lastName}
                      </span>
                      {s.captain && <CaptainBadge />}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {[s.grade, !s.active && 'Inactive'].filter(Boolean).join(' · ') || 'No grade set'}
                    </span>
                  </span>
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{s.level}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {viewed && !editing && (
        <SwimmerProfile swimmer={viewed} onEdit={() => setEditing(viewed)} onClose={() => setViewing(null)} />
      )}
      {editing && (
        <SwimmerForm
          swimmer={editing}
          photo={photoFor(data, editing.id)}
          isNew={!data.swimmers.some((s) => s.id === editing.id)}
          onSave={(s, photo) => {
            update((d) => setPhoto(s.id, photo)(saveSwimmer(s)(d)))
            setEditing(null)
          }}
          onDelete={() => {
            update(deleteSwimmer(editing.id))
            setEditing(null)
            setViewing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function CaptainBadge() {
  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold tracking-wide text-amber-900 uppercase">Captain</span>
}

function SwimmerProfile({ swimmer: s, onEdit, onClose }: { swimmer: Swimmer; onEdit: () => void; onClose: () => void }) {
  const { data } = useData()
  const gearById = new Map(data.gear.map((g) => [g.id, g]))
  const holding = openLoans(data.loans).filter((l) => l.swimmerId === s.id)
  const strokes = focusStrokes(data, s.id)
  const history = competitionHistory(data, s.id)
  const bags = (data.bags ?? []).filter((b) => !b.deleted && b.swimmerId === s.id)

  return (
    <Sheet
      title={`${s.firstName} ${s.lastName}`}
      onClose={onClose}
      footer={
        <Button className="flex-1" onClick={onEdit}>
          Edit profile
        </Button>
      }
    >
      <div className="mb-5 flex items-center gap-4">
        <Avatar id={s.id} name={`${s.firstName} ${s.lastName}`} size="lg" />
        <div className="space-y-1">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{s.level}</span>
            {s.captain && <CaptainBadge />}
            {!s.active && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Inactive</span>}
          </div>
          <div className="text-sm text-slate-600">{s.grade ?? 'Grade not set'}</div>
          {s.dateJoined && <div className="text-sm text-slate-500">Joined {formatLongDate(s.dateJoined)}</div>}
        </div>
      </div>

      <dl className="space-y-4">
        <ProfileRow label="Focus strokes">
          {strokes.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {strokes.map(({ stroke, count }) => (
                <span key={stroke} className="rounded-lg bg-brand-50 px-2 py-1 text-sm font-medium text-brand-900">
                  {stroke} <span className="text-brand-700/70">×{count}</span>
                </span>
              ))}
            </div>
          ) : (
            <span className="text-slate-500">Fills in once they're entered in competition events</span>
          )}
        </ProfileRow>
        <ProfileRow label="Contact">
          <ContactLines phone={s.phone} email={s.email} />
        </ProfileRow>
        <ProfileRow label="Parent or guardian">
          {s.parentName || s.parentPhone || s.parentEmail ? (
            <>
              {s.parentName && <div className="font-medium">{s.parentName}</div>}
              <ContactLines phone={s.parentPhone} email={s.parentEmail} />
            </>
          ) : (
            <span className="text-slate-500">Not added yet</span>
          )}
        </ProfileRow>
        <ProfileRow label="Club teams">
          {s.clubTeams.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {s.clubTeams.map((team) => (
                <span key={team} className="rounded-lg bg-slate-100 px-2 py-1 text-sm">
                  {team}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-slate-500">None</span>
          )}
        </ProfileRow>
        <ProfileRow label="Gear sizes">
          Paddles {s.paddleSize ?? '—'} · Fins {s.finSize ?? '—'} · Shoes {s.shoeSize || '—'}
        </ProfileRow>
        <ProfileRow label="Registration">{s.registration ?? <span className="text-slate-500">Not set</span>}</ProfileRow>
        {(s.gearNotes || bags.length > 0) && (
          <ProfileRow label="Gear notes and bags">
            {bags.map((b) => (
              <div key={b.id}>
                Bag {b.number}
                {b.finNumber && ` · fins #${b.finNumber}`}
                {b.paddleNumber && ` · paddles #${b.paddleNumber}`}
              </div>
            ))}
            {s.gearNotes && <div className="whitespace-pre-wrap">{s.gearNotes}</div>}
          </ProfileRow>
        )}
        <ProfileRow label="Gear they have">
          {holding.length > 0 ? (
            holding.map((l) => {
              const item = gearById.get(l.itemId)
              return <div key={l.id}>{item ? describeItem(item) : 'Gear'}</div>
            })
          ) : (
            <span className="text-slate-500">Nothing lent out</span>
          )}
        </ProfileRow>
        <ProfileRow label="Competitions">
          {history.length > 0 ? (
            <ul className="space-y-2">
              {history.map(({ competition: c, events }) => (
                <li key={c.id}>
                  <div className="font-medium">
                    {c.name || 'Untitled meet'}
                    {c.date && <span className="font-normal text-slate-500"> · {formatLongDate(c.date)}</span>}
                  </div>
                  <div className="text-slate-600">{events.map((e) => e.name || 'Unnamed event').join(', ')}</div>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-slate-500">Not entered in any competitions yet</span>
          )}
        </ProfileRow>
      </dl>
    </Sheet>
  )
}

function ProfileRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  )
}

function ContactLines({ phone, email }: { phone: string; email: string }) {
  if (!phone && !email) return <span className="text-slate-500">Not added yet</span>
  return (
    <div className="space-y-0.5">
      {phone && (
        <a className="block font-medium text-brand-700 underline-offset-2 hover:underline" href={`tel:${phone.replace(/[^\d+]/g, '')}`}>
          {phone}
        </a>
      )}
      {email && (
        <a className="block font-medium break-all text-brand-700 underline-offset-2 hover:underline" href={`mailto:${email}`}>
          {email}
        </a>
      )}
    </div>
  )
}

function SwimmerForm({
  swimmer,
  photo: initialPhoto,
  isNew,
  onSave,
  onDelete,
  onClose,
}: {
  swimmer: Draft
  photo: string | null
  isNew: boolean
  onSave: (swimmer: Draft, photo: string | null) => void
  onDelete: () => void
  onClose: () => void
}) {
  const { data } = useData()
  const finSizes = [...new Set([...teamFinSizes(data), ...(swimmer.finSize ? [swimmer.finSize] : [])])]
  const [form, setForm] = useState(swimmer)
  const [photo, setPhotoValue] = useState(initialPhoto)
  const [clubText, setClubText] = useState(swimmer.clubTeams.join(', '))
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setForm((f) => ({ ...f, [key]: value }))
  const valid = form.firstName.trim() !== ''
  const fullName = `${form.firstName} ${form.lastName}`.trim()

  const submit = () => {
    if (!valid) return
    const trim = (v: string) => v.trim()
    onSave(
      {
        ...form,
        firstName: trim(form.firstName),
        lastName: trim(form.lastName),
        phone: trim(form.phone),
        email: trim(form.email),
        parentName: trim(form.parentName),
        parentPhone: trim(form.parentPhone),
        parentEmail: trim(form.parentEmail),
        shoeSize: trim(form.shoeSize),
        gearNotes: trim(form.gearNotes),
        clubTeams: clubText
          .split(',')
          .map(trim)
          .filter(Boolean),
      },
      photo,
    )
  }

  const text = (key: 'firstName' | 'lastName' | 'phone' | 'email' | 'parentName' | 'parentPhone' | 'parentEmail', type = 'text') => (
    <input
      id={`swimmer-${key}`}
      type={type}
      inputMode={type === 'tel' ? 'tel' : type === 'email' ? 'email' : undefined}
      className={inputClass}
      value={form[key]}
      autoComplete="off"
      onChange={(e) => set(key, e.target.value)}
    />
  )

  return (
    <Sheet
      title={isNew ? 'Add swimmer' : `Edit ${swimmer.firstName}`}
      onClose={onClose}
      footer={
        confirmingRemove ? (
          <>
            <Button variant="secondary" onClick={() => setConfirmingRemove(false)}>
              Cancel
            </Button>
            <Button variant="danger" className="flex-1" onClick={onDelete}>
              Yes, remove {swimmer.firstName}
            </Button>
          </>
        ) : (
          <>
            {!isNew && (
              <Button variant="danger" onClick={() => setConfirmingRemove(true)}>
                Remove
              </Button>
            )}
            <Button className="flex-1" disabled={!valid} onClick={submit}>
              {isNew ? 'Add swimmer' : 'Save'}
            </Button>
          </>
        )
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <PhotoField name={fullName} value={photo} onChange={setPhotoValue} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">{text('firstName')}</Field>
          <Field label="Last name">{text('lastName')}</Field>
        </div>
        <Field label="Level">
          <Chips options={SWIMMER_LEVELS} value={form.level} onChange={(v) => v && set('level', v)} />
        </Field>
        <Field label="Grade">
          <Chips options={GRADES} value={form.grade} onChange={(v) => set('grade', v)} allowNone />
        </Field>
        <div className="space-y-2">
          <Toggle label="Active" hint="Active swimmers count toward gear orders." checked={form.active} onChange={(v) => set('active', v)} />
          <Toggle label="Team captain" checked={form.captain} onChange={(v) => set('captain', v)} />
        </div>

        <FormGroup title="Contact">
          <Field label="Phone">{text('phone', 'tel')}</Field>
          <Field label="Email">{text('email', 'email')}</Field>
        </FormGroup>
        <FormGroup title="Parent or guardian">
          <Field label="Name">{text('parentName')}</Field>
          <Field label="Phone">{text('parentPhone', 'tel')}</Field>
          <Field label="Email">{text('parentEmail', 'email')}</Field>
        </FormGroup>
        <FormGroup title="Team details">
          <Field label="Date joined">
            <input
              id="swimmer-dateJoined"
              type="date"
              className={inputClass}
              value={form.dateJoined ?? ''}
              onChange={(e) => set('dateJoined', e.target.value || null)}
            />
          </Field>
          <Field label="Club teams (separate with commas)">
            <input
              id="swimmer-clubTeams"
              className={inputClass}
              value={clubText}
              placeholder="e.g. Pacific Aquatics, Riverside Swim Club"
              onChange={(e) => setClubText(e.target.value)}
            />
          </Field>
        </FormGroup>
        <FormGroup title="Gear sizes">
          <Field label="Paddle size">
            <Chips options={PADDLE_SIZES} value={form.paddleSize} onChange={(v) => set('paddleSize', v)} allowNone />
          </Field>
          <Field label="Fin size">
            <Chips options={finSizes} value={form.finSize} onChange={(v) => set('finSize', v)} allowNone />
          </Field>
          <Field label="Shoe size">
            <input id="swimmer-shoeSize" className={inputClass} value={form.shoeSize} placeholder="e.g. W8.5 or 10.5" onChange={(e) => set('shoeSize', e.target.value)} />
          </Field>
          <Field label="Registration">
            <Chips options={REGISTRATION} value={form.registration} onChange={(v) => set('registration', v)} allowNone />
          </Field>
          <Field label="Gear notes">
            <textarea
              id="swimmer-gearNotes"
              className={`${inputClass} h-20 py-2`}
              value={form.gearNotes}
              placeholder="e.g. Already has fins & paddles"
              onChange={(e) => set('gearNotes', e.target.value)}
            />
          </Field>
        </FormGroup>
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}

function FormGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3 border-t border-slate-100 pt-4">
      <legend className="pr-2 text-sm font-semibold text-slate-900">{title}</legend>
      {children}
    </fieldset>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
      <input type="checkbox" className="size-6 accent-brand-700" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}
