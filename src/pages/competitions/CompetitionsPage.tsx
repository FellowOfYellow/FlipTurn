import { Link, useNavigate } from 'react-router-dom'
import { Button, EmptyState, PageHeader, Section } from '../../components/ui'
import { relayEvents, sortCompetitions } from '../../data/competitions'
import { useData } from '../../data/DataProvider'
import type { Competition } from '../../data/types'
import { formatLongDate } from '../../lib/format'

export default function CompetitionsPage() {
  const { data } = useData()
  const navigate = useNavigate()
  const { upcoming, past } = sortCompetitions(data.competitions)

  return (
    <>
      <PageHeader title="Competitions" action={<Button onClick={() => navigate('/competitions/new')}>New competition</Button>} />
      <Section title="Upcoming">
        {upcoming.length === 0 ? (
          <EmptyState>No upcoming competitions. Tap “New competition” to add a meet.</EmptyState>
        ) : (
          <CompetitionBars competitions={upcoming} />
        )}
      </Section>
      {past.length > 0 && (
        <Section title="Past">
          <CompetitionBars competitions={past} />
        </Section>
      )}
    </>
  )
}

function CompetitionBars({ competitions }: { competitions: Competition[] }) {
  return (
    <ul className="space-y-2">
      {competitions.map((c) => {
        const relays = relayEvents(c).length
        const individual = c.events.length - relays
        return (
          <li key={c.id}>
            <Link
              to={`/competitions/${c.id}`}
              className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200 hover:ring-brand-500"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{c.name || 'Untitled meet'}</span>
                <span className="block truncate text-sm text-slate-500">
                  {[c.date && formatLongDate(c.date), c.location].filter(Boolean).join(' · ') || 'No date or location'}
                </span>
              </span>
              <span className="hidden text-right text-xs text-slate-500 sm:block">
                {relays} relay{relays === 1 ? '' : 's'} · {individual} individual
                <br />
                {c.swimmerIds.length} swimmer{c.swimmerIds.length === 1 ? '' : 's'}
              </span>
              <span aria-hidden className="text-xl text-slate-400">
                ›
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
