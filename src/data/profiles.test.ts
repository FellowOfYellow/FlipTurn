import { describe, expect, it } from 'vitest'
import {
  LOCAL_COACH_ID,
  claimCoachProfile,
  coachIdFor,
  deleteSwimmer,
  saveCoach,
  saveSwimmer,
  setPhoto,
  yearsCoaching,
} from './actions'
import { emptyData } from './localStore'
import { mergeData, withSwimmerDefaults } from './merge'
import type { AppData } from './types'

const user = { name: 'Brandon Coach', email: 'coach@example.com' }

describe('claimCoachProfile', () => {
  it('creates a profile from the Google account', () => {
    const data = claimCoachProfile(user)(emptyData())
    expect(data.coaches).toHaveLength(1)
    expect(data.coaches[0]).toMatchObject({ id: coachIdFor(user.email), name: 'Brandon Coach', email: user.email })
  })

  it('does nothing when the profile already exists', () => {
    const once = claimCoachProfile(user)(emptyData())
    expect(claimCoachProfile(user)(once)).toBe(once)
  })

  it('adopts the profile filled in before signing in, photo included', () => {
    let data: AppData = saveCoach({ id: LOCAL_COACH_ID, name: 'Coach B', title: 'Head Coach', startYear: 2019, email: '' })(emptyData())
    data = setPhoto(LOCAL_COACH_ID, 'data:image/jpeg;base64,AAA')(data)
    data = claimCoachProfile(user)(data)
    const live = data.coaches.filter((c) => !c.deleted)
    expect(live).toHaveLength(1)
    expect(live[0]).toMatchObject({ name: 'Coach B', title: 'Head Coach', startYear: 2019, email: user.email })
    expect(data.photos.find((p) => p.id === live[0].id && !p.deleted)?.dataUrl).toBe('data:image/jpeg;base64,AAA')
  })

  it('gives two devices the same profile id so they merge', () => {
    const a = claimCoachProfile(user)(emptyData())
    const b = claimCoachProfile({ ...user, email: 'Coach@Example.com' })(emptyData())
    expect(mergeData(a, b).coaches).toHaveLength(1)
  })
})

describe('yearsCoaching', () => {
  it('counts school seasons, ticking over in August', () => {
    expect(yearsCoaching(2019, new Date(2026, 10, 17))).toBe(8) // 2026–27 season
    expect(yearsCoaching(2019, new Date(2026, 3, 1))).toBe(7) // still 2025–26
    expect(yearsCoaching(2026, new Date(2026, 10, 1))).toBe(1)
    expect(yearsCoaching(null)).toBeNull()
  })
})

describe('swimmer profiles', () => {
  it('fills new profile fields on rosters saved by Phase 1', () => {
    const old = { id: 's1', updatedAt: 1, firstName: 'Ana', lastName: 'Lopez', level: 'JV', active: true, paddleSize: 'S', finSize: '8' }
    const [s] = mergeData(emptyData(), { swimmers: [old as never] }).swimmers
    expect(s).toMatchObject({ firstName: 'Ana', grade: null, clubTeams: [], captain: false, parentName: '' })
  })

  it('removes the photo with the swimmer', () => {
    let data = saveSwimmer(withSwimmerDefaults({ id: 's1', updatedAt: 0, firstName: 'A', lastName: 'B' }))(emptyData())
    data = setPhoto('s1', 'data:image/jpeg;base64,AAA')(data)
    data = deleteSwimmer('s1')(data)
    expect(data.photos.find((p) => p.id === 's1')?.deleted).toBe(true)
  })

  it('skips writing a photo that did not change', () => {
    const data = emptyData()
    expect(setPhoto('s1', null)(data)).toBe(data)
  })
})

describe('deleting a swimmer', () => {
  const ana = withSwimmerDefaults({
    id: 's1', updatedAt: 0, firstName: 'Ana', lastName: 'Lopez', phone: '555-0100', email: 'ana@example.com',
    parentName: 'Rosa Lopez', parentPhone: '555-0101', parentEmail: 'rosa@example.com', clubTeams: ['Sharks'],
  })

  it('erases their name and contact details, keeping only the tombstone', () => {
    const data = deleteSwimmer('s1')(saveSwimmer(ana)(emptyData()))
    const [s] = data.swimmers
    expect(s.deleted).toBe(true)
    expect(JSON.stringify(s)).not.toMatch(/Ana|Lopez|555|example\.com|Sharks/)
  })

  it('cleans up details left behind by older versions of the app', () => {
    const old = { ...ana, deleted: true, updatedAt: 5 }
    const [s] = mergeData(emptyData(), { swimmers: [old] }).swimmers
    expect(s).toMatchObject({ id: 's1', deleted: true, updatedAt: 5, firstName: '', parentEmail: '' })
  })
})
