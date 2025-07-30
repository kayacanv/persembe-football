import Image from "next/image"
import { ImageIcon } from "lucide-react" // Using ImageIcon for placeholder

interface PlayerPhotoCardProps {
  name: string
  photoUrl?: string | null
}

// Aspect ratio for the card: 560 / 782 = 0.716
const CARD_ASPECT_RATIO = 560 / 782

export default function PlayerPhotoCard({ name, photoUrl }: PlayerPhotoCardProps) {
  return (
    <div className="w-full max-w-[280px] mx-auto rounded-lg overflow-hidden ">
      {/* This div will have the background color that shows through transparent PNG parts */}
      <div
        style={{ aspectRatio: `${CARD_ASPECT_RATIO}` }}
        className="relative bg-background flex items-center justify-center" // Use theme's background color
      >
        {photoUrl ? (
          <Image
            src={photoUrl || "/placeholder.svg"}
            alt={`${name}'s photo card`}
            layout="fill"
            objectFit="contain" // Ensures the entire image is visible, respecting transparency
          />
        ) : (
          // Simple placeholder if no photo is available
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/50">
            <ImageIcon className="w-16 h-16 opacity-50" />
            <p className="mt-2 text-sm">Fotoğraf Yok</p>
          </div>
        )}
      </div>
    </div>
  )
}
