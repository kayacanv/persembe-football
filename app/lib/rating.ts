// Player strength and play style for team building.
//
// Both come from the FIFA card for now (`card_overall`, `card_position`); the
// crowd-voted ratings in plan-ratings.md will replace the card overall here.

import type { User } from "./types"

const DEFAULT_OVERALL = 70

export function playerStrength(p: Pick<User, "card_overall">): number {
  return p.card_overall ?? DEFAULT_OVERALL
}

// Attack lean from the card position: 1 = pure defender … 5 = pure attacker.
const ATTACK_LEAN: Record<string, number> = {
  GK: 1,
  CB: 1,
  RB: 2,
  LB: 2,
  CDM: 2,
  RWB: 2.5,
  LWB: 2.5,
  CM: 3,
  RM: 3.5,
  LM: 3.5,
  CAM: 4,
  RW: 4.5,
  LW: 4.5,
  CF: 5,
  ST: 5,
}

export function attackLean(p: Pick<User, "card_position">): number {
  return ATTACK_LEAN[(p.card_position || "").toUpperCase()] ?? 3
}
