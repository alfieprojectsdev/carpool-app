# CLAUDE.md (Carpool App - Project-Specific)

This file provides project-specific guidance to Claude Code for the Carpool App project. It supplements the root-level `~/CLAUDE.md` with project-specific context, tech stack, conventions, and active worktree status.

**Hierarchy:** This file overrides root-level `~/CLAUDE.md` for project-specific details.

---

## Project Overview

**Name:** Carpool App  
**Purpose:** Web application for organizing carpools with scheduling, user management, and notifications  
**Status:** Active development  
**Repository:** (Add GitHub URL when available)

**Key Features:**
- User authentication and profiles
- Carpool creation and management
- Schedule coordination
- Real-time notifications
- Filter/search functionality

---

## Tech Stack

**Backend:**
- Node.js + Express.js
- PostgreSQL database
- (Add other backend libraries as used)

**Frontend:**
- HTML, CSS, JavaScript
- (Add framework if using React/Vue/etc)
- (Add CSS framework if using Tailwind/Bootstrap/etc)

**Development Tools:**
- npm (package manager)
- Git + Git worktrees
- (Add testing framework)
- (Add linter/formatter if configured)

**Deployment:**
- (Add platform: Heroku, Vercel, Railway, etc.)
- (Add CI/CD details when set up)

---

## Code Conventions

### File Organization
```
carpool-app/
├── db/              # Database schemas, migrations, seeds
├── routes/          # Express route handlers
├── public/          # Static assets (CSS, JS, images)
├── views/           # Templates (if using EJS/Pug/etc)
├── scripts/         # Helper scripts (including worktree.sh)
├── tests/           # Test files
├── server.js        # Main application entry point
└── package.json
```

### Naming Conventions
- **Files:** kebab-case (`user-routes.js`, `create-carpool.js`)
- **Functions:** camelCase (`getUserById`, `createCarpool`)
- **Database tables:** snake_case (`carpool_users`, `carpool_schedules`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_PASSENGERS`, `DEFAULT_PORT`)
- **Classes:** PascalCase (if using OOP)

### Database Conventions
- **Primary database:** `carpool_db`
- **Test database:** `carpool_db_test` (if separate)
- **Connection:** PostgreSQL connection via `.env` configuration
- **Migrations:** (Add migration strategy if using one)

### Git Commit Conventions
Follow Conventional Commits:
```
feat:     New feature
fix:      Bug fix
docs:     Documentation changes
style:    Code style changes (formatting, no logic change)
refactor: Code refactoring
test:     Adding or updating tests
chore:    Maintenance tasks, tooling
```

Examples:
```
feat: add user authentication with JWT
fix: resolve form validation for empty days array
docs: update worktree workflow in README
test: add unit tests for carpool creation
chore: update dependencies
```

---

## Worktree Configuration

### Setup Status
- [x] `.trees/` directory created
- [x] `.trees/` added to `.gitignore`
- [x] `scripts/worktree.sh` created and executable
- [x] `worktree-implementation.md` documented
- [ ] `PORT_ASSIGNMENTS.md` created
- [ ] Database strategy decided (shared vs isolated)

### Database Strategy
**Current approach:** (Choose one and update)
- [ ] **Shared database** - All worktrees use `carpool_db` (simpler, changes affect all)
- [ ] **Isolated databases** - Each worktree has own database (complex, fully isolated)

**If isolated, naming convention:**
```
Main:               carpool_db
Feature worktrees:  carpool_db_<branch-name>
Example:            carpool_db_auth
                   carpool_db_filters
```

### Active Worktrees

| Worktree Path | Branch | Port | Purpose | Status |
|--------------|--------|------|---------|--------|
| (main) | main | 3000 | Stable/production code | Active |
| | | | | |
| | | | | |

*Update this table as worktrees are created/removed*

### Port Assignments

| Port | Worktree | Branch | Purpose |
|------|----------|--------|---------|
| 3000 | main | main | Primary development |
| 3001 | .trees/feature-auth | feature-auth | Authentication (example) |
| 3002 | .trees/feature-filters | feature-filters | Filter/search (example) |
| 3003 | .trees/feature-realtime | feature-realtime | Real-time notifications (example) |
| 3004 | .trees/experiment-ui | experiment-ui | UI experiments (example) |

*Assign ports as needed; keep this updated*

---

## Testing Strategy

### Framework
- **Test runner:** (Add: Jest, Mocha, Vitest, etc.)
- **Assertion library:** (Add: Chai, Jest expect, etc.)
- **Coverage tool:** (Add: Istanbul, c8, etc.)

### Test Organization
```
tests/
├── unit/           # Unit tests for individual functions
├── integration/    # Integration tests for routes/database
└── e2e/           # End-to-end tests (if applicable)
```

### Test Commands
```bash
npm test              # Run all tests
npm run test:unit     # Run unit tests only
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Generate coverage report
```

### Coverage Goals
- Minimum coverage: (e.g., 70%)
- Focus on: Critical business logic, route handlers, database operations

---

## Development Workflow

### Starting Development
```bash
# Main worktree (stable development)
npm run dev  # Starts on PORT=3000

# Feature worktree
cd .trees/feature-name
PORT=3001 npm run dev
```

### Creating New Features
```bash
# 1. Create worktree
./scripts/worktree.sh create feature-name

# 2. Navigate to worktree
cd .trees/feature-name

# 3. Work on feature
# (make changes, write tests, commit)

# 4. Push feature branch
git push -u origin feature-name

# 5. Return to main for review/merge
cd ../..
git merge feature-name  # (or create PR)

# 6. Clean up
./scripts/worktree.sh remove feature-name
git branch -d feature-name
```

### Database Migrations
(Add project-specific migration workflow)
```bash
# Example with a migration tool
npm run migrate:up    # Apply migrations
npm run migrate:down  # Rollback migrations
```

---

## Project-Specific Patterns

### Pattern: Adding New Route
```
1. Create route handler in routes/
2. Write tests in tests/integration/
3. Add route to server.js
4. Test manually and with automated tests
5. Commit: "feat: add <route-name> route"
```

### Pattern: Database Schema Change
```
1. Create migration file (if using migrations)
2. Update schema in db/
3. Update seed data if needed
4. Test in isolation (preferably in worktree)
5. Commit: "feat: add <table-name> table" or "refactor: update <table-name> schema"
```

### Pattern: Adding Authentication
```
1. Create worktree: ./scripts/worktree.sh create feature-auth
2. Install dependencies (bcrypt, jsonwebtoken, etc.)
3. Write authentication middleware
4. Add auth routes
5. Write tests
6. Test in isolation on PORT=3001
7. Merge when stable
```

---

## Environment Variables

**Required in `.env`:**
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=carpool_db
DB_USER=your_username
DB_PASSWORD=your_password

# Server
PORT=3000
NODE_ENV=development

# (Add other env vars as needed)
# AUTH_SECRET=
# API_KEY=
```

**Note:** Each worktree should have its own `.env` copy (automatically handled by `scripts/worktree.sh`)

---

## Deployment Configuration

**Platform:** (Add: Heroku, Vercel, Railway, etc.)

**Deployment Steps:**
1. (Add deployment steps)
2. (Add build commands)
3. (Add post-deployment checks)

**Environment Variables (Production):**
- Set in platform dashboard
- Never commit to repository

**CI/CD:**
- [ ] GitHub Actions configured
- [ ] Automated tests on PR
- [ ] Auto-deploy on merge to main

---

## Common Tasks

### Reset Database
```bash
# Drop and recreate
dropdb carpool_db
createdb carpool_db

# Run schema
psql -d carpool_db -f db/schema.sql

# Seed data
psql -d carpool_db -f db/seeds.sql
```

### Check Active Worktrees
```bash
./scripts/worktree.sh list
# or
git worktree list
```

### Clean Stale Worktrees
```bash
./scripts/worktree.sh clean
# or
git worktree prune
```

### Troubleshoot Port Conflicts
```bash
# Find process using port
lsof -i :3001

# Kill process
kill -9 <PID>
```

---

## Troubleshooting

### Database Connection Issues
1. Check PostgreSQL is running: `pg_isready`
2. Verify `.env` credentials
3. Check database exists: `psql -l`
4. Test connection: `psql -d carpool_db`

### Worktree Issues
1. Branch already checked out: `git worktree list` (branch can only be in one worktree)
2. Stale references: `git worktree prune`
3. Missing dependencies in worktree: `cd .trees/<name> && npm install`

### Port Already in Use
1. Check what's using port: `lsof -i :3000`
2. Kill process or use different port: `PORT=3001 npm run dev`

---

## Project Roadmap

### Completed Features
- [x] Basic project setup
- [x] Worktree workflow implementation
- [ ] (Add completed features)

### In Progress
- [ ] (Add current work)

### Planned Features
- [ ] User authentication
- [ ] Carpool creation and management
- [ ] Schedule coordination
- [ ] Real-time notifications
- [ ] Filter/search functionality
- [ ] (Add other planned features)

---

## Notes for Claude Code

### Project-Specific Guidance
- This is a **learning project** - explain decisions clearly
- Balance between best practices and keeping it simple
- Suggest improvements but don't over-engineer
- Focus on getting working features before optimization

### When Working on This Project
1. Always check which worktree you're in
2. Respect the file organization structure
3. Follow naming conventions
4. Write tests for new features
5. Update this CLAUDE.md when adding new conventions
6. Keep PORT_ASSIGNMENTS.md and Active Worktrees table updated

### Reference Documentation
- `worktree-implementation.md` - Complete worktree workflow guide
- `~/CLAUDE.md` - Root-level universal preferences
- (Add other project docs as created)

---

## Maintenance Log

| Date | Change | Reason |
|------|--------|--------|
| 2025-10-23 | Initial creation | Establish project-specific configuration |
|  |  |  |

---

## Quick Reference

**Start development:**
```bash
npm run dev  # Main worktree on PORT=3000
```

**Create feature worktree:**
```bash
./scripts/worktree.sh create feature-name
cd .trees/feature-name
PORT=3001 npm run dev
```

**Run tests:**
```bash
npm test
```

**Database operations:**
```bash
psql -d carpool_db              # Connect to database
psql -d carpool_db -f db/schema.sql  # Run schema
```

**Check worktrees:**
```bash
./scripts/worktree.sh list
```