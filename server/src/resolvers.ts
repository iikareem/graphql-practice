/**
 * Slice 4 — Mutations + Input types
 *
 * Mutation resolvers receive `args.input` (or discrete args) and write via db.*.
 * Return the new/updated row so the client can select nested fields in the same request:
 *   mutation { createPost(input: {...}) { id title author { name } } }
 */
import type { GraphQLResolveInfo } from "graphql";
import { db, type CommentRow, type PostRow, type UserRow } from "./db.js";
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

export const resolvers = {
  Query: {
    hello: (): string => "Hello GraphQL — Slice 4 (mutations)",

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
