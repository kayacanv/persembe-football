"use client"

import { useEffect, useRef, useState } from "react"

// A piggy bank that fills with gold as contributions land.
//
// The silhouette is a set of overlapping primitives (body, snout, ear, legs)
// drawn three times:
//   1. "rim"  — every shape fat-stroked in a dark pink, which unions them into a
//              single outline. Drawing a stroke per shape instead would leave
//              internal lines criss-crossing the pig.
//   2. "body" — the same shapes filled flat, covering the rim's interior and
//              leaving only the outer edge showing.
//   3. clip   — the same shapes as a clip path, so the gold can only ever appear
//              inside the pig.

type PiggyBankProps = {
  /** 0–1. Values above 1 are clamped. */
  progress: number
  /** Bumping this number drops a coin into the slot (e.g. a new contribution). */
  coinTrigger?: number
  className?: string
}

// Fill level in viewBox units: 196 is just below the pig's feet (so nothing
// shows at 0%), 52 is the top of its back.
const EMPTY_Y = 196
const FULL_Y = 52

const RIM_WIDTH = 11

function PigShapes({ variant }: { variant: "rim" | "body" | "clip" }) {
  const p =
    variant === "rim"
      ? {
          strokeWidth: RIM_WIDTH,
          strokeLinejoin: "round" as const,
          className: "fill-pink-500 stroke-pink-500 dark:fill-pink-600 dark:stroke-pink-600",
        }
      : variant === "body"
        ? { className: "fill-pink-200 dark:fill-pink-900" }
        : { fill: "black" }

  return (
    <>
      {/* legs */}
      <rect x="44" y="148" width="27" height="46" rx="10" {...p} />
      <rect x="84" y="148" width="27" height="46" rx="10" {...p} />
      <rect x="124" y="148" width="27" height="46" rx="10" {...p} />
      <rect x="158" y="148" width="27" height="46" rx="10" {...p} />
      {/* ear — a floppy triangle over the head, leaning towards the snout */}
      <path d="M152 68 C154 40 184 32 190 54 C194 72 172 80 152 68 Z" {...p} />
      {/* body */}
      <ellipse cx="110" cy="112" rx="84" ry="58" {...p} />
      {/* snout */}
      <ellipse cx="196" cy="124" rx="28" ry="22" {...p} />
    </>
  )
}

export function PiggyBank({ progress, coinTrigger = 0, className }: PiggyBankProps) {
  const clamped = Math.max(0, Math.min(1, progress))
  const liquidY = EMPTY_Y - clamped * (EMPTY_Y - FULL_Y)

  const [wobbling, setWobbling] = useState(false)
  const [coinKey, setCoinKey] = useState(0)
  const firstRender = useRef(true)

  // Drop a coin whenever the trigger changes — but not on first paint, where it
  // would fire for money that arrived days ago.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    setCoinKey((k) => k + 1)
  }, [coinTrigger])

  const poke = () => {
    setWobbling(true)
    setCoinKey((k) => k + 1)
    window.setTimeout(() => setWobbling(false), 700)
  }

  return (
    <svg
      viewBox="0 0 240 210"
      className={`${className ?? ""} ${wobbling ? "piggy-wobble" : ""} cursor-pointer select-none`}
      style={{ transformOrigin: "50% 80%" }}
      onClick={poke}
      role="img"
      aria-label={`${Math.round(clamped * 100)}%`}
    >
      <defs>
        <clipPath id="piggy-clip">
          <PigShapes variant="clip" />
        </clipPath>
        <linearGradient id="piggy-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="55%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <radialGradient id="piggy-coin-fill">
          <stop offset="0%" stopColor="#FEF3C7" />
          <stop offset="100%" stopColor="#F59E0B" />
        </radialGradient>
      </defs>

      {/* Tail: a stroked curl, deliberately outside the silhouette so the gold
          never seeps into it. */}
      <path
        d="M34 96 c-22 -10 -34 8 -21 18 c11 8 21 -5 12 -13"
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
        className="stroke-pink-500 dark:stroke-pink-600"
      />

      <PigShapes variant="rim" />
      <PigShapes variant="body" />

      {/* Everything gold is confined to the pig's outline. */}
      <g clipPath="url(#piggy-clip)">
        <g
          style={{
            transform: `translateY(${liquidY}px)`,
            transition: "transform 900ms cubic-bezier(0.34, 1.15, 0.64, 1)",
          }}
        >
          <g className="piggy-wave">
            <path
              d="M-40 0 q34 -15 68 0 t68 0 t68 0 t68 0 t68 0 t68 0 t68 0 L436 320 L-40 320 Z"
              fill="url(#piggy-gold)"
            />
            {/* Coin texture, so the gold reads as a pile of change, not paint. */}
            {[
              [50, 34],
              [104, 60],
              [158, 38],
              [76, 98],
              [140, 112],
              [96, 146],
              [170, 86],
            ].map(([cx, cy]) => (
              <circle
                key={`${cx}-${cy}`}
                cx={cx}
                cy={cy}
                r="11"
                fill="url(#piggy-coin-fill)"
                opacity="0.5"
              />
            ))}
          </g>
        </g>
      </g>

      {/* Coin slot */}
      <rect
        x="72"
        y="58"
        width="56"
        height="11"
        rx="5.5"
        transform="rotate(-7 100 63)"
        className="fill-pink-700 dark:fill-pink-950"
      />

      {/* The falling coin, re-mounted on every trigger so the animation replays. */}
      {coinKey > 0 && (
        <g key={coinKey} className="piggy-coin" style={{ transformOrigin: "100px 34px" }}>
          <circle cx="100" cy="34" r="13" fill="url(#piggy-coin-fill)" stroke="#D97706" strokeWidth="2" />
          <text x="100" y="40" textAnchor="middle" fontSize="15" fontWeight="700" fill="#B45309">
            £
          </text>
        </g>
      )}

      {/* Eye */}
      <circle cx="170" cy="102" r="6.5" className="fill-pink-900 dark:fill-pink-950" />
      <circle cx="172" cy="100" r="2.2" fill="white" />

      {/* Nostrils */}
      <ellipse cx="192" cy="120" rx="3.6" ry="5.2" className="fill-pink-700 dark:fill-pink-950" />
      <ellipse cx="205" cy="126" rx="3.6" ry="5.2" className="fill-pink-700 dark:fill-pink-950" />
    </svg>
  )
}
