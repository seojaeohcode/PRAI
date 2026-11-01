// Writes schema/prai.schema.json from the zod spec, so editors autocomplete and validate prai.json.
import fs from "node:fs";
import path from "node:path";
import { zodToJsonSchema } from "zod-to-json-schema";
import { Spec } from "../src/engine/spec.ts";
import { ROOT } from "./lib/project.ts";

const schema = zodToJsonSchema(Spec, { name: "PRAI", $refStrategy: "none" });
fs.writeFileSync(path.join(ROOT, "schema", "prai.schema.json"), JSON.stringify(schema, null, 1) + "\n");
console.log("schema/prai.schema.json written");
