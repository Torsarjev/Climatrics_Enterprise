import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  if (req.cookies.get('clima_session')) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith('/api/')) return new NextResponse('Unauthorised', { status: 401 });
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = { matcher: ['/((?!login|api/health|_next|favicon.ico).*)'] };
