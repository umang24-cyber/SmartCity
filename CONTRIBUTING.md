# Contributing to SmartCity

We appreciate your interest in contributing! This guide explains how to submit changes to this project.

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. All commit messages are linted automatically using Husky and CommitLint.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type** must be one of the following:
- `feat` - A new feature
- `fix` - A bug fix
- `docs` - Documentation only changes
- `style` - Changes that don't affect code meaning (formatting, semicolons, etc)
- `refactor` - Code refactoring without feature or bug changes
- `perf` - Performance improvements
- `test` - Adding or updating tests
- `chore` - Changes to build/dependencies/tools
- `ci` - Changes to CI configuration
- `revert` - Reverting a previous commit

**Scope** (optional) - Component or module affected (e.g., `dashboard`, `auth`, `map`)

**Subject** (required) - Concise description in lowercase, no period at end

**Body** (optional) - Detailed explanation of changes

**Footer** (optional) - References to issues or breaking changes

### Constraints

- Maximum 100 characters for the header line
- All lowercase letters
- No period at the end of the subject
- Use imperative mood ("add feature" not "added feature")

## Good Commit Examples

### ✅ Good: Simple feature

```
feat(map): add geolocation tracking
```

### ✅ Good: Bug fix with scope

```
fix(dashboard): resolve widget rendering timeout
```

### ✅ Good: Feature with detailed body

```
feat(auth): implement JWT token refresh mechanism

Add automatic token refresh when token expiry approaches.
This prevents interrupted user sessions and improves UX.

Implements OAuth 2.0 refresh token flow.
```

### ✅ Good: Fix with issue reference

```
fix(sidebar): remove hardcoded city name

Closes #12
```

### ✅ Good: Documentation update

```
docs: add deployment guide for contributors
```

### ✅ Good: Refactoring with scope

```
refactor(utils): simplify date formatting logic
```

## Bad Commit Examples

### ❌ Bad: No type prefix

```
added new feature to dashboard
```

❌ **Reason**: Missing conventional commit type

### ❌ Bad: Type not lowercase

```
Feat(map): Add geolocation tracking
```

❌ **Reason**: Type must be lowercase, subject must be lowercase

### ❌ Bad: Subject with period

```
feat(dashboard): add new widget.
```

❌ **Reason**: Subject line should not end with period

### ❌ Bad: Subject too long

```
feat(dashboard): add a new interactive geolocation tracking feature that allows users to track their real-time location on the map with accuracy metrics
```

❌ **Reason**: Exceeds 100 character limit

### ❌ Bad: Vague subject

```
fix: stuff
feat: update
chore: changes
```

❌ **Reason**: Subject is not descriptive

### ❌ Bad: Multiple types in single commit

```
feat/fix(map): add geolocation and fix rendering bug
```

❌ **Reason**: Should be separate commits for feature and bug fix

### ❌ Bad: Imperative mood violation

```
feat(auth): added JWT implementation
```

❌ **Reason**: Use "add" not "added" (imperative mood)

### ❌ Bad: No type at all

```
Update dashboard styling
```

❌ **Reason**: Missing type prefix entirely

## How Hooks Work

When you attempt to commit, Husky automatically runs CommitLint to validate your commit message. If the message doesn't follow the Conventional Commits format, the commit will be rejected with a clear error message explaining what's wrong.

### Example Rejected Commit

```
$ git commit -m "updated the dashboard"

⧗   input: updated the dashboard
✖   type must be lower-case [type-case]
✖   type is not recognized [type-enum]

```

### Fixing a Rejected Commit

Read the error message and adjust your commit message accordingly:

```
$ git commit -m "feat(dashboard): update styling and layout"
```

## Pre-Commit Hook Note

The pre-commit hook has been intentionally removed. We rely only on commit message linting to maintain code quality standards.

## Questions?

If you have questions about the commit guidelines, please open an issue or ask in our discussions.

Thank you for contributing! 🎉
