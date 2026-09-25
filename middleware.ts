import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

// Two jobs, in this order:
//  1. Fail loudly (in Turkish) when the Supabase env vars are missing — a
//     misconfigured deployment should not render a half-working app.
//  2. Refresh the auth session cookie on every request, so Server Components,
//     server actions and later RLS all see the same signed-in user. Signed-out
//     visitors keep working exactly as before; nothing here gates a route.
export async function middleware(request: NextRequest) {
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

  return updateSession(request, supabaseUrl, supabaseAnonKey)
}

// Official @supabase/ssr Next.js pattern: read cookies off the request, write any
// refreshed ones onto both the request (for this render) and the response (for
// the browser). getUser() is what actually triggers the refresh.
async function updateSession(request: NextRequest, supabaseUrl: string, supabaseAnonKey: string) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  try {
    await supabase.auth.getUser()
  } catch (error) {
    // A transient auth outage must never take the whole site down.
    console.error("Session refresh failed:", error)
  }

  return response
}

// Every page, so the session cookie stays fresh site-wide. Static assets are
// excluded because they cost a pointless auth round-trip, and /api with them:
// the webhooks and cron there authenticate themselves by signature or secret and
// must not be slowed down by a session refresh they never read. The PWA files
// (service worker, manifest, offline page) are static too.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
