// proxy.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const { pathname } = request.nextUrl

  // 1. Define paths that bypass the splash page
  const isPublicResource = 
    pathname.startsWith('/coming-soon') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') || 
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.match(/\.(png|jpg|jpeg|svg|gif|webp)$/);

  const cookieStore = await request.cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({ name, value, ...options })
            response = NextResponse.next({
              request: { headers: request.headers },
            })
            response.cookies.set({ name, value, ...options })
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isComingSoon = process.env.NEXT_PUBLIC_IS_COMING_SOON === 'true'
  
  if (isComingSoon && !isPublicResource) {
    // Safely parse a comma-separated list of emails from your environment variables
    const adminEmailsString = process.env.ADMIN_EMAILS || ''
    const adminEmails = adminEmailsString.split(',').map(email => email.trim().toLowerCase())
    
    const userEmail = user?.email?.toLowerCase() || ''
    const isEmailAdmin = adminEmails.includes(userEmail)
    const isMetadataAdmin = user?.user_metadata?.role === 'admin'
    const isAppMetadataAdmin = user?.app_metadata?.role === 'admin'

    const isAdmin = isEmailAdmin || isMetadataAdmin || isAppMetadataAdmin

    // Redirect if not logged in at all, OR if logged in but not an admin
    if (!user || !isAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = '/coming-soon'
      return NextResponse.redirect(url)
    }
  }

  // Standard Route Protection
  const isProtectedPath = pathname.startsWith('/dashboard') || pathname.startsWith('/create')
  if (isProtectedPath && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}