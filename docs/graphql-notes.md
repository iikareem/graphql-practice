# GraphQL notes (from our Q&A)

Lab: Apollo Server + TypeScript + schema-first `.graphql` file.  
Sandbox: `http://localhost:4000` after `npm run server`.

---

## Schema is written in SDL

Real GraphQL types look like this:

```graphql
type User {
  id: ID!
  name: String!
  email: String!
}
```

In this lab the contract lives in:

- `server/src/schema/schema.graphql` — shared SDL (good for teams)
- `server/src/schema.ts` — only **loads** that file

`gql\`...\`` in a `.ts` file is also common with Apollo; same SDL inside.  
Separate `.graphql` files are often better for team review and sharing.

---

## What `!` means (non-null)

| Type | Meaning |
|------|---------|
| `String` | string or `null` |
| `String!` | string, never `null` |
| `[User!]!` | always an array; items are never null |

`user(id: ID!): User` → argument required; return may be `null` if not found.

If a resolver returns `null` for a `!` field, GraphQL errors that field.

---

## `type Query` is the read entry point

```graphql
type Query {
  hello: String!
  users: [User!]!
  user(id: ID!): User
  posts(published: Boolean): [Post!]!
}
```

Client documents start at a root:

| Root | Role |
|------|------|
| `Query` | read |
| `Mutation` | write (later) |
| `Subscription` | live updates (later) |

You don’t call `GET /users` — you select fields under `Query`.

---

## How selected keys get returned (default resolvers)

You often only write the **root** resolver:

```ts
users: () => db.findUsers()
// returns { id, name, email, ... }
```

Client asks:

```graphql
{ users { id email } }
```

For each selected field GraphQL uses a **default field resolver**:

```ts
(parent) => parent[fieldName]  // parent.id, parent.email
```

So:

1. Keys on the returned object should **match** GraphQL field names (or map in a custom resolver).
2. The DB/object can have **extra** keys; GraphQL **builds** the JSON field-by-field from the selection — it doesn’t automatically mean you only fetched those DB columns.

---

## Two main ideas (response vs fetch)

### A) Default mapping (best default for scalars)

- Same names → GraphQL resolves each selected field from `parent`.
- Shapes the **response**.
- Does **not** by itself skip unused DB columns.

### B) Look-ahead (fetch optimization)

- In the resolver, read the selection from `info`.
- Build a column list → SQL/ORM/NoSQL selects only those.
- We demo this on `Query.users` → `db.findUsersSelect(fields)`.
- Watch the server log: `[db] findUsersSelect columns: [id, email]`.

**Look-ahead** = look into the query selection before hitting the DB.  
**Default per-field resolve** = build the response from `parent` after data is loaded.

---

## Relations (“joins”) = nested field resolvers

```graphql
{
  posts {
    title
    author { name }
  }
}
```

Typical flow:

1. `Query.posts` → load posts (once).
2. `Post.title` → default `parent.title`.
3. `Post.author` → **your** resolver, once **per post**:

```ts
author: (parent) => db.findUserById(parent.authorId)
```

4. `User.name` → default `parent.name`.

Important:

- Runs **per parent post**, not “once per unique author” (unless DataLoader caches).
- First argument is **`parent`** (the post), not usually a GraphQL arg like `postId`.
- Signature: `(parent, args, context, info)` — relation uses `parent.authorId`.

This is GraphQL’s join model. Without batching → **N+1** (later: DataLoader).

---

## Arguments: one value per arg

Invalid:

```graphql
{ user(id: 1, 2) { id email } }
```

Valid — one id:

```graphql
{ user(id: "1") { id email } }
```

Two users — **aliases**:

```graphql
{
  first: user(id: "1") { id email }
  second: user(id: "2") { id email }
}
```

Or design a list arg: `usersByIds(ids: [ID!]!)`.

---

## Mental model cheat sheet

```text
Client selection
    → root resolver loads data (optional look-ahead for columns)
    → each selected field resolved (default = parent.key, or custom)
    → nested object fields = more resolvers (relations)
    → JSON contains only what was selected
```

| Need | Pattern |
|------|---------|
| Response only has asked fields | Always (selection + field resolvers) |
| Don’t SELECT unused columns | Look-ahead + db/ORM select |
| Relate post → user | Nested resolver on `parent.authorId` |
| Avoid N+1 | DataLoader / batch query (later slice) |

---

## Slice 3 — Nested resolvers (implemented)

- Schema: `Post.author`, `Post.comments`, `User.posts`, `Comment.author`, `Comment.post`
- DB still has `authorId` / `postId` FKs — not exposed on `Post` in GraphQL anymore
- Logs: `[db] findUserById` / `findCommentsByPostId` so you can see N calls

Example:

```graphql
{
  posts(published: true) {
    title
    author { name }
    comments { text author { name } }
  }
}
```

---

## Lab commands

```bash
cd /Users/kareem/Documents/Projects/graphql-practice
npm install
npm run server
```

Open Apollo Sandbox: **http://localhost:4000**

Example queries: see root `README.md`.
