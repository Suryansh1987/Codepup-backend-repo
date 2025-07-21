import Anthropic from '@anthropic-ai/sdk';
import { ModificationScope } from './types';
import { promises as fs } from 'fs';
import { join, isAbsolute } from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as crypto from 'crypto';

// ============================================================================
// INTERFACES
// ============================================================================

interface ProjectFile {
  path: string;
  relativePath?: string;
  content: string;
  lines: number;
  size: number;
  lastModified?: Date;
}

interface AnalysisNode {
  id: string;
  tagName: string;
  className?: string;
  startLine: number;
  endLine: number;
  displayText?: string;
  props?: Record<string, any>;
  isInteractive?: boolean;
}

interface ImportInfo {
  source: string;
  importType: 'default' | 'named' | 'namespace' | 'side-effect';
  imports: string[];
  line: number;
  fullStatement: string;
}

interface FileImportInfo {
  filePath: string;
  imports: ImportInfo[];
  hasLucideReact: boolean;
  hasReact: boolean;
  allImportSources: string[];
}

interface FileStructureInfo {
  filePath: string;
  nodes: AnalysisNode[];
  imports?: FileImportInfo;
}

interface TargetNodeInfo {
  filePath: string;
  nodeId: string;
  reason: string;
}

interface TreeInformation {
  fileStructures: FileStructureInfo[];
  compactTree: string;
  totalFiles: number;
  totalNodes: number;
  totalImports: number;
}

interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

// ============================================================================
// TOKEN TRACKER
// ============================================================================

class TokenTracker {
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private totalCacheCreationTokens = 0;
  private totalCacheReadTokens = 0;
  private apiCalls = 0;
  private operationHistory: Array<{
    operation: string;
    inputTokens: number;
    outputTokens: number;
    cacheCreation?: number;
    cacheRead?: number;
    timestamp: Date;
  }> = [];

  logUsage(usage: TokenUsage, operation: string): void {
    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const cacheCreation = usage.cache_creation_input_tokens || 0;
    const cacheRead = usage.cache_read_input_tokens || 0;

    this.totalInputTokens += inputTokens;
    this.totalOutputTokens += outputTokens;
    this.totalCacheCreationTokens += cacheCreation;
    this.totalCacheReadTokens += cacheRead;
    this.apiCalls++;

    this.operationHistory.push({
      operation,
      inputTokens,
      outputTokens,
      cacheCreation: cacheCreation > 0 ? cacheCreation : undefined,
      cacheRead: cacheRead > 0 ? cacheRead : undefined,
      timestamp: new Date()
    });

    console.log(`[SCOPE-TOKEN] ${operation}: ${inputTokens} in, ${outputTokens} out${cacheCreation > 0 ? `, ${cacheCreation} cache` : ''}${cacheRead > 0 ? `, ${cacheRead} cache-read` : ''}`);
  }

  getStats() {
    return {
      totalTokens: this.totalInputTokens + this.totalOutputTokens,
      inputTokens: this.totalInputTokens,
      outputTokens: this.totalOutputTokens,
      cacheCreationTokens: this.totalCacheCreationTokens,
      cacheReadTokens: this.totalCacheReadTokens,
      effectiveInputTokens: this.totalInputTokens - this.totalCacheReadTokens,
      apiCalls: this.apiCalls,
      averageInputPerCall: this.apiCalls > 0 ? Math.round(this.totalInputTokens / this.apiCalls) : 0,
      averageOutputPerCall: this.apiCalls > 0 ? Math.round(this.totalOutputTokens / this.apiCalls) : 0,
      operationHistory: this.operationHistory
    };
  }

  getDetailedReport(): string {
    const stats = this.getStats();
    const report = [
      `📊 SIMPLIFIED SCOPE ANALYZER TOKEN REPORT`,
      `═════════════════════════════════════════`,
      `🔢 Total API Calls: ${stats.apiCalls}`,
      `📥 Total Input Tokens: ${stats.inputTokens.toLocaleString()}`,
      `📤 Total Output Tokens: ${stats.outputTokens.toLocaleString()}`,
      `🎯 Total Tokens Used: ${stats.totalTokens.toLocaleString()}`
    ];
    return report.join('\n');
  }

  reset(): void {
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.totalCacheCreationTokens = 0;
    this.totalCacheReadTokens = 0;
    this.apiCalls = 0;
    this.operationHistory = [];
  }
}

// ============================================================================
// DYNAMIC AST ANALYZER (moved from TargetedNodes)
// ============================================================================

class DynamicASTAnalyzer {
  private streamCallback?: (message: string) => void;
  private nodeCache = new Map<string, any[]>();
  private importCache = new Map<string, FileImportInfo>();
  private reactBasePath: string;

  constructor(reactBasePath: string) {
    this.reactBasePath = reactBasePath.replace(/builddora/g, 'buildora');
  }

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
  }

  private streamUpdate(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
  }

  private extractImports(filePath: string, content: string): FileImportInfo {
    const cacheKey = `${filePath}_${content.length}`;
    
    if (this.importCache.has(cacheKey)) {
      return this.importCache.get(cacheKey)!;
    }

    const imports: ImportInfo[] = [];
    let hasLucideReact = false;
    let hasReact = false;
    const allImportSources: string[] = [];

    try {
      const ast = parse(content, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
        ranges: true
      });

      traverse(ast, {
        ImportDeclaration: (path: any) => {
          const node = path.node;
          const source = node.source.value;
          const line = node.loc?.start.line || 1;
          const fullStatement = content.split('\n')[line - 1]?.trim() || '';

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
        }
      });

    } catch (error) {
      this.streamUpdate(`⚠️ Import extraction failed for ${filePath}: ${error}`);
    }

    const fileImportInfo: FileImportInfo = {
      filePath,
      imports,
      hasLucideReact,
      hasReact,
      allImportSources
    };

    this.importCache.set(cacheKey, fileImportInfo);
    return fileImportInfo;
  }

  private createStableNodeId(node: any, content: string, index: number): string {
    const tagName = node.openingElement?.name?.name || 'unknown';
    const startLine = node.loc?.start.line || 1;
    const startColumn = node.loc?.start.column || 0;
    
    let context = '';
    if (node.start !== undefined && node.end !== undefined) {
      const start = Math.max(0, node.start - 10);
      const end = Math.min(content.length, node.end + 10);
      context = content.substring(start, end);
    }
    
    const hashInput = `${tagName}_${startLine}_${startColumn}_${index}_${context.replace(/\s+/g, ' ').trim()}`;
    const hash = crypto.createHash('sha256').update(hashInput).digest('hex');
    return hash.substring(0, 12);
  }

  private extractElementData(node: any, content: string): {
    displayText?: string;
    props: Record<string, any>;
    isInteractive: boolean;
  } {
    const props: Record<string, any> = {};
    let isInteractive = false;

    // Extract all props
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

          // Detect interactivity
          if (propName.startsWith('on') || propName === 'href' || propName === 'to') {
            isInteractive = true;
          }
        }
      }
    }

    // Extract text content - maximum 5 words
    let displayText: string | undefined;
    if (node.children) {
      const extractText = (child: any, depth: number = 0): string => {
        if (!child || depth > 3) return '';
        
        if (child.type === 'JSXText') {
          return child.value.trim();
        } else if (child.type === 'JSXExpressionContainer') {
          if (child.expression?.type === 'StringLiteral') {
            return child.expression.value;
          } else if (child.expression?.type === 'Identifier') {
            return `{${child.expression.name}}`;
          } else if (child.expression?.type === 'TemplateLiteral') {
            const quasis = child.expression.quasis || [];
            return quasis.map((q: any) => q.value?.cooked || '').join(' ');
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

    return { displayText, props, isInteractive };
  }

  private parseAndCacheNodes(filePath: string, content: string): any[] {
    const cacheKey = `${filePath}_${content.length}`;
    
    if (this.nodeCache.has(cacheKey)) {
      return this.nodeCache.get(cacheKey)!;
    }

    try {
      const ast = parse(content, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
        ranges: true
      });

      const nodes: any[] = [];
      let nodeIndex = 0;

      traverse(ast, {
        JSXElement: {
          enter: (path: any) => {
            const node = path.node;
            nodeIndex++;

            let tagName = 'unknown';
            if (node.openingElement?.name?.type === 'JSXIdentifier') {
              tagName = node.openingElement.name.name;
            } else if (node.openingElement?.name?.type === 'JSXMemberExpression') {
              tagName = `${node.openingElement.name.object.name}.${node.openingElement.name.property.name}`;
            }

            const stableId = this.createStableNodeId(node, content, nodeIndex);

            const enhancedNode = {
              ...node,
              _id: stableId,
              _tagName: tagName,
              _index: nodeIndex,
              _filePath: filePath
            };

            nodes.push(enhancedNode);
          }
        }
      });

      this.nodeCache.set(cacheKey, nodes);
      return nodes;

    } catch (error) {
      this.streamUpdate(`❌ Parsing failed: ${error}`);
      return [];
    }
  }

  // Extract minimal nodes for analysis
  extractMinimalNodes(filePath: string, projectFiles: Map<string, ProjectFile>): AnalysisNode[] {
    if (!filePath.match(/\.(tsx?|jsx?)$/i)) {
      return [];
    }

    const file = projectFiles.get(filePath);
    if (!file) {
      return [];
    }

    const nodes = this.parseAndCacheNodes(filePath, file.content);
    const minimalNodes: AnalysisNode[] = [];

    for (const node of nodes) {
      const { displayText, props, isInteractive } = this.extractElementData(node, file.content);

      const minimalNode: AnalysisNode = {
        id: node._id,
        tagName: node._tagName,
        className: props.className,
        startLine: node.loc?.start.line || 1,
        endLine: node.loc?.end.line || 1,
        displayText,
        props,
        isInteractive
      };

      minimalNodes.push(minimalNode);
    }

    return minimalNodes;
  }

  // Extract imports for a file
  extractFileImports(filePath: string, projectFiles: Map<string, ProjectFile>): FileImportInfo | null {
    if (!filePath.match(/\.(tsx?|jsx?)$/i)) {
      return null;
    }

    const file = projectFiles.get(filePath);
    if (!file) {
      return null;
    }

    return this.extractImports(filePath, file.content);
  }

  // Generate compact tree with import info and text content
  generateCompactTreeWithImports(files: FileStructureInfo[]): string {
    return files.map(file => {
      const nodeList = file.nodes.map(node => {
        const className = node.className ? `.${node.className.split(' ')[0]}` : '';
        
        let textDisplay = '';
        if (node.displayText && node.displayText.trim()) {
          textDisplay = ` "${node.displayText}"`;
        }
        
        const hasHandlers = Object.keys(node.props || {}).some(key => key.startsWith('on')) ? '{interactive}' : '';
        const lines = `(L${node.startLine}${node.endLine !== node.startLine ? `-${node.endLine}` : ''})`;
        
        return `${node.id}:${node.tagName}${className}${textDisplay}${hasHandlers}${lines}`;
      }).join('\n    ');

      // Add import information
      let importInfo = '';
      if (file.imports) {
        const importLines = file.imports.imports.map(imp => 
          `${imp.source}: [${imp.imports.join(', ')}]`
        ).join(', ');
        
        const lucideStatus = file.imports.hasLucideReact ? '✅ Lucide' : '❌ No Lucide';
        const reactStatus = file.imports.hasReact ? '✅ React' : '❌ No React';
        
        importInfo = `\n  📦 IMPORTS: ${importLines}\n  🔍 STATUS: ${lucideStatus}, ${reactStatus}`;
      }
      
      return `📁 ${file.filePath}:${importInfo}\n    ${nodeList}`;
    }).join('\n\n');
  }

  private normalizeFilePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  }

  private shouldAnalyzeFile(filePath: string): boolean {
    return filePath.match(/\.(tsx?|jsx?)$/i) !== null;
  }

  // Build minimal AST tree with imports for the entire project
  buildMinimalTreeWithImports(projectFiles: Map<string, ProjectFile>): FileStructureInfo[] {
    const fileStructures: FileStructureInfo[] = [];
    
    for (const [filePath, projectFile] of projectFiles) {
      if (!this.shouldAnalyzeFile(filePath)) {
        continue;
      }

      const nodes = this.extractMinimalNodes(filePath, projectFiles);
      const imports = this.extractFileImports(filePath, projectFiles);
      
      if (nodes.length === 0) {
        continue;
      }

      const normalizedPath = projectFile.relativePath || this.normalizeFilePath(filePath);

      fileStructures.push({
        filePath: normalizedPath,
        nodes,
        imports: imports || undefined
      });

      const importCount = imports?.imports.length || 0;
      const lucideStatus = imports?.hasLucideReact ? '✅' : '❌';
      this.streamUpdate(`📄 ${normalizedPath}: ${nodes.length} nodes, ${importCount} imports ${lucideStatus}`);
    }

    return fileStructures;
  }

  clearCache(): void {
    this.nodeCache.clear();
    this.importCache.clear();
  }
}

// ============================================================================
// SIMPLIFIED SCOPE ANALYZER
// ============================================================================

export class ScopeAnalyzer {
  private anthropic: Anthropic;
  private streamCallback?: (message: string) => void;
  private tokenTracker: TokenTracker;
  private astAnalyzer: DynamicASTAnalyzer;

  constructor(anthropic: Anthropic, reactBasePath: string = '') {
    this.anthropic = anthropic;
    this.tokenTracker = new TokenTracker();
    this.astAnalyzer = new DynamicASTAnalyzer(reactBasePath || process.cwd());
  }

  setStreamCallback(callback: (message: string) => void) {
    this.streamCallback = callback;
    this.astAnalyzer.setStreamCallback(callback);
  }

  private streamUpdate(message: string) {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
  }

  // Public method to get token tracker
  getTokenTracker(): TokenTracker {
    return this.tokenTracker;
  }

  // Public method to get token stats
  getTokenStats() {
    return this.tokenTracker.getStats();
  }

  // Public method to get detailed token report
  getTokenReport(): string {
    return this.tokenTracker.getDetailedReport();
  }

  /**
   * SIMPLIFIED: Main scope analysis with single AI call
   */
  async analyzeScope(
    prompt: string, 
    projectSummary?: string, 
    conversationContext?: string,
    dbSummary?: string,
    projectFiles?: Map<string, ProjectFile>
  ): Promise<ModificationScope> {
    this.streamUpdate('🤖 Starting simplified scope analysis...');

    // Build tree if we have project files (for potential TARGETED_NODES)
    let treeInformation: TreeInformation | undefined;
    
    if (projectFiles && projectFiles.size > 0) {
      this.streamUpdate('🌳 Building project tree...');
      this.astAnalyzer.clearCache();
      const fileStructures = this.astAnalyzer.buildMinimalTreeWithImports(projectFiles);
      
      if (fileStructures.length > 0) {
        const totalNodes = fileStructures.reduce((sum, f) => sum + f.nodes.length, 0);
        const totalImports = fileStructures.reduce((sum, f) => sum + (f.imports?.imports.length || 0), 0);
        const compactTree = this.astAnalyzer.generateCompactTreeWithImports(fileStructures);
        
        treeInformation = {
          fileStructures,
          compactTree,
          totalFiles: fileStructures.length,
          totalNodes,
          totalImports
        };
        
        this.streamUpdate(`✅ Built tree: ${fileStructures.length} files, ${totalNodes} nodes, ${totalImports} imports`);
      }
    }

    // SINGLE AI CALL for scope determination and analysis
    const result = await this.performSingleScopeAnalysis(prompt, conversationContext, treeInformation);

    this.streamUpdate(`✅ Scope determined: ${result.scope}`);
    
    // Log token summary
    const tokenStats = this.tokenTracker.getStats();
    this.streamUpdate(`💰 Scope Analysis Tokens: ${tokenStats.totalTokens} total (${tokenStats.apiCalls} API calls)`);

    return result;
  }

  /**
   * SINGLE AI CALL for all scope analysis
   */
  private async performSingleScopeAnalysis(
    prompt: string,
    conversationContext?: string,
    treeInformation?: TreeInformation
  ): Promise<ModificationScope> {
    
    const hasTree = treeInformation && treeInformation.totalNodes > 0;
    const treeSection = hasTree ? `
PROJECT TREE WITH IMPORT AND TEXT CONTENT:
${treeInformation!.compactTree}

TREE STATISTICS:
- Total Files: ${treeInformation!.totalFiles}
- Total Nodes: ${treeInformation!.totalNodes} 
- Total Imports: ${treeInformation!.totalImports}

FORMAT EXPLANATION: 
- nodeId:tagName.className "text content" {interactive} (LineNumbers)
- 📦 IMPORTS: Lists all imports from each file
- 🔍 STATUS: Shows if Lucide React and React are imported
` : 'PROJECT TREE: Not available - will use other scope methods';

    const analysisPrompt = `
**USER REQUEST:** "${prompt}"

${conversationContext ? `**CONVERSATION CONTEXT:**\n${conversationContext}\n` : ''}

${treeSection}

**COMPREHENSIVE SCOPE ANALYSIS TASK:**

You are an expert React/TypeScript modification analyzer. Your job is to determine the MOST APPROPRIATE modification scope and provide the necessary analysis data.

**DETAILED SCOPE OPTIONS:**

1. **TEXT_BASED_CHANGE** – For pure content replacement:
   ✅ CHOOSE THIS IF the request involves:
   - Only changing text content (no styling, positioning, or visual changes)
   - Simple word/phrase replacements without context targeting
   - Content updates that don't require specific element identification
   - Examples: "change 'Welcome' to 'Hello'", "replace 'Contact Us' with 'Get in Touch'"
   - Pattern: Direct text → text replacement with no element specificity

2. **TARGETED_NODES** – For specific element modifications:
   ✅ CHOOSE THIS IF the request involves:
   - Specific existing elements with targeted modifications
   - Location-based targeting (header, footer, hero section, navigation)
   - Element-specific changes that require precise identification
   - Visual modifications to particular components
   - Examples: "change the hero section tagline", "update the navigation button", "modify the footer text"
   - Pattern: Requires finding specific elements in the UI tree
   - **REQUIRES: Project tree must be available with nodes**

3. **COMPONENT_ADDITION** – For creating new UI elements:
   ✅ CHOOSE THIS IF the request involves:
   - Adding new components, pages, or UI elements
   - Creating something that doesn't exist yet
   - Examples: "add a button", "create a card", "make a new page", "build a contact form"
   - Pattern: Creation of new functionality

4. **TAILWIND_CHANGE** – For global styling modifications:
   ✅ CHOOSE THIS IF the request involves:
   - Global color changes without specifying exact elements
   - Theme color modifications (primary, secondary, accent colors)
   - Site-wide styling changes
   - Examples: "change the primary color to blue", "make the background red", "update the theme colors"
   - Pattern: Global visual changes affecting multiple elements

5. **FULL_FILE** – For complex multi-element changes:
   ✅ CHOOSE THIS IF the request involves:
   - Multiple related changes across files
   - Complete restructuring or redesign
   - Complex functionality additions affecting multiple components
   - Examples: "redesign the entire page", "add dark mode", "restructure the layout"
   - Pattern: Comprehensive changes requiring multiple file modifications

**ANALYSIS METHODOLOGY:**

1. **Request Classification:**
   - Analyze the user's intent and specificity
   - Determine if the change is simple text, targeted element, new creation, global styling, or complex

2. **Context Evaluation:**
   - Consider conversation history for additional context
   - Look for location indicators (hero, footer, navigation, etc.)
   - Assess complexity and scope of changes needed

3. **Tree Analysis (if available):**
   - For TARGETED_NODES: Identify specific nodes that match the request
   - Use semantic matching based on location, text content, and element structure
   - Consider tag names, class names, text content, and element hierarchy
   - Match user's described location with actual tree structure

4. **Data Extraction:**
   - For TEXT_BASED_CHANGE: Extract exact search and replacement terms
   - For TARGETED_NODES: Identify specific node IDs and reasons
   - For others: Provide reasoning for scope selection

**RESPONSE FORMATS:**

**For TEXT_BASED_CHANGE:**
\`\`\`json
{
  "scope": "TEXT_BASED_CHANGE",
  "reasoning": "This is a simple text replacement request without specific element targeting. The user wants to replace text content directly without requiring element identification.",
  "searchTerm": "exact text to find",
  "replacementTerm": "exact replacement text"
}
\`\`\`

**For TARGETED_NODES (only if tree available and nodes identified):**
\`\`\`json
{
  "scope": "TARGETED_NODES", 
  "reasoning": "This request targets specific elements that can be identified in the project tree. The modification requires precise element selection based on location and context.",
  "targetNodes": [
    {
      "filePath": "src/pages/Home.tsx",
      "nodeId": "nodeId123", 
      "reason": "This node represents the target element because: [detailed explanation of why this node matches the user's request, including location context, text content, and semantic meaning]"
    }
  ]
}
\`\`\`

**For COMPONENT_ADDITION:**
\`\`\`json
{
  "scope": "COMPONENT_ADDITION",
  "reasoning": "This request involves creating new UI elements that don't currently exist. The user wants to add new functionality or components to the application."
}
\`\`\`

**For TAILWIND_CHANGE:**
\`\`\`json
{
  "scope": "TAILWIND_CHANGE",
  "reasoning": "This request involves global styling changes that affect the overall theme or color scheme. The changes should be applied site-wide through configuration modifications."
}
\`\`\`

**For FULL_FILE:**
\`\`\`json
{
  "scope": "FULL_FILE",
  "reasoning": "This request requires comprehensive changes affecting multiple files or complex restructuring that cannot be handled by more specific approaches."
}
\`\`\`

**CRITICAL INSTRUCTIONS:**

1. **Path Accuracy:** Use EXACT file paths from the tree (no leading slashes: "src/pages/Home.tsx" not "/src/pages/Home.tsx")

2. **Node ID Precision:** Use EXACT node IDs from the tree structure provided above

3. **Semantic Matching:** For TARGETED_NODES, match user descriptions with actual tree elements using:
   - Location context (hero section → look for main/header elements in Home.tsx)
   - Text content matching (tagline → look for text content in nodes)
   - Element hierarchy and positioning
   - Semantic meaning of tags and classes

4. **Scope Priority:** Choose the MOST SPECIFIC scope that applies:
   - TEXT_BASED_CHANGE for simple text replacement
   - TARGETED_NODES for element-specific changes (requires tree)
   - COMPONENT_ADDITION for new element creation
   - TAILWIND_CHANGE for global styling
   - FULL_FILE only as last resort

5. **Reasoning Quality:** Provide detailed, logical reasoning that explains:
   - Why this scope was chosen over alternatives
   - How the request maps to the chosen approach
   - What specific analysis led to this decision

**PERFORM COMPREHENSIVE ANALYSIS AND RESPOND:**`;

    try {
      this.streamUpdate('🤖 Sending comprehensive scope analysis request...');
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 2000,
        temperature: 0.1,
        messages: [{ role: 'user', content: analysisPrompt }],
      });
      console.log('📊 Token Usage:', {
  inputTokens: response.usage.input_tokens,
  outputTokens: response.usage.output_tokens,
  totalTokens: response.usage.input_tokens + response.usage.output_tokens,
  model: 'claude-3-5-sonnet-20240620'
});

// More detailed logging
console.log(`🔤 Input tokens: ${response.usage.input_tokens}`);
console.log(`📝 Output tokens: ${response.usage.output_tokens}`);
console.log(`💰 Total tokens: ${response.usage.input_tokens + response.usage.output_tokens}`);

      this.tokenTracker.logUsage(response.usage, 'Comprehensive Scope Analysis');

      const responseText = response.content[0]?.type === 'text' ? response.content[0].text : '';
      return this.parseSimplifiedResponse(responseText, treeInformation);
      
    } catch (error) {
      this.streamUpdate(`❌ Scope analysis failed: ${error}`);
      
      // Fallback
      return {
        scope: "FULL_FILE",
        files: [],
        reasoning: `Analysis failed: ${error}`
      };
    }
  }

  /**
   * Parse the simplified AI response
   */
  private parseSimplifiedResponse(responseText: string, treeInformation?: TreeInformation): ModificationScope {
    try {
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[1]);
      
      // Validate scope
      const validScopes = ["FULL_FILE", "TARGETED_NODES", "COMPONENT_ADDITION", "TAILWIND_CHANGE", "TEXT_BASED_CHANGE"];
      if (!validScopes.includes(parsed.scope)) {
        throw new Error(`Invalid scope: ${parsed.scope}`);
      }

      const baseScope: ModificationScope = {
        scope: parsed.scope,
        files: [],
        reasoning: parsed.reasoning || "No reasoning provided"
      };

      // Handle TEXT_BASED_CHANGE
      if (parsed.scope === "TEXT_BASED_CHANGE" && parsed.searchTerm && parsed.replacementTerm) {
        baseScope.textChangeAnalysis = {
          searchTerm: parsed.searchTerm,
          replacementTerm: parsed.replacementTerm,
          searchVariations: []
        };
        return baseScope;
      }

      // Handle TARGETED_NODES  
      if (parsed.scope === "TARGETED_NODES" && parsed.targetNodes && treeInformation) {
        // Normalize paths (remove leading slashes)
        const normalizedTargetNodes = parsed.targetNodes.map((node: any) => ({
          ...node,
          filePath: node.filePath.replace(/^\/+/, '')
        }));

        baseScope.treeInformation = treeInformation;
        baseScope.targetNodes = normalizedTargetNodes;
        return baseScope;
      }

      // Handle all other scopes (simple response)
      return baseScope;

    } catch (error) {
      this.streamUpdate(`❌ Failed to parse response: ${error}`);
      
      // Fallback
      return {
        scope: "FULL_FILE",
        files: [],
        reasoning: `Parse error: ${error}`
      };
    }
  }
}