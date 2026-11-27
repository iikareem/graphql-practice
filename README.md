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
git clone https://github.com/iikareem/graphql-practice.git
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
│   │   ├── index.ts          # Apollo bootstrap + context
│   │   ├── context.ts        # x-user-id → context.user
│   │   ├── errors.ts         # GraphQLError helpers + codes
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
| 4 | Done | Mutations + Input types (`createPost`, `updatePost`, `deletePost`, `addComment`) |
| 5 | Done | Enums (`Role`), interface (`Node`), union (`SearchResult`), `search` + inline fragments |
| 6 | Done | Context + simple auth (`x-user-id` → `context.user`, `me`, mutation gates) |
| 7 | Done | `GraphQLError` + `extensions.code` (`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_USER_INPUT`) |
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

**Mutations (Slice 4+6)** — set Sandbox **Headers** first:

```json
{ "x-user-id": "1" }
```

(`1` = Kareem / ADMIN, `2` = Sara / USER, `3` = Omar / USER)

```graphql
query WhoAmI {
  me {
    id
    name
    role
  }
}

mutation CreatePost {
  createPost(
    input: {
      title: "My first mutation"
      body: "Author comes from context.user — no authorId in input"
      tags: ["graphql"]
      published: true
    }
  ) {
    id
    title
    published
    author {
      name
    }
  }
}

mutation AddComment {
  addComment(postId: "1", text: "Nice post!") {
    id
    text
    author {
      name
    }
  }
}

mutation UpdatePost {
  updatePost(id: "1", input: { published: false }) {
    id
    title
    published
  }
}

mutation DeletePost {
  deletePost(id: "4")
}
```

Auth gates: missing `x-user-id` → `UNAUTHENTICATED`. `updatePost` = owner or ADMIN. `deletePost` = ADMIN only (try header `"2"` → `FORBIDDEN`). Empty title/body/text → `BAD_USER_INPUT`. Missing post id → `NOT_FOUND`.

**Structured errors (Slice 7)** — clients branch on `errors[].extensions.code`, not the message string:

```graphql
mutation BadInput {
  createPost(input: { title: "   ", body: "x" }) {
    id
  }
}
```

Example response shape:

```json
{
  "errors": [
    {
      "message": "title must not be empty",
      "path": ["createPost"],
      "extensions": { "code": "BAD_USER_INPUT", "field": "title" }
    }
  ],
  "data": null
}
```

**Enum + interface + union (Slice 5):**

```graphql
query RolesAndNode {
  users {
    name
    role
  }
  node(id: "User:1") {
    id
    ... on User {
      email
      role
    }
  }
  node(id: "Product:2") {
    ... on Product {
      name
      price
    }
  }
}

query SearchMixed {
  search(term: "graphql") {
    ... on Post {
      id
      title
      tags
    }
    ... on Product {
      id
      name
      price
    }
  }
}
```

`node` needs a **global id** (`User:1`, `Post:2`, `Product:1`) because local table ids collide. `search` returns a mix — without `... on Post` / `... on Product` you cannot ask for type-specific fields.

---

## Design choices

- **Schema-first:** teams review `schema.graphql`; TypeScript only implements resolvers.
- **DB-shaped memory store:** swap `db.ts` for Postgres/ORM later without rewriting the GraphQL surface.
- **Default field resolvers:** scalars resolve from `parent` when names match.
- **Look-ahead (draft):** `Query.users` uses `info` to project columns — a sketch of SQL `SELECT` pruning.
- **Nested resolvers:** relations use `parent` FKs (`authorId`, `postId`); DataLoader comes in Slice 9.
- **Context auth:** `x-user-id` header → `context.user`; mutations read author from context (Slice 6).
- **Structured errors:** resolvers throw `GraphQLError` with `extensions.code` so clients can switch on stable codes (Slice 7).

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
