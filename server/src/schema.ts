/**
 * Loads SDL from .graphql files (schema-first, team-friendly).
 * Add more files under ./schema/ later; loadDocuments / merge as needed.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gql } from "graphql-tag";

const here = dirname(fileURLToPath(import.meta.url));

const sdl = readFileSync(join(here, "schema", "schema.graphql"), "utf8");

export const typeDefs = gql(sdl);
