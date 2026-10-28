import type { components } from "./api-schema";

// All API types come from the FastAPI OpenAPI schema (run `npm run gen:types` at the repo root).
type Schemas = components["schemas"];

export type User = Schemas["UserOut"];
export type DocumentFull = Schemas["DocumentOut"];
export type DocumentSummary = Schemas["DocumentSummary"];
export type DocumentList = Schemas["DocumentList"];
export type Share = Schemas["ShareOut"];
export type ShareRole = Schemas["ShareRole"];
export type Access = Schemas["Access"];
export type DocumentPatch = Pick<Schemas["DocumentUpdate"], "title" | "content">;
