import { useState, type ReactNode } from 'react'
import { Button, EmptyState, Field, Section, Sheet, inputClass } from '../../components/ui'
import { deleteClosetRecord, newBag, newShoppingItem, newSupply, saveClosetRecord, sortBags, sortShopping, sortSupplies } from '../../data/closet'
import { useData } from '../../data/DataProvider'
import { teamFinSizes } from '../../data/gear'
import { PADDLE_SIZES, type GearBag, type ShoppingItem, type SupplyItem } from '../../data/types'

type Draft<T> = Omit<T, 'updatedAt'>

const swimmerLabel = (s: { firstName: string; lastName: string }) => `${s.firstName} ${s.lastName}`.trim()

function Row({ title, detail, notes, onClick, right }: { title: string; detail?: string; notes?: string; onClick: () => void; right?: ReactNode }) {
  return (
    <li className="flex items-center gap-2 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      {right}
      <button type="button" onClick={onClick} className="min-h-12 min-w-0 flex-1 px-3 py-2 text-left">
        <span className="block font-medium">{title}</span>
        {detail && <span className="block text-sm text-slate-500">{detail}</span>}
        {notes && <span className="block whitespace-pre-wrap text-xs text-amber-800">{notes}</span>}
      </button>
    </li>
  )
}

function SaveFooter({ onSave, onDelete, onClose, canSave = true }: { onSave: () => void; onDelete?: () => void; onClose: () => void; canSave?: boolean }) {
  return (
    <>
      {onDelete && (
        <Button
          variant="danger"
          onClick={() => {
            onDelete()
            onClose()
          }}
        >
          Delete
        </Button>
      )}
      <Button
        className="flex-1"
        disabled={!canSave}
        onClick={() => {
          onSave()
          onClose()
        }}
      >
        Save
      </Button>
    </>
  )
}

export function GearBags() {
  const { data, update } = useData()
  const [editing, setEditing] = useState<Draft<GearBag> | null>(null)
  const [query, setQuery] = useState('')
  const swimmers = new Map(data.swimmers.filter((s) => !s.deleted).map((s) => [s.id, s]))
  const all = sortBags(data.bags ?? [])
  const bags = all.filter((b) => {
    const who = b.swimmerId && swimmers.get(b.swimmerId)
    return `${b.number} ${who ? swimmerLabel(who) : ''} ${b.notes}`.toLowerCase().includes(query.toLowerCase())
  })
  const isNew = editing && !all.some((b) => b.id === editing.id)
  return (
    <Section title="Gear bags" subtitle={`${all.length} numbered bag${all.length === 1 ? '' : 's'}`} action={<Button variant="secondary" onClick={() => setEditing(newBag())}>Add bag</Button>}>
      {all.length > 6 && <input className={`${inputClass} mb-3`} placeholder="Search bag number, swimmer or notes" value={query} onChange={(e) => setQuery(e.target.value)} />}
      {all.length === 0 ? (
        <EmptyState>No gear bags yet. Add one, or import your gear spreadsheet.</EmptyState>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {bags.map((b) => {
            const who = b.swimmerId ? swimmers.get(b.swimmerId) : null
            const fins = [b.finSize && `size ${b.finSize}`, b.finNumber && `#${b.finNumber}`].filter(Boolean).join(' ')
            const paddles = [b.paddleSize, b.paddleNumber && `#${b.paddleNumber}`].filter(Boolean).join(' ')
            return (
              <Row
                key={b.id}
                title={`Bag ${b.number || '?'}${who ? ` · ${swimmerLabel(who)}` : ''}`}
                detail={[fins && `Fins ${fins}`, paddles && `Paddles ${paddles}`].filter(Boolean).join(' · ')}
                notes={b.notes}
                onClick={() => setEditing(b)}
              />
            )
          })}
        </ul>
      )}
      {editing && (
        <Sheet
          title={isNew ? 'New gear bag' : `Bag ${editing.number}`}
          onClose={() => setEditing(null)}
          footer={
            <SaveFooter
              onClose={() => setEditing(null)}
              onSave={() => update(saveClosetRecord('bags', editing))}
              onDelete={isNew ? undefined : () => update(deleteClosetRecord('bags', editing.id))}
            />
          }
        >
          <BagForm bag={editing} onChange={setEditing} />
        </Sheet>
      )}
    </Section>
  )
}

function BagForm({ bag, onChange }: { bag: Draft<GearBag>; onChange: (bag: Draft<GearBag>) => void }) {
  const { data } = useData()
  const set = (change: Partial<GearBag>) => onChange({ ...bag, ...change })
  const swimmers = data.swimmers.filter((s) => !s.deleted).sort((a, b) => swimmerLabel(a).localeCompare(swimmerLabel(b)))
  const finSizes = teamFinSizes(data)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bag number">
          <input className={inputClass} inputMode="numeric" value={bag.number} onChange={(e) => set({ number: e.target.value })} />
        </Field>
        <Field label="Swimmer">
          <select className={inputClass} value={bag.swimmerId ?? ''} onChange={(e) => set({ swimmerId: e.target.value || null })}>
            <option value="">Nobody</option>
            {swimmers.map((s) => (
              <option key={s.id} value={s.id}>
                {swimmerLabel(s)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fin size">
          <select className={inputClass} value={bag.finSize} onChange={(e) => set({ finSize: e.target.value })}>
            <option value="">None</option>
            {[...new Set([...finSizes, bag.finSize].filter(Boolean))].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Fin number">
          <input className={inputClass} value={bag.finNumber} onChange={(e) => set({ finNumber: e.target.value })} />
        </Field>
        <Field label="Paddle size">
          <select className={inputClass} value={bag.paddleSize} onChange={(e) => set({ paddleSize: e.target.value })}>
            <option value="">None</option>
            {[...new Set([...PADDLE_SIZES, bag.paddleSize].filter(Boolean))].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Paddle number">
          <input className={inputClass} value={bag.paddleNumber} onChange={(e) => set({ paddleNumber: e.target.value })} />
        </Field>
      </div>
      <Field label="Notes">
        <textarea className={`${inputClass} h-20 py-2`} value={bag.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. Needs pull buoy" />
      </Field>
    </div>
  )
}

export function Supplies() {
  const { data, update } = useData()
  const [editing, setEditing] = useState<Draft<SupplyItem> | null>(null)
  const all = sortSupplies(data.supplies ?? [])
  const isNew = editing && !all.some((i) => i.id === editing.id)
  return (
    <Section title="Other supplies" subtitle="Caps, suits, towels, cords, spare fins and anything else in the closet." action={<Button variant="secondary" onClick={() => setEditing(newSupply())}>Add item</Button>}>
      {all.length === 0 ? (
        <EmptyState>Nothing listed yet.</EmptyState>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {all.map((i) => (
            <Row
              key={i.id}
              title={`${i.quantity ?? '?'} × ${i.name}`}
              detail={[i.size && `Size ${i.size}`, i.number && `#${i.number}`].filter(Boolean).join(' · ')}
              notes={i.notes}
              onClick={() => setEditing(i)}
            />
          ))}
        </ul>
      )}
      {editing && (
        <Sheet
          title={isNew ? 'New item' : editing.name}
          onClose={() => setEditing(null)}
          footer={
            <SaveFooter
              canSave={Boolean(editing.name.trim())}
              onClose={() => setEditing(null)}
              onSave={() => update(saveClosetRecord('supplies', { ...editing, name: editing.name.trim() }))}
              onDelete={isNew ? undefined : () => update(deleteClosetRecord('supplies', editing.id))}
            />
          }
        >
          <ItemFields
            name={editing.name}
            quantity={editing.quantity}
            size={editing.size}
            notes={editing.notes}
            number={editing.number}
            onChange={(change) => setEditing({ ...editing, ...change })}
          />
        </Sheet>
      )}
    </Section>
  )
}

export function ShoppingList() {
  const { data, update } = useData()
  const [editing, setEditing] = useState<Draft<ShoppingItem> | null>(null)
  const all = sortShopping(data.shopping ?? [])
  const isNew = editing && !all.some((i) => i.id === editing.id)
  const left = all.filter((i) => !i.done).length
  return (
    <Section title="Shopping list" subtitle={`${left} to buy`} action={<Button variant="secondary" onClick={() => setEditing(newShoppingItem())}>Add item</Button>}>
      {all.length === 0 ? (
        <EmptyState>Nothing to buy.</EmptyState>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {all.map((i) => (
            <Row
              key={i.id}
              title={`${i.quantity ?? ''}${i.quantity !== null ? ' × ' : ''}${i.item}`}
              detail={i.size}
              notes={i.notes}
              onClick={() => setEditing(i)}
              right={
                <label className="flex size-12 shrink-0 items-center justify-center">
                  <input
                    type="checkbox"
                    aria-label={`Bought ${i.item}`}
                    className="size-6 accent-brand-700"
                    checked={i.done}
                    onChange={(e) => update(saveClosetRecord('shopping', { ...i, done: e.target.checked }))}
                  />
                </label>
              }
            />
          ))}
        </ul>
      )}
      {editing && (
        <Sheet
          title={isNew ? 'New item' : editing.item}
          onClose={() => setEditing(null)}
          footer={
            <SaveFooter
              canSave={Boolean(editing.item.trim())}
              onClose={() => setEditing(null)}
              onSave={() => update(saveClosetRecord('shopping', { ...editing, item: editing.item.trim() }))}
              onDelete={isNew ? undefined : () => update(deleteClosetRecord('shopping', editing.id))}
            />
          }
        >
          <ItemFields
            name={editing.item}
            quantity={editing.quantity}
            size={editing.size}
            notes={editing.notes}
            onChange={({ name, ...rest }) => setEditing({ ...editing, ...rest, ...(name !== undefined ? { item: name } : {}) })}
          />
        </Sheet>
      )}
    </Section>
  )
}

function ItemFields({
  name,
  quantity,
  size,
  number,
  notes,
  onChange,
}: {
  name: string
  quantity: number | null
  size: string
  number?: string
  notes: string
  onChange: (change: { name?: string; quantity?: number | null; size?: string; number?: string; notes?: string }) => void
}) {
  return (
    <div className="space-y-3">
      <Field label="Item">
        <input className={inputClass} value={name} onChange={(e) => onChange({ name: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantity">
          <input
            className={inputClass}
            inputMode="numeric"
            value={quantity ?? ''}
            placeholder="?"
            onChange={(e) => {
              const n = parseFloat(e.target.value)
              onChange({ quantity: Number.isFinite(n) ? n : null })
            }}
          />
        </Field>
        <Field label="Size or type">
          <input className={inputClass} value={size} onChange={(e) => onChange({ size: e.target.value })} />
        </Field>
        {number !== undefined && (
          <Field label="Number">
            <input className={inputClass} value={number} onChange={(e) => onChange({ number: e.target.value })} />
          </Field>
        )}
      </div>
      <Field label="Notes">
        <textarea className={`${inputClass} h-20 py-2`} value={notes} onChange={(e) => onChange({ notes: e.target.value })} />
      </Field>
    </div>
  )
}
