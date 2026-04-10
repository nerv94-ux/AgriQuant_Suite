<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor mode recommendation (before code-heavy work)

Before sharing substantial code, multi-file diffs, or non-trivial refactors, briefly tell the user which Cursor mode or model tier fits **this** task best, with one short reason. Use the labels that match their UI (e.g. Auto, Premium, Composer, Composer Fast).

Rough guide:

- **Auto** — mixed Q&A and small edits; good default when unsure.
- **Premium / stronger model** — subtle bugs, security-sensitive changes, Prisma/schema/migrations, or anything that depends on this repo’s non-standard Next.js (`node_modules/next/dist/docs/`).
- **Composer** — several files at once (UI + API + types), new features, or refactors that must stay consistent.
- **Composer Fast** — repetitive or mechanical edits, boilerplate, straightforward single-purpose patches.

Skip this line for trivial one-off fixes (a few lines, one obvious file).

## Backup Checkpoint Rule

- At the end of each major task block, ask the user: `백업 커밋할까요?`
- If the user says yes, run `git add -A`, create a commit, and push to `origin/master`.
- Keep commit messages concise and include why the backup point matters.
