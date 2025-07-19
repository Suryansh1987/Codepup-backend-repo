// ============================================================================
// PROJECT EXTRACTION SERVICE - Dedicated Tree Building and AST Analysis
// ============================================================================

import { ProjectFile } from './types';

// Enhanced extraction result interfaces
interface ExtractedNode {
  id: string;
  tagName: string;
  className?: string;
  displayText?: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  props?: Record<string, any>;
  isInteractive?: boolean;
  fullCode?: string;
  startPos?: number;
  endPos?: number;
  originalCode?: string;
  codeHash?: string;
  contextBefore?: string;
  contextAfter?: string;
}

interface ExtractedImport {
  source: string;
  importType: 'default' | 'named' | 'namespace' | 'side-effect';
  imports: string[];
  line: number;
  fullStatement: string;
}

interface FileImportInfo {
  filePath: string;
  imports: ExtractedImport[];
  hasLucideReact: boolean;
  hasReact: boolean;
  allImportSources: string[];
}

interface FileStructure {
  filePath: string;
  nodes: ExtractedNode[];
  imports: FileImportInfo;
  fileSize: number;
  lineCount: number;
  componentType?: 'page' | 'component' | 'util' | 'context' | 'hook';
}

interface ProjectTreeData {
  fileStructures: FileStructure[];
  compactTree: string;
  projectMetrics: {
    totalFiles: number;
    totalNodes: number;
    totalImports: number;
    filesWithLucide: number;
    filesWithReact: number;
    componentsByType: Record<string, number>;
  };
  databaseIndicators: string[];
}

export class ProjectExtractionService {
  private streamCallback?: (message: string) => void;

  constructor() {
    // Lightweight constructor
  }

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
  }

  private streamUpdate(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
  }

  /**
   * MAIN METHOD: Extract complete project tree data
   */
  async extractProjectTreeData(projectFiles: Map<string, ProjectFile>): Promise<ProjectTreeData> {
    this.streamUpdate('🌳 Building comprehensive project tree...');
    
    const fileStructures = this.buildFileStructures(projectFiles);
    const compactTree = this.generateCompactTree(fileStructures);
    const projectMetrics = this.calculateProjectMetrics(fileStructures);
    const databaseIndicators = this.extractDatabaseIndicators(compactTree);

    this.streamUpdate(`✅ Project tree built: ${fileStructures.length} files, ${projectMetrics.totalNodes} nodes`);

    return {
      fileStructures,
      compactTree,
      projectMetrics,
      databaseIndicators
    };
  }

  /**
   * Build file structures using direct AST parsing
   */
  private buildFileStructures(projectFiles: Map<string, ProjectFile>): FileStructure[] {
    const fileStructures: FileStructure[] = [];
    
    for (const [filePath, projectFile] of projectFiles) {
      if (!this.shouldAnalyzeFile(filePath)) {
        continue;
      }

      try {
        // Extract nodes and imports directly
        const nodes = this.extractNodesDirectly(projectFile);
        const imports = this.extractImportsDirectly(projectFile);
        
        const normalizedPath = projectFile.relativePath || this.normalizeFilePath(filePath);
        const componentType = this.detectComponentType(normalizedPath, projectFile.content);
        
        fileStructures.push({
          filePath: normalizedPath,
          nodes,
          imports,
          fileSize: projectFile.content.length,
          lineCount: projectFile.lines || projectFile.content.split('\n').length,
          componentType
        });
        
      } catch (error) {
        console.warn(`[EXTRACTION] Failed to process ${filePath}:`, error);
        
        // Add minimal structure so process can continue
        const normalizedPath = projectFile.relativePath || this.normalizeFilePath(filePath);
        fileStructures.push({
          filePath: normalizedPath,
          nodes: [],
          imports: {
            filePath: normalizedPath,
            imports: [],
            hasLucideReact: false,
            hasReact: false,
            allImportSources: []
          },
          fileSize: projectFile.content.length,
          lineCount: projectFile.lines || 0
        });
      }
    }

    return fileStructures;
  }

  /**
   * Extract AST nodes directly using Babel parser
   */
  private extractNodesDirectly(projectFile: ProjectFile): ExtractedNode[] {
    try {
      // Skip very large files to avoid memory issues
      if (projectFile.content.length > 500000) {
        return [];
      }
      
      const { parse } = require('@babel/parser');
      const traverse = require('@babel/traverse').default;
      const crypto = require('crypto');
      
      const ast = parse(projectFile.content, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
        ranges: true,
        errorRecovery: true,
        strictMode: false
      });

      const nodes: ExtractedNode[] = [];
      let nodeIndex = 0;

      traverse(ast, {
        JSXElement: {
          enter: (path: any) => {
            try {
              const node = path.node;
              nodeIndex++;

              // Extract tag name
              let tagName = 'unknown';
              if (node.openingElement?.name?.type === 'JSXIdentifier') {
                tagName = node.openingElement.name.name;
              } else if (node.openingElement?.name?.type === 'JSXMemberExpression') {
                tagName = `${node.openingElement.name.object.name}.${node.openingElement.name.property.name}`;
              }

              // Generate stable ID
              const startLine = node.loc?.start.line || 1;
              const startColumn = node.loc?.start.column || 0;
              const context = projectFile.content.substring(
                Math.max(0, (node.start || 0) - 10),
                Math.min(projectFile.content.length, (node.end || 0) + 10)
              ).replace(/\s+/g, ' ').trim();
              
              const hashInput = `${tagName}_${startLine}_${startColumn}_${nodeIndex}_${context}`;
              const hash = crypto.createHash('sha256').update(hashInput).digest('hex');
              const stableId = hash.substring(0, 12);

              // Extract props
              const props: Record<string, any> = {};
              let isInteractive = false;

              if (node.openingElement?.attributes) {
                for (const attr of node.openingElement.attributes) {
                  if (attr.type === 'JSXAttribute' && attr.name?.name) {
                    const propName = attr.name.name;
                    
                    if (attr.value?.type === 'StringLiteral') {
                      props[propName] = attr.value.value;
                    } else if (attr.value?.type === 'JSXExpressionContainer') {
                      if (attr.value.expression?.type === 'Identifier') {
                        props[propName] = `{${attr.value.expression.name}}`;
                      } else {
                        props[propName] = '{...}';
                      }
                    } else if (!attr.value) {
                      props[propName] = true;
                    }

                    // Check for interactivity
                    if (propName.startsWith('on') || propName === 'href' || propName === 'to') {
                      isInteractive = true;
                    }
                  }
                }
              }

              // Extract text content (up to 5 words)
              let displayText: string | undefined = undefined;
              if (node.children) {
                const extractText = (child: any, depth: number = 0): string => {
                  if (!child || depth > 2) return '';
                  
                  if (child.type === 'JSXText') {
                    return child.value.trim();
                  } else if (child.type === 'JSXExpressionContainer') {
                    if (child.expression?.type === 'StringLiteral') {
                      return child.expression.value;
                    } else if (child.expression?.type === 'Identifier') {
                      return `{${child.expression.name}}`;
                    }
                  } else if (child.type === 'JSXElement' && child.children) {
                    return child.children
                      .map((grandChild: any) => extractText(grandChild, depth + 1))
                      .filter((text: string) => text.trim().length > 0)
                      .join(' ');
                  }
                  return '';
                };

                const allText = node.children
                  .map((child: any) => extractText(child))
                  .filter((text: string) => text.trim().length > 0)
                  .join(' ')
                  .replace(/\s+/g, ' ')
                  .trim();

                if (allText) {
                  const words = allText.split(/\s+/);
                  const maxWords = Math.min(words.length, 5);
                  const selectedWords = words.slice(0, maxWords);
                  
                  displayText = selectedWords.join(' ');
                  if (words.length > 5) {
                    displayText += '...';
                  }
                }
              }

              // Extract additional positioning data
              const startPos = node.start || 0;
              const endPos = node.end || 0;
              const originalCode = projectFile.content.substring(startPos, endPos);
              const codeHash = crypto.createHash('md5').update(originalCode).digest('hex');
              
              const contextBefore = projectFile.content.substring(Math.max(0, startPos - 50), startPos);
              const contextAfter = projectFile.content.substring(endPos, Math.min(projectFile.content.length, endPos + 50));

              const extractedNode: ExtractedNode = {
                id: stableId,
                tagName,
                className: props.className as string | undefined,
                displayText,
                startLine,
                endLine: node.loc?.end.line || startLine,
                startColumn,
                endColumn: node.loc?.end.column || startColumn,
                props,
                isInteractive,
                fullCode: originalCode,
                startPos,
                endPos,
                originalCode,
                codeHash,
                contextBefore,
                contextAfter
              };

              nodes.push(extractedNode);

            } catch (nodeError) {
              console.warn(`[EXTRACTION] Error processing JSX node:`, nodeError);
            }
          }
        }
      });

      return nodes;
      
    } catch (parseError) {
      console.warn(`[EXTRACTION] AST parsing failed for ${projectFile.path}:`, parseError);
      return [];
    }
  }

  /**
   * Extract imports directly using Babel parser
   */
  private extractImportsDirectly(projectFile: ProjectFile): FileImportInfo {
    try {
      const { parse } = require('@babel/parser');
      const traverse = require('@babel/traverse').default;
      
      const ast = parse(projectFile.content, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
        ranges: true,
        errorRecovery: true
      });

      const imports: ExtractedImport[] = [];
      let hasLucideReact = false;
      let hasReact = false;
      const allImportSources: string[] = [];

      traverse(ast, {
        ImportDeclaration: (path: any) => {
          try {
            const node = path.node;
            const source: string = node.source.value;
            const line: number = node.loc?.start.line || 1;
            const fullStatement: string = projectFile.content.split('\n')[line - 1]?.trim() || '';

            allImportSources.push(source);
            
            if (source === 'lucide-react') {
              hasLucideReact = true;
            }
            if (source === 'react') {
              hasReact = true;
            }

            let importType: 'default' | 'named' | 'namespace' | 'side-effect' = 'side-effect';
            const importNames: string[] = [];

            if (node.specifiers && node.specifiers.length > 0) {
              for (const specifier of node.specifiers) {
                if (specifier.type === 'ImportDefaultSpecifier') {
                  importType = 'default';
                  importNames.push(specifier.local.name);
                } else if (specifier.type === 'ImportNamespaceSpecifier') {
                  importType = 'namespace';
                  importNames.push(specifier.local.name);
                } else if (specifier.type === 'ImportSpecifier') {
                  importType = 'named';
                  const importedName = specifier.imported.name;
                  const localName = specifier.local.name;
                  importNames.push(importedName === localName ? importedName : `${importedName} as ${localName}`);
                }
              }
            }

            imports.push({
              source,
              importType,
              imports: importNames,
              line,
              fullStatement
            });
          } catch (importError) {
            console.warn(`[EXTRACTION] Error processing import:`, importError);
          }
        }
      });

      const normalizedPath = projectFile.relativePath || projectFile.path;

      return {
        filePath: normalizedPath,
        imports,
        hasLucideReact,
        hasReact,
        allImportSources
      };
      
    } catch (parseError) {
      console.warn(`[EXTRACTION] Import parsing failed for ${projectFile.path}:`, parseError);
      const normalizedPath = projectFile.relativePath || projectFile.path;
      
      return {
        filePath: normalizedPath,
        imports: [],
        hasLucideReact: false,
        hasReact: false,
        allImportSources: []
      };
    }
  }

  /**
   * Generate compact tree representation for Claude analysis
   */
  private generateCompactTree(fileStructures: FileStructure[]): string {
    return fileStructures.map(file => {
      const nodeList = file.nodes.map((node: ExtractedNode) => {
        const className = node.className ? `.${node.className.split(' ')[0]}` : '';
        
        let textDisplay = '';
        if (node.displayText && node.displayText.trim()) {
          textDisplay = ` "${node.displayText}"`;
        }
        
        const hasHandlers = Object.keys(node.props || {}).some((key: string) => key.startsWith('on')) ? '{interactive}' : '';
        const lines = `(L${node.startLine}${node.endLine !== node.startLine ? `-${node.endLine}` : ''})`;
        
        return `${node.id}:${node.tagName}${className}${textDisplay}${hasHandlers}${lines}`;
      }).join('\n    ');

      // Add import information
      let importInfo = '';
      if (file.imports) {
        const importLines = file.imports.imports.map((imp: ExtractedImport) => 
          `${imp.source}: [${imp.imports.join(', ')}]`
        ).join(', ');
        
        const lucideStatus = file.imports.hasLucideReact ? '✅ Lucide' : '❌ No Lucide';
        const reactStatus = file.imports.hasReact ? '✅ React' : '❌ No React';
        
        importInfo = `\n  📦 IMPORTS: ${importLines}\n  🔍 STATUS: ${lucideStatus}, ${reactStatus}`;
      }
      
      // Add component type
      const typeInfo = file.componentType ? `\n  🏷️  TYPE: ${file.componentType}` : '';
      
      return `📁 ${file.filePath}:${importInfo}${typeInfo}\n    ${nodeList}`;
    }).join('\n\n');
  }

  /**
   * Calculate project metrics
   */
  private calculateProjectMetrics(fileStructures: FileStructure[]): {
    totalFiles: number;
    totalNodes: number;
    totalImports: number;
    filesWithLucide: number;
    filesWithReact: number;
    componentsByType: Record<string, number>;
  } {
    const totalFiles = fileStructures.length;
    const totalNodes = fileStructures.reduce((sum, f) => sum + f.nodes.length, 0);
    const totalImports = fileStructures.reduce((sum, f) => sum + f.imports.imports.length, 0);
    const filesWithLucide = fileStructures.filter(f => f.imports.hasLucideReact).length;
    const filesWithReact = fileStructures.filter(f => f.imports.hasReact).length;
    
    const componentsByType: Record<string, number> = {};
    fileStructures.forEach(f => {
      if (f.componentType) {
        componentsByType[f.componentType] = (componentsByType[f.componentType] || 0) + 1;
      }
    });

    return {
      totalFiles,
      totalNodes,
      totalImports,
      filesWithLucide,
      filesWithReact,
      componentsByType
    };
  }

  /**
   * Extract database indicators from the tree
   */
  private extractDatabaseIndicators(compactTree: string): string[] {
    const indicators: string[] = [];
    const dbPatterns = [
      /\bfetch\b/gi,
      /\baxios\b/gi,
      /\bapi\b/gi,
      /\buseQuery\b/gi,
      /\buseMutation\b/gi,
      /\bsupabase\b/gi,
      /\bprisma\b/gi,
      /\bmongodb\b/gi,
      /\bmysql\b/gi,
      /\bpostgres\b/gi,
      /\bgetServerSideProps\b/gi,
      /\bgetStaticProps\b/gi,
      /\bapi\/\b/gi,
      /\btrpc\b/gi,
      /\bgraphql\b/gi
    ];

    dbPatterns.forEach(pattern => {
      const matches = compactTree.match(pattern);
      if (matches && matches.length > 0) {
        indicators.push(`${pattern.source}: ${matches.length} occurrences`);
      }
    });

    return indicators;
  }

  /**
   * Detect component type based on file path and content
   */
  private detectComponentType(filePath: string, content: string): 'page' | 'component' | 'util' | 'context' | 'hook' | undefined {
    const pathLower = filePath.toLowerCase();
    
    if (pathLower.includes('/pages/') || pathLower.includes('/page/')) {
      return 'page';
    }
    
    if (pathLower.includes('/context') || content.includes('createContext')) {
      return 'context';
    }
    
    if (pathLower.includes('/hook') || /^use[A-Z]/.test(pathLower.split('/').pop() || '')) {
      return 'hook';
    }
    
    if (content.includes('export default') && content.includes('React.FC')) {
      return 'component';
    }
    
    if (!content.includes('JSX') && !content.includes('tsx')) {
      return 'util';
    }
    
    return undefined;
  }

  /**
   * Check if file should be analyzed for React/TypeScript content
   */
  private shouldAnalyzeFile(filePath: string): boolean {
    // Only analyze React/TypeScript files
    if (!filePath.match(/\.(tsx?|jsx?)$/i)) {
      return false;
    }
    
    // Skip common directories
    const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];
    return !skipDirs.some(dir => filePath.includes(dir));
  }

  /**
   * Normalize file path for consistent handling
   */
  private normalizeFilePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  }
}