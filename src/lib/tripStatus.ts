import type { Trip, TripStatus } from '../types'
import { todayISO } from './time'

export const TRIP_STATUSES: TripStatus[] = ['past', 'upcoming', 'ongoing', 'longTerm']

export function inferTripStatus(trip: Trip, today = todayISO()): TripStatus {
  const dates = trip.days
    .map((day) => day.date)
    .filter((date): date is string => Boolean(date))
    .sort()

  if (dates.length === 0) return 'longTerm'

  const start = dates[0]
  const end = dates[dates.length - 1]
  if (today < start) return 'upcoming'
  if (today > end) return 'past'
  return 'ongoing'
}

export function tripStatus(trip: Trip, today = todayISO()): TripStatus {
  return trip.meta.statusOverride ?? inferTripStatus(trip, today)
}
