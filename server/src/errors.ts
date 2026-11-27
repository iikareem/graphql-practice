/**
 * Slice 7 — Structured GraphQL errors
 *
 * Clients read `errors[].extensions.code` (not the message string) to branch UI.
 * Apollo ships BAD_USER_INPUT; we add common app codes for auth / missing rows.
 */
import { ApolloServerErrorCode } from "@apollo/server/errors";
import { GraphQLError } from "graphql";

export const ErrorCode = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  BAD_USER_INPUT: ApolloServerErrorCode.BAD_USER_INPUT,
} as const;

export type AppErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export function throwGraphQLError(
  message: string,
  code: AppErrorCode,
  extra?: Record<string, unknown>
): never {
  throw new GraphQLError(message, {
    extensions: { code, ...extra },
  });
}

export function unauthenticated(
  message = "Unauthorized: send header x-user-id with a valid user id"
): never {
  throwGraphQLError(message, ErrorCode.UNAUTHENTICATED);
}

export function forbidden(message: string): never {
  throwGraphQLError(message, ErrorCode.FORBIDDEN);
}

export function notFound(resource: string, id?: string): never {
  const message = id ? `${resource} not found: ${id}` : `${resource} not found`;
  throwGraphQLError(message, ErrorCode.NOT_FOUND, {
    resource,
    ...(id ? { id } : {}),
  });
}

export function badUserInput(
  message: string,
  extra?: Record<string, unknown>
): never {
  throwGraphQLError(message, ErrorCode.BAD_USER_INPUT, extra);
}
