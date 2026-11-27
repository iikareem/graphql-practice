/**
 * In-memory DB (tables + repo helpers)
 *
 * Slice 5: Role enum on users + products table + search / node helpers.
 */

export type Role = "USER" | "ADMIN";

export type UserRow = {
    id: string;
    name: string;
    email: string;
    role: Role;
    password?: string;
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

export type ProductRow = {
    id: string;
    name: string;
    description: string;
    price: number;
    tags: string[];
};

const users: UserRow[] = [
    {id: "1", name: "Kareem", email: "kareem@example.com", role: "ADMIN", password: "false"},
    {id: "2", name: "Sara", email: "sara@example.com", role: "USER"},
    {id: "3", name: "Omar", email: "omar@example.com", role: "USER"},
];

const products: ProductRow[] = [
    {
        id: "1",
        name: "GraphQL Stickers",
        description: "Schema-first sticker pack",
        price: 9.99,
        tags: ["graphql", "merch"],
    },
    {
        id: "2",
        name: "Apollo Hoodie",
        description: "Warm debugging companion",
        price: 49.0,
        tags: ["apollo", "merch"],
    },
    {
        id: "3",
        name: "Relay Notebook",
        description: "Cursor pagination doodles",
        price: 14.5,
        tags: ["relay", "notes"],
    },
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
    {id: "1", text: "Clear and useful!", postId: "1", authorId: "3"},
    {id: "2", text: "Can you cover fragments next?", postId: "1", authorId: "2"},
    {id: "3", text: "Apollo Client cache tips?", postId: "2", authorId: "1"},
];

let nextPostId = 5;
let nextCommentId = 4;

const USER_COLUMNS = ["id", "name", "email", "role"] as const;
type UserColumn = (typeof USER_COLUMNS)[number];

export type NodeKind = "User" | "Post" | "Product";

/** Global id for interface Node — local ids collide across tables. */
export function toGlobalId(kind: NodeKind, id: string): string {
    return `${kind}:${id}`;
}

export function parseGlobalId(
    globalId: string
): { kind: NodeKind; id: string } | null {
    const [kind, ...rest] = globalId.split(":");
    const id = rest.join(":");
    if (!id || (kind !== "User" && kind !== "Post" && kind !== "Product")) {
        return null;
    }
    return { kind, id };
}

export const db = {
    findUsers(): UserRow[] {
        return [...users];
    },

    findUsersSelect(columns: string[]): Partial<UserRow>[] {
        const allowed = new Set<string>(USER_COLUMNS);
        const cols = columns.filter((c): c is UserColumn => allowed.has(c));

        console.log(`[db] findUsersSelect columns: [${cols.join(", ") || "(none)"}]`);

        return users.map((row) => {
            const out: Partial<UserRow> = {};
            for (const col of cols) {
                // Indexed assign across mixed column types needs a cast under strict TS.
                (out as Record<UserColumn, UserRow[UserColumn]>)[col] = row[col];
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

    findProducts(): ProductRow[] {
        return [...products];
    },

    findProductById(id: string): ProductRow | null {
        return products.find((p) => p.id === id) ?? null;
    },

    findCommentsByPostId(postId: string): CommentRow[] {
        console.log(`[db] findCommentsByPostId(${postId})`);
        return comments.filter((c) => c.postId === postId);
    },

    /**
     * Slice 5 — Node interface lookup via global id ("User:1").
     * Returns the row plus __typename so GraphQL can pick the concrete type.
     */
    findNode(
        globalId: string
    ):
        | (UserRow & { __typename: "User" })
        | (PostRow & { __typename: "Post" })
        | (ProductRow & { __typename: "Product" })
        | null {
        const parsed = parseGlobalId(globalId);
        if (!parsed) return null;

        if (parsed.kind === "User") {
            const row = users.find((u) => u.id === parsed.id);
            return row ? { ...row, __typename: "User" } : null;
        }
        if (parsed.kind === "Post") {
            const row = posts.find((p) => p.id === parsed.id);
            return row ? { ...row, __typename: "Post" } : null;
        }
        const row = products.find((p) => p.id === parsed.id);
        return row ? { ...row, __typename: "Product" } : null;
    },

    /**
     * Slice 5 — search across posts + products (union SearchResult).
     * Tags each hit with __typename for union resolution.
     */
    search(
        term: string
    ): Array<
        | (PostRow & { __typename: "Post" })
        | (ProductRow & { __typename: "Product" })
    > {
        const q = term.trim().toLowerCase();
        if (!q) return [];

        const matchedPosts = posts
            .filter(
                (p) =>
                    p.title.toLowerCase().includes(q) ||
                    p.body.toLowerCase().includes(q) ||
                    p.tags.some((t) => t.toLowerCase().includes(q))
            )
            .map((p) => ({ ...p, __typename: "Post" as const }));

        const matchedProducts = products
            .filter(
                (p) =>
                    p.name.toLowerCase().includes(q) ||
                    p.description.toLowerCase().includes(q) ||
                    p.tags.some((t) => t.toLowerCase().includes(q))
            )
            .map((p) => ({ ...p, __typename: "Product" as const }));

        console.log(
            `[db] search("${term}") → ${matchedPosts.length} posts, ${matchedProducts.length} products`
        );
        return [...matchedPosts, ...matchedProducts];
    },

    insertPost(data: {
        title: string;
        body: string;
        authorId: string;
        tags: string[];
        published: boolean;
    }): PostRow {
        const row: PostRow = {
            id: String(nextPostId++),
            title: data.title,
            body: data.body,
            authorId: data.authorId,
            tags: [...data.tags],
            published: data.published,
            createdAt: new Date().toISOString(),
        };
        posts.push(row);
        console.log(`[db] insertPost id=${row.id}`);
        return row;
    },

    updatePost(
        id: string,
        patch: {
            title?: string;
            body?: string;
            tags?: string[];
            published?: boolean;
        }
    ): PostRow | null {
        const row = posts.find((p) => p.id === id);
        if (!row) return null;
        if (patch.title !== undefined) row.title = patch.title;
        if (patch.body !== undefined) row.body = patch.body;
        if (patch.tags !== undefined) row.tags = [...patch.tags];
        if (patch.published !== undefined) row.published = patch.published;
        console.log(`[db] updatePost id=${id}`);
        return row;
    },

    deletePost(id: string): boolean {
        const index = posts.findIndex((p) => p.id === id);
        if (index === -1) return false;
        posts.splice(index, 1);
        // cascade comments for this post (simple in-memory FK cleanup)
        for (let i = comments.length - 1; i >= 0; i--) {
            if (comments[i]?.postId === id) comments.splice(i, 1);
        }
        console.log(`[db] deletePost id=${id}`);
        return true;
    },

    insertComment(data: {
        postId: string;
        text: string;
        authorId: string;
    }): CommentRow | null {
        if (!posts.some((p) => p.id === data.postId)) return null;
        if (!users.some((u) => u.id === data.authorId)) return null;
        const row: CommentRow = {
            id: String(nextCommentId++),
            text: data.text,
            postId: data.postId,
            authorId: data.authorId,
        };
        comments.push(row);
        console.log(`[db] insertComment id=${row.id}`);
        return row;
    },
};
