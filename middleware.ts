// middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  // 1. Feature Flag: Easily turn off the splash page later
  if (process.env.NEXT_PUBLIC_IS_COMING_SOON !== 'true') {
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl

  // 2. Define paths that should always be accessible
  const isPublicResource = 
    pathname.startsWith('/coming-soon') ||
    pathname.startsWith('/login') || // Allow access to login page for admins to sign in
    pathname.startsWith('/auth') ||  // Allow Supabase auth webhooks/callbacks
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.match(/\.(png|jpg|jpeg|svg|gif|webp)$/);

  if (isPublicResource) {
    return NextResponse.next()
  }

  // 3. Initialize Supabase to check the user's session securely
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // 4. Admin Verification
  // If you use a specific metadata field for admins, check it here:
  // const isAdmin = user?.user_metadata?.role === 'admin';
  
  if (!user) {
    // If no user is logged in (or not an admin), redirect to splash page
    const url = request.nextUrl.clone()
    url.pathname = '/coming-soon'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  // Apply middleware to all routes except standard static files
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}