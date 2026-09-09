---
description: Build your profile.yaml
allowed-tools: Read, Write, Edit, Bash(node tools/discover.mjs*), Bash(cp profile.example.yaml*), Bash(ls*)
---

# /setup — who are you, and what do you want

Read `profile.example.yaml` for the schema, then interview the user and write
`profile.yaml`. If it already exists, edit rather than overwrite.

Ask in small batches, in this order:

1. **Identity** — name, GitHub handle, email, timezone, links.
2. **Skills**, split three ways. Push on this: `strong` means "could be paid for
   it this week", `working` means "have shipped with it", `learning` means "am
   reading about it". Most people overstate. A profile that says everything is
   strong produces a shortlist full of things they cannot do.
3. **Work** — two or three things they have actually shipped, with links. The
   agent cites these when drafting, so a proposal can point at something real
   instead of asserting.
4. **Wants** — which opportunity types, the money floors, remote or not, what
   subject matter interests them.
5. **Avoid** — tech they do not want to touch, and keyword red flags. This is the
   cheapest filter in the system; a good `avoid` list saves money every night.
6. **Run limits** — how many to review deeply, how many to draft. Explain that
   these cap the nightly spend.

Then run `node tools/discover.mjs` and show them the shortlist. It is free, and
seeing the first results is what tells them whether the profile is right. Expect
to adjust `skills` and `avoid` immediately — that is normal, not a failure.
