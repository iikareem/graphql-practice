# GraphQL Practice Lab

Hands-on GraphQL workshop built with **TypeScript**, **Apollo Server**, and a **schema-first** `.graphql` contract. Concepts are introduced in small slices you can run and inspect in Apollo Sandbox.

Study notes from deep-dive Q&A: [docs/graphql-notes.md](docs/graphql-notes.md)

---

## Stack

| Layer | Choice |
|--------|--------|
| Runtime | Node.js (ESM) + TypeScript (`tsx`) |
| API | Apollo Server 4 |
| Schema | SDL in `server/src/schema/schema.graphql` |
| Data | In-memory DB shaped like tables + repo helpers (`server/src/db.ts`) |
| Explorer | Apollo Sandbox at `http://localhost:4000` |

No real database required — the in-memory layer mirrors relational ideas (PKs, FKs, `find*` helpers) so resolvers look like production code.

---

## Quick start

```bash
git clone <repo-url>
cd graphql-practice
npm install
npm run server
```

Open **http://localhost:4000** and run queries in Sandbox.

---

## Project layout

```text
graphql-practice/
├── docs/
│   └── graphql-notes.md      # concepts: !, Query, look-ahead, N+1, …
├── server/
│   ├── src/
│   │   ├── index.ts          # Apollo bootstrap
│   │   ├── schema.ts         # loads SDL from disk
│   │   ├── schema/
│   │   │   └── schema.graphql
│   │   ├── resolvers.ts
│   │   ├── db.ts             # in-memory tables + helpers
│   │   └── fieldSelection.ts # look-ahead helper
│   ├── package.json
│   └── tsconfig.json
└── package.json              # npm workspaces
```

---

## Learning path (slices)

| Slice | Status | Focus |
|------:|:------:|--------|
| 1 | Done | Hello world, schema vs resolvers, Sandbox |
| 2 | Done | Object types, args, in-memory DB, look-ahead on `users` |
| 3 | Done | Nested resolvers (`author`, `comments`, `User.posts`) / N+1 visible in logs |
| 4 | Planned | Mutations + Input types |
| 5 | Planned | Enums, interfaces, unions |
| 6 | Planned | Context + simple auth (`x-user-id`) |
| 7 | Planned | `GraphQLError` + extensions |
| 8 | Planned | Cursor pagination |
| 9 | Planned | DataLoader (batch + per-request cache) |
| 10 | Planned | Apollo Client UI |
| 11 | Planned | Subscriptions |

Work one slice at a time; each builds on the last.

---

## Try it (current slices)

**Look-ahead (only project selected user fields)** — watch the server log:

```graphql
query {
  users {
    id
    email
  }
}
```

Expected log: `[db] findUsersSelect columns: [id, email]`

**Nested graph (N+1 demo)** — watch `[db] findUserById` per post:

```graphql
query {
  posts(published: true) {
    title
    author {
      name
    }
    comments {
      text
      author {
        name
      }
    }
  }
}
```

**User → posts:**

```graphql
query {
  user(id: "1") {
    name
    posts {
      title
      published
    }
  }
}
```

---

## Design choices

- **Schema-first:** teams review `schema.graphql`; TypeScript only implements resolvers.
- **DB-shaped memory store:** swap `db.ts` for Postgres/ORM later without rewriting the GraphQL surface.
- **Default field resolvers:** scalars resolve from `parent` when names match.
- **Look-ahead (draft):** `Query.users` uses `info` to project columns — a sketch of SQL `SELECT` pruning.
- **Nested resolvers:** relations use `parent` FKs (`authorId`, `postId`); DataLoader comes in Slice 9.

---

## Scripts

```bash
npm run server          # Apollo Server with watch reload
npm run typecheck -w server   # tsc --noEmit
```

---

## Requirements

- Node.js 20+ recommended
- npm 9+ (workspaces)

---

## License

MIT
