/**
 * In-memory DB (tables + repo helpers)
 *
 * Slice 3: comments table + find-by-FK helpers for nested resolvers.
 */

export type UserRow = {
  id: string;
  name: string;
  email: string;
};

export type PostRow = {
  id: string;
  title: string;
  body: string;
  published: boolean;
  tags: string[];
  createdAt: string;
  authorId: string; // FK → users.id
};

export type CommentRow = {
  id: string;
  text: string;
  postId: string; // FK → posts.id
  authorId: string; // FK → users.id
};

const users: UserRow[] = [
  { id: "1", name: "Kareem", email: "kareem@example.com" },
  { id: "2", name: "Sara", email: "sara@example.com" },
  { id: "3", name: "Omar", email: "omar@example.com" },
];

const posts: PostRow[] = [
  {
    id: "1",
    title: "GraphQL Basics",
    body: "Queries ask. Schema is the contract.",
    published: true,
    tags: ["graphql", "basics"],
    createdAt: "2026-01-10T10:00:00.000Z",
    authorId: "1",
  },
  {
    id: "2",
    title: "Why Apollo?",
    body: "Apollo Server + Client give you a full GraphQL stack.",
    published: true,
    tags: ["apollo", "tooling"],
    createdAt: "2026-02-01T12:00:00.000Z",
    authorId: "2",
  },
  {
    id: "3",
    title: "Draft: N+1 deep dive",
    body: "WIP notes on DataLoader…",
    published: false,
    tags: ["performance"],
    createdAt: "2026-03-15T09:00:00.000Z",
    authorId: "1",
  },
  {
    id: "4",
    title: "Interfaces & Unions",
    body: "Shared fields vs one-of types.",
    published: true,
    tags: ["schema", "design"],
    createdAt: "2026-04-20T14:00:00.000Z",
    authorId: "2",
  },
];

const comments: CommentRow[] = [
  { id: "1", text: "Clear and useful!", postId: "1", authorId: "3" },
  { id: "2", text: "Can you cover fragments next?", postId: "1", authorId: "2" },
  { id: "3", text: "Apollo Client cache tips?", postId: "2", authorId: "1" },
];

const USER_COLUMNS = ["id", "name", "email"] as const;
type UserColumn = (typeof USER_COLUMNS)[number];

export const db = {
  findUsers(): UserRow[] {
    return [...users];
  },

  /**
   * Look-ahead: project only requested scalar columns (draft of SELECT list).
   */
  findUsersSelect(columns: string[]): Partial<UserRow>[] {
    const allowed = new Set<string>(USER_COLUMNS);
    const cols = columns.filter((c): c is UserColumn => allowed.has(c));

    console.log(`[db] findUsersSelect columns: [${cols.join(", ") || "(none)"}]`);

    return users.map((row) => {
      const out: Partial<UserRow> = {};
      for (const col of cols) {
        out[col] = row[col];
      }
      return out;
    });
  },

  findUserById(id: string): UserRow | null {
    console.log(`[db] findUserById(${id})`);
    return users.find((u) => u.id === id) ?? null;
  },

  findPosts(filter?: { published?: boolean; authorId?: string }): PostRow[] {
    let rows = [...posts];
    if (filter?.published !== undefined) {
      rows = rows.filter((p) => p.published === filter.published);
    }
    if (filter?.authorId !== undefined) {
      rows = rows.filter((p) => p.authorId === filter.authorId);
    }
    return rows;
  },

  findPostById(id: string): PostRow | null {
    return posts.find((p) => p.id === id) ?? null;
  },

  findCommentsByPostId(postId: string): CommentRow[] {
    console.log(`[db] findCommentsByPostId(${postId})`);
    return comments.filter((c) => c.postId === postId);
  },
};
