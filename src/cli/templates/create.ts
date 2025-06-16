export interface ProjectOptions {
  http?: boolean;
  cors?: boolean;
  port?: number;
}

export function createPackageJson(projectName: string) {
  return {
    name: projectName,
    version: '0.0.1',
    description: `${projectName} MCP server`,
    type: 'module',
    bin: {
      [projectName]: './dist/index.js',
    },
    files: ['dist'],
    scripts: {
      build: 'tsc && mcp-build',
      watch: 'tsc --watch',
      start: 'node dist/index.js',
      inspect: 'pnpm dlx @modelcontextprotocol/inspector',
    },
    dependencies: {
      '@magnolia-solutions/mcp-framework': '^0.2.21',
      chalk: '^5.4.1',
      dayjs: '^1.11.13',
    },
    devDependencies: {
      '@types/node': '^20.11.24',
      typescript: '^5.3.3',
    },
    engines: {
      node: '>=18.19.0',
    },
  };
}

export function createTsConfig() {
  return {
    compilerOptions: {
      target: 'ESNext',
      module: 'ESNext',
      moduleResolution: 'node',
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      allowJs: true,
      resolveJsonModule: true,
    },
    include: ['src/**/*'],
    exclude: ['node_modules'],
  };
}

export function createIndexTs(options: ProjectOptions): string {
  const transportConfig = options.http
    ? createTransportConfig(options.port || 8080, options.cors)
    : '';

  return `import { MCPServer } from "@magnolia-solutions/mcp-framework";
import { parseCliArgs } from "./config/cli.js";
import chalk from "chalk";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const main = async () => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    process.chdir(resolve(__dirname, ".."));

    const config = parseCliArgs();
    console.log(chalk.green("Configuration loaded successfully"));

    const server = new MCPServer(${transportConfig});
    server.start();
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

main();`;
}

function createTransportConfig(port: number, cors?: boolean): string {
  const corsConfig = cors
    ? `,
      cors: {
        allowOrigin: "*"
      }`
    : '';

  return `{
    transport: {
      type: "http-stream",
      options: {
        port: ${port}${corsConfig}
      }
    }
  }`;
}

export function createExampleTool(): string {
  return `import { MCPTool } from "@magnolia-solutions/mcp-framework";
import { z } from "zod";
import { getApiKey } from "../config/cli.js";

interface ExampleInput {
  message: string;
}

class ExampleTool extends MCPTool<ExampleInput> {
  name = "example_tool";
  description = \`<use_case>
  Use this tool to get a list of packs with pagination and filtering capabilities.
</use_case>

<important_notes>
  The tool supports filtering by: 
  - Pack code
  Results are paginated for better performance.
</important_notes>

<workflow>
  1. Validates input parameters
  2. Applies filters if provided
  3. Returns paginated results with total count
</workflow>\`;

  schema = {
    message: {
      type: z.string(),
      description: "Message to process",
    },
  };

  examples = {
    input: {
      message: "Hello, world!",
    },
    output: {
      type: "string",
      result: "Processed: Hello, world!",
    },
  };

  async execute(input: ExampleInput) {
    const apiKey = getApiKey();
    return \`Processed: \${input.message} with API Key: \${apiKey}\`;
  }
}

export default ExampleTool;`;
}

export function createCliConfig(): string {
  return `import chalk from "chalk";

export const BASE_URL = process.env.API_BASE_URL ?? "https://api.example.com";

export interface CliConfig {
  apiKey: string;
  baseUrl: string;
}

export function parseCliArgs(): CliConfig {
  const args = process.argv.slice(2);

  const areArgsValid = args.length >= 1;
  if (!areArgsValid) {
    console.error(chalk.red("Missing required arguments:"));
    console.error(
      chalk.red(
        "Usage: node dist/index.js <apiKey> [baseUrl]"
      )
    );
    process.exit(1);
  }

  const [apiKey, baseUrl] = args;

  return {
    apiKey,
    baseUrl: baseUrl || BASE_URL,
  };
}

export function getApiKey(): string {
  return parseCliArgs().apiKey;
}`;
}
