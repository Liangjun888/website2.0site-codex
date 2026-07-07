# Gold Summit Capital Website

This repository is the deployed website code for Gold Summit Capital.

Project planning and progress are tracked separately in:

```text
https://github.com/Liangjun888/website2.0-codex
```

## Repository role

- Public website pages live here.
- Client login and the shared client document portal live here.
- Project planning, roadmap, and decision records do not live here.

## Client portal V1

The client portal uses Supabase for:

- email magic-link login;
- private PDF storage;
- monthly report metadata;
- admin upload workflow;
- Row Level Security access control.

Setup instructions are in `supabase/README.md`.

## Local checks

Run:

```powershell
node tests/check.mjs
```

In Codex desktop, use the bundled Node runtime if system `node` is unavailable:

```powershell
& 'C:\Users\zhou6\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests/check.mjs
```
