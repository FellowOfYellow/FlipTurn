import type { Badges } from '../../data/competitions'
import type { EventKind } from '../../data/types'

export function KindTag({ kind }: { kind: EventKind }) {
  return kind === 'relay' ? (
    <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold tracking-wide text-violet-800 uppercase">Relay</span>
  ) : (
    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold tracking-wide text-emerald-800 uppercase">Individual</span>
  )
}

// One circled I per individual event and one circled R per relay.
export function EntryBadges({ badges }: { badges: Badges }) {
  const circles = [
    ...Array.from({ length: badges.individual }, () => 'I' as const),
    ...Array.from({ length: badges.relay }, () => 'R' as const),
  ]
  if (circles.length === 0) return null
  return (
    <span className="flex flex-wrap gap-0.5" aria-label={`${badges.individual} individual, ${badges.relay} relay`}>
      {circles.map((letter, i) => (
        <span
          key={i}
          aria-hidden
          className={`flex size-5 items-center justify-center rounded-full text-[10px] font-bold ring-1 ${
            letter === 'I' ? 'text-emerald-800 ring-emerald-500' : 'text-violet-800 ring-violet-500'
          }`}
        >
          {letter}
        </span>
      ))}
    </span>
  )
}
