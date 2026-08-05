import { createRemoteJWKSet, jwtVerify } from 'jose'
import { findOrCreateSsoUser, signSessionCookieValue, validateReturnTo, type SsoIdentity } from '../utils/sso'

// GET /api/sso — Zero-click Supabase SSO token exchange endpoint.
//
// Converts a Supabase JWT (passed via ?token=... or ?jwt=...) into a signed
// FeedLog web session cookie and redirects the user directly to the feedback board.
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const returnTo = validateReturnTo(event, typeof query.return_to === 'string' ? query.return_to : undefined)

  const token = (typeof query.token === 'string' ? query.token : (typeof query.jwt === 'string' ? query.jwt : '')).trim()
  if (!token) {
    throw createError({ statusCode: 400, message: 'Missing token parameter' })
  }

  const supabaseRef = process.env.SUPABASE_PROJECT_REF
  if (!supabaseRef && !process.env.SUPABASE_JWKS_URL) {
    throw createError({ statusCode: 500, message: 'SUPABASE_PROJECT_REF is not configured' })
  }

  try {
    const jwksUrl = process.env.SUPABASE_JWKS_URL
      || `https://${supabaseRef}.supabase.co/auth/v1/.well-known/jwks.json`
    const JWKS = createRemoteJWKSet(new URL(jwksUrl))

    const { payload } = await jwtVerify(token, JWKS)

    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
    if (!email || !email.includes('@')) {
      throw createError({ statusCode: 400, message: 'Supabase JWT must contain a valid email' })
    }

    const userMetadata = (payload.user_metadata as Record<string, unknown> | undefined) ?? {}
    const identity: SsoIdentity = {
      email,
      name: typeof userMetadata.full_name === 'string' && userMetadata.full_name.trim()
        ? userMetadata.full_name.trim()
        : (typeof userMetadata.name === 'string' && userMetadata.name.trim()
            ? userMetadata.name.trim()
            : (typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : email.split('@')[0])),
      image: typeof userMetadata.avatar_url === 'string' && userMetadata.avatar_url
        ? userMetadata.avatar_url
        : (typeof userMetadata.picture === 'string' && userMetadata.picture
            ? userMetadata.picture
            : (typeof payload.picture === 'string' ? payload.picture : null)),
    }

    const db = useDB()
    const userId = await findOrCreateSsoUser(db, identity)

    // Mint FeedLog BetterAuth session
    const ctx = await auth.$context
    const sessionRow = await ctx.internalAdapter.createSession(userId, false)
    if (!sessionRow?.token) {
      throw createError({ statusCode: 500, message: 'Failed to create session' })
    }

    // Set signed session cookie
    const cookie = ctx.authCookies.sessionToken
    const value = await signSessionCookieValue(sessionRow.token, ctx.secret)
    const rawSameSite = cookie.attributes.sameSite
    const sameSite = typeof rawSameSite === 'string'
      ? (rawSameSite.toLowerCase() as 'lax' | 'strict' | 'none')
      : rawSameSite

    setCookie(event, cookie.name, value, {
      httpOnly: cookie.attributes.httpOnly,
      sameSite,
      path: cookie.attributes.path ?? '/',
      secure: cookie.attributes.secure,
      maxAge: ctx.sessionConfig.expiresIn,
    })

    // Invalidate stale data cookie cache if present
    const dataCookie = ctx.authCookies.sessionData
    const dataRawSameSite = dataCookie.attributes.sameSite
    const dataSameSite = typeof dataRawSameSite === 'string'
      ? (dataRawSameSite.toLowerCase() as 'lax' | 'strict' | 'none')
      : dataRawSameSite
    const dataDeleteOpts = {
      path: dataCookie.attributes.path ?? '/',
      secure: dataCookie.attributes.secure,
      httpOnly: dataCookie.attributes.httpOnly,
      sameSite: dataSameSite,
    }
    const dataCookieName = dataCookie.name
    for (const name of Object.keys(parseCookies(event))) {
      if (name === dataCookieName || name.startsWith(`${dataCookieName}.`)) {
        deleteCookie(event, name, dataDeleteOpts)
      }
    }

    return sendRedirect(event, returnTo, 302)
  }
  catch (err) {
    console.warn('[sso] token exchange failed:', (err as Error)?.message ?? err)
    throw createError({ statusCode: 401, message: 'Invalid or expired SSO token' })
  }
})
