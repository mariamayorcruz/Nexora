import { NextRequest, NextResponse } from 'next/server';
import { hasTrackingSignals } from '@/lib/tracking';

const IGNORE_PREFIXES = ['/api', '/_next', '/favicon.ico'];

export function middleware(request: NextRequest) {
  const { nextUrl } = request;

  if (IGNORE_PREFIXES.some((prefix) => nextUrl.pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (nextUrl.pathname === '/api/tracking/capture') {
    return NextResponse.next();
  }

  if (nextUrl.searchParams.get('__trk') === '1') {
    return NextResponse.next();
  }

  if (!hasTrackingSignals(nextUrl)) {
    return NextResponse.next();
  }

  const forwardPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  const captureUrl = new URL('/api/tracking/capture', request.url);
  captureUrl.searchParams.set('next', forwardPath);
  captureUrl.searchParams.set('__trk', '1');

  return NextResponse.redirect(captureUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml|map)$).*)'],
};
