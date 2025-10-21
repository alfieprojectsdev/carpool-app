# Git Worktree Implementation Plan

## Overview

Use Git worktrees to work on multiple branches simultaneously without context switching overhead. Perfect for ADHD-friendly parallel development.

## Directory Structure

```
carpool-app/                    # Main worktree (main branch)
├── .git/                       # Git repository data
├── .trees/                     # Worktrees directory (hidden, gitignored)
│   ├── feature-auth/           # Authentication feature
│   ├── feature-filters/        # Filter/search feature
│   ├── feature-realtime/       # Real-time notifications
│   ├── bugfix-form-validation/ # Bug fix branch
│   └── experiment-ui/          # UI experiments
├── db/
├── routes/
├── public/
├── server.js
└── package.json
```

## Setup Instructions

### 1. Update .gitignore

```bash
# Add to .gitignore
echo "" >> .gitignore
echo "# Worktrees directory" >> .gitignore
echo ".trees/" >> .gitignore

git add .gitignore
git commit -m "Add .trees/ to gitignore for worktree workflow"
```

### 2. Create .trees Directory

```bash
mkdir .trees
```

### 3. Create Worktree Helper Script

Create `scripts/worktree.sh` for easy management:

```bash
#!/bin/bash
# scripts/worktree.sh - Worktree management helper

TREES_DIR=".trees"

case "$1" in
  create)
    if [ -z "$2" ]; then
      echo "Usage: ./scripts/worktree.sh create <branch-name>"
      exit 1
    fi
    
    BRANCH_NAME="$2"
    WORKTREE_PATH="$TREES_DIR/$BRANCH_NAME"
    
    # Create worktree
    git worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME"
    
    # Copy .env to worktree
    if [ -f .env ]; then
      cp .env "$WORKTREE_PATH/.env"
      echo "✓ Copied .env to worktree"
    fi
    
    # Install dependencies
    cd "$WORKTREE_PATH"
    npm install
    
    echo "✓ Worktree created at: $WORKTREE_PATH"
    echo "  cd $WORKTREE_PATH"
    ;;
    
  list)
    echo "Active worktrees:"
    git worktree list
    ;;
    
  remove)
    if [ -z "$2" ]; then
      echo "Usage: ./scripts/worktree.sh remove <branch-name>"
      exit 1
    fi
    
    BRANCH_NAME="$2"
    WORKTREE_PATH="$TREES_DIR/$BRANCH_NAME"
    
    git worktree remove "$WORKTREE_PATH"
    echo "✓ Removed worktree: $BRANCH_NAME"
    ;;
    
  clean)
    git worktree prune
    echo "✓ Cleaned up stale worktrees"
    ;;
    
  *)
    echo "Carpool App - Worktree Manager"
    echo ""
    echo "Usage:"
    echo "  ./scripts/worktree.sh create <branch-name>   - Create new worktree"
    echo "  ./scripts/worktree.sh list                   - List all worktrees"
    echo "  ./scripts/worktree.sh remove <branch-name>   - Remove worktree"
    echo "  ./scripts/worktree.sh clean                  - Clean stale worktrees"
    echo ""
    echo "Examples:"
    echo "  ./scripts/worktree.sh create feature-auth"
    echo "  ./scripts/worktree.sh list"
    echo "  ./scripts/worktree.sh remove feature-auth"
    ;;
esac
```

Make it executable:
```bash
chmod +x scripts/worktree.sh
```

### 4. Create VS Code Workspace Configuration (Optional)

Create `carpool-app.code-workspace`:

```json
{
  "folders": [
    {
      "name": "🏠 Main",
      "path": "."
    },
    {
      "name": "🔐 Auth Feature",
      "path": ".trees/feature-auth"
    },
    {
      "name": "🔍 Filters Feature",
      "path": ".trees/feature-filters"
    }
  ],
  "settings": {
    "files.exclude": {
      ".trees/": true
    }
  }
}
```

## Workflow Examples

### Example 1: Add Authentication Feature

```bash
# Create worktree for auth feature
./scripts/worktree.sh create feature-auth

# Work in the worktree
cd .trees/feature-auth

# Start dev server on different port
PORT=3001 npm run dev

# Make changes, commit
git add .
git commit -m "Add user authentication"

# Push feature branch
git push -u origin feature-auth

# Return to main
cd ../..

# Merge when ready
git merge feature-auth
```

### Example 2: Parallel Development

```bash
# Terminal 1: Main development
cd ~/repos/carpool-app
npm run dev  # Port 3000

# Terminal 2: Auth feature
cd ~/repos/carpool-app/.trees/feature-auth
PORT=3001 npm run dev  # Port 3001

# Terminal 3: UI experiments
cd ~/repos/carpool-app/.trees/experiment-ui
PORT=3002 npm run dev  # Port 3002
```

### Example 3: Quick Bug Fix

```bash
# Create bug fix worktree from main
./scripts/worktree.sh create bugfix-form-validation

cd .trees/bugfix-form-validation

# Fix bug, test, commit
git add .
git commit -m "Fix: Form validation for empty days array"
git push -u origin bugfix-form-validation

# Return to main and merge
cd ../..
git merge bugfix-form-validation

# Clean up
./scripts/worktree.sh remove bugfix-form-validation
git branch -d bugfix-form-validation
```

## Database Considerations

### Option 1: Shared Database (Simpler)
All worktrees use the same `carpool_db` database.

**Pros:** No setup needed  
**Cons:** Data changes affect all worktrees

### Option 2: Separate Databases (Isolated)

```bash
# In each worktree, create isolated database
createdb carpool_db_auth
createdb carpool_db_filters

# Update .env in each worktree
DB_NAME=carpool_db_auth  # in .trees/feature-auth/.env
DB_NAME=carpool_db_filters  # in .trees/feature-filters/.env
```

**Pros:** Complete isolation  
**Cons:** More setup, disk space

**Recommendation:** Start with Option 1, move to Option 2 if features conflict.

## Port Management

Create `PORT_ASSIGNMENTS.md` to track ports:

```markdown
# Port Assignments

| Worktree | Branch | Port |
|----------|--------|------|
| main | main | 3000 |
| .trees/feature-auth | feature-auth | 3001 |
| .trees/feature-filters | feature-filters | 3002 |
| .trees/feature-realtime | feature-realtime | 3003 |
| .trees/experiment-ui | experiment-ui | 3004 |
```

## Maintenance Tasks

### Daily
```bash
# Check active worktrees
./scripts/worktree.sh list
```

### Weekly
```bash
# Clean up merged branches
./scripts/worktree.sh clean
git branch --merged | grep -v "\*\|main" | xargs -n 1 git branch -d
```

### Monthly
```bash
# Audit disk space
du -sh .trees/*

# Remove stale worktrees
git worktree prune
```

## Integration with Claude Code (Future)

### Planned Workflow

```bash
# Use Claude Code in specific worktree
cd .trees/feature-auth

# Let Claude Code work on auth feature
claude-code "Implement JWT authentication for user login"

# Review changes, commit if good
git diff
git add .
git commit -m "feat: Add JWT authentication (via Claude Code)"
```

### Benefits
- Each agent works in isolated worktree
- No conflicts between parallel AI work
- Easy to discard experiments (just remove worktree)
- Clear separation of concerns

## Troubleshooting

### "fatal: 'branch' is already checked out"
```bash
# A branch can only be checked out in one worktree at a time
git worktree list  # See where it's checked out
```

### Stale worktree references
```bash
git worktree prune
```

### Port already in use
```bash
# Check what's using the port
lsof -i :3001

# Kill process if needed
kill -9 <PID>
```

## Advantages for Your Workflow

1. **ADHD-Friendly**
   - Switch contexts by changing directories, not `git checkout`
   - Keep multiple tasks "open" without mental overhead
   - Visual separation (different folders = different tasks)

2. **Parallel Experiments**
   - Try radical UI changes without affecting main
   - Test breaking changes in isolation
   - Compare approaches side-by-side

3. **Claude Code Ready**
   - Each agent gets its own workspace
   - No merge conflicts from parallel AI work
   - Easy to review and cherry-pick changes

4. **Low Cognitive Load**
   - No complex git commands during flow state
   - Simple folder navigation
   - Clear "what am I working on" (visible in terminal prompt)

## Quick Reference

```bash
# Create worktree
./scripts/worktree.sh create feature-name

# List worktrees
./scripts/worktree.sh list

# Remove worktree
./scripts/worktree.sh remove feature-name

# Navigate
cd .trees/feature-name

# Start with different port
PORT=3001 npm run dev
```

## Next Steps

1. ✅ Update .gitignore
2. ✅ Create scripts/worktree.sh
3. ✅ Document in notes.md
4. ⏳ Create first experimental worktree
5. ⏳ Test workflow with small feature
6. ⏳ Integrate with Claude Code (later)