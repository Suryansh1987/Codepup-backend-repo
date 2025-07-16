// ============================================================================
// COMPLETE ANALYSIS & GENERATION ENGINE WITH SUPABASE INTEGRATION
// ============================================================================

import { join, dirname, resolve, relative } from 'path';
import { promises as fs } from 'fs';
import * as babel from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ComponentTypeAnalysis {
  type: 'page' | 'component';
  name: string;
  confidence: number;
  reasoning: string;
  targetDirectory: string;
  fileName: string;
  needsRouting: boolean;
  description?: string;
  category?: string;
  fileExtension?: string;

  // Database/Context functionality detection
  needsFullContext?: boolean;
  contextFiles?: string[];
  contextKeywords?: string[];
}

export interface ElementNode {
  tag: string;
  isComponent: boolean;
  children: ElementNode[];
  props?: string[];
}

export interface ImportInfo {
  name: string;
  source: string;
  type: 'default' | 'named' | 'namespace';
  isComponent: boolean;
}

export interface ExportInfo {
  name: string;
  type: 'default' | 'named';
  isComponent: boolean;
}

export interface ProjectFile {
  path: string;
  relativePath: string;
  content: string;
  lines: number;
  fileType: string;
  exportPattern?: 'default' | 'named' | 'mixed';
  importPattern?: 'default' | 'named' | 'mixed';
  elementTree?: ElementNode;
  imports?: ImportInfo[];
  exports?: ExportInfo[];
  mainComponent?: string;
  dependencies?: string[];
  isAppFile?: boolean;
  isRouteFile?: boolean;
}

export interface GenerationResult {
  success: boolean;
  generatedContent: string;
  componentType: ComponentTypeAnalysis;
  elementTreeContext: string;
  supabaseSchemaContext: string;  // 🔥 NEW: Always included
  fullContextContent?: string;
  projectPatterns: {
    exportPattern: 'default' | 'named' | 'mixed';
    importPattern: 'default' | 'named' | 'mixed';
    routingPattern: 'react-router' | 'next' | 'reach-router' | 'basic';
    appFilePath?: string;
    routeFilePath?: string;
  };
  componentMap: Map<string, string>;
  projectFiles: Map<string, ProjectFile>;
  existingRoutes: string[];
  error?: string;
}

// ============================================================================
// ENHANCED BABEL ANALYZER
// ============================================================================

export class EnhancedBabelAnalyzer {
  private componentMap: Map<string, string> = new Map();

  analyzeFile(content: string, filePath: string): {
    elementTree?: ElementNode;
    imports: ImportInfo[];
    exports: ExportInfo[];
    mainComponent?: string;
    dependencies: string[];
    isAppFile: boolean;
    isRouteFile: boolean;
    routingInfo?: {
      hasRouter: boolean;
      routeComponents: string[];
      routingLibrary?: string;
    };
  } {
    try {
      const ast = babel.parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx']
      });

      const result = {
        imports: [] as ImportInfo[],
        exports: [] as ExportInfo[],
        dependencies: [] as string[],
        mainComponent: undefined as string | undefined,
        elementTree: undefined as ElementNode | undefined,
        isAppFile: false,
        isRouteFile: false,
        routingInfo: {
          hasRouter: false,
          routeComponents: [] as string[],
          routingLibrary: undefined as string | undefined
        }
      };

      traverse(ast, {
        ImportDeclaration: (path) => this.analyzeImport(path.node, result),
        ExportDefaultDeclaration: (path) => this.analyzeDefaultExport(path.node, result),
        ExportNamedDeclaration: (path) => this.analyzeNamedExport(path.node, result),
        FunctionDeclaration: (path) => {
          if (this.isReactComponent(path.node)) {
            result.mainComponent = path.node.id?.name;
            result.elementTree = this.buildElementTreeFromFunction(path.node);
          }
        },
        VariableDeclarator: (path) => {
          if (t.isArrowFunctionExpression(path.node.init) && 
              t.isIdentifier(path.node.id) && 
              this.isReactArrowComponent(path.node.init)) {
            result.mainComponent = path.node.id.name;
            result.elementTree = this.buildElementTreeFromArrow(path.node.init);
          }
        },
        JSXElement: (path) => this.analyzeJSXForRouting(path.node, result)
      });

      result.isAppFile = this.isAppFile(filePath, result);
      result.isRouteFile = this.isRouteFile(filePath, result);

      if (result.mainComponent) {
        this.componentMap.set(result.mainComponent, filePath);
      }

      return result;
    } catch (error) {
      console.log(`Error analyzing file ${filePath}:`, error);
      return {
        imports: [],
        exports: [],
        dependencies: [],
        mainComponent: undefined,
        elementTree: undefined,
        isAppFile: false,
        isRouteFile: false
      };
    }
  }

  private analyzeImport(node: t.ImportDeclaration, result: any): void {
    const source = node.source.value;
    
    if (['react-router-dom', 'react-router', '@reach/router', 'next/router'].includes(source)) {
      result.routingInfo.hasRouter = true;
      result.routingInfo.routingLibrary = source;
    }

    node.specifiers.forEach(spec => {
      let importInfo: ImportInfo;

      if (t.isImportDefaultSpecifier(spec)) {
        importInfo = {
          name: spec.local.name,
          source,
          type: 'default',
          isComponent: this.isComponentImport(source, spec.local.name)
        };
      } else if (t.isImportSpecifier(spec)) {
        const importedName = t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value;
        importInfo = {
          name: importedName,
          source,
          type: 'named',
          isComponent: this.isComponentImport(source, spec.local.name)
        };
        
        if (['BrowserRouter', 'Router', 'Route', 'Routes', 'Switch'].includes(importedName)) {
          result.routingInfo.hasRouter = true;
        }
      } else if (t.isImportNamespaceSpecifier(spec)) {
        importInfo = {
          name: spec.local.name,
          source,
          type: 'namespace',
          isComponent: false
        };
      } else {
        return;
      }

      result.imports.push(importInfo);
      
      if (source.startsWith('./') || source.startsWith('../')) {
        result.dependencies.push(source);
      }
    });
  }

  private analyzeDefaultExport(node: t.ExportDefaultDeclaration, result: any): void {
    let name = 'default';
    
    if (t.isIdentifier(node.declaration)) {
      name = node.declaration.name;
    } else if (t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
      name = node.declaration.id.name;
    }

    result.exports.push({
      name,
      type: 'default',
      isComponent: this.isComponentName(name)
    });
  }

  private analyzeNamedExport(node: t.ExportNamedDeclaration, result: any): void {
    if (node.specifiers) {
      node.specifiers.forEach(spec => {
        if (t.isExportSpecifier(spec)) {
          const name = t.isIdentifier(spec.exported) ? spec.exported.name : spec.exported.value;
          result.exports.push({
            name,
            type: 'named',
            isComponent: this.isComponentName(name)
          });
        }
      });
    }

    if (node.declaration) {
      if (t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
        result.exports.push({
          name: node.declaration.id.name,
          type: 'named',
          isComponent: this.isComponentName(node.declaration.id.name)
        });
      } else if (t.isVariableDeclaration(node.declaration)) {
        node.declaration.declarations.forEach(decl => {
          if (t.isIdentifier(decl.id)) {
            result.exports.push({
              name: decl.id.name,
              type: 'named',
              isComponent: this.isComponentName(decl.id.name)
            });
          }
        });
      }
    }
  }

  private analyzeJSXForRouting(node: t.JSXElement, result: any): void {
    const openingElement = node.openingElement;
    let tagName = '';

    if (t.isJSXIdentifier(openingElement.name)) {
      tagName = openingElement.name.name;
    }

    if (['Route', 'Switch', 'Routes', 'Router', 'BrowserRouter'].includes(tagName)) {
      result.routingInfo.hasRouter = true;

      if (tagName === 'Route') {
        const componentAttr = openingElement.attributes.find(attr =>
          t.isJSXAttribute(attr) &&
          t.isJSXIdentifier(attr.name) &&
          attr.name.name === 'component'
        );

        if (
          componentAttr &&
          t.isJSXAttribute(componentAttr) &&
          componentAttr.value &&
          t.isJSXExpressionContainer(componentAttr.value) &&
          t.isIdentifier(componentAttr.value.expression)
        ) {
          result.routingInfo.routeComponents.push(componentAttr.value.expression.name);
        }
      }
    }
  }

  private buildElementTreeFromFunction(node: t.FunctionDeclaration): ElementNode | undefined {
    if (!node.body || !t.isBlockStatement(node.body)) return undefined;

    const returnStatement = node.body.body.find(stmt => t.isReturnStatement(stmt)) as t.ReturnStatement;
    if (!returnStatement?.argument) return undefined;

    return this.parseJSXElement(returnStatement.argument);
  }

  private buildElementTreeFromArrow(node: t.ArrowFunctionExpression): ElementNode | undefined {
    if (t.isBlockStatement(node.body)) {
      const returnStatement = node.body.body.find(stmt => t.isReturnStatement(stmt)) as t.ReturnStatement;
      if (!returnStatement?.argument) return undefined;
      return this.parseJSXElement(returnStatement.argument);
    } else {
      return this.parseJSXElement(node.body);
    }
  }

  private parseJSXElement(node: t.Node): ElementNode | undefined {
    if (t.isJSXElement(node)) {
      return this.createElementNode(node);
    } else if (t.isJSXFragment(node)) {
      return {
        tag: 'Fragment',
        isComponent: false,
        children: node.children.map(child => this.parseJSXElement(child)).filter(Boolean) as ElementNode[]
      };
    } else if (t.isParenthesizedExpression(node)) {
      return this.parseJSXElement(node.expression);
    }
    return undefined;
  }

  private createElementNode(node: t.JSXElement): ElementNode {
    const openingElement = node.openingElement;
    let tag = '';

    if (t.isJSXIdentifier(openingElement.name)) {
      tag = openingElement.name.name;
    } else if (t.isJSXMemberExpression(openingElement.name)) {
      tag = this.getJSXMemberExpressionName(openingElement.name);
    }

    const isComponent = this.isCustomComponent(tag);

    const props = openingElement.attributes
      .filter(attr => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name))
      .map(attr => (attr as t.JSXAttribute).name.name as string);

    const children = node.children
      .map(child => this.parseJSXElement(child))
      .filter(Boolean) as ElementNode[];

    return {
      tag,
      isComponent,
      children,
      props: props.length > 0 ? props : undefined
    };
  }

  private getJSXMemberExpressionName(node: t.JSXMemberExpression): string {
    if (t.isJSXIdentifier(node.object) && t.isJSXIdentifier(node.property)) {
      return `${node.object.name}.${node.property.name}`;
    }
    return 'Unknown';
  }

  private isAppFile(filePath: string, result: any): boolean {
    const fileName = filePath.toLowerCase();
    const hasAppName = fileName.includes('app.') || fileName.endsWith('/app.tsx') || fileName.endsWith('/app.jsx');
    const hasRouting = result.routingInfo.hasRouter;
    const hasMainExport = result.exports.some((exp: any) => exp.name === 'App' || exp.name === 'default');
    
    return hasAppName || (hasRouting && hasMainExport);
  }

  private isRouteFile(filePath: string, result: any): boolean {
    const fileName = filePath.toLowerCase();
    const hasRouteInName = fileName.includes('route') || fileName.includes('routes');
    const hasRouteComponents = result.routingInfo.routeComponents.length > 0;
    
    return hasRouteInName || hasRouteComponents;
  }

  private isReactComponent(node: t.FunctionDeclaration): boolean {
    return node.id ? this.isComponentName(node.id.name) : false;
  }

  private isReactArrowComponent(node: t.ArrowFunctionExpression): boolean {
    if (t.isJSXElement(node.body) || t.isJSXFragment(node.body)) return true;
    
    if (t.isBlockStatement(node.body)) {
      const returnStmt = node.body.body.find(stmt => t.isReturnStatement(stmt)) as t.ReturnStatement;
      return returnStmt && (t.isJSXElement(returnStmt.argument) || t.isJSXFragment(returnStmt.argument));
    }
    
    return false;
  }

  private isComponentName(name: string): boolean {
    return /^[A-Z]/.test(name);
  }

  private isCustomComponent(tagName: string): boolean {
    return /^[A-Z]/.test(tagName);
  }

  private isComponentImport(source: string, name: string): boolean {
    return (source.startsWith('./') || source.startsWith('../')) && this.isComponentName(name);
  }

  getComponentMap(): Map<string, string> {
    return this.componentMap;
  }

  createElementTreeSummary(filePath: string, elementTree: ElementNode): string {
    const summary = this.elementTreeToString(elementTree, 0);
    return `FILE: ${filePath}\nSTRUCTURE:\n${summary}`;
  }

  private elementTreeToString(node: ElementNode, depth: number): string {
    const indent = '  '.repeat(depth);
    let result = `${indent}<${node.tag}`;
    
    if (node.props && node.props.length > 0) {
      result += ` props=[${node.props.join(',')}]`;
    }
    
    result += `${node.isComponent ? ' [COMPONENT]' : ''}>\n`;
    
    for (const child of node.children) {
      result += this.elementTreeToString(child, depth + 1);
    }
    
    return result;
  }
}

// ============================================================================
// MAIN ANALYSIS & GENERATION ENGINE
// ============================================================================

export class AnalysisAndGenerationEngine {
  private anthropic: any;
  private reactBasePath: string;
  private streamCallback?: (message: string) => void;
  private babelAnalyzer: EnhancedBabelAnalyzer;
  private messageDB?: any;

  constructor(anthropic: any, reactBasePath: string, messageDB?: any) {
    this.anthropic = anthropic;
    this.reactBasePath = resolve(reactBasePath);
    this.babelAnalyzer = new EnhancedBabelAnalyzer();
    this.messageDB = messageDB;
  }

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
  }

  private streamUpdate(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
    console.log(message);
  }

  // ============================================================================
  // PROJECT STRUCTURE CONTEXT FROM DATABASE
  // ============================================================================

  private async getProjectStructureContext(projectId?: number): Promise<string> {
    if (!projectId || !this.messageDB) {
      this.streamUpdate(`⚠️ No project structure context available`);
      return '';
    }

    try {
      this.streamUpdate(`📋 Retrieving project structure from database...`);
      
      const structure = await this.messageDB.getProjectStructure(projectId);
      
      if (structure) {
        this.streamUpdate(`📊 Structure retrieved: ${structure.length} characters`);
        return typeof structure === 'string' ? structure : JSON.stringify(structure);
      } else {
        this.streamUpdate(`⚠️ No project structure found for project ${projectId}`);
        return '';
      }
    } catch (error) {
      this.streamUpdate(`⚠️ Could not retrieve project structure: ${error}`);
      return '';
    }
  }

  // ============================================================================
  // FILE SCANNING WITH MANDATORY SUPABASE INTEGRATION
  // ============================================================================

  private async scanProjectFiles(): Promise<Map<string, ProjectFile>> {
    const projectFiles = new Map<string, ProjectFile>();

    // 🔥 MANDATORY: Always scan Supabase files first
    this.streamUpdate('🗄️  MANDATORY: Scanning Supabase database schema...');
    await this.scanSupabaseMigrations(projectFiles);

    // Scan root config files
    await this.scanRootConfigFiles(projectFiles);
    
    // Scan main project directory
    await this.scanMainProject(projectFiles);
    
    this.logScanResults(projectFiles);
    
    return projectFiles;
  }

  // 🔥 MANDATORY: Supabase migration scanning
private async scanSupabaseMigrations(projectFiles: Map<string, ProjectFile>): Promise<void> {
  const projectRoot = dirname(this.reactBasePath);
  
  this.streamUpdate(`   🔍 Looking for Supabase folder from project root: ${projectRoot}`);
  
  const supabasePaths = [
    join(projectRoot, 'supabase'),
    join(projectRoot, 'database'), 
    join(projectRoot, 'migrations'),
    join(dirname(projectRoot), 'supabase'),
    join(this.reactBasePath, 'supabase'),
  ];
  
  let foundSupabase = false;
  
  for (const supabasePath of supabasePaths) {
    try {
      this.streamUpdate(`   🔍 Checking: ${supabasePath}`);
      const exists = await fs.access(supabasePath).then(() => true).catch(() => false);
      
      if (exists) {
        this.streamUpdate(`   ✅ Found Supabase folder: ${supabasePath}`);
        
        // 🔥 NEW: Check for migrations subfolder specifically
        const migrationsPath = join(supabasePath, 'migrations');
        const migrationsExists = await fs.access(migrationsPath).then(() => true).catch(() => false);
        
        if (migrationsExists) {
          this.streamUpdate(`   📂 Found migrations folder: ${migrationsPath}`);
          await this.scanSupabaseDirectory(migrationsPath, projectFiles, projectRoot, 'migrations');
        }
        
        // Also scan the main supabase folder for other files
        await this.scanSupabaseDirectory(supabasePath, projectFiles, projectRoot, 'supabase');
        foundSupabase = true;
        break;
      } else {
        this.streamUpdate(`   ❌ Not found: ${supabasePath}`);
      }
    } catch (error) {
      this.streamUpdate(`   ❌ Error checking ${supabasePath}: ${error}`);
    }
  }
  
  if (!foundSupabase) {
    this.streamUpdate(`   ❌ No Supabase folder found in any of these locations:`);
    supabasePaths.forEach(path => this.streamUpdate(`      - ${path}`));
    this.streamUpdate(`   ℹ️  Expected structure: /project/supabase/migrations/*.sql`);
  }
}

private async scanSupabaseDirectory(
  dir: string, 
  projectFiles: Map<string, ProjectFile>,
  projectRoot: string,
  folderType: 'supabase' | 'migrations' = 'supabase'
): Promise<void> {
  try {
    this.streamUpdate(`   📂 Scanning ${folderType} directory: ${dir}`);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    this.streamUpdate(`   📁 Found ${entries.length} entries in ${folderType}/`);

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory() && folderType === 'supabase') {
        // Recursively scan subdirectories in main supabase folder
        this.streamUpdate(`   📂 Entering subdirectory: ${entry.name}`);
        const subFolderType = entry.name === 'migrations' ? 'migrations' : 'supabase';
        await this.scanSupabaseDirectory(fullPath, projectFiles, projectRoot, subFolderType);
      } else if (entry.isFile()) {
        this.streamUpdate(`   📄 Checking file: ${entry.name}`);
        
        if (this.isSupabaseRelevantFile(entry.name)) {
          try {
            const content = await fs.readFile(fullPath, 'utf8');
            const relativePath = relative(projectRoot, fullPath).replace(/\\/g, '/');
            
            // 🔥 ENHANCED: Better file key based on folder structure
            const fileKey = folderType === 'migrations' 
              ? `supabase/migrations/${entry.name}`
              : `supabase/${entry.name}`;
            
            projectFiles.set(fileKey, {
              path: fullPath,
              relativePath: relativePath,
              content,
              lines: content.split('\n').length,
              fileType: this.determineSupabaseFileType(entry.name, content),
              exportPattern: 'default',
              importPattern: 'default'
            });
            
            this.streamUpdate(`   ✅ Added ${folderType} file: ${entry.name} (${content.length} chars)`);
            
          } catch (readError) {
            this.streamUpdate(`   ❌ Error reading ${entry.name}: ${readError}`);
          }
        } else {
          this.streamUpdate(`   ⏭️  Skipping non-relevant file: ${entry.name}`);
        }
      }
    }
  } catch (error) {
    this.streamUpdate(`   ❌ Error scanning ${folderType} directory ${dir}: ${error}`);
  }
}

 private isSupabaseRelevantFile(fileName: string): boolean {
  const relevantExtensions = ['.sql', '.ts', '.js', '.json', '.md'];
  const relevantNames = ['schema', 'migration', 'seed', 'function', 'trigger', 'policy', 'rls'];
  
  const hasRelevantExtension = relevantExtensions.some(ext => fileName.endsWith(ext));
  const hasRelevantName = relevantNames.some(name => fileName.toLowerCase().includes(name));
  const isTimestampMigration = /^\d+.*\.sql$/.test(fileName);
  const isCreateMigration = /create.*\.sql$/i.test(fileName);
  const isMigrationFile = fileName.includes('migration') || fileName.includes('init');
  
  const isRelevant = hasRelevantExtension && (
    hasRelevantName || 
    isTimestampMigration ||
    isCreateMigration ||
    isMigrationFile ||
    fileName.includes('schema') ||
    fileName.includes('seed')
  );
  
  if (isRelevant) {
    this.streamUpdate(`     ✅ Relevant file: ${fileName} (${hasRelevantName ? 'by name' : isTimestampMigration ? 'timestamp migration' : 'pattern match'})`);
  }
  
  return isRelevant;
}

  private determineSupabaseFileType(fileName: string, content: string): string {
    if (fileName.endsWith('.sql')) {
      if (content.includes('CREATE TABLE') || content.includes('create table')) {
        return 'migration-table';
      }
      if (content.includes('CREATE FUNCTION') || content.includes('create function')) {
        return 'migration-function';
      }
      if (content.includes('INSERT INTO') || content.includes('insert into')) {
        return 'migration-seed';
      }
      return 'migration-sql';
    }
    
    if (fileName.toLowerCase().includes('schema')) return 'schema';
    if (fileName.toLowerCase().includes('seed')) return 'seed-data';
    if (fileName.endsWith('.ts') || fileName.endsWith('.js')) return 'supabase-config';
    
    return 'supabase-misc';
  }

  private async scanRootConfigFiles(projectFiles: Map<string, ProjectFile>): Promise<void> {
    const projectRoot = dirname(this.reactBasePath);
    
    const configFiles = [
      'tailwind.config.ts',
      'tailwind.config.js',
      'package.json',
      'tsconfig.json'
    ];
    
    for (const configFile of configFiles) {
      try {
        const configPath = join(projectRoot, configFile);
        const content = await fs.readFile(configPath, 'utf8');
        
        projectFiles.set(configFile, {
          path: configPath,
          relativePath: relative(this.reactBasePath, configPath).replace(/\\/g, '/'),
          content,
          lines: content.split('\n').length,
          fileType: this.determineFileType(configFile),
          exportPattern: 'default',
          importPattern: 'default'
        });
        
        this.streamUpdate(`   📄 Config: ${configFile}`);
        
      } catch (error) {
        // Config file doesn't exist
      }
    }
  }

  private async scanMainProject(projectFiles: Map<string, ProjectFile>): Promise<void> {
    const scanDirectory = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          const relativePath = relative(this.reactBasePath, fullPath).replace(/\\/g, '/');

          if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
            await scanDirectory(fullPath);
          } else if (entry.isFile() && this.isRelevantFile(entry.name)) {
            try {
              const content = await fs.readFile(fullPath, 'utf8');
              const patterns = this.analyzeFilePatterns(content);

              let babelAnalysis;
              if (this.isReactFile(entry.name)) {
                babelAnalysis = this.babelAnalyzer.analyzeFile(content, relativePath);
              }

              projectFiles.set(relativePath, {
                path: fullPath,
                relativePath,
                content,
                lines: content.split('\n').length,
                fileType: this.determineFileType(entry.name),
                exportPattern: patterns.exportPattern,
                importPattern: patterns.importPattern,
                elementTree: babelAnalysis?.elementTree,
                imports: babelAnalysis?.imports,
                exports: babelAnalysis?.exports,
                mainComponent: babelAnalysis?.mainComponent,
                dependencies: babelAnalysis?.dependencies,
                isAppFile: babelAnalysis?.isAppFile,
                isRouteFile: babelAnalysis?.isRouteFile
              });
            } catch (readError) {
              // Skip unreadable files
            }
          }
        }
      } catch (error) {
        // Skip inaccessible directories
      }
    };

    await scanDirectory(this.reactBasePath);
  }

  private logScanResults(projectFiles: Map<string, ProjectFile>): void {
    const supabaseFiles = Array.from(projectFiles.keys()).filter(f => f.startsWith('supabase/'));
    const appFiles = Array.from(projectFiles.values()).filter(f => f.isAppFile);
    const componentFiles = Array.from(projectFiles.values()).filter(f => f.mainComponent);
    const tailwindConfig = projectFiles.get('tailwind.config.ts') || projectFiles.get('tailwind.config.js');
    
    this.streamUpdate(`📊 SCAN RESULTS:`);
    this.streamUpdate(`   📁 Total files: ${projectFiles.size}`);
    this.streamUpdate(`   🗄️  Supabase files: ${supabaseFiles.length} ${supabaseFiles.length > 0 ? '✅' : '❌'}`);
    this.streamUpdate(`   📱 App files: ${appFiles.length}`);
    this.streamUpdate(`   🧩 Components: ${componentFiles.length}`);
    this.streamUpdate(`   🎨 Tailwind config: ${tailwindConfig ? 'FOUND ✅' : 'NOT FOUND ❌'}`);
  }

  // ============================================================================
  // SUPABASE SCHEMA CONTEXT GENERATION (ALWAYS INCLUDED)
  // ============================================================================

  private getSupabaseSchemaContext(projectFiles: Map<string, ProjectFile>): string {
  const supabaseFiles = Array.from(projectFiles.entries())
    .filter(([path, file]) => 
      path.startsWith('supabase/') && 
      (file.fileType === 'migration-table' || file.fileType === 'migration-sql' || file.fileType === 'schema')
    )
    .sort(([pathA], [pathB]) => pathA.localeCompare(pathB));

  if (supabaseFiles.length === 0) {
    return `
🗄️ **DATABASE SCHEMA CONTEXT:**
❌ No Supabase migration files found.

⚠️ **IMPORTANT:** Without database schema, generated queries may fail.
Use standard e-commerce assumptions: products(id, name, price), users(id, email), cart_items(id, user_id, product_id, quantity).
`;
  }

  this.streamUpdate(`   🗄️  Processing ${supabaseFiles.length} database schema files`);

  const schemaAnalysis = supabaseFiles.map(([path, file]) => {
    const tables = this.extractTableInfo(file.content);
    
    return {
      file: path,
      content: file.content.slice(0, 2000), // Increased for your rich schema
      tables: tables
    };
  });

  const allTables = schemaAnalysis.flatMap(s => s.tables);
  
  // 🔥 ENHANCED: Generate realistic mock data for e-commerce based on your schema
  
  return `
🗄️ **E-COMMERCE DATABASE SCHEMA CONTEXT:**
✅ Found ${supabaseFiles.length} schema files with ${allTables.length} tables.

📋 **AVAILABLE TABLES & RELATIONSHIPS:**
${allTables.map(table => `
- ${table.name}:
  - Columns: ${table.columns.join(', ')}
  - Sample query: .from('${table.name}').select('${table.columns.slice(0, 4).join(', ')}')`).join('')}

🛒 **E-COMMERCE BUSINESS LOGIC:**
- **Products**: Use for product listings, search, categories
- **Cart Items**: User-specific cart with quantities
- **Orders**: Complete purchase workflow
- **Profiles**: User authentication and roles
- **Wishlist**: Save for later functionality
- **Testimonials**: Social proof and reviews

🎯 **QUERY GENERATION RULES:**
- ONLY use columns that exist in the schema above
- Use proper Supabase syntax: .from('table').select('columns')
- Include error handling: if (error) console.error('Error:', error)
- Add loading states for better UX
- Use realistic sample data based on e-commerce context



📝 **SCHEMA FILES ANALYZED:**
${schemaAnalysis.map(s => `
=== ${s.file} ===
${s.content}${s.content.length >= 2000 ? '\n... (truncated)' : ''}
`).join('\n')}

🚨 **CRITICAL:** Only reference columns that exist in the schema above!
Never use non-existent columns like 'views', 'popularity', etc.
`;
}
  private extractTableInfo(sqlContent: string): Array<{name: string, columns: string[]}> {
    const tables: Array<{name: string, columns: string[]}> = [];
    
    const tableRegex = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)\s*\(([\s\S]*?)\);/gi;
    
    let match;
    while ((match = tableRegex.exec(sqlContent)) !== null) {
      const tableName = match[1];
      const tableBody = match[2];
      
      const columnMatches = tableBody.match(/^\s*(\w+)\s+/gm);
      const columns = columnMatches 
        ? columnMatches.map(col => col.trim().split(/\s+/)[0]).filter(Boolean)
        : [];
      
      tables.push({
        name: tableName,
        columns: columns.slice(0, 10) // Limit for readability
      });
    }
    
    return tables;
  }

  // ============================================================================
  // ENHANCED COMPONENT TYPE ANALYSIS WITH DB CONTEXT DETECTION
  // ============================================================================

private async analyzeComponentTypeWithContext(
  userPrompt: string, 
  projectFiles: Map<string, ProjectFile>,
  projectStructureContext: string = ''
): Promise<ComponentTypeAnalysis> {

  const analysisPrompt = `
🎯 **TASK:** Analyze user prompt to determine component type and required context files.

**USER PROMPT:** "${userPrompt}"

${projectStructureContext ? `
🏢 **COMPLETE PROJECT STRUCTURE:**
${projectStructureContext}

📋 **CONTEXT FILE ANALYSIS:** From the project structure above, identify files that provide:
- Authentication: AuthContext, useAuth, auth services
- Cart/Shopping: CartContext, useCart, shopping services  
- Database: supabase.ts, database clients, API services
- Types: type definitions, interfaces
- Business Logic: custom hooks, utilities, services
` : ''}

🔍 **ANALYSIS CRITERIA:**

**Step 1: Component Type Detection**
- **PAGE**: Full routes/screens (homepage, login page, dashboard, profile page, product listing page)
- **COMPONENT**: Reusable UI pieces (product card, hero section, navbar, modal, button, form)

**Step 2: Functionality Analysis** 
What will this page/component DO? Check for:
- 🔐 **AUTHENTICATION**: login, signup, logout, user profile, protected routes
- 🛒 **SHOPPING/CART**: display products, add to cart, checkout, order management, shopping features
- 📊 **DATA DISPLAY**: show lists, fetch from database, CRUD operations
- 📅 **BOOKING**: appointments, reservations, calendar functionality  
- 💰 **PAYMENTS**: billing, subscriptions, payment processing
- 🎨 **UI ONLY**: pure presentation, no data/functionality

**Enhanced Cart Detection Logic:**
- **Products Section/List/Grid** → ALWAYS needs CartContext (users expect to add products to cart)
- **Product Card/Item Component** → ALWAYS needs CartContext (individual products need add to cart)
- **Shop/Store/Catalog pages** → ALWAYS needs CartContext (shopping functionality)
- **E-commerce related components** → ALWAYS needs CartContext (cart is core functionality)

**Step 3: Context File Selection**
Based on detected functionality, include relevant context files:
- 🔐 Authentication functionality → AuthContext.tsx, useAuth.ts
- 🛒 Shopping functionality → CartContext.tsx, useCart.ts  
- 📊 Data display functionality → supabase.ts, API services, types
- 📅 Booking functionality → BookingContext.tsx, calendar services
- 🎨 UI only → No context files needed

**CRITICAL: E-commerce Context Rules**
- ANY component displaying products → MUST include CartContext.tsx (users expect add to cart)
- Product sections, product grids, product lists → ALWAYS need CartContext.tsx + supabase.ts
- Shopping pages, store pages → ALWAYS need CartContext.tsx + AuthContext.tsx + supabase.ts
- Product cards, product items → ALWAYS need CartContext.tsx

**Critical Logic:**
- If ANY context files are selected → set needsFullContext: true
- If NO context files needed → set needsFullContext: false  
- DO NOT include the target component file itself in contextFiles
- Only include files that provide functionality/data/services

**Examples:**
- "create homepage" → PAGE + DATA DISPLAY → needs supabase.ts, types
- "create login page" → PAGE + AUTHENTICATION → needs AuthContext.tsx, supabase.ts
- "create products section" → COMPONENT + SHOPPING + DATA → needs CartContext.tsx, supabase.ts, types
- "add products section to homepage" → COMPONENT + SHOPPING + DATA → needs CartContext.tsx, supabase.ts, types  
- "create shopping cart page" → PAGE + SHOPPING → needs CartContext.tsx, AuthContext.tsx, supabase.ts
- "create product card" → COMPONENT + SHOPPING + DATA → needs CartContext.tsx, supabase.ts, types
- "create product listing page" → PAGE + SHOPPING + DATA → needs CartContext.tsx, supabase.ts, types
- "create button component" → COMPONENT + UI ONLY → needs no context
- "create user profile page" → PAGE + AUTHENTICATION → needs AuthContext.tsx, supabase.ts
- "create checkout component" → COMPONENT + SHOPPING + PAYMENTS → needs CartContext.tsx, AuthContext.tsx, payment service

**RESPONSE FORMAT (JSON only):**
{
  "type": "page|component",
  "name": "PascalCaseName", 
  "confidence": 85,
  "reasoning": "Clear explanation of why this type was chosen, intended usage, and which functionalities detected",
  "targetDirectory": "src/pages|src/components",
  "fileName": "ComponentName.tsx",
  "needsRouting": true|false,
  "needsFullContext": true|false,
  "contextFiles": ["src/lib/supabase.ts", "src/types/index.ts"],
  "contextKeywords": ["database", "types"],
  "detectedFunctionalities": ["data-display", "database"],
  "recommendedIntegrations": ["fetch products", "display data"],
  "usageDescription": "This component will be imported and used in the homepage to display products"
}

**CRITICAL VALIDATION:**
- needsFullContext MUST be true if contextFiles array is not empty
- needsFullContext MUST be false if contextFiles array is empty
- contextFiles should NOT include the target component itself
- Only include files that provide services/data/context/types
- This function only creates NEW files, never modifies existing ones
- Components are designed to be imported and used in other components/pages
`;

  const response = await this.anthropic.messages.create({
    model: 'claude-3-5-sonnet-20240620',
    max_tokens: 1000,
    temperature: 0,
    messages: [{ role: 'user', content: analysisPrompt }]
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    throw new Error('Failed to parse component type analysis');
  }

  const analysis = JSON.parse(jsonMatch[0]);
  
  // 🔥 VALIDATION: Ensure logic consistency
  if (analysis.contextFiles && analysis.contextFiles.length > 0) {
    analysis.needsFullContext = true;
  } else {
    analysis.needsFullContext = false;
    analysis.contextFiles = [];
  }
  
  // 🔥 DEBUG LOGGING: Add detailed logging
  this.streamUpdate(`🔍 FUNCTIONALITY ANALYSIS:`);
  this.streamUpdate(`   Prompt: "${userPrompt}"`);
  this.streamUpdate(`   📄 Type: ${analysis.type.toUpperCase()}`);
  this.streamUpdate(`   📁 File: ${analysis.fileName}`);
  this.streamUpdate(`   ⚙️ Functionalities: ${analysis.detectedFunctionalities?.join(', ') || 'UI Only'}`);
  this.streamUpdate(`   📋 Context Files Needed: ${analysis.contextFiles?.length || 0}`);
  if (analysis.contextFiles?.length > 0) {
  analysis.contextFiles.forEach((file: string) => this.streamUpdate(`      - ${file}`));
}

  this.streamUpdate(`   🔧 Context Required: ${analysis.needsFullContext ? 'YES' : 'NO'}`);
  this.streamUpdate(`   💡 Logic: ${analysis.reasoning}`);

  return analysis;
}

  // ============================================================================
  // CONTEXT FILES GATHERING
  // ============================================================================

 private async getFullContextFromFiles(
  contextFiles: string[],
  projectFiles: Map<string, ProjectFile>,
  detectedFunctionalities: string[] = []
): Promise<string> {
  if (contextFiles.length === 0) {
    return '';
  }
  
  this.streamUpdate(`🔍 Gathering context from ${contextFiles.length} files for: ${detectedFunctionalities.join(', ')}...`);
  
  const fullContextContent: string[] = [];
  
  for (const contextFile of contextFiles) {
    // Try direct lookup first
    let file = projectFiles.get(contextFile);
    
    // If not found, try variations
    if (!file) {
      const variations = [
        contextFile,
        contextFile.replace('src/', ''),
        contextFile.replace(/^\//, ''),
        contextFile.replace(/\\/g, '/'),
        contextFile.replace(/\.(tsx?|jsx?)$/, '') + '.tsx',
        contextFile.replace(/\.(tsx?|jsx?)$/, '') + '.ts'
      ];
      
      for (const variation of variations) {
        file = projectFiles.get(variation);
        if (file) {
          this.streamUpdate(`   📄 Found: ${variation} (variation of ${contextFile})`);
          break;
        }
      }
    } else {
      this.streamUpdate(`   📄 Found: ${contextFile}`);
    }
    
    if (file) {
      fullContextContent.push(`
=== CONTEXT FILE: ${contextFile} ===
${file.content}

=== EXPORTS ===
${file.exports?.map(exp => `- ${exp.name} (${exp.type})`).join('\n') || 'None'}

=== IMPORTS ===  
${file.imports?.map(imp => `- ${imp.name} from "${imp.source}"`).join('\n') || 'None'}
`);
    } else {
      this.streamUpdate(`   ❌ Not found: ${contextFile}`);
    }
  }
  
  this.streamUpdate(`✅ Context gathered from ${fullContextContent.length}/${contextFiles.length} files`);
  
  return fullContextContent.join('\n---\n');
}
  // ============================================================================
  // ENHANCED COMPONENT GENERATION WITH SUPABASE + CONTEXT
  // ============================================================================

  private async generateComponentContentWithContext(
    userPrompt: string,
    componentType: ComponentTypeAnalysis,
    elementTreeContext: string,
    projectPatterns: any,
    projectFiles: Map<string, ProjectFile>,
    projectStructureContext: string = '',
    supabaseSchemaContext: string,  // 🔥 MANDATORY: Always passed
    fullContextContent: string = ''
  ): Promise<string> {
    const tailwindFile = projectFiles.get('tailwind.config.ts') || 
                        projectFiles.get('tailwind.config.js');
    
    const tailwindColors = tailwindFile ? `
🎨 **CUSTOM TAILWIND THEME:**
${tailwindFile.content.slice(0, 1800)}

🎯 **TAILWIND STRATEGY:** Use primary/secondary/accent colors strategically!
` : `🎨 **MODERN TAILWIND:** Use vibrant, professional color combinations.`;

    const businessType = this.detectBusinessType(projectStructureContext);
    const designInspiration = this.getDesignInspiration(businessType);

    // 🔥 ENHANCED: Common visual consistency rules for both components and pages
    const visualConsistencyRules = `
🎨 **VISUAL CONSISTENCY & APPEAL RULES:**

📏 **CARD CONSISTENCY (CRITICAL):**
- ALL cards MUST have identical heights using: h-80, h-96, or min-h-[400px]
- Use aspect-ratio-[4/3] or aspect-ratio-square for image containers
- Consistent padding: p-6 for all card content areas
- Uniform spacing: space-y-4 between card elements
- Image placeholder: Always use object-cover with fixed dimensions
- If no image: Use gradient backgrounds or icon placeholders with same dimensions

📐 **LAYOUT PERFECTION:**
- Grid uniformity: All grid items same height with grid-rows-[auto_1fr_auto]
- Consistent gaps: gap-6 md:gap-8 throughout
- Alignment: items-start for consistent top alignment
- Flexbox cards: Use flex flex-col h-full for equal height cards

🖼️ **IMAGE HANDLING:**
- Fixed aspect ratios: aspect-[4/3] for product images, aspect-square for avatars
- Consistent image containers: h-48 w-full for product cards
- Object positioning: object-cover object-center always
- Fallback handling: gradient or placeholder when no image
- Loading states: animate-pulse bg-gray-200 placeholders

🎯 **VISUAL HIERARCHY:**
- Consistent typography scale: text-lg font-semibold for titles, text-sm text-gray-600 for descriptions
- Button uniformity: Same height (h-10), padding (px-4), and corner radius (rounded-md)
- Color consistency: Use theme colors systematically
- Spacing rhythm: mb-2, mb-4, mb-6 pattern consistently

⚡ **MICRO-INTERACTIONS & ANIMATIONS:**
- Hover transformations: hover:scale-105 transform transition-all duration-300
- Loading states: animate-pulse, animate-spin for consistent feedback
- Button interactions: hover:bg-primary-700 active:scale-95
- Card interactions: hover:shadow-xl hover:-translate-y-1

🌟 **PREMIUM VISUAL APPEAL:**
- Gradients: bg-gradient-to-br from-primary-50 to-secondary-50 for sections
- Shadows: shadow-lg hover:shadow-xl for depth
- Borders: border border-gray-200 hover:border-primary-200
- Backdrop effects: backdrop-blur-sm bg-white/80 for overlays
- Glass morphism: bg-white/10 backdrop-blur-md border border-white/20

🎨 **COLOR PSYCHOLOGY:**
- Primary colors for CTAs and important actions
- Secondary colors for supporting elements
- Accent colors for highlights and badges
- Neutral grays for text hierarchy
- Success/warning/error colors for states
`;

    let prompt = '';

    if (componentType.type === 'component') {
      prompt = `
🎯 **MISSION:** Create a STUNNING ${componentType.name} component with perfect visual consistency and Tailwind CSS!

**USER REQUEST:** "${userPrompt}"

${visualConsistencyRules}

${projectStructureContext ? `
🏢 **BUSINESS CONTEXT:**
${projectStructureContext}

🎨 **INDUSTRY:** ${businessType}
${designInspiration}
` : ''}

${supabaseSchemaContext}

${fullContextContent ? `
🔧 **INTEGRATION PATTERNS (use exact syntax):**
${fullContextContent}

🚨 **CRITICAL:** Copy exact function names, hooks, and import paths!
` : ''}

${tailwindColors}

🎨 **COMPONENT-SPECIFIC EXCELLENCE:**
- Component isolation: Self-contained with proper props interface
- Reusability: Flexible props for different use cases
- Performance: Memoization with React.memo if needed
- Accessibility: Proper ARIA labels and keyboard navigation
- Error boundaries: Graceful error handling and fallbacks

🖼️ **CARD DESIGN MASTERY (if applicable):**
- Uniform card heights: min-h-[400px] or h-96 consistently
- Image containers: aspect-[4/3] h-48 w-full object-cover
- Content areas: p-6 space-y-4 flex-1 flex flex-col
- Action buttons: mt-auto (stick to bottom) h-10 w-full
- Hover states: group hover:shadow-xl transition-all duration-300

**COMPONENT PATTERNS:**
- Product cards: Image + title + description + price + CTA button
- Feature cards: Icon + title + description (all same height)
- Team cards: Avatar + name + role + bio (consistent layout)
- Testimonial cards: Quote + author + rating (uniform structure)

**TECHNICAL REQUIREMENTS:**
- TypeScript interfaces for all props with proper types
- Loading states with skeleton screens matching final layout
- Error handling with user-friendly fallbacks
- Responsive design: mobile-first approach
- Performance optimization: lazy loading for images

**RESPONSE:** Return ONLY the component code:

\`\`\`tsx
[STUNNING VISUALLY CONSISTENT COMPONENT WITH PERFECT TAILWIND]
\`\`\`
`;

    } else if (componentType.type === 'page') {
      prompt = `
🚀 **MISSION:** Create a CONVERSION-CRUSHING ${componentType.name} page with expert visual design and working database integration!

**USER REQUEST:** "${userPrompt}"

${visualConsistencyRules}

${projectStructureContext ? `
🏢 **BUSINESS INTELLIGENCE:**
${projectStructureContext}

🎯 **TARGET MARKET:** ${businessType}
${designInspiration}
` : ''}

${supabaseSchemaContext}

${fullContextContent ? `
🔧 **SYSTEM INTEGRATION (exact patterns):**
${fullContextContent}

🚨 **INTEGRATION CRITICAL:** 
- Use exact auth patterns (useAuth hooks, login flows)
- Implement cart operations (useCart)
- Use Supabase queries with proper error handling
- Match existing API patterns and data structures
` : ''}

${tailwindColors}

🎨 **PAGE-SPECIFIC VISUAL MASTERY:**

🌟 **Hero Section Excellence:**
- Epic gradients: bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-800
- Typography scale: text-4xl md:text-6xl lg:text-7xl font-extrabold
- CTA hierarchy: Primary CTA (px-8 py-4) + Secondary CTA (px-6 py-3)
- Visual anchors: Hero image/video with overlay text

🏗️ **Section Layout Mastery:**
- Consistent section spacing: py-16 md:py-24 lg:py-32
- Container consistency: max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
- Grid systems: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
- Section backgrounds: Alternating white and gray-50/primary-50

📱 **Responsive Excellence:**
- Mobile-first design: Base styles for mobile, progressive enhancement
- Touch targets: Minimum 44px (h-11 w-11) for interactive elements
- Typography scaling: text-base md:text-lg lg:text-xl for body text
- Image responsiveness: w-full h-auto with proper aspect ratios

🛒 **E-COMMERCE SPECIFIC PATTERNS:**
- Product grids: Consistent card heights with proper image aspect ratios
- Filter sections: Sticky sidebar with collapsible categories
- Shopping cart: Fixed/sticky cart summary with item count badges
- Checkout flow: Multi-step with progress indicators

🎯 **CONVERSION OPTIMIZATION:**
- Above-the-fold: Hero + value proposition + primary CTA
- Social proof: Testimonials, reviews, trust badges (consistent styling)
- Urgency/scarcity: Limited time offers with countdown timers
- Trust signals: Security badges, guarantees, certifications

⚡ **MICRO-INTERACTIONS & STATES:**
- Page transitions: Smooth fade-in animations with stagger effects
- Loading states: Skeleton screens matching final content layout
- Hover effects: Subtle scale and shadow changes (hover:scale-[1.02])
- Error states: Friendly error messages with retry actions

🗄️ **DATABASE INTEGRATION EXCELLENCE:**
- Loading skeletons: Match final content dimensions exactly
- Error handling: Graceful fallbacks with retry mechanisms
- Data validation: Client-side validation matching server constraints
- Performance: Pagination, infinite scroll, or virtualization for large datasets

**PAGE STRUCTURE TEMPLATE:**
1. Hero Section: Eye-catching intro with main CTA
2. Features/Benefits: Grid of value propositions
3. Products/Services: Consistent card layouts
4. Testimonials: Social proof section
5. CTA Section: Final conversion push
6. Footer: Contact, links, legal

**TECHNICAL EXCELLENCE:**
- TypeScript with comprehensive interfaces and proper error types
- SEO optimization: Proper meta tags, headings hierarchy
- Accessibility: WCAG 2.1 AA compliance
- Performance: Image optimization, lazy loading, code splitting
- Analytics: Event tracking for user interactions

**INSPIRATION:** Stripe + Linear + Vercel + Apple + Shopify quality!

**RESPONSE:** Return ONLY the page code:

\`\`\`tsx
[CONVERSION-OPTIMIZED PAGE WITH EXPERT VISUAL DESIGN + DATABASE]
\`\`\`
`;
    }

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 4000,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const codeMatch = text.match(/```(?:tsx|typescript|jsx|javascript)\s*([\s\S]*?)```/);

    if (!codeMatch) {
      throw new Error('Failed to extract generated component code');
    }

    return codeMatch[1].trim();
  }

  // ============================================================================
  // BUSINESS TYPE DETECTION & DESIGN INSPIRATION
  // ============================================================================

  private detectBusinessType(projectStructureContext: string): string {
    if (!projectStructureContext) return 'Business';
    
    const content = projectStructureContext.toLowerCase();
    
    if (content.includes('cart') || content.includes('product') || content.includes('shop')) {
      return 'E-commerce';
    }
    if (content.includes('booking') || content.includes('appointment')) {
      return 'Booking/Service';
    }
    if (content.includes('dashboard') || content.includes('saas')) {
      return 'SaaS';
    }
    if (content.includes('health') || content.includes('medical')) {
      return 'Healthcare';
    }
    
    return 'Business';
  }

  private getDesignInspiration(businessType: string): string {
    const inspirations = {
      'E-commerce': `
🎨 **E-COMMERCE INSPIRATION:** Shopify, Stripe elegance
- Clean product cards with hover effects
- Trust signals and social proof
- Strategic "Add to Cart" buttons
- Beautiful product imagery placeholders`,

      'Booking/Service': `
🎨 **BOOKING INSPIRATION:** Calendly, OpenTable premium
- Elegant calendar interfaces  
- Service showcase sections
- Professional provider profiles
- Clear pricing and availability`,

      'SaaS': `
🎨 **SAAS INSPIRATION:** Notion, Linear, GitHub quality
- Clean dashboards with data viz
- Feature comparison tables
- Interactive demo sections
- Integration showcases`,

      'Healthcare': `
🎨 **HEALTHCARE INSPIRATION:** Teladoc, trusted platforms
- Calming, trustworthy colors
- Doctor/provider cards
- Privacy and security badges
- Appointment booking flows`,

      'Business': `
🎨 **BUSINESS INSPIRATION:** Modern platforms like Slack
- Professional layouts
- Team collaboration sections
- Clear value propositions
- Client testimonial areas`
    };

    return inspirations[businessType as keyof typeof inspirations] || inspirations['Business'];
  }

  private getBusinessSpecificTailwindPatterns(businessType: string): string {
    const patterns = {
      'E-commerce': `
- Product cards: bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all
- Price displays: text-3xl font-bold text-gray-900 
- Cart badges: absolute -top-2 -right-2 bg-red-500 text-white rounded-full
- Trust badges: flex items-center space-x-2 text-green-600`,

      'SaaS': `
- Feature cards: bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-8
- Pricing tables: divide-y divide-gray-200 bg-gradient-to-t from-primary-50
- Dashboard previews: bg-white border-2 border-gray-200 rounded-lg shadow-inner
- Metric displays: text-4xl font-bold text-primary-600`,

      'Booking/Service': `
- Service cards: relative overflow-hidden rounded-2xl with gradient overlays
- Calendar widgets: grid grid-cols-7 gap-1 hover:bg-primary-100
- Provider profiles: flex items-center space-x-4 rounded-full avatars
- Time slots: grid grid-cols-6 gap-2 selectable buttons`,

      'Healthcare': `
- Doctor cards: bg-white border border-blue-100 rounded-lg hover:border-blue-200
- Trust indicators: flex items-center text-green-600 checkmarks
- Emergency CTAs: bg-red-600 hover:bg-red-700 pulse animation
- Appointment widgets: bg-blue-50 rounded-lg calendar icons`,

      'Business': `
- Feature highlights: bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl
- Team sections: grid grid-cols-4 gap-8 rounded-full avatars
- Stats displays: text-4xl font-bold text-primary-600 numbers
- CTA sections: bg-gradient-to-r from-primary-600 to-secondary-600`
    };

    return patterns[businessType as keyof typeof patterns] || patterns['Business'];
  }

  // ============================================================================
  // MAIN ANALYSIS & GENERATION WORKFLOW
  // ============================================================================

  async analyzeAndGenerate(userPrompt: string, projectId?: number): Promise<GenerationResult> {
    this.streamUpdate('🚀 Starting Enhanced Analysis & Generation with Supabase Integration...');

    try {
      // STEP 1: Get project structure context from database
      const projectStructureContext = await this.getProjectStructureContext(projectId);

      // STEP 2: Scan all files (including mandatory Supabase)
      this.streamUpdate('📂 Scanning project files (including Supabase)...');
      const projectFiles = await this.scanProjectFiles();

      // STEP 3: Generate Supabase schema context (ALWAYS)
      this.streamUpdate('🗄️  Generating database schema context...');
      const supabaseSchemaContext = this.getSupabaseSchemaContext(projectFiles);

      // STEP 4: Enhanced component analysis with context detection
      this.streamUpdate('🧠 Analyzing component type with DB context detection...');
      const componentTypeAnalysis = await this.analyzeComponentTypeWithContext(
        userPrompt, 
        projectFiles, 
        projectStructureContext
      );
      
      this.streamUpdate(`📋 ANALYSIS RESULTS:`);
      this.streamUpdate(`   Type: ${componentTypeAnalysis.type.toUpperCase()}`);
      this.streamUpdate(`   Name: ${componentTypeAnalysis.name}`);
      this.streamUpdate(`   DB Context Needed: ${componentTypeAnalysis.needsFullContext}`);
      this.streamUpdate(`   Context Files: ${componentTypeAnalysis.contextFiles?.join(', ') || 'None'}`);

      // STEP 5: Generate other contexts
      const elementTreeContext = this.createElementTreeContext(projectFiles);
      const projectPatterns = this.analyzeProjectPatterns(projectFiles);
      const existingRoutes = this.extractExistingRoutes(projectFiles);

      // STEP 6: Get full context content if needed
      let fullContextContent = '';
      if (componentTypeAnalysis.needsFullContext && componentTypeAnalysis.contextFiles) {
        fullContextContent = await this.getFullContextFromFiles(
          componentTypeAnalysis.contextFiles, 
          projectFiles
        );
      }

      // STEP 7: Generate component with all contexts
      this.streamUpdate('🎨 Generating component with Supabase + context integration...');
      const generatedContent = await this.generateComponentContentWithContext(
        userPrompt,
        componentTypeAnalysis,
        elementTreeContext,
        projectPatterns,
        projectFiles,
        projectStructureContext,
        supabaseSchemaContext,  // 🔥 ALWAYS passed
        fullContextContent
      );

      this.streamUpdate('✅ Enhanced generation complete!');
      this.streamUpdate(`   📄 Generated: ${generatedContent.length} characters`);
      this.streamUpdate(`   🗄️  Database context: ${supabaseSchemaContext.length > 100 ? 'Included' : 'Unavailable'}`);

      return {
        success: true,
        generatedContent,
        componentType: componentTypeAnalysis,
        elementTreeContext,
        supabaseSchemaContext,  // 🔥 Always included in result
        fullContextContent,
        projectPatterns,
        componentMap: this.babelAnalyzer.getComponentMap(),
        projectFiles,
        existingRoutes
      };

    } catch (error) {
      this.streamUpdate(`❌ Analysis & generation failed: ${error}`);
      return {
        success: false,
        generatedContent: '',
        componentType: {
          type: 'component',
          name: 'Unknown',
          confidence: 0,
          reasoning: 'Failed to analyze',
          targetDirectory: 'src/components',
          fileName: 'Unknown.tsx',
          needsRouting: false
        },
        elementTreeContext: '',
        supabaseSchemaContext: '',
        projectPatterns: {
          exportPattern: 'default',
          importPattern: 'default',
          routingPattern: 'basic'
        },
        componentMap: new Map(),
        projectFiles: new Map(),
        existingRoutes: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private createElementTreeContext(projectFiles: Map<string, ProjectFile>): string {
    const contextSummaries: string[] = [];
    
    for (const [filePath, file] of projectFiles) {
      if (file.elementTree && file.mainComponent && !this.shouldSkipUIComponentFile(filePath)) {
        const summary = this.babelAnalyzer.createElementTreeSummary(filePath, file.elementTree);
        contextSummaries.push(summary);
      }
    }
    
    return contextSummaries.slice(0, 8).join('\n\n---\n\n');
  }

  private analyzeProjectPatterns(projectFiles: Map<string, ProjectFile>): {
    exportPattern: 'default' | 'named' | 'mixed';
    importPattern: 'default' | 'named' | 'mixed';
    routingPattern: 'react-router' | 'next' | 'reach-router' | 'basic';
    appFilePath?: string;
    routeFilePath?: string;
  } {
    let routingPattern: 'react-router' | 'next' | 'reach-router' | 'basic' = 'basic';
    let appFilePath: string | undefined;
    let routeFilePath: string | undefined;

    for (const [path, file] of projectFiles) {
      if (file.isAppFile) appFilePath = path;
      if (file.isRouteFile) routeFilePath = path;

      if (file.imports) {
        for (const imp of file.imports) {
          if (imp.source === 'react-router-dom') {
            routingPattern = 'react-router';
            break;
          } else if (imp.source === '@reach/router') {
            routingPattern = 'reach-router';
            break;
          } else if (imp.source.includes('next')) {
            routingPattern = 'next';
            break;
          }
        }
      }
      if (routingPattern !== 'basic') break;
    }

    return {
      exportPattern: 'default',
      importPattern: 'default',
      routingPattern,
      appFilePath,
      routeFilePath
    };
  }

  private extractExistingRoutes(projectFiles: Map<string, ProjectFile>): string[] {
    const routes: string[] = [];
    
    for (const file of projectFiles.values()) {
      if (file.isAppFile || file.isRouteFile) {
        const routeMatches = file.content.match(/path=["']([^"']+)["']/g);
        if (routeMatches) {
          routeMatches.forEach(match => {
            const pathMatch = match.match(/path=["']([^"']+)["']/);
            if (pathMatch) routes.push(pathMatch[1]);
          });
        }
      }
    }
    
    return [...new Set(routes)];
  }

  private analyzeFilePatterns(content: string): {
    exportPattern: 'default' | 'named' | 'mixed';
    importPattern: 'default' | 'named' | 'mixed';
  } {
    const hasDefaultExport = /export\s+default/.test(content);
    const hasNamedExport = /export\s+(const|function|class)/.test(content);
    const hasDefaultImport = /import\s+\w+\s+from/.test(content);
    const hasNamedImport = /import\s*\{[^}]+\}\s*from/.test(content);

    const exportPattern = hasDefaultExport && hasNamedExport ? 'mixed' : 
                         hasDefaultExport ? 'default' : 'named';
    const importPattern = hasDefaultImport && hasNamedImport ? 'mixed' : 
                         hasDefaultImport ? 'default' : 'named';

    return { exportPattern, importPattern };
  }

  private shouldSkipDirectory(name: string): boolean {
    return ['node_modules', '.git', '.next', 'dist', 'build', 'coverage'].includes(name) || 
           name.startsWith('.');
  }

  private isRelevantFile(fileName: string): boolean {
    return ['.tsx', '.ts', '.jsx', '.js', '.json'].some(ext => fileName.endsWith(ext));
  }

  private isReactFile(fileName: string): boolean {
    return ['.tsx', '.jsx'].some(ext => fileName.endsWith(ext));
  }

  private shouldSkipUIComponentFile(filePath: string): boolean {
    return filePath.includes('/components/ui/') || 
           filePath.includes('\\components\\ui\\');
  }

  private determineFileType(fileName: string): string {
    if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) return 'react-component';
    if (fileName.endsWith('.ts') || fileName.endsWith('.js')) return 'javascript';
    if (fileName.endsWith('.json')) return 'config';
    return 'unknown';
  }

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  async refreshFileStructure(): Promise<void> {
    this.streamUpdate('🔄 Refreshing file structure...');
    await this.scanProjectFiles();
    this.streamUpdate('✅ File structure refreshed');
  }

  async getProjectAnalysisSummary(): Promise<string> {
    try {
      const projectFiles = await this.scanProjectFiles();
      const supabaseFiles = Array.from(projectFiles.keys()).filter(f => f.startsWith('supabase/'));
      const componentFiles = Array.from(projectFiles.values()).filter(f => f.mainComponent);
      
      return `
ENHANCED ANALYSIS ENGINE - PROJECT SUMMARY
==========================================
📁 Total files: ${projectFiles.size}
🗄️  Supabase files: ${supabaseFiles.length}
🧩 Components: ${componentFiles.length}
🎨 Tailwind: ${projectFiles.has('tailwind.config.ts') ? 'Available' : 'Not found'}

🔥 CAPABILITIES:
✅ Mandatory Supabase schema integration
✅ Database context detection
✅ Context file gathering  
✅ Expert Tailwind generation
✅ Business-specific patterns
✅ Conversion optimization

Ready for production-quality code generation!
`;
    } catch (error) {
      return `Failed to generate summary: ${error}`;
    }
  }
}