import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { listCommand } from "./commands/list.js";
import { publishCommand } from "./commands/publish.js";
import { runCommand } from "./commands/run.js";

const program = new Command();

program
  .name("toast")
  .description("xtc-toaster CLI — publish and manage toasts")
  .version("0.0.0");

program
  .command("login <login> <password>")
  .description("authenticate and store token locally")
  .action(loginCommand);

program
  .command("list")
  .description("list all published toasts")
  .action(listCommand);

program
  .command("publish")
  .description("publish a new toast")
  .requiredOption("-n, --name <name>", "toast name")
  .requiredOption("-p, --preview <path>", "path to preview gif")
  .option("-d, --description <text>", "optional description")
  .action((opts: { name: string; preview: string; description?: string }) =>
    publishCommand(opts)
  );

program
  .command("run <slug>")
  .description("apply a toast to an image")
  .requiredOption("-i, --input <path>", "input image path")
  .requiredOption("-o, --output <path>", "output image path")
  .option(
    "--param <key=value>",
    "toast parameter (repeatable)",
    (v: string, acc: string[]) => [...acc, v],
    [] as string[],
  )
  .action(async (slug: string, opts: { input: string; output: string; param: string[] }) =>
    runCommand(slug, opts)
  );

program.parse();
