# GraphQL notes (from our Q&A)

Lab: Apollo Server + TypeScript + schema-first `.graphql` file.  
Sandbox: `http://localhost:4000` after `npm run server`.

---

## Slice 5 — Enum / Interface / Union (GraphQL, not TS)

These live in the **schema**. TypeScript only implements resolvers (`__resolveType`, `search`, etc.).

| Tool | Job | In this lab |
|------|-----|-------------|
| **Enum** | Fixed allowed values | `enum Role { USER ADMIN }` on `User.role` |
| **Interface** | Shared fields; many types implement them | `interface Node { id }` — `User`, `Post`, `Product` |
| **Union** | Field returns *one of* several types (no shared fields required) | `union SearchResult = Post \| Product` |

**`implements` vs `extend` (different jobs):**

| Keyword | Meaning |
|---------|---------|
| `implements` | This type **is a** Node (must have the interface fields) |
| `extend` | **Add more fields** to a type already defined (split schema across files) |

GraphQL has **no** OOP-style `extends` for object inheritance. Shared shape → interface + `implements`. One-of → union.

**Why inline fragments?** A union/interface result is polymorphic. GraphQL only lets you ask for fields that exist on the concrete type:

```graphql
search(term: "graphql") {
  __typename
  ... on Post { title }
  ... on Product { price }
}
```

### Names in GraphQL

| Term | Meaning |
|------|---------|
| **Abstract type** | `union` or `interface` |
| **Concrete type** | `Post`, `Product`, `User`, … |
| **Type resolver / `__resolveType`** | Picks the concrete type for each value |
| **Inline fragment** | `... on Post { ... }` |
| **Abstract type resolution** | The whole “figure out which type, then resolve its fields” step |

### How `search` connects to `SearchResult`

Same pattern as `posts` → `Post`. You do **not** call `SearchResult` from `search`. The **schema return type** wires them:

```graphql
search(term: String!): [SearchResult!]!
```

```ts
Query: {
  search: (_, args) => db.search(args.term),  // returns a list of objects
},
SearchResult: {
  __resolveType(obj) { ... },  // GraphQL runs this because return type is SearchResult
},
```

**Execution phases for a union field:**

```text
1. Query.search runs once → returns [row, row, …]
2. For each item → SearchResult.__resolveType → "Post" or "Product"
3. Then resolve that concrete type’s selected fields (... on Post / ... on Product)
```

Return type says “polymorphic.” `__resolveType` says “which one.” Then normal field resolvers run.

### `__typename` — server vs client

| Where | Job |
|-------|-----|
| **Server (internal)** | Tag / hint so `__resolveType` can return `"Post"` or `"Product"`. Happens even if the client never asks for `__typename`. |
| **Client (response)** | Only appears in JSON if the query selects it (or Apollo Client adds it). Used for UI branching + cache (`__typename` + `id`). |

So: server uses it to **resolve**; client uses it to **read/cache**. Same name, two stages.

### Why a wrong `__typename` can still “work”

We tried tagging posts as `__typename: "tt"` and search still worked.

`SearchResult.__resolveType` only trusts `__typename` when it is a **real** schema name (`"Post"` / `"Product"`). `"tt"` fails that check → **fallback to shape** (`title` → Post, `price` → Product).

That fallback is a learning safety net. In production prefer a correct `__typename` (or a clear discriminator); guessing from fields can collide.

**Global ids for `node`:** tables reuse `"1"`, `"2"`, … so `node(id: "1")` is ambiguous. Use `"User:1"`, `"Post:2"`, `"Product:1"`.

---

## What we locked in (`posts` / `Post` / mutations)

Plain version of the recent questions:

1. **Resolver names must match the schema** so GraphQL can find them.  
   - Schema has `type Query { posts ... }` and `type Post { author ... }`  
   - Code must have `Query.posts` and `Post.author` — same spelling.

2. **`posts` and `Post` are both real, and both need resolvers (different jobs).**  
   - `Query.posts` → get the list (runs **once**)  
   - `Post` → for each item, resolve selected fields like `author` / `comments`

3. **Execution order:**  
   run `posts` first → then for **each** returned post, go to `Post` field resolvers.

4. **Mutations reuse the same `Post` resolvers.**  
   - `createPost(...): Post!` means “this returns a Post”  
   - After create, if the client selects `author`, GraphQL runs `Post.author` — same map as after `Query.posts`  
   - One `Post: { author, comments }` serves queries **and** mutations

```text
Query.posts  ──once──► [post, post, …]
                              │
              for each post ──┤
                              ▼
                         Post.author
                         Post.comments
                         (only if selected)

Mutation.createPost ──► one post ──► same Post.* resolvers
```

Details below in the matching sections.

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

## Resolver keys must match the schema (by name)

GraphQL finds resolvers by **exact name**:

| Schema | Resolver key |
|--------|----------------|
| `type Query` + field `posts` | `Query.posts` |
| `type Post` | `Post: { ... }` |
| field `author` on `Post` | `Post.author` |

If the name is wrong (`Posts`, `Authors`), GraphQL won’t use your function — it falls back to the default resolver.

The same `Post` map is reused everywhere a `Post` is returned: `Query.posts`, `Query.post`, `createPost`, nested fields, etc.

```graphql
createPost(...): Post!   # return type name → uses Post resolvers
```

```ts
Mutation.createPost → returns PostRow
  → client selects author → Post.author(parent)
```

---

## `posts` vs `Post` — two different resolvers

They look similar but are **not** the same thing:

| In code | In schema | Job |
|---------|-----------|-----|
| `Query.posts` | Root field `posts` | **Get the list** (runs once) |
| `Post.author`, `Post.comments`, … | Fields on type `Post` | **Enrich each item** (runs per post, if selected) |

```ts
Query: {
  posts: (_, args) => db.findPosts(...)  // parent / entry — returns post rows
},

Post: {
  author: (parent) => db.findUserById(parent.authorId),  // per post
  comments: (parent) => db.findCommentsByPostId(parent.id),
},
```

`posts` = fetch many posts.  
`Post` = for one post object, how do its fields resolve?

**Execution:** run `posts` once → for **each** item, run selected fields under `Post`.

---

## Execution order: parent first, then each type’s fields

GraphQL walks the query **top → down**:

1. Run the **parent / root** resolver first (e.g. `Query.posts`) → get objects.
2. For **each** returned object, run resolvers for the **selected fields on that type**.
3. If a field returns another object (`author` → `User`), repeat for that type’s selected fields.

```text
Query.posts  →  [post1, post2, post3]          // once
     ↓
For each post:
  Post.title    → parent.title                 // default
  Post.author   → findUserById(authorId)       // custom
       ↓
  User.name     → parent.name                   // default
```

Only fields you asked for. Only types that appear in the result.

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
- N posts + `author` selected → `Post.author` runs **N times** (same for `comments`).

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

## Mutations vs queries + Input types (Slice 4)

| | Query | Mutation |
|--|--------|----------|
| Intent | read | write (create / update / delete) |
| Root type | `type Query` | `type Mutation` |
| Client keyword | `query { ... }` (or shorthand `{ ... }`) | `mutation { ... }` |

**Input types** — never pass a full `Post` object into a mutation. Use `input`:

```graphql
input CreatePostInput {
  title: String!
  body: String!
  authorId: ID!
  tags: [String!] = []
  published: Boolean = false
}

type Mutation {
  createPost(input: CreatePostInput!): Post!
}
```

Why `input`:
- Clear write payload (optional vs required fields differ from the output type)
- Can reuse one input across mutations
- Defaults (`= []`, `= false`) live on the input

After a mutation, select fields on the return type (including nested resolvers):

```graphql
mutation {
  createPost(input: { title: "Hi", body: "...", authorId: "1" }) {
    id
    title
    author { name }
  }
}
```

Flow: `Mutation.createPost` → `db.insertPost` → return row → `Post.author` runs if selected.

Because the return type is `Post!`, the resolver map key **`Post`** must exist and match — same as for `Query.posts`. The mutation does not get its own copy of `author` / `comments`; it reuses `Post`.

`authorId` in the input is temporary; Slice 6 moves “who am I” into context.

---

## Lab commands

```bash
cd /Users/kareem/Documents/Projects/graphql-practice
npm install
npm run server
```

Open Apollo Sandbox: **http://localhost:4000**

Example queries: see root `README.md`.
