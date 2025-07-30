import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Check if the required environment variables are available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase environment variables are missing")

    // Return a simple error page
    return new NextResponse(
      `<!DOCTYPE html>
      <html lang="tr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Yapılandırma Hatası</title>
          <style>
            body { font-family: system-ui, sans-serif; line-height: 1.5; padding: 2rem; max-width: 40rem; margin: 0 auto; }
            .error { background-color: #fee2e2; border: 1px solid #ef4444; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; }
            h1 { color: #111827; }
            pre { background-color: #f3f4f6; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
          </style>
        </head>
        <body>
          <h1>Yapılandırma Hatası</h1>
          <div class="error">
            <p><strong>Hata:</strong> Supabase yapılandırması eksik.</p>
          </div>
          <p>Lütfen aşağıdaki ortam değişkenlerinin doğru yapılandırıldığından emin olun:</p>
          <pre>NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY</pre>
          <p>Bu değişkenler Vercel projenizin ortam değişkenleri bölümünde ayarlanmalıdır.</p>
        </body>
      </html>`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/html",
        },
      },
    )
  }

  return NextResponse.next()
}

// Only run the middleware on the home page and match pages
export const config = {
  matcher: ["/", "/match/:path*"],
}
