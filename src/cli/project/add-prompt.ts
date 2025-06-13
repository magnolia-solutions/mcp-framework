import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import prompts from 'prompts';
import { toPascalCase } from '../utils/string-utils.js';
import { validateMCPProject } from '../utils/validate-project.js';
import chalk from 'chalk';

export async function addPrompt(name?: string) {
  await validateMCPProject();

  let promptName = name;
  if (!promptName) {
    const response = await prompts([
      {
        type: 'text',
        name: 'name',
        message: chalk.cyan('💭 What is the name of your prompt?'),
        validate: (value: string) =>
          /^[a-z0-9-]+$/.test(value)
            ? true
            : chalk.red('❌ Prompt name can only contain lowercase letters, numbers, and hyphens'),
      },
    ]);

    if (!response.name) {
      console.log(chalk.yellow('⚠️  Prompt creation cancelled'));
      process.exit(1);
    }

    promptName = response.name;
  }

  if (!promptName) {
    throw new Error(chalk.red('❌ Prompt name is required'));
  }

  const className = toPascalCase(promptName);
  const fileName = `${className}Prompt.ts`;
  const promptsDir = join(process.cwd(), 'src/prompts');

  try {
    console.log(chalk.blue('📁 Creating prompts directory...'));
    await mkdir(promptsDir, { recursive: true });

    const promptContent = `import { MCPPrompt } from "@magnolia-solutions/mcp-framework";
import { z } from "zod";

interface ${className}Input {
  message: string;
}

class ${className}Prompt extends MCPPrompt<${className}Input> {
  name = "${promptName}";
  description = "${className} prompt description";

  schema = {
    message: {
      type: z.string(),
      description: "Message to process",
      required: true,
    },
  };

  async generateMessages({ message }: ${className}Input) {
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: message,
        },
      },
    ];
  }
}

export default ${className}Prompt;`;

    console.log(chalk.blue('📝 Creating prompt file...'));
    await writeFile(join(promptsDir, fileName), promptContent);

    console.log(
      chalk.green(`
✨ Prompt ${chalk.bold(promptName)} created successfully at ${chalk.yellow(`src/prompts/${fileName}`)}
    `)
    );
  } catch (error) {
    console.error(chalk.red('❌ Error creating prompt:'), error);
    process.exit(1);
  }
}
