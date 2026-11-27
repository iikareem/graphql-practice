/**
 * Slice 6 — GraphQL context (per-request bag)
 *
 * Apollo builds this once per HTTP request and passes it as the 3rd
 * resolver argument: (parent, args, context, info).
 *
 * Practice auth: client sends header `x-user-id: 1` → we look up the user.
 * Real apps swap this for JWT / session verification; the context pattern stays.
 */
import type { IncomingMessage } from "node:http";
import { db, type UserRow } from "./db.js";

export type GraphQLContext = {
  /** Authenticated user, or null if header missing / unknown id. */
  user: UserRow | null;
};

function readUserIdHeader(req: IncomingMessage): string | null {
  const raw = req.headers["x-user-id"];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && raw[0]?.trim()) return raw[0].trim();
  return null;
}

export function createContext(req: IncomingMessage): GraphQLContext {
  const userId = readUserIdHeader(req);
  const user = userId ? db.findUserById(userId) ?? null : null;
  return { user };
}
