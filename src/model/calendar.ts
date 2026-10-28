/**
 * Date arithmetic of the calendar view.
 *
 * Publish dates are wall-clock times without a time zone (`YYYY-MM-DDTHH:mm`): "10:00 on
 * the 5th" means the same to everyone. All arithmetic therefore happens on calendar days in
 * UTC, where no day is ever 23 or 25 hours long, and times are formatted in UTC too, so a
 * time that does not exist locally (02:30 on the night clocks go forward) still reads 02:30.
 * Only "today" depends on the user's time zone.
 */
import { DateTime, Info } from 'luxon'
import { isValidDate, isValidDateTime, type Card } from './schema'

/** Time given to a card that is planned for the first time by dropping it on a day. */
export const DEFAULT_PUBLISH_TIME = '09:00'

function day(iso: string) {
  return DateTime.fromISO(iso, { zone: 'utc' })
}

function isoDay(date: DateTime) {
  return date.toISODate() as string
}

/** Today in the given (default: the user's) time zone, `YYYY-MM-DD`. */
export function today(zone?: string, now: DateTime = DateTime.now()) {
  return isoDay(zone ? now.setZone(zone) : now.toLocal())
}

/** `YYYY-MM` of a day */
export function monthOf(isoDate: string) {
  return isoDate.slice(0, 7)
}

/** Monday of the week containing `isoDate` */
export function weekStart(isoDate: string) {
  return isoDay(day(isoDate).startOf('week'))
}

export function addDays(isoDate: string, days: number) {
  return isoDay(day(isoDate).plus({ days }))
}

/** First day of the month `months` away from the month of `isoDate`. */
export function addMonths(isoDate: string, months: number) {
  return isoDay(day(`${monthOf(isoDate)}-01`).plus({ months }))
}

export function weekDays(isoDate: string) {
  const start = weekStart(isoDate)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

/**
 * The weeks shown for the month of `isoDate`, Monday first: from the week of the 1st to
 * the week of the last day, each a list of 7 days (with days of the adjacent months).
 */
export function monthGrid(isoDate: string): string[][] {
  const first = day(`${monthOf(isoDate)}-01`)
  const last = first.endOf('month')
  const weeks: string[][] = []
  for (let start = first.startOf('week'); start <= last; start = start.plus({ weeks: 1 })) {
    weeks.push(weekDays(isoDay(start)))
  }
  return weeks
}

export function isSameMonth(a: string, b: string) {
  return monthOf(a) === monthOf(b)
}

/** The day part of a publish date */
export function dayOf(publishDate: string) {
  return publishDate.slice(0, 10)
}

/** The `HH:mm` part of a publish date */
export function timeOf(publishDate: string) {
  return publishDate.slice(11, 16)
}

/** Moves a publish date to another day, keeping its time. */
export function moveToDay(publishDate: string | null, isoDate: string) {
  if (!isValidDate(isoDate)) {
    throw new RangeError(`invalid day ${isoDate}`)
  }
  const time =
    publishDate && isValidDateTime(publishDate) ? timeOf(publishDate) : DEFAULT_PUBLISH_TIME
  return `${isoDate}T${time}`
}

export function withTime(publishDate: string, time: string) {
  return `${dayOf(publishDate)}T${time}`
}

/** Monday-first weekday names in the user's language */
export function weekdayNames(locale: string, format: 'long' | 'short' | 'narrow' = 'short') {
  return Info.weekdays(format, { locale })
}

export function formatMonth(isoDate: string, locale: string) {
  return day(isoDate).setLocale(locale).toLocaleString({ month: 'long', year: 'numeric' })
}

export function formatDay(
  isoDate: string,
  locale: string,
  format: Intl.DateTimeFormatOptions = DateTime.DATE_FULL
) {
  return day(isoDate).setLocale(locale).toLocaleString(format)
}

export function formatTime(publishDate: string, locale: string) {
  return DateTime.fromISO(publishDate, { zone: 'utc' })
    .setLocale(locale)
    .toLocaleString(DateTime.TIME_SIMPLE)
}

export function formatPublishDate(publishDate: string, locale: string) {
  return DateTime.fromISO(publishDate, { zone: 'utc' })
    .setLocale(locale)
    .toLocaleString({ day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

/** Title of the week view, e.g. "26 oct. – 1 nov. 2026" */
export function formatWeek(isoDate: string, locale: string) {
  const start = day(weekStart(isoDate))
  const format = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  })
  return format.formatRange(start.toJSDate(), start.plus({ days: 6 }).toJSDate())
}

/** Cards with a publish date by day, each day sorted by time, then title. */
export function cardsByDay(cards: readonly Card[]) {
  const days = new Map<string, Card[]>()
  for (const card of cards) {
    if (!card.publishDate) {
      continue
    }
    const key = dayOf(card.publishDate)
    days.set(key, [...(days.get(key) ?? []), card])
  }
  for (const list of days.values()) {
    list.sort(
      (a, b) =>
        (a.publishDate as string).localeCompare(b.publishDate as string) ||
        a.title.localeCompare(b.title)
    )
  }
  return days
}
