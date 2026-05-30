// Curated club list for the card "Takım" (team) picker.
// Logos bundled in /public/clubs/<slug>.png (from football-logos.cc).
// AUTO-GENERATED from the files in public/clubs — keep in sync if logos change.

export interface Club {
  slug: string
  name: string
  country: string
}

export const CLUBS: Club[] = [
  { slug: "basaksehir", name: "Başakşehir", country: "Türkiye" },
  { slug: "besiktas", name: "Beşiktaş", country: "Türkiye" },
  { slug: "eyupspor", name: "Eyüpspor", country: "Türkiye" },
  { slug: "fenerbahce", name: "Fenerbahçe", country: "Türkiye" },
  { slug: "galatasaray", name: "Galatasaray", country: "Türkiye" },
  { slug: "goztepe", name: "Göztepe", country: "Türkiye" },
  { slug: "kasimpasa", name: "Kasımpaşa", country: "Türkiye" },
  { slug: "konyaspor", name: "Konyaspor", country: "Türkiye" },
  { slug: "samsunspor", name: "Samsunspor", country: "Türkiye" },
  { slug: "trabzonspor", name: "Trabzonspor", country: "Türkiye" },
  { slug: "rizespor", name: "Çaykur Rizespor", country: "Türkiye" },
  { slug: "arsenal", name: "Arsenal", country: "İngiltere" },
  { slug: "aston-villa", name: "Aston Villa", country: "İngiltere" },
  { slug: "chelsea", name: "Chelsea", country: "İngiltere" },
  { slug: "everton", name: "Everton", country: "İngiltere" },
  { slug: "liverpool", name: "Liverpool", country: "İngiltere" },
  { slug: "manchester-city", name: "Manchester City", country: "İngiltere" },
  { slug: "manchester-united", name: "Manchester United", country: "İngiltere" },
  { slug: "newcastle", name: "Newcastle", country: "İngiltere" },
  { slug: "tottenham", name: "Tottenham", country: "İngiltere" },
  { slug: "athletic-bilbao", name: "Athletic Bilbao", country: "İspanya" },
  { slug: "atletico-madrid", name: "Atlético Madrid", country: "İspanya" },
  { slug: "barcelona", name: "Barcelona", country: "İspanya" },
  { slug: "real-betis", name: "Real Betis", country: "İspanya" },
  { slug: "real-madrid", name: "Real Madrid", country: "İspanya" },
  { slug: "real-sociedad", name: "Real Sociedad", country: "İspanya" },
  { slug: "sevilla", name: "Sevilla", country: "İspanya" },
  { slug: "valencia", name: "Valencia", country: "İspanya" },
  { slug: "villarreal", name: "Villarreal", country: "İspanya" },
  { slug: "atalanta", name: "Atalanta", country: "İtalya" },
  { slug: "fiorentina", name: "Fiorentina", country: "İtalya" },
  { slug: "inter", name: "Inter", country: "İtalya" },
  { slug: "juventus", name: "Juventus", country: "İtalya" },
  { slug: "lazio", name: "Lazio", country: "İtalya" },
  { slug: "milan", name: "Milan", country: "İtalya" },
  { slug: "napoli", name: "Napoli", country: "İtalya" },
  { slug: "roma", name: "Roma", country: "İtalya" },
  { slug: "bayer-leverkusen", name: "Bayer Leverkusen", country: "Almanya" },
  { slug: "bayern-munich", name: "Bayern Münih", country: "Almanya" },
  { slug: "borussia-dortmund", name: "Borussia Dortmund", country: "Almanya" },
  { slug: "eintracht-frankfurt", name: "Eintracht Frankfurt", country: "Almanya" },
  { slug: "rb-leipzig", name: "RB Leipzig", country: "Almanya" },
  { slug: "lille", name: "Lille", country: "Fransa" },
  { slug: "lyon", name: "Lyon", country: "Fransa" },
  { slug: "marseille", name: "Marseille", country: "Fransa" },
  { slug: "monaco", name: "Monaco", country: "Fransa" },
  { slug: "psg", name: "Paris Saint-Germain", country: "Fransa" },
  { slug: "ajax", name: "Ajax", country: "Hollanda" },
  { slug: "feyenoord", name: "Feyenoord", country: "Hollanda" },
  { slug: "psv", name: "PSV", country: "Hollanda" },
  { slug: "benfica", name: "Benfica", country: "Portekiz" },
  { slug: "porto", name: "Porto", country: "Portekiz" },
  { slug: "sporting", name: "Sporting CP", country: "Portekiz" },
]

/** Badge URL for a stored slug. We persist /clubs/<slug>.png in users.club_badge_url. */
export function clubLogoPath(slug: string): string {
  return `/clubs/${slug}.png`
}

/** Resolve a stored club_badge_url (bare slug OR /clubs/<slug>.png) to a Club. */
export function findClub(value?: string | null): Club | undefined {
  if (!value) return undefined
  const slug = value.replace(/^\/clubs\//, "").replace(/\.png$/, "")
  return CLUBS.find((c) => c.slug === slug)
}
