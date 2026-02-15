---
mode: "agent"
description: "Structured code review — check quality, patterns, naming, tests, security, and VS Code API usage"
---

# Code Review

Perform a structured code review of the specified files or recent changes.

## Review Dimensions

### 1. Correctness
- Does the code do what it claims?
- Are edge cases handled (null, undefined, empty arrays, missing workspace)?
- Is error handling comprehensive with user-facing messages?
- Are async operations properly awaited?

### 2. Conventions
- Agent IDs: kebab-case
- Names/descriptions: Swedish
- Code identifiers/JSDoc: English
- File placement: `src/<module>/<name>.ts`
- Test placement: `src/<module>/<name>.test.ts`

### 3. Architecture
- Is the code in the right module?
- Does it follow the `BaseAgent` → `AgentRegistry` pattern?
- Does it respect the middleware pipeline?
- Is `AutonomousExecutor` used for file operations (not raw fs)?

### 4. Security
- Path traversal protection via `validatePath()`?
- No hardcoded agent lists?
- Input validation on user data?

### 5. Performance
- No unnecessary file reads in hot paths?
- Streaming responses rather than buffering?
- Cache properly used/invalidated?

### 6. Testing
- Test file exists?
- Covers happy path, errors, edge cases?
- Uses centralized VS Code mock?

## Output Format

Use this structure:
```
## Summary
[Overall assessment: approve / request changes / needs discussion]

## Issues
1. **[Severity]** [file:line] — Description
   - Suggestion: ...

## Positive Notes
- [Things done well]
```
