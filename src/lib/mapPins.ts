import L from 'leaflet'

export const MAP_PIN_COLORS = {
  brand: '#bf7185',
  blue: '#a99fbf',
  green: '#8aa99a',
  amber: '#d3968c',
  red: '#b85d6b',
  pink: '#e0998b',
  indigo: '#806c79',
  teal: '#bb99bf',
  gray: '#c1a0ac',
} as const

export const DAY_PIN_PALETTE = [
  MAP_PIN_COLORS.brand,
  MAP_PIN_COLORS.blue,
  MAP_PIN_COLORS.green,
  MAP_PIN_COLORS.amber,
  MAP_PIN_COLORS.red,
  MAP_PIN_COLORS.pink,
  MAP_PIN_COLORS.indigo,
  MAP_PIN_COLORS.teal,
]

function svgPin(color: string, n?: number) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 38' width='28' height='38'>
      <path d='M14 0C6.27 0 0 6.27 0 14c0 9.92 14 24 14 24s14-14.08 14-24C28 6.27 21.73 0 14 0z' fill='${color}'/>
      ${n !== undefined ? `<circle cx='14' cy='14' r='8' fill='white'/><text x='14' y='17.5' text-anchor='middle' font-family='-apple-system,system-ui,sans-serif' font-size='11' font-weight='700' fill='${color}'>${n}</text>` : `<circle cx='14' cy='14' r='5' fill='white'/>`}
    </svg>`,
  )}`
}

export function makeMapPinIcon(color: string, n?: number) {
  return L.icon({
    iconUrl: svgPin(color, n),
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -34],
  })
}
