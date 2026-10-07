// Ofis koordinatalari [x, z]. Yer tekisligi XZ.
export const DESKS = {
  jarvis: [0, -3],
  music: [-4, 0],
  visual: [4, 0],
  seo: [0, 3],
}
export const SPOTS = {
  meeting: [0, -1],
  coffee: [-6, -5],
  lounge: [6, 5],
}
export const ROOM = { w: 16, d: 14 }

// Agent uchun nuqta: ish stoli yonida (stul) yoki boshqa joy
export function deskSeat(id) {
  const [x, z] = DESKS[id] ?? [0, 0]
  return [x, z + 1.1]
}
export function resolveLocation(id, location, wanderSpot) {
  if (location === 'desk') return deskSeat(id)
  if (location === 'meeting') return SPOTS.meeting
  if (location === 'free') return wanderSpot ?? deskSeat(id)
  return deskSeat(id)
}
