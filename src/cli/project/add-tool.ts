import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import prompts from 'prompts';
import { validateMCPProject } from '../utils/validate-project.js';
import { toPascalCase } from '../utils/string-utils.js';
import chalk from 'chalk';

export async function addTool(name?: string) {
  await validateMCPProject();

  let toolName = name;
  if (!toolName) {
    const response = await prompts([
      {
        type: 'text',
        name: 'name',
        message: chalk.cyan('🛠️  What is the name of your tool?'),
        validate: (value: string) =>
          /^[a-z0-9-]+$/.test(value)
            ? true
            : chalk.red('❌ Tool name can only contain lowercase letters, numbers, and hyphens'),
      },
    ]);

    if (!response.name) {
      console.log(chalk.yellow('⚠️  Tool creation cancelled'));
      process.exit(1);
    }

    toolName = response.name;
  }

  if (!toolName) {
    throw new Error(chalk.red('❌ Tool name is required'));
  }

  const className = toPascalCase(toolName);
  const fileName = `${className}Tool.ts`;
  const toolsDir = join(process.cwd(), 'src/tools');

  try {
    console.log(chalk.blue('📁 Creating tools directory...'));
    await mkdir(toolsDir, { recursive: true });

    const toolContent = `import { MCPTool } from "@magnolia-solutions/mcp-framework";
import { z } from "zod";

interface ${className}Input {
  message: string;
}

class ${className}Tool extends MCPTool<${className}Input> {
  name = "${toolName}";
  description = "${className} tool description";

  examples = {
    input: {
      message: "Hello, world!",
    },
    output: {
      type: "string",
      result: "Processed: Hello, world!",
    },
  };

  schema = {
    message: {
      type: z.string(),
      description: "Message to process",
    },
  };

  async execute(input: ${className}Input) {
    return \`Processed: \${input.message}\`;
  }
}

export default ${className}Tool;`;

    console.log(chalk.blue('📝 Creating tool file...'));
    await writeFile(join(toolsDir, fileName), toolContent);

    console.log(
      chalk.green(`
✨ Tool ${chalk.bold(toolName)} created successfully at ${chalk.yellow(`src/tools/${fileName}`)}
    `)
    );
  } catch (error) {
    console.error(chalk.red('❌ Error creating tool:'), error);
    process.exit(1);
  }
}
