import { parseArgs } from "util";
import { resolve } from "path";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    input: { type: "string", short: "i" },
  },
});

const inputPath = values.input
  ?? resolve(import.meta.dirname, "assets/degas-076.sm.jpg");

console.log("[toast-1/degas] input:", inputPath);
