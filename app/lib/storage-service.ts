import { getSupabaseBrowserClient } from "./supabase"

const PLAYER_PHOTOS_BUCKET = "player-photos"

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
