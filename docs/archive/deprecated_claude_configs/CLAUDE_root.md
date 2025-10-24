# CLAUDE.md (Root-Level Configuration)

This file provides universal guidance to Claude Code across ALL projects. It defines my working style, learning preferences, and standard workflows that apply regardless of the specific project.

---

## Developer Profile

**Background:**
- Transitioning from Geodetic Data Analysis (16+ years) to Web Development/Engineering
- Strong foundation in automation, data wrangling, scripting (Bash, Python, FORTRAN, MATLAB, regex)
- Building modern web development skills via freeCodeCamp certifications:
  - Responsive Web Design ✓
  - JavaScript Algorithms and Data Structures ✓
  - Relational Databases (PostgreSQL) ✓

**Neurodivergent Considerations:**
- Strongly suspect ADHD and/or autism
- Benefits from reduced context-switching overhead
- Works best with clear, structured information
- Prefers incremental progress over perfectionism
- Values visual/spatial organization (folders = tasks)

**Personal Context:**
- Married father of three (one child on autism spectrum)
- Balancing technical growth with real-life responsibilities
- Working toward financial stability while managing debt
- Need sustainable, long-term learning pace

---

## Universal Communication Preferences

### How to Communicate With Me

**DO:**
- Be concise but complete – avoid unnecessary verbosity
- Use scaffolding when introducing new concepts
- Provide concrete examples and code samples
- Break down complex ideas into digestible pieces
- Explain "why" behind decisions, not just "what" to do
- Suggest practical next steps explicitly
- Use analogies to data processing/automation workflows when helpful
- Ask clarifying questions when requirements are ambiguous

**DON'T:**
- Use overly academic or theoretical explanations without context
- Assume I know framework-specific conventions (I'm still learning)
- Make changes without explaining the reasoning
- Overwhelm with multiple questions at once
- Use jargon without brief definition
- Jump to implementation before confirming the approach

### Learning Style
- **Pattern-based learning:** Show me the pattern, then variations
- **Incremental complexity:** Start simple, add layers gradually
- **Practical first:** Working code before theoretical deep-dives
- **Context switching:** Minimize; use worktrees for parallel work
- **Documentation:** Value clear inline comments and README updates

---

## Universal Workflow Methodology

### Specialized Subagents (Universal Standard)

**Claude Code should leverage subagents for task-specific expertise across ALL projects.**

Subagents are specialized AI assistants that operate in isolated context windows with custom system prompts and specific tool permissions. They enable efficient, focused work without polluting the main conversation context.

**Core Benefits:**
- **Context isolation:** Each subagent maintains separate context, preventing pollution
- **Domain expertise:** Specialized prompts deliver expert-level performance
- **Automatic delegation:** Claude Code intelligently routes tasks to appropriate subagents
- **Scalable workflows:** Chain subagents for complex multi-step processes
- **Reduced cognitive load:** Subagents handle details while main thread stays focused on objectives

**Standard Subagent Location:**
```
~/.claude/agents/           # Global subagents (available to all projects)
project/.claude/agents/     # Project-specific subagents (override global)
```

**When Claude Code Should Use Subagents:**
- Complex architectural decisions → `system-architect` subagent
- Code quality review → `code-reviewer` subagent  
- Security analysis → `security-auditor` subagent
- Test creation/execution → `test-automator` subagent
- Database design → `database-architect` subagent
- Documentation → `technical-writer` subagent
- Bug investigation → `debugger-specialist` subagent
- Performance optimization → `performance-optimizer` subagent

**Subagent Orchestration Patterns:**
```
Pattern A: requirements-analyst → system-architect → code-reviewer
Use case: End-to-end feature development with quality gates

Pattern B: debugger-specialist → test-automator → code-reviewer
Use case: Bug fix with regression testing

Pattern C: system-architect → database-architect → security-auditor
Use case: New feature requiring data model and security review

Pattern D: research-analyst → technical-writer → code-reviewer
Use case: Spike/exploration with documentation
```

**Subagent File Format:**
```markdown
---
name: subagent-name
description: When this subagent should be invoked (be specific and action-oriented)
tools: bash, read, write  # Optional - omit to inherit all tools
model: sonnet  # Optional - sonnet, opus, or haiku
---

# Subagent Role Definition

You are a [role] specializing in [domain]. When invoked:

1. [Step 1]
2. [Step 2]
3. [Step 3]

Key practices:
- [Practice 1]
- [Practice 2]
- [Practice 3]

Always:
- [Always do this]
- [Never do that]
```

**Creating Subagents:**
1. Use `/agents` command in Claude Code for interactive setup
2. Start with Claude-generated subagent, then customize
3. Test with explicit invocation: "Use the [subagent-name] to [task]"
4. Let Claude Code auto-delegate once proven

---

### Git Worktree Standard

**ALL projects should use Git worktrees for parallel development.**

See `worktree-implementation.md` (reference implementation in `carpool-app`) for complete details.

**Key Principles:**
```
Main worktree:     Production/stable code (main branch)
.trees/ directory: Feature branches as separate worktrees
Benefits:          No git checkout, parallel experiments, reduced cognitive load
```

**Standard Directory Structure:**
```
project-name/
├── .git/
├── .trees/                    # Hidden, gitignored
│   ├── feature-*/             # Feature worktrees
│   ├── bugfix-*/              # Bug fix worktrees
│   └── experiment-*/          # Experimental worktrees
├── scripts/
│   └── worktree.sh            # Worktree helper script
├── CLAUDE.md                  # Project-specific config
├── worktree-implementation.md # (if first project with worktrees)
└── (project files)
```

**When Claude Code Should Suggest Worktrees:**
- New features that will take multiple sessions
- Experimental work that might be discarded
- Bug fixes needing testing isolation
- Any time I express context-switching frustration
- When I want to compare approaches side-by-side
- Large refactors

**Worktree Lifecycle Claude Code Should Support:**
1. **Create:** Help set up with `./scripts/worktree.sh create <branch-name>`
2. **Work:** Respect worktree boundaries, confirm current location
3. **Test:** Support running parallel dev servers on different ports
4. **Merge:** Guide merge process when feature is ready
5. **Cleanup:** Help remove and prune stale worktrees

---

## Universal Development Workflow

### 5-Phase Development Lifecycle

#### 1. Discovery Phase
**Activities:** Explore codebase, search docs, onboard & learn

**Claude Code Should:**
- Help explore and understand codebase structure
- Provide clear explanations with analogies to data workflows when helpful
- Search and summarize documentation
- Create quick reference guides when needed
- Explain architectural decisions

#### 2. Design Phase
**Activities:** Plan project, develop specs, define architecture

**Claude Code Should:**
- **Delegate to `system-architect` subagent** for architectural decisions
- **Use `requirements-analyst` subagent** to clarify requirements before planning
- Help plan features in small, manageable increments
- **Wait for confirmation before implementing** ("ultrathink" mode)
- Outline 2-3 approaches with tradeoffs
- Suggest worktree creation for complex/experimental work
- Let me choose direction before coding

**Subagent Usage:**
```
For architecture: Use system-architect subagent
For requirements clarification: Use requirements-analyst subagent
For database design: Use database-architect subagent
```

**Decision Pattern:**
```
1. Discuss problem/feature (may invoke requirements-analyst)
2. Explore 2-3 approaches (may invoke system-architect)
3. Let me choose direction
4. Suggest worktree if appropriate
5. Confirm plan before coding
```

#### 3. Build Phase
**Activities:** Implement code, write tests, create commits & PRs

**Claude Code Should:**
- Write clean, well-commented code with descriptive names
- Follow existing project patterns
- **Delegate to `test-automator` subagent** for test creation
- **Use `code-reviewer` subagent** before finalizing commits
- Make atomic commits with conventional commit messages
- **Always check current worktree location before making changes**
- Respect worktree boundaries

**Subagent Usage:**
```
For test creation: Use test-automator subagent
For code review: Use code-reviewer subagent
For refactoring: Use refactoring-specialist subagent
For documentation: Use technical-writer subagent
```

**Testing Approach:**
```
Preferred: Write tests → commit → implement → iterate → commit
- Use test-automator subagent to write comprehensive tests
- Make tests pass incrementally
- Use code-reviewer subagent before committing
- Commit working states frequently
```

#### 4. Deploy Phase
**Activities:** Automate CI/CD, configure environments, manage deployments

**Claude Code Should:**
- **Delegate to `devops-engineer` subagent** for CI/CD setup
- **Use `cloud-architect` subagent** for infrastructure decisions
- Help set up/improve CI/CD pipelines
- Assist with environment configuration
- Troubleshoot with clear diagnostic steps
- Document deployment processes

**Subagent Usage:**
```
For CI/CD pipelines: Use devops-engineer subagent
For cloud infrastructure: Use cloud-architect subagent
For container orchestration: Use kubernetes-specialist subagent
For deployment docs: Use technical-writer subagent
```

#### 5. Support & Scale Phase
**Activities:** Debug errors, refactor, monitor performance

**Claude Code Should:**
- **Delegate to `debugger-specialist` subagent** for systematic debugging
- **Use `performance-optimizer` subagent** for optimization work
- **Use `security-auditor` subagent** for security reviews
- Provide systematic debugging (not guesses)
- Explain error messages clearly
- Suggest refactoring in manageable chunks
- Help interpret logs/metrics

**Subagent Usage:**
```
For debugging: Use debugger-specialist subagent
For performance: Use performance-optimizer subagent
For security: Use security-auditor subagent
For large refactors: Use refactoring-specialist subagent
```

**Debugging Approach:**
```
1. Invoke debugger-specialist subagent
2. Form hypothesis about root cause
3. Suggest targeted investigation steps
4. Test one thing at a time
5. Explain what was learned
```

---

## Universal Workflow Patterns

### Pattern A: Explore → Plan → Confirm → Code → Commit
**Use for:** Root cause investigation, feature planning, architectural changes

```
1. Explore:  Understand the problem
2. Plan:     Suggest 2-3 approaches
3. Confirm:  Wait for my decision
4. Execute:  Implement chosen approach
5. Commit:   Conventional commit message
```

**With worktrees:** Create worktree after confirmation, before implementation.

---

### Pattern B: Write Tests → Commit → Code → Iterate → Commit
**Use for:** New features, bug fixes with clear requirements

```
1. Write tests (may fail initially)
2. Commit tests
3. Implement code to pass tests
4. Iterate based on test feedback
5. Commit working implementation
```

**With worktrees:** Entire cycle happens in feature worktree.

---

### Pattern C: Write Code → Screenshot → Iterate
**Use for:** UI/UX work, visual components, styling

```
1. Implement UI component
2. Screenshot with Puppeteer (or similar)
3. Compare to mock/design
4. Iterate until match
```

**With worktrees:** Run experimental UI in separate worktree on different port, compare with main running simultaneously.

---

### Pattern D: Parallel Development
**Use for:** Multiple features, comparing approaches, reducing context switching

```
Terminal 1 (main):          PORT=3000 (stable code)
Terminal 2 (feature-auth):  PORT=3001 (auth work)
Terminal 3 (experiment-ui): PORT=3002 (UI experiments)

All running simultaneously, no git checkout
```

---

## Code Quality Standards

**All Projects Should Have:**
- Tests for new functionality
- Clear, descriptive variable/function names
- Comments for complex logic
- Conventional commit messages
- Consistent code style (follow existing patterns)

**Code Style Preferences:**
- Readability over cleverness
- Explicit over implicit
- Focused, single-purpose functions
- Descriptive names (avoid over-abbreviation)

---

## Project Setup Standards

### Recommended Global Subagents

Create these subagents in `~/.claude/agents/` for use across all projects:

**Essential Subagents (Priority 1):**
1. **system-architect** - System design and architectural decisions
2. **code-reviewer** - Code quality and best practices review
3. **test-automator** - Test creation and test-driven development
4. **debugger-specialist** - Systematic debugging and root cause analysis
5. **security-auditor** - Security vulnerability detection and fixes

**Development Subagents (Priority 2):**
6. **database-architect** - Database schema design and optimization
7. **technical-writer** - Documentation and README creation
8. **refactoring-specialist** - Code refactoring and cleanup
9. **performance-optimizer** - Performance analysis and optimization
10. **requirements-analyst** - Requirements clarification and analysis

**DevOps Subagents (Priority 3):**
11. **devops-engineer** - CI/CD pipelines and automation
12. **cloud-architect** - Cloud infrastructure and deployment
13. **docker-specialist** - Container orchestration and Docker

**Framework-Specific Subagents (As Needed):**
- **react-specialist** - React/frontend development
- **nodejs-specialist** - Node.js/backend development
- **python-specialist** - Python development
- **postgres-specialist** - PostgreSQL optimization

**Setup Command:**
```bash
# Create global agents directory
mkdir -p ~/.claude/agents

# Use Claude Code's /agents command to create each subagent
# Or copy from reference repositories:
# - https://github.com/VoltAgent/awesome-claude-code-subagents
# - https://github.com/wshobson/agents
# - https://github.com/lst97/claude-code-sub-agents
```

---

### New Project Checklist
When starting a new project, Claude Code should help me:

```bash
# 1. Initialize git
git init

# 2. Set up worktree structure
mkdir .trees
echo -e "\n# Worktrees directory\n.trees/" >> .gitignore

# 3. Create helper scripts
mkdir -p scripts
# (Claude Code provides worktree.sh from reference implementation)
chmod +x scripts/worktree.sh

# 4. Create project-specific CLAUDE.md
# (Claude Code creates from template, using carpool-app as reference)

# 5. Initial commit
git add .
git commit -m "chore: initial project setup with worktree support"
```

### Existing Project Migration
When adding worktrees to an existing project:

```bash
# 1. Add to .gitignore
echo -e "\n# Worktrees directory\n.trees/" >> .gitignore

# 2. Create .trees directory
mkdir .trees

# 3. Add helper script
mkdir -p scripts
# (Copy from reference implementation)
chmod +x scripts/worktree.sh

# 4. Create/update CLAUDE.md
# (Use carpool-app/CLAUDE.md as template)

# 5. Commit changes
git add .gitignore scripts/worktree.sh CLAUDE.md
git commit -m "chore: add worktree workflow support"
```

---

## When to Reference Project-Specific CLAUDE.md

**Always check for project-specific CLAUDE.md first.** It overrides these universal defaults with:
- Project tech stack
- Project-specific conventions
- Testing framework details
- Deployment configuration
- Active worktrees
- Custom workflows

**Hierarchy:**
```
Project-specific CLAUDE.md (highest priority)
    ↓
Root-level CLAUDE.md (universal defaults)
    ↓
Claude Code's default behavior
```

---

## Retroactive Organization

**For projects created before this root-level config:**

Claude Code should offer to:
1. Add worktree infrastructure (`scripts/worktree.sh`, `.trees/`, `.gitignore`)
2. Create project-specific `CLAUDE.md` based on `carpool-app` template
3. Migrate active branches to worktrees (if appropriate)
4. Update documentation

**When to suggest retroactive setup:**
- I mention context-switching difficulties
- Multiple features being developed simultaneously
- I ask about parallel development
- Project reaches natural breakpoint

---

## Reference Implementation

**Primary reference:** `carpool-app` project
- Contains complete worktree setup
- Has both root-level and project-specific CLAUDE.md
- Includes `worktree-implementation.md` documentation
- Demonstrates all workflow patterns

**To propagate changes:**
```
Use carpool-app/CLAUDE.md as template for updating other projects
Use carpool-app/scripts/worktree.sh as script template
Use carpool-app/worktree-implementation.md as workflow documentation
```

---

## Meta: About This File

**Location:** `~/CLAUDE.md` or `~/.config/claude/CLAUDE.md`

**Purpose:** Universal preferences that apply to ALL projects

**Maintenance:**
- Update when I discover new workflow preferences
- Refine based on what works/doesn't work
- Keep synchronized with project-specific templates

**Version History:**

| Date | Change | Reason |
|------|--------|--------|
| 2025-10-23 | Initial creation | Establish universal workflow standards |

---

## Quick Reference

**When starting any task:**
1. Check for project-specific `CLAUDE.md` in project root
2. Apply project-specific overrides
3. Fall back to these universal preferences
4. Confirm current worktree location
5. **Identify if task benefits from specialized subagent**
6. Delegate to appropriate subagent or proceed directly
7. Use appropriate workflow pattern

**Core Principles:**
- ✅ Incremental progress over perfection
- ✅ Worktrees for parallel work
- ✅ Subagents for specialized tasks
- ✅ Test-driven when appropriate
- ✅ Clear communication with scaffolding
- ✅ Conventional commits
- ✅ Respect my neurodivergent workflow needs

**Common Subagent Invocations:**
```bash
# Explicit invocation (when needed)
"Use the system-architect subagent to design the auth system"
"Have the code-reviewer subagent analyze this module"
"Let the debugger-specialist investigate this error"

# Automatic delegation (preferred)
"Design the authentication architecture" → system-architect auto-invoked
"Review this code for issues" → code-reviewer auto-invoked
"Fix this bug" → debugger-specialist auto-invoked
```