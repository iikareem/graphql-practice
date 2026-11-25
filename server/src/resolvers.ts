/**
 * Slice 3 — Nested resolvers
 *
 * Query.posts returns Post rows (with authorId in DB).
 * Post.author runs ONCE PER POST: (parent) => db.findUserById(parent.authorId)
 *
 * Watch the server log when you query posts { author { name } } — N findUserById calls.
 */
import type { GraphQLResolveInfo } from "graphql";
import { db, type CommentRow, type PostRow, type UserRow } from "./db.js";
import { selectedFieldNames } from "./fieldSelection.js";

export const resolvers = {
  Query: {
    hello: (): string => "Hello GraphQL — Slice 3 (nested resolvers)",

    users: (
      _parent: unknown,
      _args: unknown,
      _ctx: unknown,
      info: GraphQLResolveInfo
    ) => {
      const fields = selectedFieldNames(info);
      // Keep id when nested posts are selected (relation needs parent.id)
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

  User: {
    posts: (parent: UserRow | Partial<UserRow>) => {
      if (!parent.id) return [];
      return db.findPosts({ authorId: parent.id });
    },
  },

  Post: {
    author: (parent: PostRow) => {
      // parent = post row; args are empty — FK is on parent
      return db.findUserById(parent.authorId);
    },
    comments: (parent: PostRow) => db.findCommentsByPostId(parent.id),
  },

  Comment: {
    author: (parent: CommentRow) => db.findUserById(parent.authorId),
    post: (parent: CommentRow) => db.findPostById(parent.postId),
  },
};
