/**
 * Look-ahead helper: which fields did the client ask for under this resolver?
 * Used to fetch/project only those columns (draft of SQL column pruning).
 */
import type { GraphQLResolveInfo, FieldNode } from "graphql";

export function selectedFieldNames(info: GraphQLResolveInfo): string[] {
  const node = info.fieldNodes[0];
  const selections = node?.selectionSet?.selections ?? [];

  return selections
    .filter((s): s is FieldNode => s.kind === "Field")
    .filter((s) => s.name.value !== "__typename")
    .map((s) => s.name.value);
}
