// lib/membership.js
// The board is for residents only. Everyone in the community group chat gets
// one shared passcode (COMMUNITY_PASSCODE). Entering it once sets a signed,
// HttpOnly cookie that lasts 180 days.
//
// The signing key is derived from the passcode itself, so changing the
// passcode (e.g. after it leaks outside the group) signs everyone out.
// Anyone who knows the passcode could forge a cookie, but they could also
// just type the passcode, so that costs nothing.
//
// With COMMUNITY_PASSCODE unset the gate is off and the board is public.

const crypto = require('crypto');

const COOKIE = 'carpool_member';
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

// Trimmed like the typed passcode: `echo … | vercel env add` stores a trailing newline.
function passcode() {
  return (process.env.COMMUNITY_PASSCODE || '').trim();
}

function gateEnabled() {
  return passcode().length > 0;
}

function signingKey() {
  return crypto.createHash('sha256').update(`carpool-member:${passcode()}`).digest();
}

function sign(issuedAt) {
  return crypto.createHmac('sha256', signingKey()).update(`member:${issuedAt}`).digest('base64url');
}

function sameString(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

function passcodeMatches(supplied) {
  return gateEnabled() && typeof supplied === 'string' && sameString(supplied.trim(), passcode());
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function isMember(req) {
  if (!gateEnabled()) return true;
  const value = readCookie(req, COOKIE);
  if (!value) return false;
  const [issuedAt, signature] = value.split('.');
  const age = Date.now() / 1000 - Number(issuedAt);
  if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_SECONDS) return false;
  return typeof signature === 'string' && sameString(signature, sign(issuedAt));
}

function cookieAttributes(maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

function setMemberCookie(res) {
  const issuedAt = Math.floor(Date.now() / 1000);
  res.append('Set-Cookie', `${COOKIE}=${issuedAt}.${sign(issuedAt)}; ${cookieAttributes(MAX_AGE_SECONDS)}`);
}

function clearMemberCookie(res) {
  res.append('Set-Cookie', `${COOKIE}=; ${cookieAttributes(0)}`);
}

function requireMember(req, res, next) {
  if (isMember(req)) return next();
  res.status(401).json({ error: 'Enter the community passcode first.', code: 'PASSCODE_REQUIRED' });
}

module.exports = { gateEnabled, passcodeMatches, isMember, setMemberCookie, clearMemberCookie, requireMember };
