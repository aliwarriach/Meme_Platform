# Memory format & index

One file per backend feature/module. Purpose: let a new session (or the frontend, integrating against this backend) understand a feature **without re-reading the codebase** — token efficiency is the whole point. If a fact is obvious from the code/framework convention, or is already stated in a `CLAUDE.md`, it does not belong here — don't restate it.

## What belongs in a memory file
- Models: table name, key fields, non-obvious constraints (unique/composite keys, nullable rules).
- Endpoints: method + path + request/response shape (the actual contract, field names as they cross the wire) + auth requirement.
- Business rules that aren't derivable by reading one file in isolation (e.g. "one vote per user per period enforced by a DB constraint, not just the API").
- Gotchas: things that cost real debugging time or a non-obvious library choice (e.g. "passlib doesn't work with bcrypt>=4.1, we use `bcrypt` directly").
- File map: only the files someone would actually need to open to extend this feature.
- Status: what's built vs. deliberately deferred/stubbed.

## What does NOT belong
- Full code listings — point at the file/line instead.
- Anything a `CLAUDE.md` already states as a repo-wide rule (async-first, Pydantic at boundaries, etc.).
- Speculative/future design not yet built.
- Verbose prose — bullet points, short.

## Template
```markdown
# <feature-name>

## Status
<Done | In progress | Stubbed — what's stubbed and why>

## Models
- `TableName` (`app/models/x.py`): key fields, constraints.

## Endpoints
- `METHOD /path` — auth: yes/no — request `{...}` → response `{...}`

## Business rules
- ...

## Frontend integration notes
- Base URL / auth header shape, field name mapping (snake_case wire → camelCase client), anything the frontend must know that isn't obvious from the endpoint list.

## Gotchas
- ...

## Key files
- backend: ...
- frontend: ...

## Tests
- `backend/tests/test_x.py` — what's covered.
```

## Index
- [auth-profile.md](auth-profile.md) — User model, JWT auth, register/login/me.
