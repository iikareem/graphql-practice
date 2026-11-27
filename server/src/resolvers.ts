/**
 * Slice 6 — Context + auth gates
 *
 * Resolvers receive context as the 3rd argument.
 * Auth rules (practice, not production JWT):
 *   - createPost / addComment: must be logged in (context.user)
 *   - updatePost: owner of the post, or ADMIN
 *   - deletePost: ADMIN only
 */
import type { GraphQLResolveInfo } from "graphql";
import type { GraphQLContext } from "./context.js";
import {
  db,
  type CommentRow,
  type PostRow,
  type ProductRow,
  type UserRow,
} from "./db.js";
import { selectedFieldNames } from "./fieldSelection.js";

type CreatePostInput = {
  title: string;
  body: string;
  tags?: string[] | null;
  published?: boolean | null;
};

type UpdatePostInput = {
  title?: string | null;
  body?: string | null;
  tags?: string[] | null;
  published?: boolean | null;
};

type WithTypename<T extends string> = { __typename?: T };

function requireUser(ctx: GraphQLContext): UserRow {
  if (!ctx.user) {
    throw new Error("Unauthorized: send header x-user-id with a valid user id");
  }
  return ctx.user;
}

function requireAdmin(ctx: GraphQLContext): UserRow {
  const user = requireUser(ctx);
  if (user.role !== "ADMIN") {
    throw new Error("Forbidden: ADMIN role required");
  }
  return user;
}

export const resolvers = {
  Query: {
    hello: (): string => "Hello GraphQL — Slice 6 (context + auth)",

    me: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.user,

    users: (
      _parent: unknown,
      _args: unknown,
      _ctx: GraphQLContext,
      info: GraphQLResolveInfo
    ) => {
      const fields = selectedFieldNames(info);
      const cols =
        fields.length > 0 ? [...new Set(["id", ...fields])] : fields;
      return db.findUsersSelect(cols);
    },

    user: (_: unknown, args: { id: string }) => db.findUserById(args.id),

    posts: (_: unknown, args: { published?: boolean | null }) =>
      db.findPosts(
        args.published === null || args.published === undefined
          ? undefined
          : { published: args.published }
      ),

    post: (_: unknown, args: { id: string }) => db.findPostById(args.id),

    products: () => db.findProducts(),

    product: (_: unknown, args: { id: string }) =>
      db.findProductById(args.id),

    node: (_: unknown, args: { id: string }) => db.findNode(args.id),

    search: (_: unknown, args: { term: string }) => db.search(args.term),
  },

  Mutation: {
    createPost: (
      _: unknown,
      args: { input: CreatePostInput },
      ctx: GraphQLContext
    ) => {
      const user = requireUser(ctx);
      const { input } = args;
      return db.insertPost({
        title: input.title,
        body: input.body,
        authorId: user.id,
        tags: input.tags ?? [],
        published: input.published ?? false,
      });
    },

    updatePost: (
      _: unknown,
      args: { id: string; input: UpdatePostInput },
      ctx: GraphQLContext
    ) => {
      const user = requireUser(ctx);
      const existing = db.findPostById(args.id);
      if (!existing) {
        throw new Error(`Post not found: ${args.id}`);
      }
      if (existing.authorId !== user.id && user.role !== "ADMIN") {
        throw new Error("Forbidden: only the author or an ADMIN can update");
      }
      const updated = db.updatePost(args.id, {
        title: args.input.title ?? undefined,
        body: args.input.body ?? undefined,
        tags: args.input.tags ?? undefined,
        published: args.input.published ?? undefined,
      });
      if (!updated) {
        throw new Error(`Post not found: ${args.id}`);
      }
      return updated;
    },

    deletePost: (
      _: unknown,
      args: { id: string },
      ctx: GraphQLContext
    ) => {
      requireAdmin(ctx);
      const ok = db.deletePost(args.id);
      if (!ok) {
        throw new Error(`Post not found: ${args.id}`);
      }
      return true;
    },

    addComment: (
      _: unknown,
      args: { postId: string; text: string },
      ctx: GraphQLContext
    ) => {
      const user = requireUser(ctx);
      const row = db.insertComment({
        postId: args.postId,
        text: args.text,
        authorId: user.id,
      });
      if (!row) {
        throw new Error("Post not found");
      }
      return row;
    },
  },

  /**
   * Interface Node — GraphQL asks: which concrete type is this object?
   * Prefer __typename we attached in db.findNode; fall back to shape checks.
   */
  Node: {
    __resolveType(
      obj: WithTypename<"User" | "Post" | "Product"> &
        Partial<UserRow & PostRow & ProductRow>
    ): "User" | "Post" | "Product" | null {
      if (obj.__typename) return obj.__typename;
      if ("email" in obj && obj.email !== undefined) return "User";
      if ("price" in obj && obj.price !== undefined) return "Product";
      if ("title" in obj && obj.title !== undefined) return "Post";
      return null;
    },
  },

  /**
   * Union SearchResult — same idea: pick Post vs Product for each hit.
   */
  SearchResult: {
    __resolveType(
      obj: WithTypename<"Post" | "Product"> & Partial<PostRow & ProductRow>
    ): "Post" | "Product" | null {
      if (obj.__typename === "Post" || obj.__typename === "Product") {
        return obj.__typename;
      }
      if ("price" in obj && obj.price !== undefined) return "Product";
      if ("title" in obj && obj.title !== undefined) return "Post";
      return null;
    },
  },

  User: {
    posts: (parent: UserRow | Partial<UserRow>) => {
      if (!parent.id) return [];
      return db.findPosts({ authorId: parent.id });
    },
  },

  Post: {
    author: (parent: PostRow) => db.findUserById(parent.authorId),
    comments: (parent: PostRow) => db.findCommentsByPostId(parent.id),
  },

  Comment: {
    author: (parent: CommentRow) => db.findUserById(parent.authorId),
    post: (parent: CommentRow) => db.findPostById(parent.postId),
  },
};
