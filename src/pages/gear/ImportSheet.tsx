import { useRef, useState } from 'react'
import { Button, Sheet } from '../../components/ui'
import { useData } from '../../data/DataProvider'
import { applyGearImport, readGearWorkbook, type GearImport } from '../../data/gearImport'
import { readWorkbook } from '../../lib/xlsxGrid'

// Pick the team's gear spreadsheet, see what will come in, then import it.
export default function ImportSheet({ onClose }: { onClose: () => void }) {
  const { data, update } = useData()
  const input = useRef<HTMLInputElement>(null)
  const [plan, setPlan] = useState<GearImport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const choose = async (file: File) => {
    setError(null)
    setPlan(null)
    try {
      if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('Choose an Excel file (.xlsx). In Google Sheets, use File → Download → Microsoft Excel.')
      const sheets = readWorkbook(new Uint8Array(await file.arrayBuffer()))
      const result = readGearWorkbook(sheets, data, file.name)
      const found = result.swimmers.length + result.bags.length + result.counts.length + result.supplies.length + result.shopping.length
      if (found === 0) throw new Error('No roster, gear bags, counts, supplies or shopping list were found in that file.')
      setPlan(result)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const updated = plan?.swimmers.filter((s) => s.existing).length ?? 0
  const lines = plan
    ? [
        plan.swimmers.length && `${plan.swimmers.length} swimmers (${plan.swimmers.length - updated} new, ${updated} updated) with fin, paddle and shoe sizes, registration and notes`,
        plan.finSizes.length && `Fin sizes: ${plan.finSizes.join(', ')}`,
        plan.counts.length && `${plan.counts.length} inventory counts (${plan.counts.map((c) => `${c.label.replace(' size', '')} ${c.quantity}`).join(', ')})`,
        plan.bags.length && `${plan.bags.length} numbered gear bags`,
        plan.supplies.length && `${plan.supplies.length} other supplies`,
        plan.shopping.length && `${plan.shopping.length} shopping list items`,
        plan.leftovers.length && `${plan.leftovers.length} other cells saved to the team notes on the Profile tab`,
      ].filter(Boolean)
    : []

  return (
    <Sheet
      title="Import gear spreadsheet"
      onClose={onClose}
      footer={
        done ? (
          <Button className="flex-1" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={!plan}
              onClick={() => {
                update(applyGearImport(plan!))
                setDone(true)
              }}
            >
              Import
            </Button>
          </>
        )
      }
    >
      {done ? (
        <p className="text-sm text-slate-700">Imported. Everything is on the Gear and Swimmers tabs, and it will sync to Google Drive.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Choose the team’s Excel file. Swimmers with the same name are updated, not added twice, and importing the same file again won’t make copies.
          </p>
          <input
            ref={input}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void choose(file)
            }}
          />
          <Button variant="secondary" onClick={() => input.current?.click()}>
            {plan ? 'Choose a different file' : 'Choose file'}
          </Button>
          {error && <p className="text-sm text-red-700">{error}</p>}
          {plan && (
            <div className="space-y-3">
              <h3 className="font-semibold">Found in {plan.fileName}</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {lines.map((line) => (
                  <li key={String(line)}>{line}</li>
                ))}
              </ul>
              {plan.warnings.length > 0 && (
                <ul className="space-y-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                  {plan.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
              {plan.leftovers.length > 0 && (
                <details className="rounded-xl bg-slate-50 p-3 text-sm">
                  <summary className="cursor-pointer font-medium">Cells saved as team notes</summary>
                  <ul className="mt-2 space-y-0.5 font-mono text-xs text-slate-600">
                    {plan.leftovers.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}
