// Open-Meteo (free, CORS-enabled, no API key) for weather + geocoding.
// Docs: https://open-meteo.com/en/docs

export interface GeocodeHit {
  name: string
  country?: string
  admin1?: string
  lat: number
  lng: number
}

const geocodeCache = new Map<string, GeocodeHit[]>()

export async function geocode(query: string, signal?: AbortSignal): Promise<GeocodeHit | null> {
  if (!query.trim()) return null
  const hits = await geocodeOptions(query, { count: 1, signal })
  return hits[0] ?? null
}

export async function geocodeOptions(
  query: string,
  options: { count?: number; context?: string; signal?: AbortSignal } = {},
): Promise<GeocodeHit[]> {
  const q = query.trim()
  if (!q) return []
  const count = options.count ?? 5
  const context = options.context?.trim()
  const contextualQuery = context ? `${q}, ${context}` : q
  const cacheKey = `${contextualQuery}::${count}`
  const cached = geocodeCache.get(cacheKey)
  if (cached) return cached

  try {
    const contextualHits = await geocodeWithNominatim(contextualQuery, count, options.signal)
    if (contextualHits.length > 0) {
      geocodeCache.set(cacheKey, contextualHits)
      return contextualHits
    }

    if (context && contextualQuery !== q) {
      const directHits = await geocodeWithNominatim(q, count, options.signal)
      if (directHits.length > 0) {
        geocodeCache.set(cacheKey, directHits)
        return directHits
      }
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    // Nominatim can rate-limit or reject browser requests; fall back below.
  }

  const fallback = await geocodeWithOpenMeteo(contextualQuery, options.signal)
  if (fallback) {
    const hits = [fallback]
    geocodeCache.set(cacheKey, hits)
    return hits
  }

  if (context && contextualQuery !== q) {
    const directFallback = await geocodeWithOpenMeteo(q, options.signal)
    if (directFallback) {
      const hits = [directFallback]
      geocodeCache.set(cacheKey, hits)
      return hits
    }
  }

  geocodeCache.set(cacheKey, [])
  return []
}

async function geocodeWithNominatim(query: string, count: number, signal?: AbortSignal): Promise<GeocodeHit[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', String(count))
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('accept-language', 'en')
  const r = await fetch(url, { signal })
  if (!r.ok) throw new Error(`Nominatim geocode failed: ${r.status}`)
  const hits = (await r.json()) as Array<{
    display_name?: string
    name?: string
    lat: string
    lon: string
    address?: {
      country?: string
      state?: string
      province?: string
      region?: string
      city?: string
      town?: string
      village?: string
      county?: string
    }
  }>
  return hits.flatMap((hit) => {
    const lat = Number(hit.lat)
    const lng = Number(hit.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return []
    const address = hit.address ?? {}
    return [{
      name: hit.name || hit.display_name?.split(',')[0]?.trim() || query,
      country: address.country,
      admin1:
        address.state ??
        address.province ??
        address.region ??
        address.city ??
        address.town ??
        address.village ??
        address.county,
      lat,
      lng,
    }]
  })
}

async function geocodeWithOpenMeteo(query: string, signal?: AbortSignal): Promise<GeocodeHit | null> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', query)
  url.searchParams.set('count', '1')
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')
  const r = await fetch(url, { signal })
  if (!r.ok) return null
  const j = (await r.json()) as {
    results?: Array<{ name: string; country?: string; admin1?: string; latitude: number; longitude: number }>
  }
  const hit = j.results?.[0]
  if (!hit) return null
  return {
    name: hit.name,
    country: hit.country,
    admin1: hit.admin1,
    lat: hit.latitude,
    lng: hit.longitude,
  }
}

export interface DailyWeather {
  date: string // YYYY-MM-DD
  tempMax?: number
  tempMin?: number
  precipMm?: number
  precipProb?: number
  weatherCode?: number
  summary: string
}

const WEATHER_CODE_LABEL: Record<number, [string, string]> = {
  0: ['Clear', '晴'],
  1: ['Mainly clear', '多云转晴'],
  2: ['Partly cloudy', '局部多云'],
  3: ['Overcast', '阴'],
  45: ['Fog', '雾'],
  48: ['Rime fog', '雾凇'],
  51: ['Light drizzle', '小毛雨'],
  53: ['Drizzle', '毛雨'],
  55: ['Heavy drizzle', '强毛雨'],
  61: ['Light rain', '小雨'],
  63: ['Rain', '中雨'],
  65: ['Heavy rain', '大雨'],
  71: ['Light snow', '小雪'],
  73: ['Snow', '中雪'],
  75: ['Heavy snow', '大雪'],
  80: ['Showers', '阵雨'],
  81: ['Heavy showers', '强阵雨'],
  82: ['Violent showers', '暴雨'],
  95: ['Thunderstorm', '雷雨'],
  96: ['Thunder w/ hail', '雷雨伴冰雹'],
  99: ['Severe thunderstorm', '强雷暴'],
}

export function describeWeatherCode(code: number, locale: 'zh' | 'en'): string {
  const t = WEATHER_CODE_LABEL[code]
  if (!t) return locale === 'zh' ? '未知' : 'Unknown'
  return locale === 'zh' ? t[1] : t[0]
}

export async function fetchDailyForecast(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string,
  locale: 'zh' | 'en' = 'zh',
  signal?: AbortSignal,
): Promise<DailyWeather[]> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lng))
  url.searchParams.set('start_date', startDate)
  url.searchParams.set('end_date', endDate)
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max',
  )
  url.searchParams.set('timezone', 'auto')
  const r = await fetch(url, { signal })
  if (!r.ok) return []
  const j = (await r.json()) as {
    daily?: {
      time?: string[]
      weather_code?: number[]
      temperature_2m_max?: number[]
      temperature_2m_min?: number[]
      precipitation_sum?: number[]
      precipitation_probability_max?: number[]
    }
  }
  const d = j.daily
  if (!d?.time) return []
  const out: DailyWeather[] = []
  for (let i = 0; i < d.time.length; i++) {
    const code = d.weather_code?.[i]
    const label = code !== undefined ? describeWeatherCode(code, locale) : ''
    const tmax = d.temperature_2m_max?.[i]
    const tmin = d.temperature_2m_min?.[i]
    const pp = d.precipitation_probability_max?.[i]
    const summary = [
      label,
      tmax !== undefined && tmin !== undefined ? `${Math.round(tmin)}–${Math.round(tmax)}°C` : '',
      pp !== undefined ? `${locale === 'zh' ? '降水概率' : 'precip'} ${pp}%` : '',
    ]
      .filter(Boolean)
      .join(' · ')
    out.push({
      date: d.time[i],
      tempMax: tmax,
      tempMin: tmin,
      precipMm: d.precipitation_sum?.[i],
      precipProb: pp,
      weatherCode: code,
      summary,
    })
  }
  return out
}
