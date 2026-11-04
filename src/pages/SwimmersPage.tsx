import { useState } from 'react'
import { Avatar, Button, Chips, EmptyState, Field, PageHeader, Section, Sheet, inputClass } from '../components/ui'
import { deleteSwimmer, newId, saveSwimmer } from '../data/actions'
import { useData } from '../data/DataProvider'
import { describeItem, openLoans } from '../data/gear'
import { FIN_SIZES, PADDLE_SIZES, SWIMMER_LEVELS, type Swimmer, type SwimmerLevel } from '../data/types'

type Filter = 'active' | 'inactive' | 'all'

export default function SwimmersPage() {
  const { data, update } = useData()
  const [filter, setFilter] = useState<Filter>('active')
  const [level, setLevel] = useState<SwimmerLevel | null>(null)
  const [editing, setEditing] = useState<Omit<Swimmer, 'updatedAt'> | null>(null)

  const swimmers = data.swimmers
    .filter((s) => !s.deleted)
    .filter((s) => filter === 'all' || s.active === (filter === 'active'))
    .filter((s) => !level || s.level === level)
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))

  const blank = (): Omit<Swimmer, 'updatedAt'> => ({
    id: newId(),
    firstName: '',
    lastName: '',
    level: 'Varsity',
    active: true,
    paddleSize: null,
    finSize: null,
  })

  return (
    <>
      <PageHeader title="Swimmers" action={<Button onClick={() => setEditing(blank())}>Add swimmer</Button>} />
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
                  onClick={() => setEditing(s)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-white px-3 py-2 text-left shadow-sm ring-1 ring-slate-200 hover:ring-brand-500"
                >
                  <Avatar swimmer={s} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{s.firstName} {s.lastName}</span>
                    <span className="block text-xs text-slate-500">
                      Paddles {s.paddleSize ?? '—'} · Fins {s.finSize ?? '—'}
                      {!s.active && ' · Inactive'}
                    </span>
                  </span>
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{s.level}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {editing && (
        <SwimmerSheet
          swimmer={editing}
          isNew={!data.swimmers.some((s) => s.id === editing.id)}
          onSave={(s) => {
            update(saveSwimmer(s))
            setEditing(null)
          }}
          onDelete={() => {
            update(deleteSwimmer(editing.id))
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function SwimmerSheet({
  swimmer,
  isNew,
  onSave,
  onDelete,
  onClose,
}: {
  swimmer: Omit<Swimmer, 'updatedAt'>
  isNew: boolean
  onSave: (swimmer: Omit<Swimmer, 'updatedAt'>) => void
  onDelete: () => void
  onClose: () => void
}) {
  const { data } = useData()
  const [form, setForm] = useState(swimmer)
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))
  const valid = form.firstName.trim() !== '' && form.lastName.trim() !== ''
  const gearById = new Map(data.gear.map((g) => [g.id, g]))
  const holding = openLoans(data.loans).filter((l) => l.swimmerId === swimmer.id)

  const submit = () => {
    if (valid) onSave({ ...form, firstName: form.firstName.trim(), lastName: form.lastName.trim() })
  }

  return (
    <Sheet
      title={isNew ? 'Add swimmer' : `${swimmer.firstName} ${swimmer.lastName}`}
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm(`Remove ${swimmer.firstName} ${swimmer.lastName} from the roster?`)) onDelete()
              }}
            >
              Remove
            </Button>
          )}
          <Button className="flex-1" disabled={!valid} onClick={submit}>
            {isNew ? 'Add swimmer' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <input className={inputClass} value={form.firstName} autoFocus={isNew} autoComplete="off" onChange={(e) => set('firstName', e.target.value)} />
          </Field>
          <Field label="Last name">
            <input className={inputClass} value={form.lastName} autoComplete="off" onChange={(e) => set('lastName', e.target.value)} />
          </Field>
        </div>
        <Field label="Level">
          <Chips options={SWIMMER_LEVELS} value={form.level} onChange={(v) => v && set('level', v)} />
        </Field>
        <Field label="Paddle size">
          <Chips options={PADDLE_SIZES} value={form.paddleSize} onChange={(v) => set('paddleSize', v)} allowNone />
        </Field>
        <Field label="Fin size">
          <Chips options={FIN_SIZES} value={form.finSize} onChange={(v) => set('finSize', v)} allowNone />
        </Field>
        <label className="flex min-h-11 items-center justify-between rounded-xl bg-slate-50 px-3">
          <span>
            <span className="block font-medium">Active</span>
            <span className="block text-xs text-slate-500">Active swimmers count toward gear orders.</span>
          </span>
          <input type="checkbox" className="size-6 accent-brand-700" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
        </label>
        {holding.length > 0 && (
          <div className="rounded-xl bg-amber-50 p-3 text-sm">
            <div className="font-medium text-amber-900">Has this gear</div>
            <ul className="mt-1 list-inside list-disc text-amber-900">
              {holding.map((l) => {
                const item = gearById.get(l.itemId)
                return <li key={l.id}>{item ? describeItem(item) : 'Gear'}</li>
              })}
            </ul>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}
