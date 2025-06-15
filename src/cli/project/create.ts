import { spawnSync } from 'child_process';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import prompts from 'prompts';
import { generateReadme } from '../templates/readme.js';
import { execa } from 'execa';
import chalk from 'chalk';

export async function createProject(
  name?: string,
  options?: { http?: boolean; cors?: boolean; port?: number; install?: boolean; example?: boolean }
) {
  let projectName: string;
  // Default install and example to true if not specified
  const shouldInstall = options?.install !== false;
  const shouldCreateExample = options?.example !== false;

  if (!name) {
    const response = await prompts([
      {
        type: 'text',
        name: 'projectName',
        message: chalk.cyan('🚀 What is the name of your MCP server project?'),
        validate: (value: string) =>
          /^[a-z0-9-]+$/.test(value)
            ? true
            : chalk.red('❌ Project name can only contain lowercase letters, numbers, and hyphens'),
      },
    ]);

    if (!response.projectName) {
      console.log(chalk.yellow('⚠️  Project creation cancelled'));
      process.exit(1);
    }

    projectName = response.projectName as string;
  } else {
    projectName = name;
  }

  if (!projectName) {
    throw new Error(chalk.red('❌ Project name is required'));
  }

  const projectDir = join(process.cwd(), projectName);
  const srcDir = join(projectDir, 'src');
  const toolsDir = join(srcDir, 'tools');

  try {
    console.log(chalk.blue('📁 Creating project structure...'));
    await mkdir(projectDir);
    await mkdir(srcDir);
    await mkdir(toolsDir);

    const packageJson = {
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
        '@magnolia-solutions/mcp-framework': '^0.2.19',
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

    const tsconfig = {
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

    let indexTs = '';

    if (options?.http) {
      const port = options.port || 8080;
      let transportConfig = `\n  transport: {
    type: "http-stream",
    options: {
      port: ${port}`;

      if (options.cors) {
        transportConfig += `,
      cors: {
        allowOrigin: "*"
      }`;
      }

      transportConfig += `
    }
  }`;

      indexTs = `import { MCPServer } from "@magnolia-solutions/mcp-framework";

const server = new MCPServer({${transportConfig}});

server.start();`;
    } else {
      indexTs = `import { MCPServer } from "@magnolia-solutions/mcp-framework";

const server = new MCPServer();

server.start();`;
    }

    const exampleToolTs = `import { MCPTool } from "@magnolia-solutions/mcp-framework";
import { z } from "zod";

interface ExampleInput {
  message: string;
}

class ExampleTool extends MCPTool<ExampleInput> {
  name = "example_tool";
  description = "<use_case>\n  Use this tool to get a list of packs with pagination and filtering capabilities.\n</use_case>\n\n<important_notes>\n  The tool supports filtering by:\n  - Pack code\n  Results are paginated for better performance.\n</important_notes>\n\n<workflow>\n  1. Validates input parameters\n  2. Applies filters if provided\n  3. Returns paginated results with total count\n</workflow>";

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
    return \`Processed: \${input.message}\`;
  }
}

export default ExampleTool;`;

    // Prepare the files to write
    const filesToWrite = [
      writeFile(join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2)),
      writeFile(join(projectDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2)),
      writeFile(join(projectDir, 'README.md'), generateReadme(projectName)),
      writeFile(join(srcDir, 'index.ts'), indexTs),
    ];

    // Conditionally add the example tool
    if (shouldCreateExample) {
      filesToWrite.push(writeFile(join(toolsDir, 'ExampleTool.ts'), exampleToolTs));
    }

    console.log(chalk.blue('📝 Creating project files...'));
    await Promise.all(filesToWrite);

    process.chdir(projectDir);

    console.log(chalk.blue('🔧 Initializing git repository...'));
    const gitInit = spawnSync('git', ['init'], {
      stdio: 'inherit',
      shell: true,
    });

    if (gitInit.status !== 0) {
      throw new Error(chalk.red('❌ Failed to initialize git repository'));
    }

    if (shouldInstall) {
      console.log(chalk.blue('📦 Installing dependencies...'));
      const pnpmInstall = spawnSync('pnpm', ['install'], {
        stdio: 'inherit',
        shell: true,
      });

      if (pnpmInstall.status !== 0) {
        throw new Error(chalk.red('❌ Failed to install dependencies'));
      }

      console.log(chalk.blue('🔨 Building project...'));
      const tscBuild = await execa('npx', ['tsc'], {
        cwd: projectDir,
        stdio: 'inherit',
      });

      if (tscBuild.exitCode !== 0) {
        throw new Error(chalk.red('❌ Failed to build TypeScript'));
      }

      const mcpBuild = await execa('npx', ['mcp-build'], {
        cwd: projectDir,
        stdio: 'inherit',
        env: {
          ...process.env,
          MCP_SKIP_VALIDATION: 'true',
        },
      });

      if (mcpBuild.exitCode !== 0) {
        throw new Error(chalk.red('❌ Failed to run mcp-build'));
      }

      console.log(
        chalk.green(`
✨ Project ${chalk.bold(projectName)} created and built successfully!

${chalk.cyan('Next steps:')}
1. ${chalk.yellow(`cd ${projectName}`)}
2. Add more tools using:
   ${chalk.yellow(`mcp add tool <n>`)}
    `)
      );
    } else {
      console.log(
        chalk.green(`
✨ Project ${chalk.bold(projectName)} created successfully (without dependencies)!

${chalk.cyan('Next steps:')}
1. ${chalk.yellow(`cd ${projectName}`)}
2. Run ${chalk.yellow("'pnpm install'")} to install dependencies
3. Run ${chalk.yellow("'pnpm run build'")} to build the project
4. Add more tools using:
   ${chalk.yellow(`mcp add tool <n>`)}
    `)
      );
    }
  } catch (error) {
    console.error(chalk.red('❌ Error creating project:'), error);
    process.exit(1);
  }
}
