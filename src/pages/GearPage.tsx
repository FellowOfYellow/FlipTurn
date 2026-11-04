import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Button, EmptyState, PageHeader, Section, Sheet, Stepper, inputClass } from '../components/ui'
import { formatDate } from '../lib/format'
import { lendGear, returnLoan, setGearQuantity } from '../data/actions'
import { useData } from '../data/DataProvider'
import {
  activeSwimmers,
  describeItem,
  gearItemId,
  openLoans,
  orderListText,
  summarizeGear,
  type GearSummary,
} from '../data/gear'
import type { GearType, Swimmer } from '../data/types'

const ICONS: Record<GearType, string> = {
  paddles: '✋',
  fins: '🦶',
  gearBag: '🎒',
  kickboard: '🟦',
}

export default function GearPage() {
  const { data, update } = useData()
  const summaries = useMemo(() => summarizeGear(data.gear, data.swimmers, data.loans), [data])
  const [editing, setEditing] = useState<GearSummary | null>(null)
  const [lending, setLending] = useState(false)
  const [copied, setCopied] = useState(false)
  const activeCount = activeSwimmers(data.swimmers).length
  const schoolName = data.team.find((t) => t.id === 'team')?.schoolName ?? ''
  const totalToOrder = summaries.reduce((n, s) => n + s.toOrder, 0)

  const copyOrder = async () => {
    try {
      await navigator.clipboard.writeText(orderListText(summaries, schoolName))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.alert(orderListText(summaries, schoolName))
    }
  }

  return (
    <>
      <PageHeader title="Gear" action={<Button onClick={() => setLending(true)}>Lend gear</Button>} />

      <Section title="Inventory" subtitle="Everything the team owns, including gear that's lent out. Tap to update.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {summaries.map((summary) => (
            <button
              key={summary.info.type}
              type="button"
              onClick={() => setEditing(summary)}
              className="flex flex-col rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-brand-500"
            >
              <div className="flex items-center justify-between text-sm font-medium text-slate-500">
                {summary.info.label}
                <span aria-hidden>{ICONS[summary.info.type]}</span>
              </div>
              <div className="mt-1 text-3xl font-bold tabular-nums">{summary.inventory}</div>
              {summary.lentOut > 0 && <div className="text-xs text-slate-500">{summary.lentOut} lent out</div>}
              {summary.info.sizes && <SizeBreakdown summary={summary} field="inventory" />}
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="To order"
        subtitle={`Every active swimmer needs one of each (${activeCount} active), minus inventory.`}
        action={
          <Button variant="secondary" onClick={copyOrder} disabled={totalToOrder === 0}>
            {copied ? 'Copied' : 'Copy list'}
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {summaries.map((summary) => (
            <div
              key={summary.info.type}
              className={`rounded-2xl p-4 ring-1 ${summary.toOrder > 0 ? 'bg-amber-50 ring-amber-200' : 'bg-white ring-slate-200'}`}
            >
              <div className="text-sm font-medium text-slate-500">{summary.info.label}</div>
              <div className="mt-1 text-3xl font-bold tabular-nums">{summary.toOrder}</div>
              {summary.info.sizes && summary.toOrder > 0 && <SizeBreakdown summary={summary} field="toOrder" hideZero />}
              {summary.missingSize > 0 && (
                <Link to="/swimmers" className="mt-2 block text-xs font-medium text-amber-800 underline">
                  {summary.missingSize} active swimmer{summary.missingSize === 1 ? ' has' : 's have'} no{' '}
                  {summary.info.type === 'fins' ? 'fin' : 'paddle'} size
                </Link>
              )}
            </div>
          ))}
        </div>
      </Section>

      <LentOut swimmers={data.swimmers} onReturn={(id) => update(returnLoan(id))} />

      {editing && (
        <InventorySheet
          summary={summaries.find((s) => s.info.type === editing.info.type)!}
          onChange={(itemId, quantity) => update(setGearQuantity(itemId, quantity))}
          onClose={() => setEditing(null)}
        />
      )}
      {lending && (
        <LendSheet
          swimmers={activeSwimmers(data.swimmers)}
          summaries={summaries}
          onLend={(swimmerId, itemIds) => {
            update(lendGear(swimmerId, itemIds))
            setLending(false)
          }}
          onClose={() => setLending(false)}
        />
      )}
    </>
  )
}

function SizeBreakdown({
  summary,
  field,
  hideZero,
}: {
  summary: GearSummary
  field: 'inventory' | 'toOrder'
  hideZero?: boolean
}) {
  const lines = summary.lines.filter((l) => !hideZero || l[field] > 0)
  return (
    <div className="mt-3 flex flex-wrap gap-1">
      {lines.map((line) => (
        <span key={line.itemId} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700 tabular-nums">
          {line.size}: <strong>{line[field]}</strong>
        </span>
      ))}
    </div>
  )
}

function InventorySheet({
  summary,
  onChange,
  onClose,
}: {
  summary: GearSummary
  onChange: (itemId: string, quantity: number) => void
  onClose: () => void
}) {
  return (
    <Sheet title={`${summary.info.label} inventory`} onClose={onClose} footer={<Button className="flex-1" onClick={onClose}>Done</Button>}>
      <p className="mb-4 text-sm text-slate-500">How many the team owns in total, including any that are lent out.</p>
      <ul className="divide-y divide-slate-100">
        {summary.lines.map((line) => (
          <li key={line.itemId} className="flex items-center justify-between gap-3 py-2">
            <div>
              <div className="font-medium">{line.size ? `Size ${line.size}` : summary.info.label}</div>
              <div className="text-xs text-slate-500">
                {line.needed} needed{line.lentOut > 0 ? ` · ${line.lentOut} lent out` : ''}
              </div>
            </div>
            <Stepper
              label={line.size ? `${summary.info.label} size ${line.size}` : summary.info.label}
              value={line.inventory}
              onChange={(n) => onChange(line.itemId, n)}
            />
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

function LendSheet({
  swimmers,
  summaries,
  onLend,
  onClose,
}: {
  swimmers: Swimmer[]
  summaries: GearSummary[]
  onLend: (swimmerId: string, itemIds: string[]) => void
  onClose: () => void
}) {
  const [swimmerId, setSwimmerId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Record<string, string | null>>({})
  const swimmer = swimmers.find((s) => s.id === swimmerId)

  const available = (type: GearType, size: string | null) => {
    const line = summaries.find((g) => g.info.type === type)!.lines.find((l) => l.size === size)
    return line ? line.inventory - line.lentOut : 0
  }

  const choose = (s: Swimmer) => {
    setSwimmerId(s.id)
    // Start with their recorded sizes, skipping anything with none in the bin.
    const next: Record<string, string | null> = {}
    for (const { info } of summaries) {
      const size = info.sizes ? (info.swimmerSize?.(s) ?? null) : null
      if (info.sizes ? size === null || available(info.type, size) > 0 : available(info.type, null) > 0) {
        next[info.type] = size
      }
    }
    setPicked(next)
  }

  const selected = summaries.filter(
    ({ info }) => info.type in picked && (!info.sizes || picked[info.type]) && available(info.type, picked[info.type] ?? null) > 0,
  )
  const itemIds = selected.map(({ info }) => gearItemId(info.type, picked[info.type] ?? null))

  const sorted = swimmers
    .filter((s) => `${s.firstName} ${s.lastName}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.lastName.localeCompare(b.lastName))

  return (
    <Sheet
      title={swimmer ? `Lend to ${swimmer.firstName} ${swimmer.lastName}` : 'Lend gear'}
      onClose={onClose}
      footer={
        swimmer && (
          <>
            <Button variant="secondary" onClick={() => setSwimmerId(null)}>Back</Button>
            <Button className="flex-1" disabled={itemIds.length === 0} onClick={() => onLend(swimmer.id, itemIds)}>
              Lend {itemIds.length} item{itemIds.length === 1 ? '' : 's'}
            </Button>
          </>
        )
      }
    >
      {!swimmer ? (
        swimmers.length === 0 ? (
          <EmptyState>
            No active swimmers yet. <Link className="font-semibold text-brand-700 underline" to="/swimmers" onClick={onClose}>Add swimmers</Link> first.
          </EmptyState>
        ) : (
          <>
            <input className={`${inputClass} mb-3`} placeholder="Search swimmers" value={query} onChange={(e) => setQuery(e.target.value)} />
            <ul className="divide-y divide-slate-100">
              {sorted.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => choose(s)} className="flex w-full items-center gap-3 py-2 text-left">
                    <Avatar swimmer={s} />
                    <span className="font-medium">{s.firstName} {s.lastName}</span>
                    <span className="ml-auto text-xs text-slate-500">{s.level}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )
      ) : (
        <ul className="space-y-4">
          {summaries.map(({ info, lines }) => {
            const on = info.type in picked
            const size = picked[info.type] ?? null
            const inBin = info.sizes && !size ? null : available(info.type, size)
            // Unsized gear with none left can't be ticked; sized gear can, to pick another size.
            const noneAtAll = info.sizes ? lines.every((l) => l.inventory - l.lentOut <= 0) : inBin === 0
            return (
              <li key={info.type} className="rounded-2xl p-3 ring-1 ring-slate-200">
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-5 accent-brand-700"
                    checked={on}
                    disabled={noneAtAll}
                    onChange={(e) =>
                      setPicked((p) => {
                        const next = { ...p }
                        if (e.target.checked) next[info.type] = info.sizes ? (info.swimmerSize?.(swimmer) ?? null) : null
                        else delete next[info.type]
                        return next
                      })
                    }
                  />
                  <span className={`font-medium ${noneAtAll ? 'text-slate-400' : ''}`}>{info.label}</span>
                  {noneAtAll ? (
                    <span className="ml-auto text-xs font-semibold text-amber-700">None in the bin</span>
                  ) : (
                    on &&
                    inBin !== null && (
                      <span className={`ml-auto text-xs ${inBin > 0 ? 'text-slate-500' : 'font-semibold text-amber-700'}`}>
                        {inBin > 0 ? `${inBin} in the bin` : `No size ${size} in the bin`}
                      </span>
                    )
                  )}
                </label>
                {on && info.sizes && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {info.sizes.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setPicked((p) => ({ ...p, [info.type]: option }))}
                        aria-pressed={size === option}
                        className={`min-h-10 min-w-10 rounded-lg px-2 text-sm font-semibold ring-1 ${
                          size === option ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white ring-slate-300'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                    {!size && <p className="w-full text-xs text-amber-700">Pick a size.</p>}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}

function LentOut({ swimmers, onReturn }: { swimmers: Swimmer[]; onReturn: (loanId: string) => void }) {
  const { data } = useData()
  const [query, setQuery] = useState('')
  const loans = openLoans(data.loans)
  const gearById = new Map(data.gear.map((g) => [g.id, g]))
  const byId = new Map(swimmers.map((s) => [s.id, s]))

  const bySwimmer = new Map<string, typeof loans>()
  for (const loan of loans) bySwimmer.set(loan.swimmerId, [...(bySwimmer.get(loan.swimmerId) ?? []), loan])
  const groups = [...bySwimmer]
    .map(([swimmerId, items]) => ({ swimmer: byId.get(swimmerId), items }))
    .filter((g) => g.swimmer && !g.swimmer.deleted)
    .filter((g) => `${g.swimmer!.firstName} ${g.swimmer!.lastName}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.swimmer!.lastName.localeCompare(b.swimmer!.lastName))

  return (
    <Section title="Lent out" subtitle={`${loans.length} item${loans.length === 1 ? '' : 's'} with swimmers`}>
      {loans.length > 0 && (
        <input className={`${inputClass} mb-3`} placeholder="Search by swimmer" value={query} onChange={(e) => setQuery(e.target.value)} />
      )}
      {groups.length === 0 ? (
        <EmptyState>{loans.length === 0 ? 'No gear is lent out right now.' : 'No swimmers match that search.'}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {groups.map(({ swimmer, items }) => (
            <li key={swimmer!.id} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <div className="mb-2 flex items-center gap-3">
                <Avatar swimmer={swimmer!} />
                <span className="font-semibold">{swimmer!.firstName} {swimmer!.lastName}</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {items.map((loan) => {
                  const item = gearById.get(loan.itemId)
                  return (
                    <li key={loan.id} className="flex items-center justify-between gap-3 py-1.5">
                      <div>
                        <div className="text-sm font-medium">{item ? describeItem(item) : 'Gear'}</div>
                        <div className="text-xs text-slate-500">Since {formatDate(loan.lentOn)}</div>
                      </div>
                      <Button variant="secondary" onClick={() => onReturn(loan.id)}>Returned</Button>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
