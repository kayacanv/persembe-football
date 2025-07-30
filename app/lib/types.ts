export type MatchStatus = "registering" | "ready" | "done"
export type Position = "kaleci" | "defans" | "orta saha" | "forvet" | ""
export type Team = "A" | "B" | null
export type PlayerStatus = "active" | "waitlist" | "canceled"

export type User = {
  id: string
  name: string
  phone: string
  email?: string
  position: Position
  confirmed: boolean
  power: number // Power rating from 1-10
  position_weight: number // Attack tendency from 1-5 (1=defend, 5=attack)
  photo_url?: string | null // URL for the player's photo
  created_at?: string
}

export type Match = {
  id: string
  date: string
  time: string
  status: MatchStatus
  price: number // Price in decimal pounds (e.g., 7.50)
  score_a?: number | null
  score_b?: number | null
  created_at?: string
}

export type MatchPlayer = {
  id: string
  match_id: string
  user_id: string
  has_paid: boolean
  team: Team
  status: PlayerStatus
  position: number // Position number (0-8), 0 means unassigned
  registration_date: string
  cancellation_date?: string | null
  created_at?: string
  // Joined fields from User
  user?: User
}

// Combined type for UI display
export type PlayerWithDetails = User & {
  has_paid: boolean
  team: Team
  match_player_id: string
  status: PlayerStatus
  field_position: number // Position number (0-8), 0 means unassigned
  registration_date: string
  cancellation_date?: string | null
  waitlist_position?: number
}

// Player match summary for profile page
export type PlayerMatchSummary = {
  matchId: string
  date: string
  time: string
  team: Team
  hasPaid: boolean
  result: "win" | "loss" | "unknown"
  score: string | null
}

// Player statistics for profile page
export type PlayerStats = {
  totalMatches: number
  wins: number
  losses: number
  winRate: number
  teamAMatches: number
  teamAWins: number
  teamAWinRate: number
  teamBMatches: number
  teamBWins: number
  teamBWinRate: number
}

// Teammate statistics for profile page
export type TeammateStats = {
  userId: string
  name: string
  matchesPlayedTogether: number
  winsTogether: number
  lossesTogether: number
  winRateTogether: number
  matchesPlayedAgainst: number
  winsAgainst: number // Primary player's wins when playing against this user
  lossesAgainst: number // Primary player's losses when playing against this user
  winRateAgainst: number // Primary player's win rate when playing against this user
}

// Player ranking statistics for home page
export type PlayerRankingStats = {
  userId: string
  name: string
  totalMatches: number
  wins: number
  winRate: number
}
