import { getSupabaseBrowserClient } from "./supabase"

const PLAYER_PHOTOS_BUCKET = "player-photos"

// Remove the background from an uploaded photo entirely in the browser (free, no API key)
// using @imgly/background-removal (WASM/ONNX). Returns a transparent PNG File ready to
// composite into the live card. On any failure it falls back to the ORIGINAL file so an
// upload never hard-fails. The model (~5MB) is fetched + cached on first use, hence the
// lazy dynamic import — only players who upload pay the cost.
export async function removeBackgroundToCutout(
  file: File,
  onProgress?: (stage: string, ratio: number) => void,
): Promise<File> {
  try {
    const { removeBackground } = await import("@imgly/background-removal")
    const blob = await removeBackground(file, {
      output: { format: "image/png" },
      progress: (key: string, current: number, total: number) => {
        if (onProgress && total > 0) onProgress(key, current / total)
      },
    })
    const baseName = file.name.replace(/\.[^.]+$/, "")
    // Downscale so the transparent PNG stays well under the 5MB bucket limit and the
    // card stays crisp (cards never render wider than ~560px).
    const sized = await downscalePng(blob, 720)
    return new File([sized], `${baseName}-cutout.png`, { type: "image/png" })
  } catch (e) {
    console.warn("Background removal failed; using original image:", e)
    return file
  }
}

// Downscale a PNG blob so its longest side is <= maxSize, preserving transparency.
// Returns the original blob unchanged if it's already small enough or on any error.
async function downscalePng(blob: Blob, maxSize: number): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(blob)
    const { width, height } = bitmap
    if (Math.max(width, height) <= maxSize) {
      bitmap.close()
      return blob
    }
    const scale = maxSize / Math.max(width, height)
    const w = Math.round(width * scale)
    const h = Math.round(height * scale)
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      bitmap.close()
      return blob
    }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
    return out ?? blob
  } catch (e) {
    console.warn("Cutout downscale failed; using full-size cutout:", e)
    return blob
  }
}

// Upload player photo to Supabase Storage
export async function uploadPlayerPhoto(userId: string, file: File): Promise<string | null> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return null
  }

  // Ensure unique file name, e.g., using user ID and timestamp
  const fileName = `${userId}-${Date.now()}.${file.name.split(".").pop()}`
  const filePath = `${fileName}` // Store directly in the bucket root or a subfolder like `public/${fileName}`

  try {
    const { data, error } = await supabase.storage.from(PLAYER_PHOTOS_BUCKET).upload(filePath, file, {
      cacheControl: "3600", // Cache for 1 hour
      upsert: true, // Overwrite if file with same name exists
    })

    if (error) {
      console.error("Error uploading photo to Supabase Storage:", error)
      throw error
    }

    // Get the public URL of the uploaded file
    const { data: publicUrlData } = supabase.storage.from(PLAYER_PHOTOS_BUCKET).getPublicUrl(data.path)

    if (!publicUrlData || !publicUrlData.publicUrl) {
      console.error("Error getting public URL for photo")
      return null
    }
    return publicUrlData.publicUrl
  } catch (error) {
    console.error("Upload failed:", error)
    return null
  }
}

// Delete player photo from Supabase Storage
export async function deletePlayerPhoto(photoPath: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return false
  }

  try {
    // Extract the file name/path from the full URL if necessary
    // Assuming photoPath is the direct path in the bucket like "userId-timestamp.jpg"
    const { error } = await supabase.storage.from(PLAYER_PHOTOS_BUCKET).remove([photoPath])

    if (error) {
      console.error("Error deleting photo from Supabase Storage:", error)
      return false
    }
    return true
  } catch (error) {
    console.error("Deletion failed:", error)
    return false
  }
}
