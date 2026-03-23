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

  // 1. Define paths that should always bypass the "Coming Soon" block
  const isPublicResource = 
    pathname.startsWith('/coming-soon') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.match(/\.(png|jpg|jpeg|svg|gif|webp)$/);

  // 2. Initialize Supabase and await cookies
  const cookieStore = await request.cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
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

  // Verify the secure session
  const { data: { user } } = await supabase.auth.getUser()

  // 3. Splash Page Logic (Controlled by Vercel Environment Variable)
  const isComingSoon = process.env.NEXT_PUBLIC_IS_COMING_SOON === 'true'
  
  if (isComingSoon && !isPublicResource) {
    // Determine if the current user has the admin role
    const isAdmin = user?.user_metadata?.role === 'admin'

    // Redirect to splash page if there is no user, OR if the user is not an admin
    if (!user || !isAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = '/coming-soon'
      return NextResponse.redirect(url)
    }
  }

  // 4. Standard Route Protection (Always runs, regardless of Coming Soon status)
  const isProtectedPath = pathname.startsWith('/dashboard') || pathname.startsWith('/create')
  
  if (isProtectedPath && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  // Update the matcher to intercept all routes so the splash page works globally, 
  // but explicitly ignore static build files and images to save server execution time.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}