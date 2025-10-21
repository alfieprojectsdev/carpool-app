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
