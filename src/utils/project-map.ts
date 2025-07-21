// utils/projectMapper.ts - Project Structure Mapping Utility
import * as fs from 'fs';
import * as path from 'path';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

interface ProjectFile {
  file: string;
  path: string;
  imports: string[];
  exports: string[];
}

interface ProjectStructure {
  files: ProjectFile[];
}

interface ProjectMapping {
  structure: ProjectStructure;
  summary: {
    totalFiles: number;
    filesByType: Record<string, number>;
    structureDepth: number;
    hasValidStructure: boolean;
  };
  validation: {
    fileStructure: boolean;
    supabase: boolean;
    tailwind: boolean;
  };
  supabaseInfo: {
    filesFound: number;
    hasConfig: boolean;
    migrationCount: number;
    hasSeedFile: boolean;
  };
}

export class ProjectStructureMapper {
  private excludedDirs = new Set([
    'node_modules', 
    '.git', 
    'dist', 
    'build', 
    '.next', 
    '.nuxt',
    'coverage',
    '.nyc_output',
    'temp-builds',
    '.temp'
  ]);

  private excludedFiles = new Set([
    '.DS_Store',
    'Thumbs.db',
    '.gitignore',
    '.env.local',
    '.env.development',
    '.env.production',
    'yarn.lock',
    'package-lock.json',
    'pnpm-lock.yaml'
  ]);

  private priorityDirs = new Set(['src', 'supabase', 'public', 'components', 'pages', 'utils', 'lib', 'types', 'contexts']);

  constructor(private projectPath: string) {}

  /**
   * Main function to map the entire project structure
   */
  async mapProjectStructure(): Promise<ProjectMapping> {
    console.log(`🗂️ Starting project mapping for: ${this.projectPath}`);
    
    const files = await this.scanDirectory(this.projectPath);
    const processedFiles = await this.processFiles(files);
    
    const mapping: ProjectMapping = {
      structure: {
        files: processedFiles
      },
      summary: this.generateSummary(processedFiles),
      validation: this.validateProject(processedFiles),
      supabaseInfo: this.analyzeSupabaseStructure(processedFiles)
    };

    console.log(`✅ Project mapping complete: ${processedFiles.length} files processed`);
    return mapping;
  }

  /**
   * Recursively scan directory for files
   */
  private async scanDirectory(dirPath: string, relativePath = ''): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await readdir(dirPath);
      
      for (const entry of entries) {
        if (this.excludedFiles.has(entry)) continue;
        
        const fullPath = path.join(dirPath, entry);
        const relativeEntryPath = path.join(relativePath, entry);
        const stats = await stat(fullPath);
        
        if (stats.isDirectory()) {
          if (this.excludedDirs.has(entry)) continue;
          
          // Prioritize important directories
          if (this.priorityDirs.has(entry) || relativePath === '' || this.isPriorityPath(relativeEntryPath)) {
            const subFiles = await this.scanDirectory(fullPath, relativeEntryPath);
            files.push(...subFiles);
          }
        } else if (stats.isFile()) {
          // Include all relevant file types
          if (this.isRelevantFile(entry)) {
            files.push(relativeEntryPath);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error scanning directory ${dirPath}:`, error);
    }
    
    return files;
  }

  /**
   * Check if a file is relevant for mapping
   */
  private isRelevantFile(fileName: string): boolean {
    const relevantExtensions = [
      '.ts', '.tsx', '.js', '.jsx',
      '.json', '.css', '.scss', '.sass',
      '.html', '.md', '.sql', '.env',
      '.yml', '.yaml', '.toml'
    ];
    
    const ext = path.extname(fileName).toLowerCase();
    return relevantExtensions.includes(ext) || 
           fileName === 'package.json' ||
           fileName === 'tailwind.config.ts' ||
           fileName === 'vite.config.ts' ||
           fileName === 'tsconfig.json';
  }

  /**
   * Check if path should be prioritized
   */
  private isPriorityPath(filePath: string): boolean {
    const pathParts = filePath.split(path.sep);
    return pathParts.some(part => this.priorityDirs.has(part));
  }

  /**
   * Process individual files to extract imports/exports
   */
  private async processFiles(filePaths: string[]): Promise<ProjectFile[]> {
    const processedFiles: ProjectFile[] = [];
    
    // Sort files to prioritize important ones
    const sortedFiles = this.sortFilesByPriority(filePaths);
    
    for (const filePath of sortedFiles) {
      try {
        const fullPath = path.join(this.projectPath, filePath);
        const fileInfo = await this.analyzeFile(fullPath, filePath);
        if (fileInfo) {
          processedFiles.push(fileInfo);
        }
      } catch (error) {
        console.warn(`⚠️ Error processing file ${filePath}:`, error);
        // Add basic file info even if analysis fails
        processedFiles.push({
          file: path.basename(filePath),
          path: `/${filePath.replace(/\\/g, '/')}`,
          imports: [],
          exports: []
        });
      }
    }
    
    return processedFiles;
  }

  /**
   * Sort files by priority (main files first)
   */
  private sortFilesByPriority(filePaths: string[]): string[] {
    const priority = [
      'package.json',
      'tailwind.config.ts',
      'vite.config.ts',
      'tsconfig.json',
      'src/App.tsx',
      'src/main.tsx',
      'src/index.tsx'
    ];

    return filePaths.sort((a, b) => {
      const aPriority = priority.indexOf(a);
      const bPriority = priority.indexOf(b);
      
      if (aPriority !== -1 && bPriority !== -1) {
        return aPriority - bPriority;
      }
      if (aPriority !== -1) return -1;
      if (bPriority !== -1) return 1;
      
      // Secondary sort: src files first, then by extension
      const aInSrc = a.startsWith('src/') ? 0 : 1;
      const bInSrc = b.startsWith('src/') ? 0 : 1;
      
      if (aInSrc !== bInSrc) return aInSrc - bInSrc;
      
      return a.localeCompare(b);
    });
  }

  /**
   * Analyze individual file for imports and exports
   */
  private async analyzeFile(fullPath: string, relativePath: string): Promise<ProjectFile | null> {
    const fileName = path.basename(relativePath);
    const ext = path.extname(fileName).toLowerCase();
    
    // Handle non-JS/TS files
    if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      return {
        file: fileName,
        path: `/${relativePath.replace(/\\/g, '/')}`,
        imports: this.getSpecialImports(ext, fileName),
        exports: []
      };
    }

    try {
      const content = await readFile(fullPath, 'utf-8');
      const { imports, exports } = this.parseJavaScriptFile(content, ext);
      
      return {
        file: fileName,
        path: `/${relativePath.replace(/\\/g, '/')}`,
        imports,
        exports
      };
    } catch (error) {
      console.warn(`⚠️ Failed to parse ${relativePath}:`, error);
      return {
        file: fileName,
        path: `/${relativePath.replace(/\\/g, '/')}`,
        imports: [],
        exports: []
      };
    }
  }

  /**
   * Get special imports for non-JS files
   */
  private getSpecialImports(ext: string, fileName: string): string[] {
    const imports: string[] = [];
    
    switch (ext) {
      case '.css':
      case '.scss':
      case '.sass':
        if (fileName.includes('tailwind') || fileName === 'index.css') {
          imports.push('tailwindcss');
        }
        break;
      case '.json':
        if (fileName === 'package.json') {
          imports.push('dependencies', 'devDependencies');
        }
        break;
    }
    
    return imports;
  }

  /**
   * Parse JavaScript/TypeScript files using Babel
   */
  private parseJavaScriptFile(content: string, ext: string): { imports: string[], exports: string[] } {
    const imports = new Set<string>();
    const exports = new Set<string>();
    
    try {
      const ast = parser.parse(content, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        plugins: [
          'typescript',
          'jsx',
          'asyncGenerators',
          'bigInt',
          'classProperties',
          'decorators-legacy',
          'doExpressions',
          'dynamicImport',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'functionBind',
          'functionSent',
          'importMeta',
          'nullishCoalescingOperator',
          'numericSeparator',
          'objectRestSpread',
          'optionalCatchBinding',
          'optionalChaining',
          'throwExpressions',
          'topLevelAwait'
        ]
      });

      traverse(ast, {
        ImportDeclaration(path) {
          const source = path.node.source.value;
          
          // Categorize imports
          if (source.startsWith('@/') || source.startsWith('./') || source.startsWith('../')) {
            if (source.includes('components')) imports.add('components');
            else if (source.includes('pages')) imports.add('pages');
            else if (source.includes('contexts')) imports.add('contexts');
            else if (source.includes('utils')) imports.add('utils');
            else if (source.includes('lib')) imports.add('lib');
            else if (source.includes('types')) imports.add('types');
            else if (source.includes('supabase')) imports.add('supabase');
            else imports.add('local');
          } else if (source.startsWith('react')) {
            imports.add('react');
          } else if (source.includes('router')) {
            imports.add('router');
          } else if (source.includes('supabase')) {
            imports.add('supabase');
          } else {
            imports.add(source.split('/')[0]);
          }
        },

        ExportDefaultDeclaration(path) {
          if (path.node.declaration.type === 'Identifier') {
            exports.add(path.node.declaration.name);
          } else if (path.node.declaration.type === 'FunctionDeclaration' && path.node.declaration.id) {
            exports.add(path.node.declaration.id.name);
          } else {
            exports.add('default');
          }
        },

        ExportNamedDeclaration(path) {
          if (path.node.specifiers.length > 0) {
            path.node.specifiers.forEach(spec => {
              if (spec.type === 'ExportSpecifier' && spec.exported.type === 'Identifier') {
                exports.add(spec.exported.name);
              }
            });
          }
          
          if (path.node.declaration) {
            if (path.node.declaration.type === 'VariableDeclaration') {
              path.node.declaration.declarations.forEach(decl => {
                if (decl.id.type === 'Identifier') {
                  exports.add(decl.id.name);
                }
              });
            } else if (path.node.declaration.type === 'FunctionDeclaration' && path.node.declaration.id) {
              exports.add(path.node.declaration.id.name);
            }
          }
        }
      });
    } catch (error) {
      console.warn(`⚠️ Babel parsing failed for file:`, error);
    }

    return {
      imports: Array.from(imports),
      exports: Array.from(exports)
    };
  }

  /**
   * Generate project summary
   */
  private generateSummary(files: ProjectFile[]) {
    const filesByType: Record<string, number> = {};
    let maxDepth = 0;
    
    files.forEach(file => {
      const ext = path.extname(file.file).substring(1) || 'other';
      filesByType[ext] = (filesByType[ext] || 0) + 1;
      
      const depth = file.path.split('/').length - 1;
      maxDepth = Math.max(maxDepth, depth);
    });

    return {
      totalFiles: files.length,
      filesByType,
      structureDepth: maxDepth,
      hasValidStructure: files.some(f => f.path.includes('/src/')) && 
                        files.some(f => f.file === 'package.json')
    };
  }

  /**
   * Validate project structure
   */
  private validateProject(files: ProjectFile[]) {
    return {
      fileStructure: files.some(f => f.path.includes('/src/')),
      supabase: files.some(f => f.path.includes('/supabase/')),
      tailwind: files.some(f => f.file.includes('tailwind'))
    };
  }

  /**
   * Analyze Supabase structure
   */
  private analyzeSupabaseStructure(files: ProjectFile[]) {
    const supabaseFiles = files.filter(f => f.path.includes('/supabase/'));
    const migrationFiles = supabaseFiles.filter(f => f.path.includes('/migrations/'));
    
    return {
      filesFound: supabaseFiles.length,
      hasConfig: supabaseFiles.some(f => f.file.includes('config')),
      migrationCount: migrationFiles.length,
      hasSeedFile: supabaseFiles.some(f => f.file.includes('seed'))
    };
  }

  /**
   * Generate clean JSON mapping (without metadata)
   */
  generateCleanMapping(mapping: ProjectMapping): string {
    const cleanMapping = {
      structure: mapping.structure,
      summary: mapping.summary,
      validation: mapping.validation,
      supabaseInfo: mapping.supabaseInfo
    };
    
    return JSON.stringify(cleanMapping, null, 2);
  }
}

/**
 * Utility function to map project structure
 */
export async function mapProjectStructure(projectPath: string): Promise<ProjectMapping> {
  const mapper = new ProjectStructureMapper(projectPath);
  return await mapper.mapProjectStructure();
}

/**
 * Generate clean mapping string for database storage
 */
export async function generateProjectMappingString(projectPath: string): Promise<string> {
  const mapper = new ProjectStructureMapper(projectPath);
  const mapping = await mapper.mapProjectStructure();
  return mapper.generateCleanMapping(mapping);
}