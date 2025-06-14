import { ToolProtocol } from '../tools/BaseTool.js';
import { join, dirname } from 'path';
import { promises as fs, existsSync } from 'fs';
import { logger } from '../core/Logger.js';
import { discoverFilesRecursively, hasValidFiles } from '../utils/fileDiscovery.js';

export class ToolLoader {
  private readonly TOOLS_DIR: string;
  private readonly EXCLUDED_FILES = ['BaseTool.js', '*.test.js', '*.spec.js'];

  constructor(basePath?: string) {
    const projectRoot = process.cwd();
    const distToolsPath = join(projectRoot, 'dist', 'tools');

    if (existsSync(distToolsPath)) {
      this.TOOLS_DIR = distToolsPath;
      logger.debug(`Using project's dist/tools directory: ${this.TOOLS_DIR}`);
    } else if (basePath) {
      this.TOOLS_DIR = join(basePath, 'tools');
      logger.debug(`Using provided base path for tools: ${this.TOOLS_DIR}`);
    } else {
      // For backwards compatibility
      const mainModulePath = process.argv[1];
      const moduleDir = dirname(mainModulePath);

      if (moduleDir.endsWith('dist')) {
        this.TOOLS_DIR = join(moduleDir, 'tools');
      } else {
        this.TOOLS_DIR = join(moduleDir, 'dist', 'tools');
      }
      logger.debug(`Using module path for tools: ${this.TOOLS_DIR}`);
    }
  }

  async hasTools(): Promise<boolean> {
    try {
      const hasDistTools = await hasValidFiles(this.TOOLS_DIR, {
        extensions: ['.js'],
        excludePatterns: this.EXCLUDED_FILES,
      });

      if (hasDistTools) {
        logger.debug(`Found tools in ${this.TOOLS_DIR}`);
        return true;
      }

      logger.debug(`No tools found in ${this.TOOLS_DIR}`);
      return false;
    } catch (error) {
      logger.debug(`No tools directory found: ${(error as Error).message}`);
      return false;
    }
  }

  private validateTool(tool: any): tool is ToolProtocol {
    const isValid = Boolean(
      tool &&
        typeof tool.name === 'string' &&
        tool.toolDefinition &&
        typeof tool.toolCall === 'function'
    );

    if (isValid) {
      logger.debug(`Validated tool: ${tool.name}`);
    } else {
      logger.warn(`Invalid tool found: missing required properties`);
    }

    return isValid;
  }

  async loadTools(): Promise<ToolProtocol[]> {
    try {
      logger.debug(`Attempting to load tools from: ${this.TOOLS_DIR}`);

      const toolFiles = await discoverFilesRecursively(this.TOOLS_DIR, {
        extensions: ['.js'],
        excludePatterns: this.EXCLUDED_FILES,
      });

      if (toolFiles.length === 0) {
        logger.debug('No tool files found');
        return [];
      }

      logger.debug(`Found tool files: ${toolFiles.join(', ')}`);

      const tools: ToolProtocol[] = [];

      for (const file of toolFiles) {
        try {
          const fullPath = join(this.TOOLS_DIR, file);
          logger.debug(`Attempting to load tool from: ${fullPath}`);

          const importPath = `file://${fullPath}`;
          const module = await import(importPath);

          // Handle both CommonJS (module.default) and ES6 (module.default) exports
          let ToolClass = module.default;

          // If no default export, try the module itself (CommonJS style)
          if (!ToolClass && typeof module === 'function') {
            ToolClass = module;
          }

          // If still no class, try common export patterns
          if (!ToolClass) {
            // Try named exports or direct module.exports
            const keys = Object.keys(module);
            if (keys.length === 1) {
              ToolClass = module[keys[0]];
            }
          }

          if (!ToolClass) {
            logger.warn(`No valid export found in ${file}`);
            continue;
          }

          const tool = new ToolClass();
          if (this.validateTool(tool)) {
            tools.push(tool);
          }
        } catch (error) {
          logger.error(`Error loading tool ${file}: ${(error as Error).message}`);
        }
      }

      logger.debug(
        `Successfully loaded ${tools.length} tools: ${tools.map((t) => t.name).join(', ')}`
      );
      return tools;
    } catch (error) {
      logger.error(`Failed to load tools: ${(error as Error).message}`);
      return [];
    }
  }
}
