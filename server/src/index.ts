/**
 * Slice 1 — Apollo Server bootstrap (TypeScript)
 *
 * After start: open http://localhost:4000
 * → Apollo Sandbox: schema explorer + run queries
 */
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { typeDefs } from "./schema.js";
import { resolvers } from "./resolvers.js";

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
});

console.log(`Slice 1 ready (TS) — open Sandbox: ${url}`);
