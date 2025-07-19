import Anthropic from '@anthropic-ai/sdk';
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

interface FileStructureInfo {
  filePath: string;
  nodes: AnalysisNode[];
  imports?: FileImportInfo;
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

interface ModificationNode extends AnalysisNode {
  startColumn: number;
  endColumn: number;
  fullCode: string;
  fullAttributes: Record<string, any>;
  startPos: number;
  endPos: number;
  lineBasedStart: number;
  lineBasedEnd: number;
  originalCode: string;
  codeHash: string;
  contextBefore: string;
  contextAfter: string;
  parentNode?: {
    id: string;
    tagName: string;
    className?: string;
    startLine: number;
    endLine: number;
  };
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

interface ModificationRequest {
  filePath: string;
  nodeId: string;
  newCode: string;
  reasoning: string;
  requiredImports?: ImportInfo[];
}

interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

// ============================================================================
// TOKEN TRACKER
// ============================================================================

class TokenTracker {
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private apiCalls = 0;

  logUsage(usage: TokenUsage, operation: string): void {
    this.totalInputTokens += usage.input_tokens || 0;
    this.totalOutputTokens += usage.output_tokens || 0;
    this.apiCalls++;
    console.log(`[TARGETED-TOKEN] ${operation}: ${usage.input_tokens || 0} in, ${usage.output_tokens || 0} out`);
  }

  getStats() {
    return {
      totalTokens: this.totalInputTokens + this.totalOutputTokens,
      inputTokens: this.totalInputTokens,
      outputTokens: this.totalOutputTokens,
      apiCalls: this.apiCalls
    };
  }

  reset(): void {
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.apiCalls = 0;
  }
}

// ============================================================================
// SIMPLIFIED TARGETED NODES PROCESSOR (STEP 2 ONLY)
// ============================================================================

export class TargetedNodesProcessor {
  private anthropic: Anthropic;
  private reactBasePath: string;
  private streamCallback?: (message: string) => void;
  private tokenTracker: TokenTracker;
  private nodeCache = new Map<string, any[]>();
  private fileNodeCache = new Map<string, Map<string, ModificationNode>>();

  constructor(anthropic: Anthropic, reactBasePath: string) {
    this.anthropic = anthropic;
    this.reactBasePath = reactBasePath.replace(/builddora/g, 'buildora');
    this.tokenTracker = new TokenTracker();
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
  // MAIN PROCESSING METHOD (SIMPLIFIED - NO TREE BUILDING OR ANALYSIS)
  // ============================================================================

  async processTargetedModification(
    prompt: string,
    projectFiles: Map<string, ProjectFile>,
    reactBasePath: string,
    streamCallback: (message: string) => void,
    // NEW: Receive tree information and target nodes from ScopeAnalyzer
    treeInformation?: TreeInformation,
    targetNodes?: TargetNodeInfo[]
  ): Promise<{
    success: boolean;
    projectFiles?: Map<string, ProjectFile>;
    updatedProjectFiles?: Map<string, ProjectFile>;
    changes?: Array<{
      type: string;
      file: string;
      description: string;
      success: boolean;
      details?: any;
    }>;
  }> {
    this.setStreamCallback(streamCallback);
    
    if (reactBasePath) {
      this.reactBasePath = reactBasePath.replace(/builddora/g, 'buildora');
    }

    try {
      this.streamUpdate(`🎯 TARGETED NODES: Starting Step 2 processing...`);
      
      // Check if we have the required data from ScopeAnalyzer
      if (!treeInformation || !targetNodes || targetNodes.length === 0) {
        this.streamUpdate(`❌ No tree information or target nodes provided by ScopeAnalyzer`);
        return { success: false, changes: [] };
      }

      this.streamUpdate(`✅ Received tree info: ${treeInformation.totalFiles} files, ${treeInformation.totalNodes} nodes`);
      this.streamUpdate(`🎯 Target nodes to process: ${targetNodes.length}`);

      // STEP 2: Extract full nodes and apply modifications
      this.streamUpdate(`🔧 STEP 2: Extracting full nodes and applying modifications...`);
      const modificationResults = await this.extractAndModifyNodes(
        targetNodes, 
        projectFiles, 
        prompt,
        treeInformation.fileStructures
      );

      const changes = this.buildChangeReport(modificationResults, treeInformation);
      const successCount = modificationResults.filter(r => r.success).length;

      this.streamUpdate(`\n🎉 TARGETED NODES COMPLETE!`);
      this.streamUpdate(`   ✅ Modified: ${successCount}/${modificationResults.length} files`);
      this.streamUpdate(`   📊 Total nodes processed: ${treeInformation.totalNodes}`);
      
      const tokenStats = this.tokenTracker.getStats();
      this.streamUpdate(`💰 Tokens used: ${tokenStats.totalTokens} (${tokenStats.apiCalls} API calls)`);

      return {
        success: successCount > 0,
        updatedProjectFiles: projectFiles,
        projectFiles: projectFiles,
        changes: changes
      };

    } catch (error) {
      this.streamUpdate(`❌ Processing error: ${error}`);
      return {
        success: false,
        changes: [{
          type: 'error',
          file: 'system',
          description: `Processing failed: ${error}`,
          success: false
        }]
      };
    }
  }

  // ============================================================================
  // STEP 2: EXTRACT AND MODIFY NODES
  // ============================================================================

  private async extractAndModifyNodes(
    targetNodes: TargetNodeInfo[],
    projectFiles: Map<string, ProjectFile>,
    userRequest: string,
    fileStructures: FileStructureInfo[]
  ): Promise<Array<{ filePath: string; success: boolean; modificationsApplied: number; error?: string }>> {
    
    // Group by file
    const nodesByFile = new Map<string, Array<{ nodeId: string; reason: string }>>();
    
    for (const target of targetNodes) {
      const actualKey = this.findFileKey(target.filePath, projectFiles);
      
      if (!actualKey) {
        this.streamUpdate(`❌ File not found: ${target.filePath}`);
        continue;
      }
      
      if (!nodesByFile.has(actualKey)) {
        nodesByFile.set(actualKey, []);
      }
      nodesByFile.get(actualKey)!.push({ nodeId: target.nodeId, reason: target.reason });
    }

    const results: Array<{ filePath: string; success: boolean; modificationsApplied: number; error?: string }> = [];

    // Process each file
    for (const [actualFileKey, fileTargets] of nodesByFile) {
      try {
        const file = projectFiles.get(actualFileKey);
        const displayPath = file?.relativePath || actualFileKey;
        
        // Get import info for this file
        const fileStructure = fileStructures.find(fs => 
          fs.filePath === displayPath || 
          fs.filePath === this.normalizeFilePath(actualFileKey)
        );
        
        this.streamUpdate(`🔍 Extracting full nodes for ${fileTargets.length} targets in ${displayPath}...`);
        
        const nodeIds = fileTargets.map(t => t.nodeId);
        const fullNodes = this.extractFullNodes(actualFileKey, nodeIds, projectFiles);
        this.streamUpdate(`📊 Found ${fullNodes.length} full nodes for IDs: ${nodeIds.join(', ')}`);

        if (fullNodes.length === 0) {
          const failureResult = { 
            filePath: displayPath, 
            success: false, 
            modificationsApplied: 0, 
            error: 'No full nodes extracted' 
          };
          results.push(failureResult);
          continue;
        }

        this.streamUpdate(`✅ Extracted ${fullNodes.length} full nodes`);
       
        // Generate modifications with import context
        const modifications = await this.generateModificationsWithImports(
          fullNodes, 
          fileTargets, 
          userRequest, 
          displayPath,
          fileStructure?.imports
        );
        
        this.streamUpdate(`🔧 Generated ${modifications.length} modifications with import context`);
        
        if (modifications.length === 0) {
          const failureResult = { 
            filePath: displayPath, 
            success: false, 
            modificationsApplied: 0, 
            error: 'No modifications generated' 
          };
          results.push(failureResult);
          continue;
        }

        // Apply modifications with import handling
        const applyResult = await this.applyModificationsWithImports(
          modifications, 
          actualFileKey, 
          projectFiles, 
          fullNodes,
          fileStructure?.imports
        );

        const cleanResult = {
          filePath: applyResult.filePath,
          success: applyResult.success,
          modificationsApplied: applyResult.modificationsApplied,
          error: applyResult.error
        };

        this.streamUpdate(`💾 Applied ${cleanResult.modificationsApplied} modifications`);
        results.push(cleanResult);

      } catch (error) {
        const file = projectFiles.get(actualFileKey);
        const displayPath = file?.relativePath || actualFileKey;
        
        const errorResult = { 
          filePath: displayPath, 
          success: false, 
          modificationsApplied: 0, 
          error: `${error}` 
        };
        results.push(errorResult);
      }
    }

    return results;
  }

  // ============================================================================
  // NODE EXTRACTION AND CACHING
  // ============================================================================

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

  private calculatePosition(node: any, content: string): {
    startPos: number;
    endPos: number;
    lineBasedStart: number;
    lineBasedEnd: number;
    originalCode: string;
    contextBefore: string;
    contextAfter: string;
    codeHash: string;
  } {
    const lines = content.split('\n');
    const startLine = (node.loc?.start?.line || 1) - 1;
    const endLine = (node.loc?.end?.line || 1) - 1;
    const startColumn = node.loc?.start?.column || 0;
    const endColumn = node.loc?.end?.column || 0;

    // Calculate line-based positions
    let lineBasedStart = 0;
    for (let i = 0; i < startLine && i < lines.length; i++) {
      lineBasedStart += lines[i].length + 1;
    }
    lineBasedStart += startColumn;

    let lineBasedEnd = 0;
    for (let i = 0; i < endLine && i < lines.length; i++) {
      lineBasedEnd += lines[i].length + 1;
    }
    lineBasedEnd += endColumn;

    // Use AST positions if available
    let startPos = lineBasedStart;
    let endPos = lineBasedEnd;
    
    if (node.start !== undefined && node.end !== undefined && 
        node.start >= 0 && node.end > node.start && 
        node.end <= content.length) {
      startPos = node.start;
      endPos = node.end;
    }

    // Extract code
    let originalCode = '';
    if (startPos >= 0 && endPos > startPos && endPos <= content.length) {
      originalCode = content.substring(startPos, endPos);
    } else if (lineBasedStart >= 0 && lineBasedEnd > lineBasedStart && lineBasedEnd <= content.length) {
      originalCode = content.substring(lineBasedStart, lineBasedEnd);
      startPos = lineBasedStart;
      endPos = lineBasedEnd;
    }

    // Get context
    const contextSize = 50;
    const contextBefore = content.substring(Math.max(0, startPos - contextSize), startPos);
    const contextAfter = content.substring(endPos, Math.min(content.length, endPos + contextSize));

    // Generate hash
    const codeHash = crypto.createHash('md5').update(originalCode).digest('hex');

    return {
      startPos,
      endPos,
      lineBasedStart,
      lineBasedEnd,
      originalCode,
      contextBefore,
      contextAfter,
      codeHash
    };
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
      const parentStack: any[] = [];

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

            // Get parent info
            let parentInfo = null;
            if (parentStack.length > 0) {
              const parent = parentStack[parentStack.length - 1];
              parentInfo = {
                id: parent._id,
                tagName: parent._tagName,
                startLine: parent.loc?.start.line || 1,
                endLine: parent.loc?.end.line || 1
              };
            }

            const enhancedNode = {
              ...node,
              _id: stableId,
              _tagName: tagName,
              _index: nodeIndex,
              _filePath: filePath,
              _parentInfo: parentInfo
            };

            nodes.push(enhancedNode);
            parentStack.push(enhancedNode);
          },
          exit: () => {
            parentStack.pop();
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

  // Extract full nodes for modification
  private extractFullNodes(filePath: string, nodeIds: string[], projectFiles: Map<string, ProjectFile>): ModificationNode[] {
    const file = projectFiles.get(filePath);
    if (!file) {
      return [];
    }

    let fullNodesMap = this.fileNodeCache.get(filePath);
    
    if (!fullNodesMap) {
      fullNodesMap = new Map();
      const nodes = this.parseAndCacheNodes(filePath, file.content);

      for (const node of nodes) {
        const { displayText, props, isInteractive } = this.extractElementData(node, file.content);
        const positionData = this.calculatePosition(node, file.content);

        const fullNode: ModificationNode = {
          id: node._id,
          tagName: node._tagName,
          className: props.className,
          startLine: node.loc?.start.line || 1,
          endLine: node.loc?.end.line || 1,
          startColumn: node.loc?.start.column || 0,
          endColumn: node.loc?.end.column || 0,
          displayText,
          props,
          isInteractive,
          fullCode: positionData.originalCode,
          fullAttributes: props,
          startPos: positionData.startPos,
          endPos: positionData.endPos,
          lineBasedStart: positionData.lineBasedStart,
          lineBasedEnd: positionData.lineBasedEnd,
          originalCode: positionData.originalCode,
          codeHash: positionData.codeHash,
          contextBefore: positionData.contextBefore,
          contextAfter: positionData.contextAfter,
          parentNode: node._parentInfo
        };

        fullNodesMap.set(node._id, fullNode);
      }

      this.fileNodeCache.set(filePath, fullNodesMap);
    }

    // Return requested nodes
    const result: ModificationNode[] = [];
    for (const nodeId of nodeIds) {
      const node = fullNodesMap.get(nodeId);
      if (node) {
        result.push(node);
      }
    }

    return result;
  }

  // ============================================================================
  // AI MODIFICATION GENERATION
  // ============================================================================

  private async generateModificationsWithImports(
    fullNodes: ModificationNode[],
    targets: Array<{ nodeId: string; reason: string }>,
    userRequest: string,
    filePath: string,
    currentImports?: FileImportInfo
  ): Promise<ModificationRequest[]> {
    
    const nodeDetails = fullNodes.map(node => {
      const target = targets.find(t => t.nodeId === node.id);
      
      // Build context string
      let contextInfo = '';
      if (node.parentNode) {
        contextInfo += `\nPARENT: ${node.parentNode.tagName} (L${node.parentNode.startLine}-${node.parentNode.endLine})`;
      }
      
      // Include relevant props
      const relevantProps = Object.entries(node.props || {})
        .filter(([key]) => !key.includes('className') || !key.includes('class'))
        .slice(0, 4)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
      
      return `
NODE ID: ${node.id}
TAG: ${node.tagName}
TEXT: ${node.displayText || 'none'}
PROPS: ${relevantProps || 'none'}
POSITION: L${node.startLine}-${node.endLine}${contextInfo}
REASON: ${target?.reason || 'modification needed'}
CURRENT CODE:
${node.fullCode}
`;
    }).join('\n---\n');

    // Build import context
    let importContext = '';
    if (currentImports) {
      const importList = currentImports.imports.map(imp => 
        `${imp.source}: [${imp.imports.join(', ')}]`
      ).join('\n');
      
      importContext = `
CURRENT IMPORTS IN FILE:
${importList}

IMPORT STATUS:
- Lucide React: ${currentImports.hasLucideReact ? '✅ Available' : '❌ NOT IMPORTED'}
- React: ${currentImports.hasReact ? '✅ Available' : '❌ NOT IMPORTED'}
- All Sources: ${currentImports.allImportSources.join(', ')}
`;
    } else {
      importContext = `
CURRENT IMPORTS IN FILE: 
No import information available

IMPORT STATUS:
- Lucide React: ❌ UNKNOWN
- React: ❌ UNKNOWN
`;
    }

    const modificationPrompt = `You are an EXPERT JSX CODE TRANSFORMER with advanced visual design capabilities and IMPORT MANAGEMENT expertise.

USER REQUEST: "${userRequest}"
FILE: ${filePath}

${importContext}

NODES TO MODIFY WITH FULL CONTEXT:
${nodeDetails}

🎨 COMPREHENSIVE MODIFICATION INSTRUCTIONS:

1. **IMPORT REQUIREMENTS - CRITICAL**:
   - ⚠️ If modification requires Lucide React icons and "❌ NOT IMPORTED", you MUST add required imports
   - ⚠️ If modification requires React hooks and "❌ NOT IMPORTED", you MUST add React import
   - Common Lucide icons: Plus, Minus, Search, User, Home, Settings, ChevronDown, etc.
   - Format: { IconName1, IconName2 } from 'lucide-react'

2. **VISUAL TRANSFORMATION PRIORITY**:
   - When user requests color changes, modify BOTH text content AND visual styling
   - Apply changes to className, style props, and CSS classes
   - Consider the ENTIRE visual appearance, not just text

3. **INTELLIGENT COLOR MAPPING - OVERRIDE TAILWIND CONFIG**:
   - ⚠️ CRITICAL: If element uses Tailwind classes, REMOVE them and use inline styles instead
   - Tailwind config may have custom colors that don't match user expectations
   - "blue" → style={{backgroundColor: '#3B82F6', color: 'white'}} (true blue, not config blue)
   - "red" → style={{backgroundColor: '#EF4444', color: 'white'}} (true red)
   - "green" → style={{backgroundColor: '#10B981', color: 'white'}} (true green)
   - Add hover effects with onMouseEnter/onMouseLeave for true colors

4. **TEXT CONTENT AWARENESS**:
   - Use the provided TEXT field to understand element purpose
   - Modify content based on user request and current text context
   - Preserve meaningful text while applying requested changes

5. **COMPREHENSIVE STYLE UPDATES**:
   - Replace Tailwind color classes with inline style objects
   - Use standard web colors that match user expectations
   - Remove conflicting Tailwind classes entirely
   - Maintain responsive design with Tailwind layout classes only

🔧 TECHNICAL REQUIREMENTS:

- Return COMPLETE, VALID JSX with full styling applied
- Preserve ALL existing functionality and event handlers
- Maintain semantic HTML structure
- Apply modern CSS best practices
- Ensure cross-browser compatibility
- Handle import requirements properly

You must respond with ONLY a valid JSON object in this exact format:

{
  "modifications": [
    {
      "filePath": "${filePath}",
      "nodeId": "exact_node_id_from_above",
      "newCode": "complete JSX element with comprehensive visual styling applied",
      "reasoning": "detailed explanation of all changes applied, including text content considerations",
      "requiredImports": [
        {
          "source": "lucide-react",
          "importType": "named",
          "imports": ["Plus", "Search"],
          "line": 0,
          "fullStatement": "import { Plus, Search } from 'lucide-react';"
        }
      ]
    }
  ]
}

⚡ CRITICAL IMPORT RULES:
1. If code uses Lucide icons and Lucide React is NOT imported, add requiredImports
2. If code uses React hooks and React is NOT imported, add requiredImports  
3. Only include requiredImports if the import is actually missing
4. Use exact icon names from Lucide React library
5. Format imports correctly: named imports for icons, default for React

⚡ CRITICAL: Focus on user request with intelligent text content understanding!

Do not include any text before or after the JSON object.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.1,
        messages: [{ role: 'user', content: modificationPrompt }],
      });


      const block = response.content[0];
const responseText = block && 'text' in block ? (block as any).text : '';

      
      // Extract JSON from response
      let jsonData = null;
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          jsonData = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          this.streamUpdate(`⚠️ JSON parse error: ${parseError}`);
        }
      }
      
      if (jsonData && jsonData.modifications) {
        const importCount = jsonData.modifications.reduce((sum: number, mod: any) => 
          sum + (mod.requiredImports?.length || 0), 0);
        this.streamUpdate(`✅ Generated ${jsonData.modifications.length} modifications with ${importCount} import requirements`);
        return jsonData.modifications;
      } else {
        this.streamUpdate(`⚠️ No valid JSON found, generating fallback modifications`);
        return this.generateFallbackModifications(fullNodes, targets, userRequest, filePath);
      }
      
    } catch (error) {
      this.streamUpdate(`❌ Modification generation error: ${error}`);
      return this.generateFallbackModifications(fullNodes, targets, userRequest, filePath);
    }
  }

  // ============================================================================
  // MODIFICATION APPLICATION
  // ============================================================================

  private async applyModificationsWithImports(
    modifications: ModificationRequest[],
    fileKey: string,
    projectFiles: Map<string, ProjectFile>,
    fullNodes: ModificationNode[],
    currentImports?: FileImportInfo
  ): Promise<{ filePath: string; success: boolean; modificationsApplied: number; error?: string }> {
    
    const projectFile = projectFiles.get(fileKey);
    const displayPath = projectFile?.relativePath || fileKey;
    
    if (!projectFile) {
      return { 
        filePath: displayPath, 
        success: false, 
        modificationsApplied: 0, 
        error: 'File not found' 
      };
    }

    this.streamUpdate(`🔧 Applying ${modifications.length} modifications to ${displayPath}...`);

    let content = projectFile.content;
    let appliedCount = 0;

    // Step 1: Handle import additions
    const allRequiredImports = modifications
      .flatMap(mod => mod.requiredImports || [])
      .filter(imp => imp);

    if (allRequiredImports.length > 0) {
      this.streamUpdate(`📦 Processing ${allRequiredImports.length} import requirements...`);
      content = await this.addRequiredImports(content, allRequiredImports, currentImports);
    }

    // Step 2: Apply code modifications
    const sortedMods = modifications
      .map(mod => ({
        ...mod,
        node: fullNodes.find(n => n.id === mod.nodeId)
      }))
      .filter(mod => mod.node)
      .sort((a, b) => {
        const aPos = a.node!.lineBasedStart || a.node!.startPos;
        const bPos = b.node!.lineBasedStart || b.node!.startPos;
        return bPos - aPos;
      });

    // Apply each modification with multiple strategies
    for (const mod of sortedMods) {
      const node = mod.node!;
      let success = false;

      // Strategy 1: Exact hash-verified replacement
      if (node.originalCode && node.codeHash) {
        const currentHash = crypto.createHash('md5').update(node.originalCode).digest('hex');
        if (currentHash === node.codeHash && content.includes(node.originalCode)) {
          const occurrences = content.split(node.originalCode).length - 1;
          
          if (occurrences === 1) {
            content = content.replace(node.originalCode, mod.newCode);
            success = true;
            this.streamUpdate(`   ✅ Strategy 1: Exact replacement for ${node.id}`);
          }
        }
      }

      // Strategy 2: Context-aware replacement
      if (!success && node.contextBefore && node.contextAfter) {
        try {
          const exactPattern = this.escapeRegExp(node.contextBefore) + 
                              '([\\s\\S]*?)' + 
                              this.escapeRegExp(node.contextAfter);
          const exactRegex = new RegExp(exactPattern, 'g');
          const exactMatches = Array.from(content.matchAll(exactRegex));
          
          if (exactMatches.length === 1) {
            const match = exactMatches[0];
            const matchedCode = match[1];
            const similarity = this.calculateSimilarity(matchedCode.trim(), node.originalCode.trim());
            
            if (similarity > 0.7) {
              const replacement = node.contextBefore + mod.newCode + node.contextAfter;
              content = content.replace(match[0], replacement);
              success = true;
              this.streamUpdate(`   ✅ Strategy 2: Context replacement for ${node.id}`);
            }
          }
        } catch (regexError) {
          // Continue to next strategy
        }
      }

      // Strategy 3: Line-based replacement
      if (!success && node.lineBasedStart >= 0 && node.lineBasedEnd > node.lineBasedStart) {
        if (node.lineBasedEnd <= content.length) {
          const before = content.substring(0, node.lineBasedStart);
          const after = content.substring(node.lineBasedEnd);
          const currentCode = content.substring(node.lineBasedStart, node.lineBasedEnd);
          
          const similarity = this.calculateSimilarity(currentCode.trim(), node.originalCode.trim());
          
          if (similarity > 0.6) {
            content = before + mod.newCode + after;
            success = true;
            this.streamUpdate(`   ✅ Strategy 3: Line-based replacement for ${node.id}`);
          }
        }
      }

      if (success) {
        appliedCount++;
      } else {
        this.streamUpdate(`   ❌ Failed to apply modification for ${node.id}`);
      }
    }

    // Write file if modifications applied
    if (appliedCount > 0) {
      try {
        const actualPath = this.resolveFilePath(projectFile);
        await fs.writeFile(actualPath, content, 'utf8');
        
        // Update in-memory file
        projectFile.content = content;
        projectFile.lines = content.split('\n').length;
        projectFile.size = content.length;

        this.streamUpdate(`💾 Saved ${appliedCount}/${modifications.length} modifications to ${displayPath}`);

      } catch (writeError) {
        this.streamUpdate(`💥 Write error: ${writeError}`);
        return { filePath: displayPath, success: false, modificationsApplied: 0, error: `Write failed: ${writeError}` };
      }
    }

    const finalSuccess = appliedCount > 0;

    return { 
      filePath: displayPath, 
      success: finalSuccess, 
      modificationsApplied: appliedCount 
    };
  }

  // ============================================================================
  // IMPORT MANAGEMENT
  // ============================================================================

  private async addRequiredImports(
    content: string, 
    requiredImports: ImportInfo[], 
    currentImports?: FileImportInfo
  ): Promise<string> {
    
    const lines = content.split('\n');
    const newImports: string[] = [];

    // Group required imports by source
    const importsBySource = new Map<string, string[]>();
    for (const imp of requiredImports) {
      if (!importsBySource.has(imp.source)) {
        importsBySource.set(imp.source, []);
      }
      importsBySource.get(imp.source)!.push(...imp.imports);
    }

    // Check each source and merge/add imports
    for (const [source, newImportNames] of importsBySource) {
      const existingImport = currentImports?.imports.find(imp => imp.source === source);
      
      if (existingImport) {
        // Merge with existing import
        const uniqueNewImports = newImportNames.filter(name => 
          !existingImport.imports.includes(name) && 
          !existingImport.imports.includes(name.split(' as ')[0])
        );
        
        if (uniqueNewImports.length > 0) {
          const allImports = [...existingImport.imports, ...uniqueNewImports].sort();
          const newImportStatement = `import { ${allImports.join(', ')} } from '${source}';`;
          
          // Replace existing import line
          const lineIndex = existingImport.line - 1;
          if (lineIndex >= 0 && lineIndex < lines.length) {
            lines[lineIndex] = newImportStatement;
            this.streamUpdate(`   📦 Updated existing import: ${source}`);
          }
        }
      } else {
        // Add new import
        const uniqueImports = [...new Set(newImportNames)].sort();
        const newImportStatement = `import { ${uniqueImports.join(', ')} } from '${source}';`;
        newImports.push(newImportStatement);
        this.streamUpdate(`   📦 Adding new import: ${source}`);
      }
    }

    // Add new imports at the top (after existing imports or at the beginning)
    if (newImports.length > 0) {
      let insertIndex = 0;
      
      // Find the last import line
      if (currentImports && currentImports.imports.length > 0) {
        const lastImportLine = Math.max(...currentImports.imports.map(imp => imp.line));
        insertIndex = lastImportLine;
      }
      
      // Insert new imports
      for (let i = newImports.length - 1; i >= 0; i--) {
        lines.splice(insertIndex, 0, newImports[i]);
      }
    }

    return lines.join('\n');
  }

  // ============================================================================
  // FALLBACK AND HELPER METHODS
  // ============================================================================

  private generateFallbackModifications(
    fullNodes: ModificationNode[],
    targets: Array<{ nodeId: string; reason: string }>,
    userRequest: string,
    filePath: string
  ): ModificationRequest[] {
    return targets.map(target => {
      const node = fullNodes.find(n => n.id === target.nodeId);
      if (!node) {
        return {
          filePath,
          nodeId: target.nodeId,
          newCode: '',
          reasoning: 'Node not found for modification'
        };
      }

      // Simple fallback - return original code with a comment
      let fallbackCode = node.fullCode;
      
      // For simple text changes, try basic replacement
      if (userRequest.includes('change') && userRequest.includes('to')) {
        const match = userRequest.match(/change\s+(.+?)\s+to\s+(.+)/i);
        if (match) {
          const [, oldText, newText] = match;
          if (fallbackCode.includes(oldText)) {
            fallbackCode = fallbackCode.replace(oldText, newText);
          }
        }
      }

      return {
        filePath,
        nodeId: target.nodeId,
        newCode: fallbackCode,
        reasoning: `Fallback modification applied for: ${userRequest}`
      };
    });
  }

 private escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    let matches = 0;
    const maxLength = Math.max(str1.length, str2.length);
    
    for (let i = 0; i < shorter.length; i++) {
      if (str1[i] === str2[i]) matches++;
    }
    
    return matches / maxLength;
  }

  private buildChangeReport(
    applyResults: Array<{ filePath: string; success: boolean; modificationsApplied: number; error?: string }>,
    treeInformation: TreeInformation
  ): Array<any> {
    const changes: Array<any> = [];

    // Add summary
    changes.push({
      type: 'targeted_nodes_processing',
      file: 'system',
      description: `Targeted nodes processing: ${treeInformation.totalFiles} files, ${treeInformation.totalNodes} nodes analyzed`,
      success: true,
      details: {
        filesAnalyzed: treeInformation.totalFiles,
        totalNodes: treeInformation.totalNodes,
        totalImports: treeInformation.totalImports
      }
    });

    // Add file results
    for (const result of applyResults) {
      if (result.success) {
        changes.push({
          type: 'file_modified',
          file: result.filePath,
          description: `Applied ${result.modificationsApplied} modifications with import handling`,
          success: true,
          details: {
            modificationsApplied: result.modificationsApplied
          }
        });
      } else {
        changes.push({
          type: 'modification_failed',
          file: result.filePath,
          description: `Failed: ${result.error}`,
          success: false,
          details: {
            error: result.error
          }
        });
      }
    }

    return changes;
  }

 private findFileKey(relativePath: string, projectFiles: Map<string, ProjectFile>): string | null {
    console.log(`[DEBUG] findFileKey: Looking for path: "${relativePath}"`);
    console.log(`[DEBUG] findFileKey: Available files:`, Array.from(projectFiles.keys()).slice(0, 5));
    
    // Normalize the target path - remove leading slash
    const normalizedTarget = relativePath.replace(/^\/+/, '').replace(/\\/g, '/');
    console.log(`[DEBUG] findFileKey: Normalized target: "${normalizedTarget}"`);
    
    // Direct match
    if (projectFiles.has(relativePath)) {
      console.log(`[DEBUG] findFileKey: Direct match found: ${relativePath}`);
      return relativePath;
    }
    
    // Try normalized version (without leading slash)
    if (projectFiles.has(normalizedTarget)) {
      console.log(`[DEBUG] findFileKey: Normalized match found: ${normalizedTarget}`);
      return normalizedTarget;
    }
    
    // Try with different path variations
    for (const [key, file] of projectFiles) {
      const normalizedKey = key.replace(/^\/+/, '').replace(/\\/g, '/');
      const normalizedFileRelative = file.relativePath?.replace(/^\/+/, '').replace(/\\/g, '/');
      
      console.log(`[DEBUG] findFileKey: Comparing "${normalizedTarget}" with key "${normalizedKey}" and relative "${normalizedFileRelative}"`);
      
      if (normalizedKey === normalizedTarget || 
          normalizedFileRelative === normalizedTarget ||
          normalizedKey.endsWith('/' + normalizedTarget) ||
          normalizedFileRelative?.endsWith('/' + normalizedTarget) ||
          // Additional check: target ends with key
          normalizedTarget.endsWith('/' + normalizedKey) ||
          normalizedTarget.endsWith('/' + (normalizedFileRelative || ''))) {
        console.log(`[DEBUG] findFileKey: Match found with key: ${key}`);
        return key;
      }
    }
    
    // Fallback: exact filename match
    const targetFilename = normalizedTarget.split('/').pop();
    console.log(`[DEBUG] findFileKey: Trying filename match: "${targetFilename}"`);
    
    if (targetFilename) {
      for (const [key, file] of projectFiles) {
        const keyFilename = key.split('/').pop();
        const relativeFilename = file.relativePath?.split('/').pop();
        
        if (keyFilename === targetFilename || relativeFilename === targetFilename) {
          console.log(`[DEBUG] findFileKey: Filename match found: ${key}`);
          return key;
        }
      }
    }
    
    console.log(`[DEBUG] findFileKey: No match found for "${relativePath}"`);
    console.log(`[DEBUG] findFileKey: All available keys:`, Array.from(projectFiles.keys()));
    return null;
  }

  private resolveFilePath(projectFile: ProjectFile): string {
    if (isAbsolute(projectFile.path)) {
      return projectFile.path.replace(/builddora/g, 'buildora');
    }

    if (projectFile.relativePath) {
      return join(this.reactBasePath, projectFile.relativePath);
    }

    return projectFile.path.replace(/builddora/g, 'buildora');
  }

  private normalizeFilePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  }

  // ============================================================================
  // BACKWARD COMPATIBILITY METHODS
  // ============================================================================

  async process(
    prompt: string,
    projectFiles: Map<string, ProjectFile>,
    reactBasePath: string,
    streamCallback: (message: string) => void,
    treeInformation?: TreeInformation,
    targetNodes?: TargetNodeInfo[]
  ) {
    return this.processTargetedModification(prompt, projectFiles, reactBasePath, streamCallback, treeInformation, targetNodes);
  }

  async handleTargetedModification(
    prompt: string,
    projectFiles: Map<string, ProjectFile>,
    reactBasePath: string,
    streamCallback: (message: string) => void,
    treeInformation?: TreeInformation,
    targetNodes?: TargetNodeInfo[]
  ) {
    return this.processTargetedModification(prompt, projectFiles, reactBasePath, streamCallback, treeInformation, targetNodes);
  }

  getTokenTracker(): TokenTracker {
    return this.tokenTracker;
  }
}