import { describe, expect, it } from 'vitest'
import { readEvents } from './eventReader'

describe('readEvents', () => {
  it('reads a typical high school meet order', () => {
    const { events, skipped } = readEvents(`Dual Meet Order of Events
Event 1  Girls 200 Yard Medley Relay
Event 2  Boys 200 Yard Medley Relay
3. Girls 200 Yard Freestyle
4 Boys 200 IM
Event 9 Girls 1 Meter Diving
Event 11  Girls 50 Yard Butterfly   24.51
Event 15 Mixed 4x50 Free Relay
Event 20  Boys 100 Backstroke`)
    expect(events.map((e) => [e.name, e.kind, e.stroke, e.distance])).toEqual([
      ['Girls 200 Yard Medley Relay', 'relay', 'Medley', 200],
      ['Boys 200 Yard Medley Relay', 'relay', 'Medley', 200],
      ['Girls 200 Yard Freestyle', 'individual', 'Free', 200],
      ['Boys 200 IM', 'individual', 'IM', 200],
      ['Girls 50 Yard Butterfly', 'individual', 'Fly', 50],
      ['Mixed 4x50 Free Relay', 'relay', 'Free', 200],
      ['Boys 100 Backstroke', 'individual', 'Back', 100],
    ])
    expect(skipped).toEqual([{ line: 'Event 9 Girls 1 Meter Diving', reason: 'Diving is not tracked' }])
  })

  it("doesn't mistake words like breath or come back for strokes without a distance", () => {
    expect(readEvents('Warm up 10 minutes, no breath drills').events).toEqual([])
  })
})
