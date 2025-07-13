// ============================================================================
// UPDATED AST ANALYZER: processors/ASTAnalyzer.ts - Excludes UI Components
// ============================================================================

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { ProjectFile, ASTNode, FileRelevanceResult } from '../filemodifier/types';
import { TokenTracker } from '../../utils/TokenTracer';

export class ASTAnalyzer {
  private streamCallback?: (message: string) => void;

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
  }

  private streamUpdate(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
  }

  /**
   * Check if a file should be excluded from AST analysis
   */
  private shouldExcludeFile(filePath: string): boolean {
    const excludePatterns = [
      // UI component directories
      /src[\/\\]components?[\/\\]ui[\/\\]/i,
      /components?[\/\\]ui[\/\\]/i,
      
      // Shadcn/ui specific patterns
      /ui[\/\\](button|input|card|dialog|dropdown|select|textarea|checkbox|radio|switch|slider|progress|alert|badge|avatar|separator|skeleton|toast|tooltip|popover|command|calendar|accordion|tabs|sheet|scroll-area|menubar|navigation-menu|context-menu|hover-card|label|aspect-ratio|collapsible|toggle|form)\.tsx?$/i,
      
      // Other UI library patterns
      /ui[\/\\](components?|elements?|primitives?)[\/\\]/i,
      
      // Generic exclude patterns
      /\.d\.ts$/,
      /test\.|spec\./,
      /\.test\.|\.spec\./,
      /node_modules[\/\\]/,
      /\.git[\/\\]/,
      /dist[\/\\]/,
      /build[\/\\]/,
      
      // Utility and config files
      /utils?\.tsx?$/i,
      /helpers?\.tsx?$/i,
      /constants?\.tsx?$/i,
      /config\.tsx?$/i,
      /types\.tsx?$/i,
      
      // Library and vendor files
      /lib[\/\\]/,
      /vendor[\/\\]/,
      /third-party[\/\\]/
    ];

    const isExcluded = excludePatterns.some(pattern => pattern.test(filePath));
    
    if (isExcluded) {
      this.streamUpdate(`⏭️ Skipping UI/utility file: ${filePath}`);
    }
    
    return isExcluded;
  }

  /**
   * Enhanced file parsing that respects exclusions
   */
  parseFileWithAST(filePath: string, projectFiles: Map<string, ProjectFile>): ASTNode[] {
    // Check if file should be excluded
    if (this.shouldExcludeFile(filePath)) {
      return [];
    }

    this.streamUpdate(`🔬 Parsing ${filePath} with AST analysis...`);
    
    const file = projectFiles.get(filePath);
    if (!file) {
      this.streamUpdate(`⚠️ File not found in project files: ${filePath}`);
      return [];
    }

    // Additional content-based exclusion for UI libraries
    if (this.isUILibraryFile(file.content)) {
      this.streamUpdate(`⏭️ Skipping detected UI library file: ${filePath}`);
      return [];
    }

    try {
      const ast = parse(file.content, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      const nodes: ASTNode[] = [];
      let nodeId = 1;
      const lines = file.content.split('\n');

      const self = this;

traverse(ast, {
  JSXElement(path: any) {
    const node = path.node;

    let tagName = 'unknown';
    if (node.openingElement?.name?.type === 'JSXIdentifier') {
      tagName = node.openingElement.name.name;
    }

    if (self.isUILibraryComponent(tagName || '')) {
      return;
    }

    let textContent = '';
    if (node.children) {
      node.children.forEach((child: any) => {
        if (child.type === 'JSXText') {
          textContent += child.value.trim() + ' ';
        }
      });
    }

    const startLine = node.loc?.start.line || 1;
    const endLine = node.loc?.end.line || 1;
    const startColumn = node.loc?.start.column || 0;
    const endColumn = node.loc?.end.column || 0;

    const codeSnippet = lines.slice(startLine - 1, endLine).join('\n');
    const contextStart = Math.max(0, startLine - 4);
    const contextEnd = Math.min(lines.length, endLine + 3);
    const fullContext = lines.slice(contextStart, contextEnd).join('\n');

    const attributes: string[] = [];
    if (node.openingElement?.attributes) {
      node.openingElement.attributes.forEach((attr: any) => {
        if (attr.type === 'JSXAttribute' && attr.name) {
          attributes.push(attr.name.name);
        }
      });
    }

    nodes.push({
      id: `node_${nodeId++}`,
      type: 'JSXElement',
      tagName,
      textContent: textContent.trim(),
      startLine,
      endLine,
      startColumn,
      endColumn,
      codeSnippet,
      fullContext,
      isButton: tagName.toLowerCase().includes('button'),
      hasSigninText: /sign\s*in|log\s*in|login|signin/i.test(textContent),
      attributes
    });
  }
});

const filteredNodes = nodes.filter(node => !self.isUILibraryComponent(node.tagName || ''));
this.streamUpdate(`✅ AST parsing complete! Found ${filteredNodes.length} relevant JSX elements (filtered ${nodes.length - filteredNodes.length} UI components).`);
return filteredNodes;

    } catch (error) {
      this.streamUpdate(`❌ AST parsing failed for ${filePath}: ${error}`);
      return [];
    }
  }

  /**
   * Detect if file content suggests it's a UI library file
   */
  private isUILibraryFile(content: string): boolean {
    const uiLibraryIndicators = [
      // Shadcn/ui indicators
      /@\/lib\/utils/,
      /class-variance-authority/,
      /clsx.*cn/,
      /React\.forwardRef.*displayName/,
      
      // Radix UI indicators
      /@radix-ui\//,
      /Primitive\./,
      
      // Other UI library indicators
      /styled-components/,
      /@emotion\//,
      /chakra-ui/,
      /mantine/,
      
      // Generic UI component patterns
      /interface.*Props.*extends.*React\./,
      /VariantProps/,
      /cva\(/,
      
      // File content suggests it's a basic UI primitive
      /export.*const.*=.*React\.forwardRef/,
      /export.*\{.*as.*\}/
    ];

    const hasUIIndicators = uiLibraryIndicators.some(pattern => pattern.test(content));
    
    // Additional check: if file only exports basic HTML elements wrapped in React.forwardRef
    const isBasicWrapper = content.includes('React.forwardRef') && 
                          /return\s*<(div|span|button|input|textarea|select|label|p|h[1-6])\s/.test(content) &&
                          content.split('\n').length < 50; // Small files are likely basic wrappers

    return hasUIIndicators || isBasicWrapper;
  }

  /**
   * Check if a JSX tag name represents a UI library component
   */
  private isUILibraryComponent(tagName: string): boolean {
    // Common UI library component patterns
    const uiComponentPatterns = [
      // Shadcn/ui components
      /^(Button|Input|Card|CardHeader|CardContent|CardTitle|CardDescription|CardFooter)$/,
      /^(Dialog|DialogContent|DialogHeader|DialogTitle|DialogDescription|DialogFooter|DialogTrigger)$/,
      /^(DropdownMenu|DropdownMenuContent|DropdownMenuItem|DropdownMenuTrigger|DropdownMenuSeparator)$/,
      /^(Select|SelectContent|SelectItem|SelectTrigger|SelectValue)$/,
      /^(Textarea|Checkbox|RadioGroup|RadioGroupItem|Switch|Slider|Progress)$/,
      /^(Alert|AlertDescription|AlertTitle|Badge|Avatar|AvatarImage|AvatarFallback)$/,
      /^(Separator|Skeleton|Toast|Tooltip|TooltipContent|TooltipProvider|TooltipTrigger)$/,
      /^(Popover|PopoverContent|PopoverTrigger|Command|CommandInput|CommandList|CommandItem)$/,
      /^(Calendar|Accordion|AccordionContent|AccordionItem|AccordionTrigger)$/,
      /^(Tabs|TabsContent|TabsList|TabsTrigger|Sheet|SheetContent|SheetHeader|SheetTitle)$/,
      /^(ScrollArea|Menubar|NavigationMenu|ContextMenu|HoverCard|Label|AspectRatio)$/,
      /^(Collapsible|Toggle|Form|FormControl|FormDescription|FormField|FormItem|FormLabel|FormMessage)$/,
      
      // Generic UI patterns
      /^UI[A-Z]/,  // UI prefixed components
      /^[A-Z][a-z]+UI$/,  // Components ending with UI
      /^Primitive[A-Z]/,  // Primitive components
      
      // Icon libraries
      /^(Icon|Lucide|Feather|Heroicon|Material|FontAwesome)[A-Z]/,
      /Icon$/,  // Components ending with Icon
      
      // Layout primitives that are likely from UI libraries
      /^(Box|Stack|Flex|Grid|Container|Spacer|Divider|Center|Square|Circle)$/,
      
      // Form primitives
      /^(Field|Control|Group|Label|Help|Error|Success|Warning|Info)$/
    ];

    const isUIComponent = uiComponentPatterns.some(pattern => pattern.test(tagName));
    
    if (isUIComponent) {
      this.streamUpdate(`🎨 Skipping UI library component: ${tagName}`);
    }
    
    return isUIComponent;
  }

  /**
   * Enhanced file relevance analysis with UI exclusion
   */
  async analyzeFileRelevance(
    prompt: string,
    filePath: string,
    astNodes: ASTNode[],
    modificationMethod: 'FULL_FILE' | 'TARGETED_NODES',
    projectFiles: Map<string, ProjectFile>,
    anthropic: any,
    tokenTracker: TokenTracker
  ): Promise<FileRelevanceResult> {
    // Early exclusion check
    if (this.shouldExcludeFile(filePath)) {
      return {
        isRelevant: false,
        reasoning: 'File excluded: UI library or utility file',
        relevanceScore: 0
      };
    }

    const file = projectFiles.get(filePath);
    if (!file || astNodes.length === 0) {
      return {
        isRelevant: false,
        reasoning: 'File not found or no relevant AST nodes available (UI components filtered out)',
        relevanceScore: 0
      };
    }

    // Additional content-based exclusion
    if (this.isUILibraryFile(file.content)) {
      return {
        isRelevant: false,
        reasoning: 'File detected as UI library component',
        relevanceScore: 0
      };
    }

    let analysisPrompt = '';

    if (modificationMethod === 'TARGETED_NODES') {
      const nodesPreview = astNodes.slice(0, 20).map(node => 
        `${node.id}: <${node.tagName}> "${node.textContent.substring(0, 50)}" ${node.isButton ? '[BUTTON]' : ''}${node.hasSigninText ? '[SIGNIN]' : ''}`
      ).join('\n');

      analysisPrompt = `
USER REQUEST: "${prompt}"
FILE: ${filePath}
METHOD: TARGETED_NODES

RELEVANT ELEMENTS IN FILE (UI components filtered out):
${nodesPreview}

Question: Does this file contain specific elements that match the user's request?
Note: UI library components (Button, Card, Input, etc.) have been filtered out to focus on business logic components.

Answer with ONLY this format:
RELEVANT: YES/NO
SCORE: 0-100
REASON: [brief explanation]
TARGETS: [comma-separated node IDs if relevant]

Example:
RELEVANT: YES
SCORE: 85
REASON: Contains signin button that matches request
TARGETS: node_1,node_3
      `;
    } else {
      const filePreview = file.content.substring(0, 500);
      const elementSummary = [...new Set(astNodes.map(n => n.tagName))].slice(0, 10).join(', ');

      analysisPrompt = `
USER REQUEST: "${prompt}"
FILE: ${filePath}
METHOD: FULL_FILE

FILE PREVIEW:
${filePreview}...

COMPONENT: ${file.componentName || 'Unknown'}
RELEVANT ELEMENTS: ${elementSummary} (UI library components filtered)
HAS BUTTONS: ${file.hasButtons}
HAS SIGNIN: ${file.hasSignin}

Question: Should this entire file be modified to fulfill the user's request?
Note: This file has been confirmed as non-UI-library code suitable for modification.

Answer with ONLY this format:
RELEVANT: YES/NO
SCORE: 0-100
REASON: [brief explanation]

Example:
RELEVANT: YES
SCORE: 75
REASON: Main component file that needs layout changes
      `;
    }

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 300,
        temperature: 0,
        messages: [{ role: 'user', content: analysisPrompt }],
      });

      tokenTracker.logUsage(response.usage, `File Relevance Analysis: ${filePath}`);

      const firstBlock = response.content[0];
      if (firstBlock?.type === 'text') {
        const text = firstBlock.text;
        return this.parseSimpleRelevanceResponse(text, astNodes);
      }
      
      return {
        isRelevant: false,
        reasoning: 'Failed to get response from AI',
        relevanceScore: 0
      };
    } catch (error) {
      this.streamUpdate(`❌ Error analyzing file relevance for ${filePath}: ${error}`);
      return {
        isRelevant: false,
        reasoning: `Error during analysis: ${error}`,
        relevanceScore: 0
      };
    }
  }

  private parseSimpleRelevanceResponse(text: string, astNodes: ASTNode[]): FileRelevanceResult {
    try {
      const lines = text.split('\n').map(line => line.trim());
      
      let isRelevant = false;
      let score = 0;
      let reasoning = 'No reasoning provided';
      let targetNodes: ASTNode[] = [];

      for (const line of lines) {
        if (line.startsWith('RELEVANT:')) {
          isRelevant = line.includes('YES');
        } else if (line.startsWith('SCORE:')) {
          const scoreMatch = line.match(/\d+/);
          if (scoreMatch) {
            score = parseInt(scoreMatch[0]);
          }
        } else if (line.startsWith('REASON:')) {
          reasoning = line.replace('REASON:', '').trim();
        } else if (line.startsWith('TARGETS:')) {
          const targetIds = line.replace('TARGETS:', '').trim().split(',').map(id => id.trim());
          targetNodes = astNodes.filter(node => targetIds.includes(node.id));
        }
      }

      return {
        isRelevant,
        reasoning,
        relevanceScore: Math.max(0, Math.min(100, score)),
        targetNodes: targetNodes.length > 0 ? targetNodes : undefined
      };
    } catch (error) {
      return {
        isRelevant: false,
        reasoning: `Failed to parse AI response: ${error}`,
        relevanceScore: 0
      };
    }
  }

  /**
   * Enhanced forced analysis that respects exclusions
   */
  async forceAnalyzeSpecificFiles(
    prompt: string,
    filePaths: string[],
    method: 'FULL_FILE' | 'TARGETED_NODES',
    projectFiles: Map<string, ProjectFile>,
    anthropic: any,
    tokenTracker: TokenTracker
  ): Promise<Array<{ filePath: string; isRelevant: boolean; score: number; reasoning: string; targetNodes?: ASTNode[] }>> {
    // Filter out excluded files first
    const validFilePaths = filePaths.filter(path => !this.shouldExcludeFile(path));
    
    if (validFilePaths.length < filePaths.length) {
      this.streamUpdate(`🔍 Filtered ${filePaths.length - validFilePaths.length} UI/utility files from analysis`);
    }
    
    this.streamUpdate(`🔍 Analyzing ${validFilePaths.length} relevant files: ${validFilePaths.join(', ')}`);
    
    const results: Array<{
      filePath: string;
      isRelevant: boolean;
      score: number;
      reasoning: string;
      targetNodes?: ASTNode[];
    }> = [];
    
    const maxFiles = Math.min(validFilePaths.length, 5);
    
    for (let i = 0; i < maxFiles; i++) {
      const filePath = validFilePaths[i];
      
      const astNodes = this.parseFileWithAST(filePath, projectFiles);
      if (astNodes.length === 0) {
        results.push({
          filePath,
          isRelevant: false,
          score: 0,
          reasoning: 'No relevant AST nodes found (UI components filtered)',
        });
        continue;
      }
      
      const relevanceResult = await this.analyzeFileRelevance(
        prompt,
        filePath,
        astNodes,
        method,
        projectFiles,
        anthropic,
        tokenTracker
      );
      
      results.push({
        filePath,
        isRelevant: relevanceResult.isRelevant,
        score: relevanceResult.relevanceScore,
        reasoning: relevanceResult.reasoning,
        targetNodes: relevanceResult.targetNodes
      });
    }
    
    return results;
  }

  /**
   * Get statistics about filtered components
   */
  getFilteringStats(projectFiles: Map<string, ProjectFile>): {
    totalFiles: number;
    excludedFiles: number;
    analyzableFiles: number;
    excludedPaths: string[];
  } {
    const totalFiles = projectFiles.size;
    const excludedPaths: string[] = [];
    
    for (const [filePath] of projectFiles) {
      if (this.shouldExcludeFile(filePath)) {
        excludedPaths.push(filePath);
      }
    }
    
    return {
      totalFiles,
      excludedFiles: excludedPaths.length,
      analyzableFiles: totalFiles - excludedPaths.length,
      excludedPaths
    };
  }
}