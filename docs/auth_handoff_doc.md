# Carpool App: Authentication Implementation Hand-off

**Date Created:** November 4, 2025  
**Current Status:** Pre-authentication (manual user creation per ride post)  
**Next Phase:** Username + Password + Community Code authentication  
**Target Tool:** Claude Code (CLI agentic coding assistant)

---

## 🎯 Implementation Goal

Add **persistent identity authentication** to the carpool app so users:
- Create one account per community with username + password + community code
- Login once and post multiple rides without re-entering contact info
- Build trust through consistent identity (usernames visible to community members)
- Maintain complete data isolation between communities

---

## 📊 Current State

### Application Architecture
- **Type:** Node.js/Express web app
- **Database:** PostgreSQL on Render.com
- **Frontend:** Vanilla JavaScript (no framework)
- **Templating:** Currently static HTML (moving to EJS for script injection)
- **Deployment:** Render.com with GitHub auto-deploy
- **Repository:** [Your GitHub repo URL here]

### Current User Flow (Pre-Auth)
```
1. User visits site
2. Fills "Post a Ride" form
   - Name (re-entered each time)
   - Contact method + info (re-entered each time)
   - Ride details
3. System creates user + ride post
4. No persistent identity
```

### Database Schema Status
- ✅ Community isolation implemented (`community_code` in all tables)
- ✅ `users` table has contact info fields
- ❌ No `username`, `password_hash`, or `email` columns yet
- ❌ No session management yet
- ✅ Helper functions exist: `validate_community_code()`, `get_community_info()`

### Key Files
```
carpool-app/
├── server.js              # Express app entry point
├── db/
│   ├── connection.js      # PostgreSQL pool
│   └── schema.sql         # Current schema (with community_code)
├── routes/
│   └── rides.js           # Ride CRUD endpoints
├── public/
│   ├── index.html         # Main UI (will move to views/index.ejs)
│   ├── style.css          # Styling
│   └── js/
│       └── analytics.js   # GoatCounter event tracking
└── package.json
```

---

## 🚀 Target User Flow (Post-Auth)

### New User Signup
```
1. Visit /signup
2. Enter:
   - Community Code (validates against communities table)
   - Username (unique per community)
   - Password (hashed with bcrypt)
   - Name (display name)
   - Email (optional, for recovery)
   - Contact method + info (saved to profile)
3. System creates user with credentials
4. Auto-login → redirect to dashboard
```

### Returning User Login
```
1. Visit /login (or redirected if unauthenticated)
2. Enter:
   - Username
   - Password
   - Community Code
3. System validates credentials
4. Create session (userId, username, communityCode)
5. Redirect to dashboard
```

### Authenticated Ride Posting
```
1. User clicks "Post Ride" (already logged in)
2. Form shows:
   - ✅ Name pre-filled (from profile)
   - ✅ Contact info pre-filled (from profile)
   - Route, schedule, notes (user enters)
3. Submit → ride created with user_id from session
4. No need to recreate user record
```

---

## 📋 Implementation Checklist

### Phase 1: Database Schema Migration
- [ ] Add auth columns to `users` table:
  ```sql
  ALTER TABLE users ADD COLUMN username VARCHAR(50);
  ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
  ALTER TABLE users ADD COLUMN email VARCHAR(255);
  ALTER TABLE users ADD CONSTRAINT unique_username_per_community 
      UNIQUE (community_code, username);
  ```
- [ ] Create `sessions` table (or use `connect-pg-simple`)
- [ ] Migrate existing anonymous users (decide strategy: keep as-is or mark as legacy)

### Phase 2: Dependencies Installation
```bash
npm install passport passport-local bcrypt express-session connect-pg-simple
```

### Phase 3: Backend Implementation
- [ ] Create `routes/auth.js`:
  - `POST /api/auth/signup` (validate community code, hash password, create user)
  - `POST /api/auth/login` (validate credentials, create session)
  - `POST /api/auth/logout` (destroy session)
  - `GET /api/auth/session` (check if authenticated)
- [ ] Create `middleware/auth.js`:
  - `ensureAuthenticated()` middleware for protected routes
  - `attachUserToRequest()` to populate `req.user`
- [ ] Update `server.js`:
  - Configure `express-session` with PostgreSQL store
  - Initialize Passport.js with LocalStrategy
  - Add session middleware before routes
- [ ] Update `routes/rides.js`:
  - Protect with `ensureAuthenticated` middleware
  - Remove user creation logic (users already exist)
  - Get `user_id` and `community_code` from `req.session` or `req.user`

### Phase 4: Frontend Implementation
- [ ] Create `views/signup.ejs`:
  - Community code input with real-time validation
  - Username, password, email, name, contact fields
  - Client-side validation (password strength, etc.)
- [ ] Create `views/login.ejs`:
  - Username, password, community code inputs
  - "Forgot password?" link (optional Phase 2)
- [ ] Update `views/index.ejs` (formerly `public/index.html`):
  - Remove name/contact fields from "Post Ride" form
  - Show logged-in user info (e.g., "Logged in as: Alice Magalang")
  - Add "Logout" button
- [ ] Add authentication check on page load:
  ```javascript
  // Check if authenticated
  fetch('/api/auth/session')
    .then(res => res.json())
    .then(data => {
      if (!data.authenticated) {
        window.location.href = '/login';
      } else {
        // Pre-populate user info, load rides
        loadUserProfile(data.user);
      }
    });
  ```

### Phase 5: Session Management
- [ ] Configure session store (PostgreSQL or Redis)
- [ ] Set session cookie options:
  ```javascript
  {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
    }
  }
  ```
- [ ] Add `SESSION_SECRET` to Render environment variables

### Phase 6: Security Hardening
- [ ] Rate limiting on auth endpoints (prevent brute force)
- [ ] CSRF protection for forms
- [ ] Password requirements enforcement (min 8 chars, etc.)
- [ ] SQL injection protection (verify parameterized queries)
- [ ] XSS protection (verify escapeHtml() usage)

### Phase 7: Testing
- [ ] Test signup with valid/invalid community codes
- [ ] Test login with correct/incorrect credentials
- [ ] Test session persistence across page refreshes
- [ ] Test logout functionality
- [ ] Test community isolation (user in PHIRST2024 can't see PASIG2024 rides)
- [ ] Test ride posting flow with authenticated user

---

## 🔧 Technical Decisions to Make

### 1. Username Format
**Options:**
- **Lowercase alphanumeric + underscore** (`alice_magalang`) — Easy to type, URL-safe
- **Allow spaces** (`Alice Magalang`) — More natural, but needs escaping
- **Email as username** (`alice@example.com`) — Familiar, but requires email validation

**Recommendation:** Lowercase alphanumeric + underscore (3-30 chars)

### 2. Password Reset Flow
**Options:**
- **Email-based reset** — Standard, but requires email service (SendGrid, etc.)
- **Admin-assisted reset** — Simpler, contact HOA/admin to reset
- **Security questions** — Less secure, not recommended

**Recommendation:** Start without password reset, add email-based later if needed

### 3. Session Store
**Options:**
- **Memory store** (default) — Simple, but doesn't persist across restarts
- **PostgreSQL** (`connect-pg-simple`) — Uses existing database
- **Redis** — Faster, but requires separate service

**Recommendation:** PostgreSQL store (leverages existing infrastructure)

### 4. Multi-Community Accounts
**Question:** Can one user have accounts in multiple communities?

**Options:**
- **Yes, separate accounts** — User creates different username per community
- **No, one account only** — Enforce one community per user
- **Yes, linked accounts** — One master account, multiple community memberships

**Recommendation:** Separate accounts per community (simpler, maintains isolation)

---

## 🗂️ Schema Changes Required

```sql
-- Migration: Add authentication fields
BEGIN;

-- Add auth columns to users
ALTER TABLE users 
  ADD COLUMN username VARCHAR(50),
  ADD COLUMN password_hash VARCHAR(255),
  ADD COLUMN email VARCHAR(255);

-- Make username unique per community
ALTER TABLE users 
  ADD CONSTRAINT unique_username_per_community 
  UNIQUE (community_code, username);

-- Optional: Add email uniqueness per community
ALTER TABLE users 
  ADD CONSTRAINT unique_email_per_community 
  UNIQUE (community_code, email);

-- Add indexes for login performance
CREATE INDEX idx_users_username_community ON users(username, community_code);

-- Sessions table (if using connect-pg-simple)
CREATE TABLE "session" (
  "sid" VARCHAR NOT NULL COLLATE "default",
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL
) WITH (OIDS=FALSE);

ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid");
CREATE INDEX "IDX_session_expire" ON "session" ("expire");

COMMIT;
```

---

## 🔐 Security Considerations

### Password Hashing
```javascript
const bcrypt = require('bcrypt');
const saltRounds = 10;

// On signup
const passwordHash = await bcrypt.hash(plainPassword, saltRounds);

// On login
const isValid = await bcrypt.compare(plainPassword, user.password_hash);
```

### Session Security
- Store only `userId`, `username`, `communityCode` in session (no sensitive data)
- Use `httpOnly` cookies (prevent XSS)
- Use `secure` cookies in production (HTTPS only)
- Regenerate session ID after login (prevent fixation attacks)

### Input Validation
- Username: `/^[a-z0-9_]{3,30}$/`
- Password: Minimum 8 characters, at least one letter and one number
- Community code: Must exist in `communities` table and `is_active = true`

---

## 🧪 Testing Strategy

### Manual Testing Checklist
```
[ ] Sign up with valid community code → Success
[ ] Sign up with invalid community code → Error
[ ] Sign up with existing username in same community → Error
[ ] Sign up with existing username in different community → Success
[ ] Login with correct credentials → Success
[ ] Login with wrong password → Error
[ ] Login with non-existent username → Error
[ ] Post ride while authenticated → Success
[ ] Post ride while not authenticated → Redirect to login
[ ] View rides from own community → Success
[ ] View rides from other community → Empty (isolated)
[ ] Logout → Session destroyed, redirect to login
```

### Automated Testing (Optional)
- Use `supertest` for API endpoint testing
- Use `jest` for unit tests (password hashing, validation functions)

---

## 🚨 Migration Path for Existing Data

### Current Users (No Credentials)
**Problem:** Existing ride posts have users without usernames/passwords

**Options:**
1. **Mark as legacy** — Add `is_legacy BOOLEAN` flag, don't require auth for old posts
2. **Delete on migration** — Fresh start, no existing data
3. **Manual conversion** — Admin creates accounts for existing users

**Recommendation:** Since app is in early deployment, treat as fresh start or mark legacy

---

## 📚 Passport.js Implementation Snippets

### Local Strategy Configuration
```javascript
// config/passport.js
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const pool = require('../db/connection');

passport.use(new LocalStrategy(
  {
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true  // Get access to community_code from req.body
  },
  async (req, username, password, done) => {
    try {
      const { community_code } = req.body;

      // Find user by username and community
      const result = await pool.query(
        'SELECT * FROM users WHERE username = $1 AND community_code = $2',
        [username.toLowerCase(), community_code.toUpperCase()]
      );

      if (result.rows.length === 0) {
        return done(null, false, { message: 'Invalid credentials' });
      }

      const user = result.rows[0];

      // Verify password
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        return done(null, false, { message: 'Invalid credentials' });
      }

      // Success
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, {
    userId: user.user_id,
    communityCode: user.community_code,
    username: user.username
  });
});

passport.deserializeUser((sessionData, done) => {
  done(null, sessionData);
});
```

---

## 🎨 UI/UX Considerations

### Login Page Design
- Friendly error messages ("Oops! Wrong password" vs "Authentication failed")
- Show community name after code is validated ("Joining: Phirst Park Homes ✓")
- Remember username (not password) with browser autocomplete
- Mobile-first responsive design (matches existing style.css)

### Dashboard Improvements
- Welcome message: "Welcome back, Alice! 👋"
- Show user stats: "You've posted 5 rides this month"
- Quick actions: "Post New Ride" button prominent
- Profile link: Edit contact info, change password

---

## 🔗 Related Documentation

- **Passport.js Docs:** https://www.passportjs.org/docs/
- **bcrypt Docs:** https://github.com/kelektiv/node.bcrypt.js
- **connect-pg-simple:** https://github.com/voxpelli/node-connect-pg-simple
- **Express Session:** https://github.com/expressjs/session

---

## 🎯 Success Criteria

Authentication implementation is complete when:
- [ ] Users can sign up with community code + username + password
- [ ] Users can login and session persists across page refreshes
- [ ] Ride posting uses authenticated user's info (no re-entering)
- [ ] Community isolation is maintained (users only see their community's rides)
- [ ] Security best practices implemented (password hashing, httpOnly cookies, etc.)
- [ ] All existing functionality still works (ride interests, location filtering, etc.)
- [ ] GoatCounter tracks auth events (signup, login, logout)

---

## 💬 Notes from Original Discussion

### Key Requirements
1. **Username + Password + Community Code** login (not email-based initially)
2. **Persistent identity** so people recognize regular riders/drivers
3. **Community isolation** enforced at authentication layer
4. **Contact info pre-filled** from profile (no re-entry friction)
5. **Trust building** through consistent usernames within community

### Deferred Features (Future Phases)
- Password reset via email
- Profile photo uploads
- Email notifications for ride matches
- Admin dashboard for community management
- Multi-community account linking

---

## 🧠 Developer Context

### Your Background
- **Role:** Geodetic Data Analyst transitioning to Web Development
- **Experience:** 16+ years with Bash, FORTRAN, Python, MATLAB, regex
- **Learning:** freeCodeCamp certifications (Responsive Web Design, JS, PostgreSQL)
- **Preferences:** Clear, structured instructions with scaffolding
- **Working Style:** Neurodivergent-friendly approach (ADHD/autism considerations)

### Codebase Style
- **Pragmatic over perfect** (ship working features, refactor later)
- **Minimal abstractions** (avoid over-engineering)
- **Inline documentation** (comments explain "why", not "what")
- **Mobile-first** (Philippines users primarily on mobile)

---

## 📞 Hand-off to Claude Code

When ready to implement, provide Claude Code with:
1. **This document** (context + requirements)
2. **Current schema.sql** (database structure)
3. **Current server.js** (Express app setup)
4. **Current routes/rides.js** (API endpoints)
5. **Environment info:** Node.js version, PostgreSQL version, Render.com deployment

**Prompt suggestion for Claude Code:**
```
I need to implement username + password + community code authentication 
for my carpool app. I have a hand-off document with full context and 
requirements. Let's start with the database migration, then move to 
Passport.js setup, then frontend changes. Work in small, testable 
increments. Ask clarifying questions before making breaking changes.
```

---

**End of Hand-off Document**  
*Ready for implementation when you give the signal! 🚀*