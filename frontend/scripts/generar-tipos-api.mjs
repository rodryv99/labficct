// Genera src/api/schema.d.ts a partir del esquema OpenAPI del backend.
// Lee la dirección de la API desde frontend/.env (VITE_API_BASE_URL),
// así no hay ninguna URL escrita a mano. Uso: npm run gen:api
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const texto = readFileSync(new URL("../.env", import.meta.url), "utf8");
const linea = texto.split(/\r?\n/).find((l) => l.startsWith("VITE_API_BASE_URL="));
if (!linea) {
  console.error("Falta VITE_API_BASE_URL en frontend/.env");
  process.exit(1);
}
const base = linea.split("=")[1].trim().replace(/^"|"$/g, "").replace(/\/+$/, "");
const esquema = `${base}/schema/`;
console.log(`Leyendo ${esquema}`);
execSync(`npx openapi-typescript ${esquema} -o src/api/schema.d.ts`, { stdio: "inherit" });
