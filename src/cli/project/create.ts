import { spawnSync } from 'child_process';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import prompts from 'prompts';
import { generateReadme } from '../templates/readme.js';
import { execa } from 'execa';
import chalk from 'chalk';
import {
  createPackageJson,
  createTsConfig,
  createIndexTs,
  createExampleTool,
  createCliConfig,
} from '../templates/create.js';

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
  const configDir = join(srcDir, 'config');

  try {
    console.log(chalk.blue('📁 Creating project structure...'));
    await mkdir(projectDir);
    await mkdir(srcDir);
    await mkdir(toolsDir);
    await mkdir(configDir);

    // Use template functions
    const packageJson = createPackageJson(projectName);
    const tsconfig = createTsConfig();
    const indexTs = createIndexTs(options || {});
    const cliConfigTs = createCliConfig();

    const filesToWrite = [
      writeFile(join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2)),
      writeFile(join(projectDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2)),
      writeFile(join(projectDir, 'README.md'), generateReadme(projectName)),
      writeFile(join(srcDir, 'index.ts'), indexTs),
      writeFile(join(srcDir, 'config', 'cli.ts'), cliConfigTs),
    ];

    // Conditionally add the example tool
    if (shouldCreateExample) {
      const exampleToolTs = createExampleTool();
      filesToWrite.push(writeFile(join(toolsDir, 'ExampleTool.ts'), exampleToolTs));
    }

    console.log(chalk.blue('📝 Creating project files...'));
    await Promise.all(filesToWrite);

    if (shouldInstall) {
      console.log(chalk.blue('📦 Installing dependencies...'));
      const { stdout, stderr } = await execa('pnpm', ['install'], { cwd: projectDir });
      if (stderr) console.error(stderr);
      if (stdout) console.log(stdout);
    }

    console.log(chalk.green('✅ Project created successfully!'));
    console.log(chalk.cyan('\nNext steps:'));
    console.log(chalk.cyan(`  cd ${projectName}`));
    if (!shouldInstall) {
      console.log(chalk.cyan('  pnpm install'));
    }
    console.log(chalk.cyan('  pnpm build'));
    console.log(chalk.cyan('  pnpm start'));
  } catch (error) {
    console.error(chalk.red('❌ Error creating project:'), error);
    process.exit(1);
  }
}
