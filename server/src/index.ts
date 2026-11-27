/**
 * Slice 6 — Apollo Server + per-request context
 *
 * After start: open http://localhost:4000
 * In Sandbox → Headers: { "x-user-id": "1" }
 */
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { createContext } from "./context.js";
import { typeDefs } from "./schema.js";
import { resolvers } from "./resolvers.js";

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
  context: async ({ req }) => createContext(req),
});

console.log(`Slice 6 ready (TS) — open Sandbox: ${url}`);
console.log(`Auth: set header x-user-id to a user id (e.g. "1" = ADMIN, "2" = USER)`);
