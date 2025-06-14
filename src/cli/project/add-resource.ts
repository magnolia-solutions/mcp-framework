import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import prompts from 'prompts';
import { validateMCPProject } from '../utils/validate-project.js';
import { toPascalCase } from '../utils/string-utils.js';
import chalk from 'chalk';

export async function addResource(name?: string) {
  await validateMCPProject();

  let resourceName = name;
  if (!resourceName) {
    const response = await prompts([
      {
        type: 'text',
        name: 'name',
        message: chalk.cyan('📚 What is the name of your resource?'),
        validate: (value: string) =>
          /^[a-z0-9-]+$/.test(value)
            ? true
            : chalk.red(
                '❌ Resource name can only contain lowercase letters, numbers, and hyphens'
              ),
      },
    ]);

    if (!response.name) {
      console.log(chalk.yellow('⚠️  Resource creation cancelled'));
      process.exit(1);
    }

    resourceName = response.name;
  }

  if (!resourceName) {
    throw new Error(chalk.red('❌ Resource name is required'));
  }

  const className = toPascalCase(resourceName);
  const fileName = `${className}Resource.ts`;
  const resourcesDir = join(process.cwd(), 'src/resources');

  try {
    console.log(chalk.blue('📁 Creating resources directory...'));
    await mkdir(resourcesDir, { recursive: true });

    const resourceContent = `import { MCPResource, ResourceContent } from "@magnolia-solutions/mcp-framework";

class ${className}Resource extends MCPResource {
  uri = "resource://${resourceName}";
  name = "${className}";
  description = "${className} resource description";
  mimeType = "application/json";

  async read(): Promise<ResourceContent[]> {
    return [
      {
        uri: this.uri,
        mimeType: this.mimeType,
        text: JSON.stringify({ message: "Hello from ${className} resource" }),
      },
    ];
  }
}

export default ${className}Resource;`;

    console.log(chalk.blue('📝 Creating resource file...'));
    await writeFile(join(resourcesDir, fileName), resourceContent);

    console.log(
      chalk.green(`
✨ Resource ${chalk.bold(resourceName)} created successfully at ${chalk.yellow(`src/resources/${fileName}`)}
    `)
    );
  } catch (error) {
    console.error(chalk.red('❌ Error creating resource:'), error);
    process.exit(1);
  }
}
