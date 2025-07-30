import type { Match } from "./types"

// Mock data for matches
export const matches: Match[] = [
  {
    id: "1",
    date: "25.04.2024",
    time: "21:00",
    status: "registering",
    players: [
      { id: "1", name: "Ahmet Yılmaz", phone: "5551234567", position: "kaleci", hasPaid: false },
      { id: "2", name: "Mehmet Demir", phone: "5559876543", position: "defans", hasPaid: true },
      { id: "3", name: "Ali Kaya", phone: "5554567890", position: "orta saha", hasPaid: false },
      { id: "4", name: "Mustafa Çelik", phone: "5553456789", position: "forvet", hasPaid: true },
    ],
  },
  {
    id: "2",
    date: "18.04.2024",
    time: "21:00",
    status: "done",
    players: [
      { id: "1", name: "Ahmet Yılmaz", phone: "5551234567", position: "kaleci", hasPaid: true },
      { id: "2", name: "Mehmet Demir", phone: "5559876543", position: "defans", hasPaid: true },
      { id: "5", name: "Emre Şahin", phone: "5552345678", position: "orta saha", hasPaid: true },
      { id: "6", name: "Ozan Yıldız", phone: "5557654321", position: "forvet", hasPaid: false },
    ],
    teamA: [
      { id: "1", name: "Ahmet Yılmaz", phone: "5551234567", position: "kaleci", hasPaid: true },
      { id: "5", name: "Emre Şahin", phone: "5552345678", position: "orta saha", hasPaid: true },
    ],
    teamB: [
      { id: "2", name: "Mehmet Demir", phone: "5559876543", position: "defans", hasPaid: true },
      { id: "6", name: "Ozan Yıldız", phone: "5557654321", position: "forvet", hasPaid: false },
    ],
    scoreA: 3,
    scoreB: 2,
  },
  {
    id: "3",
    date: "11.04.2024",
    time: "21:00",
    status: "done",
    players: [
      { id: "2", name: "Mehmet Demir", phone: "5559876543", position: "defans", hasPaid: true },
      { id: "3", name: "Ali Kaya", phone: "5554567890", position: "orta saha", hasPaid: true },
      { id: "4", name: "Mustafa Çelik", phone: "5553456789", position: "forvet", hasPaid: true },
      { id: "7", name: "Burak Aydın", phone: "5558765432", position: "kaleci", hasPaid: true },
    ],
    teamA: [
      { id: "2", name: "Mehmet Demir", phone: "5559876543", position: "defans", hasPaid: true },
      { id: "4", name: "Mustafa Çelik", phone: "5553456789", position: "forvet", hasPaid: true },
    ],
    teamB: [
      { id: "3", name: "Ali Kaya", phone: "5554567890", position: "orta saha", hasPaid: true },
      { id: "7", name: "Burak Aydın", phone: "5558765432", position: "kaleci", hasPaid: true },
    ],
    scoreA: 1,
    scoreB: 4,
  },
]

// Helper function to get a match by ID
export function getMatchById(id: string): Match | undefined {
  return matches.find((match) => match.id === id)
}

// Helper function to get the next Thursday date
export function getNextThursday(): string {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 is Sunday, 4 is Thursday
  const daysUntilThursday = (4 + 7 - dayOfWeek) % 7
  const nextThursday = new Date(today)
  nextThursday.setDate(today.getDate() + daysUntilThursday)

  // Format date as DD.MM.YYYY
  return `${nextThursday.getDate().toString().padStart(2, "0")}.${(nextThursday.getMonth() + 1).toString().padStart(2, "0")}.${nextThursday.getFullYear()}`
}
