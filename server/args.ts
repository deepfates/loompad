import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const isReplit = Boolean(
  process.env.REPL_ID || process.env.REPL_SLUG || process.env.REPLIT_DB_URL,
);
const defaultPort = process.env.PORT
  ? Number(process.env.PORT)
  : process.platform === "darwin" && !isReplit
    ? 5173
    : 5000;

const argv = yargs(hideBin(process.argv))
  .option("port", {
    default: defaultPort,
    type: "number",
    describe: "Server port",
  })
  .option("mode", {
    default: "development",
    describe: "Server mode",
    choices: ["development", "production"],
  })
  .option("ssr", {
    default: false,
    type: "boolean",
    describe:
      "Enable server-side rendering.\n  *CSS SSR requires mode=production",
  }).argv;

if (process.env.DEBUG_ARGS) {
  console.log("Running with args:");
  for (const [key, value] of Object.entries(argv)) {
    if (key !== "_" && key !== "$0") {
      console.log(`  --${key} ${value}`);
    }
  }
}

export default argv as {
  port: number;
  mode: "development" | "production";
  ssr: boolean;
  _: (string | number)[];
  $0: string;
};
