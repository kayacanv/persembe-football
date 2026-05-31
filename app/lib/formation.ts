// Free-form formation model for the Organize Teams page.
//
// A team is five horizontal lines (top -> bottom on that team's pitch):
//   FWD (forwards) · CAM (attacking mid) · MID (midfield) · CDM (defensive mid) · DEF (defense)
// Players flow freely between lines; within a line they auto-arrange SYMMETRICALLY
// (1 -> center, 2 -> left+right, 3 -> L/C/R, 4 -> evenly spread, ...).
//
// The exact spot of each player is persisted as field_x / field_y percentages
// (see add-field-coordinates.sql), so the formation reloads identically for everyone.

import type { PlayerWithDetails } from "@/app/lib/types"

export const BANDS = ["FWD", "CAM", "MID", "CDM", "DEF"] as const
export type BandId = (typeof BANDS)[number]
export type TeamSide = "A" | "B"
export type TeamShape = Record<BandId, PlayerWithDetails[]>

// Visual y-center (% from top) of each line on a team's pitch.
export const BAND_Y: Record<BandId, number> = {
  FWD: 13,
  CAM: 31,
  MID: 50,
  CDM: 69,
  DEF: 87,
}

// Locale-agnostic line abbreviations drawn faintly on the pitch (like the card's "ST"/"CB").
export const BAND_LABEL: Record<BandId, string> = {
  FWD: "FWD",
  CAM: "CAM",
  MID: "MID",
  CDM: "CDM",
  DEF: "DEF",
}

export function emptyShape(): TeamShape {
  return { FWD: [], CAM: [], MID: [], CDM: [], DEF: [] }
}

export function cloneShape(s: TeamShape): TeamShape {
  return { FWD: [...s.FWD], CAM: [...s.CAM], MID: [...s.MID], CDM: [...s.CDM], DEF: [...s.DEF] }
}

// Symmetric horizontal placement of the index-th of `count` players on a line.
// count=1 -> 50%; 2 -> 33/67; 3 -> 25/50/75; 4 -> 20/40/60/80.
export function bandX(index: number, count: number): number {
  return ((index + 1) / (count + 1)) * 100
}

export function shapePlayers(s: TeamShape): PlayerWithDetails[] {
  return BANDS.flatMap((b) => s[b])
}

export function shapeCount(s: TeamShape): number {
  return BANDS.reduce((n, b) => n + s[b].length, 0)
}

// Remove a player from every line of a shape (in place).
export function removeFromShape(s: TeamShape, playerId: string): void {
  for (const b of BANDS) {
    const i = s[b].findIndex((p) => p.id === playerId)
    if (i !== -1) s[b].splice(i, 1)
  }
}

// Nearest line to a stored y% (used when loading saved coordinates).
export function yToBand(y: number): BandId {
  let best: BandId = "MID"
  let bestD = Number.POSITIVE_INFINITY
  for (const b of BANDS) {
    const d = Math.abs(BAND_Y[b] - y)
    if (d < bestD) {
      bestD = d
      best = b
    }
  }
  return best
}

// Football-notation formation, defense first, only non-empty lines, e.g. "4-1-3-1".
export function formationString(s: TeamShape): string {
  const order: BandId[] = ["DEF", "CDM", "MID", "CAM", "FWD"]
  const counts = order.map((b) => s[b].length).filter((c) => c > 0)
  return counts.length ? counts.join("-") : "—"
}

// Legacy 1-9 slot index (old fixed 3x3 formation) -> line + x, so old saves still load.
// Old SAVE convention (team-actions): 1-3 DEF, 4-6 MID, 7-9 FWD; col = (pos-1) % 3.
export function legacyToBandX(pos: number): { band: BandId; x: number } {
  const band: BandId = pos <= 3 ? "DEF" : pos <= 6 ? "MID" : "FWD"
  const col = (pos - 1) % 3 // 0 left, 1 center, 2 right
  return { band, x: [25, 50, 75][col] }
}

// Rebuild a team's shape from persisted players (field_x/field_y first, legacy fallback).
export function shapeFromPlayers(players: PlayerWithDetails[], team: TeamSide): TeamShape {
  const entries: { player: PlayerWithDetails; band: BandId; x: number }[] = []
  for (const p of players) {
    if (p.team !== team) continue
    if (p.field_y != null) {
      entries.push({ player: p, band: yToBand(p.field_y), x: p.field_x ?? 50 })
    } else if (p.field_position && p.field_position > 0) {
      const { band, x } = legacyToBandX(p.field_position)
      entries.push({ player: p, band, x })
    } else {
      entries.push({ player: p, band: "MID", x: 50 })
    }
  }
  const shape = emptyShape()
  for (const b of BANDS) {
    shape[b] = entries
      .filter((e) => e.band === b)
      .sort((a, c) => a.x - c.x)
      .map((e) => e.player)
  }
  return shape
}

// Default auto layout for a team: place by preferred position, then balance DEF/MID/FWD
// to within one of each other (CAM/CDM are left for manual fine-tuning).
export function autoShape(players: PlayerWithDetails[]): TeamShape {
  const shape = emptyShape()
  const pref = (p: PlayerWithDetails): BandId => {
    if (p.position === "forvet") return "FWD"
    if (p.position === "defans" || p.position === "kaleci") return "DEF"
    return "MID"
  }
  // Stronger players first so they tend to land in the center of their line.
  ;[...players]
    .sort((a, b) => (b.power || 5) - (a.power || 5))
    .forEach((p) => shape[pref(p)].push(p))

  const tri: BandId[] = ["DEF", "MID", "FWD"]
  for (let guard = 0; guard < 30; guard++) {
    const counts = tri.map((b) => shape[b].length)
    const max = Math.max(...counts)
    const min = Math.min(...counts)
    if (max - min <= 1) break
    const moved = shape[tri[counts.indexOf(max)]].pop()
    if (!moved) break
    shape[tri[counts.indexOf(min)]].push(moved)
  }
  return shape
}

// Flat placement list for persistence. position is a non-zero line rank (1-5) kept only
// so the legacy column stays meaningful; field_x/field_y are the real source of truth.
export interface Placement {
  match_player_id: string
  team: TeamSide
  position: number
  field_x: number
  field_y: number
}

export function shapeToPlacements(shape: TeamShape, team: TeamSide): Placement[] {
  const out: Placement[] = []
  BANDS.forEach((band, bandIdx) => {
    const arr = shape[band]
    arr.forEach((player, i) => {
      out.push({
        match_player_id: player.match_player_id,
        team,
        position: bandIdx + 1, // 1..5 (FWD..DEF); legacy column, not used for layout
        field_x: Math.round(bandX(i, arr.length) * 10) / 10,
        field_y: BAND_Y[band],
      })
    })
  })
  return out
}
