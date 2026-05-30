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
  result: "win" | "draw" | "loss" | "unknown"
  score: string | null
}

// Player statistics for profile page
export type PlayerStats = {
  totalMatches: number
  wins: number
  draws: number
  losses: number
  winRate: number
  teamAMatches: number
  teamAWins: number
  teamADraws: number
  teamAWinRate: number
  teamBMatches: number
  teamBWins: number
  teamBDraws: number
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
  draws: number
  losses: number
  winRate: number
}

// MVP (man of the match) voting

export type MvpVote = {
  id: string
  match_id: string
  candidate_id: string
  device_id: string
  created_at?: string
}

// Computed voting window for a match (see mvp-service.ts)
export type VotingWindow = {
  openAt: Date
  closeAt: Date
  isOpen: boolean // voting currently accepting votes
  isClosed: boolean // window passed, result is final
}

// A single candidate's tally within a match
export type MvpVoteCount = {
  candidateId: string
  name: string
  photo_url?: string | null
  votes: number
}

// Winner summary for a match (null if no votes were cast)
export type MvpWinner = {
  candidateId: string
  name: string
  photo_url?: string | null
  votes: number
}
