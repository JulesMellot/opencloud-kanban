import { DateTime, Settings } from 'luxon'
import {
  addDays,
  addMonths,
  cardsByDay,
  formatMonth,
  formatTime,
  formatWeek,
  monthGrid,
  moveToDay,
  today,
  weekDays,
  weekdayNames,
  weekStart
} from '../../../src/model/calendar'
import { card } from '../fixtures'

const defaultZone = Settings.defaultZone

beforeAll(() => {
  Settings.defaultZone = 'Europe/Paris'
})

afterAll(() => {
  Settings.defaultZone = defaultZone
})

/** ICU uses narrow and thin no-break spaces in formatted dates */
const plain = (value: string) => value.replace(/[\u202f\u2009\u00a0]/g, ' ')

function expectConsecutive(days: string[]) {
  for (let i = 1; i < days.length; i++) {
    const previous = DateTime.fromISO(days[i - 1], { zone: 'utc' })
    expect(DateTime.fromISO(days[i], { zone: 'utc' }).diff(previous, 'days').days).toBe(1)
  }
}

describe('monthGrid', () => {
  it('starts weeks on Monday and covers the whole month', () => {
    // October 2026 starts on a Thursday and ends on a Saturday
    const weeks = monthGrid('2026-10-15')
    expect(weeks).toHaveLength(5)
    expect(weeks[0][0]).toBe('2026-09-28')
    expect(weeks[0][3]).toBe('2026-10-01')
    expect(weeks.at(-1)?.at(-1)).toBe('2026-11-01')
    expect(weeks.every((week) => week.length === 7)).toBe(true)
    expect(weeks.every((week) => DateTime.fromISO(week[0]).weekday === 1)).toBe(true)
  })

  it('needs six weeks for some months and four for others', () => {
    // August 2026 starts on a Saturday and has 31 days
    expect(monthGrid('2026-08-01')).toHaveLength(6)
    // February 2027 starts on a Monday and has 28 days
    expect(monthGrid('2027-02-10')).toHaveLength(4)
  })

  it.each([
    ['2026-03-01', 'spring forward on March 29'],
    ['2026-10-01', 'fall back on October 25']
  ])('has every day once around the change of time (%s, %s)', (month) => {
    const days = monthGrid(month).flat()
    expect(new Set(days).size).toBe(days.length)
    expectConsecutive(days)
  })
})

describe('navigation', () => {
  it('goes to the first day of the previous and next month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-01')
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01')
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01')
  })

  it('moves by days across the change of time', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
    expect(addDays('2026-10-26', -7)).toBe('2026-10-19')
  })

  it('finds the week of a day, Monday to Sunday', () => {
    expect(weekStart('2026-10-25')).toBe('2026-10-19')
    expect(weekStart('2026-10-26')).toBe('2026-10-26')
    const days = weekDays('2026-03-29')
    expect(days[0]).toBe('2026-03-23')
    expect(days[6]).toBe('2026-03-29')
    expectConsecutive(days)
  })
})

describe('moveToDay', () => {
  it('keeps the time when moving to another day', () => {
    expect(moveToDay('2026-10-28T18:30', '2026-11-03')).toBe('2026-11-03T18:30')
  })

  it('keeps a time that does not exist locally on the night clocks go forward', () => {
    expect(moveToDay('2026-03-27T02:30', '2026-03-29')).toBe('2026-03-29T02:30')
  })

  it('keeps a time that exists twice on the night clocks go back', () => {
    expect(moveToDay('2026-10-20T02:30', '2026-10-25')).toBe('2026-10-25T02:30')
  })

  it('gives a default time to a card planned for the first time', () => {
    expect(moveToDay(null, '2026-11-03')).toBe('2026-11-03T09:00')
  })

  it('refuses an invalid day', () => {
    expect(() => moveToDay(null, '2026-02-30')).toThrow(RangeError)
  })
})

describe('today', () => {
  it('is the day in the user time zone, not in UTC', () => {
    const now = DateTime.fromISO('2026-10-24T23:30:00Z')
    expect(today('Europe/Paris', now)).toBe('2026-10-25')
    expect(today('UTC', now)).toBe('2026-10-24')
    expect(today('America/New_York', now)).toBe('2026-10-24')
  })

  it('uses the default zone when none is given', () => {
    expect(today(undefined, DateTime.fromISO('2026-03-28T23:30:00Z'))).toBe('2026-03-29')
  })
})

describe('formatting', () => {
  it('shows the stored time, even one that does not exist locally', () => {
    expect(formatTime('2026-03-29T02:30', 'fr')).toBe('02:30')
    expect(formatTime('2026-10-25T02:30', 'fr')).toBe('02:30')
    expect(plain(formatTime('2026-10-25T14:05', 'en-US'))).toBe('2:05 PM')
  })

  it('names months and weekdays in the user language, Monday first', () => {
    expect(formatMonth('2026-10-01', 'fr')).toBe('octobre 2026')
    expect(formatMonth('2026-10-01', 'en')).toBe('October 2026')
    expect(weekdayNames('fr')[0]).toMatch(/^lun/)
    expect(weekdayNames('en')[6]).toBe('Sun')
  })

  it('names a week by its first and last day', () => {
    expect(plain(formatWeek('2026-10-28', 'en'))).toBe('Oct 26 – Nov 1, 2026')
  })
})

describe('cardsByDay', () => {
  it('groups cards by publish day, sorted by time, and skips undated ones', () => {
    const days = cardsByDay([
      card('late', 'c', 1, { publishDate: '2026-10-28T18:00' }),
      card('none', 'c', 2),
      card('early', 'c', 3, { publishDate: '2026-10-28T08:00' }),
      card('next', 'c', 4, { publishDate: '2026-10-29T08:00' })
    ])
    expect([...days.keys()]).toEqual(['2026-10-28', '2026-10-29'])
    expect(days.get('2026-10-28')?.map(({ id }) => id)).toEqual(['early', 'late'])
  })
})
