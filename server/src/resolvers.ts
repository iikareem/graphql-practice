/**
 * Slice 5 — Enums, Interface, Union
 *
 * - Role enum: default resolver reads parent.role (must match enum values)
 * - Node / SearchResult: __resolveType tells GraphQL which concrete type
 * - Inline fragments (... on Post) only work after resolveType succeeds
 */
import type { GraphQLResolveInfo } from "graphql";
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
  authorId: string;
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

export const resolvers = {
  Query: {
    hello: (): string => "Hello GraphQL — Slice 5 (enum / interface / union)",

    users: (
      _parent: unknown,
      _args: unknown,
      _ctx: unknown,
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
    createPost: (_: unknown, args: { input: CreatePostInput }) => {
      const { input } = args;
      if (!db.findUserById(input.authorId)) {
        throw new Error(`User not found: ${input.authorId}`);
      }
      return db.insertPost({
        title: input.title,
        body: input.body,
        authorId: input.authorId,
        tags: input.tags ?? [],
        published: input.published ?? false,
      });
    },

    updatePost: (
      _: unknown,
      args: { id: string; input: UpdatePostInput }
    ) => {
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

    deletePost: (_: unknown, args: { id: string }) => {
      const ok = db.deletePost(args.id);
      if (!ok) {
        throw new Error(`Post not found: ${args.id}`);
      }
      return true;
    },

    addComment: (
      _: unknown,
      args: { postId: string; text: string; authorId: string }
    ) => {
      const row = db.insertComment({
        postId: args.postId,
        text: args.text,
        authorId: args.authorId,
      });
      if (!row) {
        throw new Error("Post or author not found");
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
