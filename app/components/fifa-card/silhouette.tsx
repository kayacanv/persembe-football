// Neutral footballer silhouette shown when a player has no photo.
// Original artwork (simple head + torso shape), tinted per card tier via the `color` prop.
// Reads as an intentional "no image" state rather than a broken image.

interface SilhouetteProps {
  color?: string
  className?: string
}

export default function Silhouette({ color = "rgba(0,0,0,0.4)", className }: SilhouetteProps) {
  return (
    <svg
      viewBox="0 0 120 150"
      className={className}
      fill={color}
      aria-hidden="true"
      preserveAspectRatio="xMidYMax meet"
    >
      {/* head */}
      <circle cx="60" cy="42" r="24" />
      {/* shoulders / torso */}
      <path d="M60 70c-26 0-46 17-50 44-1 6 0 36 0 36h100s1-30 0-36c-4-27-24-44-50-44z" />
    </svg>
  )
}
