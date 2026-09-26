"use client"

// Search box that suggests players as you type and opens the picked player's
// profile. Matching ignores case and accents, so "cagri" finds "Çağrı".

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { getPlayerDirectory } from "@/app/lib/data-service"
import type { User } from "@/app/lib/types"
import { useTranslation } from "@/lib/i18n/useTranslation"

type Player = Pick<User, "id" | "name" | "photo_url">

type IndexedPlayer = Player & {
  chars: string[] // the name, one entry per character
  folded: string // fold(name)
  origin: number[] // origin[i] = index in `chars` that folded[i] came from
}

type Result = { player: IndexedPlayer; start: number; end: number } // matched chars: [start, end)

const MAX_RESULTS = 8

// Lower-case, strip accents and map the dotless ı, so the Turkish letters match
// their plain Latin look-alikes on any keyboard: Ç→c, Ğ→g, İ/ı→i, Ö→o, Ş→s, Ü→u.
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .toLowerCase()
}

// Folded one character at a time, so a match in the folded name can be mapped
// back to the original characters and highlighted.
function indexPlayer(player: Player): IndexedPlayer {
  const chars = Array.from(player.name.normalize("NFC"))
  let folded = ""
  const origin: number[] = []
  chars.forEach((char, i) => {
    const f = fold(char)
    folded += f
    for (let k = 0; k < f.length; k++) origin.push(i)
  })
  return { ...player, chars, folded, origin }
}

// Rank 0: the name starts with the query. 1: a later word does ("yil" finds
// "Ahmet Yılmaz"). 2: the query appears anywhere else in the name.
function findMatch(name: string, query: string): { rank: number; at: number } | null {
  let inside = -1
  for (let at = name.indexOf(query); at >= 0; at = name.indexOf(query, at + 1)) {
    if (at === 0) return { rank: 0, at }
    if (!/[\p{L}\p{N}]/u.test(name[at - 1])) return { rank: 1, at }
    if (inside < 0) inside = at
  }
  return inside < 0 ? null : { rank: 2, at: inside }
}

function searchPlayers(players: IndexedPlayer[], rawQuery: string): Result[] {
  const query = fold(rawQuery.trim().replace(/\s+/g, " "))
  if (!query) return []

  const matches: Array<Result & { rank: number }> = []
  for (const player of players) {
    const match = findMatch(player.folded, query)
    if (!match) continue
    matches.push({
      player,
      rank: match.rank,
      start: player.origin[match.at],
      end: player.origin[match.at + query.length - 1] + 1,
    })
  }

  return matches
    .sort((a, b) => a.rank - b.rank || a.player.name.localeCompare(b.player.name, "tr"))
    .slice(0, MAX_RESULTS)
}

export function PlayerSearch({ className }: { className?: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const [players, setPlayers] = useState<IndexedPlayer[] | null>(null)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  useEffect(() => {
    let alive = true
    getPlayerDirectory()
      .then((rows) => alive && setPlayers(rows.map(indexPlayer)))
      .catch((error) => console.error("Error loading player directory:", error))
    return () => {
      alive = false
    }
  }, [])

  const results = useMemo(() => (players ? searchPlayers(players, query) : []), [players, query])
  const showDropdown = open && query.trim().length > 0
  const showList = showDropdown && results.length > 0

  // Keep the keyboard-highlighted row visible when the list scrolls.
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" })
  }, [active])

  function updateQuery(next: string) {
    setQuery(next)
    setActive(0)
    setOpen(true)
  }

  function openProfile(player: Player) {
    setQuery("")
    setOpen(false)
    inputRef.current?.blur()
    router.push(`/profile/${player.id}`)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (results.length === 0) return
      e.preventDefault()
      setOpen(true)
      const step = e.key === "ArrowDown" ? 1 : -1
      setActive((i) => (i + step + results.length) % results.length)
    } else if (e.key === "Enter") {
      if (showList && results[active]) {
        e.preventDefault()
        openProfile(results[active].player)
      }
    } else if (e.key === "Escape") {
      if (showDropdown) setOpen(false)
      else updateQuery("")
    }
  }

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={t("playerSearch.label")}
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        value={query}
        onChange={(e) => updateQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        placeholder={t("playerSearch.placeholder")}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        className={cn("pl-9", query && "pr-9")}
      />
      {query && (
        <button
          type="button"
          aria-label={t("playerSearch.clear")}
          // Keep focus in the input so the user can type again straight away.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => updateQuery("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          {showList ? (
            <ul ref={listRef} id={listId} role="listbox" className="max-h-80 overflow-y-auto p-1">
              {results.map(({ player, start, end }, i) => (
                <li
                  key={player.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  // mousedown would blur the input and close the list before the click lands.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseMove={() => setActive(i)}
                  onClick={() => openProfile(player)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                    i === active && "bg-accent text-accent-foreground",
                  )}
                >
                  {player.photo_url ? (
                    <img
                      src={player.photo_url}
                      alt=""
                      loading="lazy"
                      className="h-7 w-7 shrink-0 rounded-full bg-muted object-cover object-top"
                    />
                  ) : (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {player.name.charAt(0).toLocaleUpperCase("tr-TR")}
                    </span>
                  )}
                  <span className="min-w-0 truncate">
                    {player.chars.slice(0, start).join("")}
                    <mark className="bg-transparent font-semibold text-inherit">
                      {player.chars.slice(start, end).join("")}
                    </mark>
                    {player.chars.slice(end).join("")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p role="status" className="px-3 py-2 text-sm text-muted-foreground">
              {players ? t("common.playerNotFound") : t("common.loading")}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
