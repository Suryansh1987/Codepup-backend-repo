// Enhanced Hybrid Text Processor: Fast-glob + Babel AST + Claude + Batch Processing
// Production-ready TypeScript implementation with fragmented text support

import { promises as fs } from 'fs';
import { join } from 'path';
import * as diff from 'diff';
import fg from 'fast-glob';
import * as babel from '@babel/core';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';

// Core interfaces
export interface ClaudeModificationResult {
  nodeIndex: number;
  originalContent: string;
  modifiedContent: string;
  reasoning: string;
  confidence: number;
  shouldApply: boolean;
  strategy: string;
  warnings: string[];
  originalSnippet?: string;
  modifiedSnippet?: string;
}

export interface ExtractedTextNode {
  nodeType: string;
  content: string;
  outerHTML: string;
  filePath: string;
  absolutePath: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  contextBefore: string[];
  contextAfter: string[];
  parentContext: string;
  containsFullSearchTerm: boolean;
  relevanceScore: number;
  metadata: { [key: string]: any };
  originalPath?: any;
  fullSequence?: Array<{
    content: string;
    startLine: number;
    endLine: number;
    filePath: string;
    node: any;
    parent: any;
  }>;
}

export interface ProcessingBatch {
  searchTerm: string;
  replacementTerm: string;
  userPrompt: string;
  extractedNodes: ExtractedTextNode[];
  batchId: string;
  confidence: number;
}

export interface BatchProcessingResult {
  batchId: string;
  modifications: ClaudeModificationResult[];
  success: boolean;
  errorMessage: string | null;
  processedNodes: number;
  successfulModifications: number;
  overallStrategy: string;
  batchConfidence: number;
}

export interface HybridProcessingResult {
  success: boolean;
  filesModified: string[];
  totalReplacements: number;
  totalBatches: number;
  batchResults: BatchProcessingResult[];
  overallStrategy: string;
  diffs: string[];
  averageConfidence: number;
  processingTime: string;
  stats: {
    filesScanned: number;
    nodesExtracted: number;
    batchesProcessed: number;
    totalBatches: number;
  };
  error?: string;
}

export interface FileInfo {
  filePath: string;
  absolutePath: string;
  fileType: string;
}

export interface ProcessingConfig {
  fileExtensions: string[];
  excludeDirectories: string[];
  maxBatchSize: number;
  contextLines: number;
  enableBabelExtraction: boolean;
  enableClaudeProcessing: boolean;
  generateDiffs: boolean;
  preserveFormatting: boolean;
  babelParserOptions: any;
}

export interface ClaudeResponse {
  modifications: ClaudeModificationResult[];
  overallStrategy: string;
  batchConfidence: number;
}

export interface ExtractedNode {
  content: string;
  startLine: number;
  endLine: number;
  filePath: string;
  fullSequence?: Array<{
    content: string;
    startLine: number;
    endLine: number;
    filePath: string;
    node: any;
    parent: any;
  }>;
}

// Legacy interfaces for backward compatibility
export interface LLMModificationRequest {
  originalContent: string;
  searchTerm: string;
  replacementTerm: string;
  context: string;
  filePath: string;
  matchedLines: Array<{
    lineNumber: number;
    content: string;
    matchedText: string;
    contextBefore: string[];
    contextAfter: string[];
  }>;
}

export interface LLMModificationResponse {
  modifiedContent: string;
  changes: Array<{
    lineNumber: number;
    originalText: string;
    modifiedText: string;
    reasoning: string;
  }>;
  confidence: number;
  preservedStructure: boolean;
}

export interface ContextualSearchResult {
  filePath: string;
  lineNumber: number;
  lineContent: string;
  matchedText: string;
  contextBefore: string[];
  contextAfter: string[];
  confidence: number;
  matchType: 'exact' | 'case_insensitive' | 'partial';
  shouldReplace: boolean;
  reasoning: string;
}

export interface ExtractedTerms {
  searchTerm: string;
  replacementTerm: string;
  extractionMethod: 'pattern_matching' | 'ai_analysis' | 'manual' | 'enhanced_pattern';
  confidence: number;
  variations?: string[];
  context?: string;
}

export interface SearchStrategy {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
  includeVariations: boolean;
  filterCodeElements: boolean;
  generateDiff: boolean;
  useLLMModification: boolean;
  excludeUIDirectories: boolean;
  contextualSearch: boolean;
  containerSearch: boolean;
  contextLines: number;
}

export interface SearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  fileExtensions?: string[];
  excludeDirectories?: string[];
  excludeUIDirectories?: boolean;
  generateDiff?: boolean;
  includeVariations?: boolean;
  filterCodeElements?: boolean;
  useRegex?: boolean;
  useLLMModification?: boolean;
  maxResults?: number;
  contextLines?: number;
  contextualSearch?: boolean;
  containerSearch?: boolean;
  preferContainerSearch?: boolean;
}

export interface LLMContextualRequest {
  userPrompt: string;
  searchTerm: string;
  replacementTerm: string;
  matches: Array<{
    filePath: string;
    lineNumber: number;
    lineContent: string;
    matchedText: string;
    contextBefore: string[];
    contextAfter: string[];
  }>;
}

export interface LLMContextualResponse {
  decisions: Array<{
    filePath: string;
    lineNumber: number;
    shouldReplace: boolean;
    confidence: number;
    reasoning: string;
    suggestedReplacement?: string;
    replacementStrategy?: string;
    _enhanced?: any;
  }>;
  overallConfidence: number;
  strategy: string;
  _multilineStrategy?: any;
}

export interface LLMContainerDecision {
  filePath: string;
  shouldModify: boolean;
  newContainerContent: string;
  reasoning: string;
  confidence: number;
  preserveStructure: boolean;
}

export interface DiffPatch {
  filePath: string;
  originalContent: string;
  modifiedContent: string;
  unifiedDiff: string;
  structuredDiff: diff.Change[];
  linesChanged: number;
  additions: number;
  deletions: number;
}

/**
 * Enhanced Hybrid Text Processor
 * Combines fast-glob file discovery + improved Babel AST extraction + Claude batch processing
 */
export class EnhancedLLMRipgrepProcessor {
  private projectPath: string;
  private anthropic: any;
  private config: ProcessingConfig;
  private streamCallback: ((message: string) => void) | null;
  private batchStorage: Map<string, ProcessingBatch>;
  private currentFilePath: string;
  private enableFileLogging: boolean = true;
  private requestCounter: number = 0;
  constructor(projectPath: string, anthropic: any) {
    this.projectPath = projectPath;
    this.anthropic = anthropic;
    this.batchStorage = new Map();
    this.currentFilePath = '';
    this.config = {
      fileExtensions: ['.tsx', '.ts', '.jsx', '.js', '.html', '.css'],
      excludeDirectories: ['node_modules', '.git', 'dist', 'build', '.next'],
      maxBatchSize: 10,
      contextLines: 4,
      enableBabelExtraction: true,
      enableClaudeProcessing: true,
      generateDiffs: true,
      preserveFormatting: true,
      babelParserOptions: {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        plugins: [
          'jsx',
          'typescript',
          'decorators-legacy',
          'classProperties',
          'asyncGenerators',
          'functionBind',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'dynamicImport',
          'nullishCoalescingOperator',
          'optionalChaining'
        ]
      }
    };
    this.streamCallback = null;
  }

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
  }

   
  private log(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
    console.log(message);
  }
private async logToFile(logType: string, data: any): Promise<void> {
  if (!this.enableFileLogging) return;
  
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      logType,
      ...data
    };
    
    // CHANGE THIS LINE to control where log.txt is written:
    const logPath = "C:\\Users\\KIIT\\Documents\\Lovable\\Lovable\\Deployment_backend\\backend-rep-buildora\\logs\\log.txt" // Current working directory
    // OR: const logPath = path.join(this.projectPath, 'log.txt'); // Project directory (current)
    // OR: const logPath = '/custom/path/log.txt'; // Absolute path
    
    await fs.appendFile(logPath, JSON.stringify(logEntry, null, 2) + '\n---\n');
  } catch (error) {
    console.warn(`Failed to write to log.txt:`, error);
  }
}
  
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4); // ~4 chars per token
  }

async processText(
  userPrompt: string,
  searchTerm: string,
  replacementTerm: string
): Promise<HybridProcessingResult> {
  console.log(`\n=== ENHANCED HYBRID PROCESSOR START ===`);
  console.log(`[HYBRID-PROCESS] Search: "${searchTerm}"`);
  console.log(`[HYBRID-PROCESS] Replace: "${replacementTerm}"`);
  
  this.log(`🚀 Starting Enhanced Hybrid Text Processing`);
  this.log(`   🔎 Search: "${searchTerm}"`);
  this.log(`   ✏️  Replace: "${replacementTerm}"`);

  const startTime = Date.now();

  try {
    // Step 1: Smart file discovery
    const files = await this.discoverFiles(searchTerm);
    if (files.length === 0) {
      // LOG FAILURE
      await this.logToFile('processing-summary', {
        success: false,
        error: 'No files found containing the search term',
        searchTerm: searchTerm.substring(0, 100),
        replacementTerm: replacementTerm.substring(0, 100),
        processingTimeMs: Date.now() - startTime
      });
      return this.createFailureResult('No files found containing the search term');
    }

    // Step 2: Enhanced Babel AST extraction with fragmented text support
    const extractedNodes = await this.extractTextNodesWithBabel(files, searchTerm);
    if (extractedNodes.length === 0) {
      // LOG FAILURE
      await this.logToFile('processing-summary', {
        success: false,
        error: 'No text nodes found containing the search term',
        searchTerm: searchTerm.substring(0, 100),
        replacementTerm: replacementTerm.substring(0, 100),
        processingTimeMs: Date.now() - startTime,
        filesScanned: files.length
      });
      return this.createFailureResult('No text nodes found containing the search term');
    }

    // Step 3: Claude processing with improved prompts
    const batchResults = await this.processWithClaudeSnippets(extractedNodes, searchTerm, replacementTerm, userPrompt);
    
    // Step 4: Apply modifications with enhanced strategies
    const applyResult = await this.applyModifications(batchResults);

    const endTime = Date.now();
    const processingTime = `${(endTime - startTime) / 1000}s`;
 
    const result: HybridProcessingResult = {
      success: true,
      filesModified: applyResult.filesModified,
      totalReplacements: applyResult.totalReplacements,
      totalBatches: batchResults.length,
      batchResults,
      overallStrategy: `Enhanced Hybrid: Smart discovery → Fragmented AST extraction → Intelligent Claude processing → Safe JSX transformation`,
      diffs: applyResult.diffs,
      averageConfidence: this.calculateAverageConfidence(batchResults),
      processingTime,
      stats: {
        filesScanned: files.length,
        nodesExtracted: extractedNodes.length,
        batchesProcessed: batchResults.filter(b => b.success).length,
        totalBatches: batchResults.length
      }
    };

    // LOG SUCCESS
    await this.logToFile('processing-summary', {
      success: true,
      searchTerm: searchTerm.substring(0, 100),
      replacementTerm: replacementTerm.substring(0, 100),
      filesModified: result.filesModified,
      totalReplacements: result.totalReplacements,
      totalBatches: result.totalBatches,
      averageConfidence: result.averageConfidence,
      processingTimeMs: endTime - startTime,
      stats: result.stats,
      batchResults: batchResults.map(batch => ({
        batchId: batch.batchId,
        success: batch.success,
        processedNodes: batch.processedNodes,
        successfulModifications: batch.successfulModifications,
        batchConfidence: batch.batchConfidence,
        errorMessage: batch.errorMessage
      }))
    });

    // LOG TOKEN USAGE
    await this.logTokenUsage();

    return result;

  } catch (error: any) {
    const processingTime = `${(Date.now() - startTime) / 1000}s`;
    
    // LOG ERROR
    await this.logToFile('processing-summary', {
      success: false,
      error: error.message,
      searchTerm: searchTerm.substring(0, 100),
      replacementTerm: replacementTerm.substring(0, 100),
      processingTimeMs: Date.now() - startTime,
      stackTrace: error.stack
    });
    
    console.error(`[HYBRID-PROCESS] ❌ Processing failed after ${processingTime}:`, error);
    this.log(`❌ Hybrid processing failed: ${error.message}`);
    return this.createFailureResult(error.message);
  }
}

  // ENHANCED FILE DISCOVERY
  async discoverFiles(searchTerm: string): Promise<FileInfo[]> {
  const startTime = Date.now(); // ADD THIS
  this.log(`🔍 Step 1: Smart file discovery for: "${searchTerm.substring(0, 50)}..."`);

  try {
    const includePatterns = this.config.fileExtensions.map(ext => `**/*${ext}`);
    const ignorePatterns = [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**'
    ];

    const files = await fg(includePatterns, {
      cwd: this.projectPath,
      ignore: ignorePatterns,
      onlyFiles: true,
      suppressErrors: true,
      absolute: false,
      dot: false
    });

    const matchingFiles: FileInfo[] = [];
    const searchStrategies = this.createSmartSearchStrategies(searchTerm);
    
    for (const file of files) {
      try {
        const filePath = join(this.projectPath, file);
        const content = await fs.readFile(filePath, 'utf8');
        
        for (const strategy of searchStrategies) {
          if (strategy.test(content)) {
            matchingFiles.push({
              filePath: file,
              absolutePath: filePath,
              fileType: this.getFileType(file)
            });
            break;
          }
        }
      } catch (error: any) {
        this.log(`⚠️ Error reading ${file}: ${error.message}`);
      }
    }

    const scanTimeMs = Date.now() - startTime; // ADD THIS

    // LOG TO FILE
    await this.logToFile('glob-scan', {
      searchTerm: searchTerm.substring(0, 100),
      patternsUsed: includePatterns,
      filesScanned: files.length,
      matchingFiles: matchingFiles.length,
      scanTimeMs, // ADD THIS
      strategies: searchStrategies.map(s => s.name)
    });

    this.log(`✅ Found ${matchingFiles.length} files using smart search strategies`);
    return matchingFiles;

  } catch (error: any) {
    // LOG ERROR
    await this.logToFile('glob-scan', {
      error: error.message,
      searchTerm: searchTerm.substring(0, 100),
      success: false,
      scanTimeMs: Date.now() - startTime
    });
    
    this.log(`❌ File discovery failed: ${error.message}`);
    return [];
  }
}

  // ENHANCED BABEL AST EXTRACTION WITH FRAGMENTED TEXT SUPPORT
  async extractTextNodesWithBabel(files: FileInfo[], searchTerm: string): Promise<ExtractedTextNode[]> {
    this.log(`🔧 Step 2: Enhanced Babel AST extraction for: "${searchTerm}"`);

    const allExtractedNodes: ExtractedTextNode[] = [];

    for (const file of files) {
      try {
        this.currentFilePath = file.filePath;
        const content = await fs.readFile(file.absolutePath, 'utf8');
        const lines = content.split('\n');

        // Skip non-JS/TS files for Babel processing
        if (!file.fileType.includes('script') && !file.fileType.includes('react')) {
          const fallbackNodes = this.extractWithSmartRegex(file, content, lines, searchTerm);
          allExtractedNodes.push(...fallbackNodes);
          continue;
        }

        try {
          const ast = parser.parse(content, this.config.babelParserOptions);
          const extractedNodes = this.extractTextNodes(ast, searchTerm);
          
          // Convert to ExtractedTextNode format
          const formattedNodes = extractedNodes.map(node => 
            this.convertToExtractedTextNode(node, file, lines, searchTerm)
          );
          
          allExtractedNodes.push(...formattedNodes);
          

        } catch (babelError: any) {
          this.log(`⚠️ Babel parsing failed for ${file.filePath}, using regex fallback`);
          const fallbackNodes = this.extractWithSmartRegex(file, content, lines, searchTerm);
          allExtractedNodes.push(...fallbackNodes);
        }

      } catch (error: any) {
        this.log(`❌ Error processing file ${file.filePath}: ${error.message}`);
      }
    }

    const uniqueNodes = this.deduplicateNodes(allExtractedNodes);
  
  this.log(`🎯 Extracted ${uniqueNodes.length} unique text nodes (removed ${allExtractedNodes.length - uniqueNodes.length} duplicates)`);
  return uniqueNodes;
  }

  // IMPROVED TEXT NODE EXTRACTION WITH FRAGMENTED TEXT SUPPORT
  // Enhanced text node extraction methods for fragmented text support

/**
 * Extracts text nodes from AST with support for fragmented text across multiple JSX elements
 */
private extractTextNodes(ast: any, searchTerm: string): ExtractedNode[] {
  const nodes: ExtractedNode[] = [];
  const searchWords = searchTerm.toLowerCase().split(/\s+/).filter((w: string) => w.length > 0);

  const allTextNodes: Array<{
    content: string;
    startLine: number;
    endLine: number;
    filePath: string;
    node: any;
    parent: any;
  }> = [];

  const filePath = this.currentFilePath; // ✅ Capture class property

  traverse(ast, {
    JSXText(path: any) {
      const content = path.node.value?.trim();
      if (content && content.length > 0) {
        allTextNodes.push({
          content,
          startLine: path.node.loc?.start?.line || 0,
          endLine: path.node.loc?.end?.line || 0,
          filePath, // ✅ Use captured variable
          node: path.node,
          parent: path.parent
        });
      }
    },

    JSXExpressionContainer(path: any) {
      if (path.node.expression?.type === 'StringLiteral') {
        const content = path.node.expression.value?.trim();
        if (content && content.length > 0) {
          allTextNodes.push({
            content,
            startLine: path.node.loc?.start?.line || 0,
            endLine: path.node.loc?.end?.line || 0,
            filePath,
            node: path.node,
            parent: path.parent
          });
        }
      }
    },

    StringLiteral(path: any) {
      const content = path.node.value?.trim();
      if (content && content.length > 3) {
        allTextNodes.push({
          content,
          startLine: path.node.loc?.start?.line || 0,
          endLine: path.node.loc?.end?.line || 0,
          filePath,
          node: path.node,
          parent: path.parent
        });
      }
    }
  });

  console.log(`[EXTRACT-TEXT-NODES] Found ${allTextNodes.length} text nodes`);

  const currentFilePath = filePath; // you can keep using this if needed below

  for (const textNode of allTextNodes) {
    const contentLower = textNode.content.toLowerCase();
    const searchLower = searchTerm.toLowerCase();

    if (contentLower.includes(searchLower)) {
      console.log(`[EXTRACT-TEXT-NODES] ✅ Found exact match: "${textNode.content}"`);
      nodes.push({
        content: textNode.content,
        startLine: textNode.startLine,
        endLine: textNode.endLine,
        filePath: currentFilePath
      });
    }
  }

  if (nodes.length === 0) {
    console.log(`[EXTRACT-TEXT-NODES] No exact matches found, searching for fragmented text`);

    for (let i = 0; i < allTextNodes.length; i++) {
      const sequenceNodes = this.findTextSequence(allTextNodes, i, searchWords);
      if (sequenceNodes.length > 0) {
        const firstNode = sequenceNodes[0];
        const lastNode = sequenceNodes[sequenceNodes.length - 1];
        const combinedContent = sequenceNodes.map(n => n.content).join(' ');

        console.log(`[EXTRACT-TEXT-NODES] ✅ Found fragmented sequence: "${combinedContent}"`);

        nodes.push({
          content: combinedContent,
          startLine: firstNode.startLine,
          endLine: lastNode.endLine,
          filePath: currentFilePath,
          fullSequence: sequenceNodes
        });
      }
    }
  }

  console.log(`[EXTRACT-TEXT-NODES] Extracted ${nodes.length} nodes total`);
  return nodes;
}


/**
 * Finds sequences of text nodes that together form the search term
 * Handles cases where text is split across multiple JSX elements
 */
private findTextSequence(textNodes: any[], startIndex: number, searchWords: string[]): any[] {
  const sequence: any[] = [];
  let wordIndex = 0;
  const maxLookAhead = 5; // Prevent infinite loops
  
  console.log(`[FIND-TEXT-SEQUENCE] Starting search from index ${startIndex} for words: [${searchWords.join(', ')}]`);
  
  for (let i = startIndex; i < textNodes.length && i < startIndex + maxLookAhead && wordIndex < searchWords.length; i++) {
    const nodeContent = textNodes[i].content.toLowerCase();
  const nodeWords = nodeContent
  .split(/\s+/)
  .filter((w: string) => w.length > 0);

    
    let foundMatchInNode = false;
    
    // Check if this node contains any of the remaining search words
    for (const nodeWord of nodeWords) {
      if (wordIndex < searchWords.length) {
        const searchWord = searchWords[wordIndex];
        
        // Flexible matching: partial word matches
        if (nodeWord.includes(searchWord) || searchWord.includes(nodeWord)) {
          foundMatchInNode = true;
          wordIndex++;
          console.log(`[FIND-TEXT-SEQUENCE] ✅ Found word "${searchWord}" in node: "${textNodes[i].content}"`);
        }
      }
    }
    
    if (foundMatchInNode) {
      sequence.push(textNodes[i]);
    } else if (sequence.length > 0) {
      // If we have a partial sequence but this node doesn't match,
      // check if the next node might have what we need
      const hasNextMatch = 
  i + 1 < textNodes.length && 
  wordIndex < searchWords.length &&
  textNodes[i + 1].content.toLowerCase()
    .split(/\s+/)
    .some((word: string) => word.includes(searchWords[wordIndex]));

      
      if (!hasNextMatch) {
        console.log(`[FIND-TEXT-SEQUENCE] Breaking sequence - no next match found`);
        break;
      }
    }
  }
  
  // Return sequence only if we found a reasonable portion of search words
  const threshold = Math.ceil(searchWords.length * 0.6);
  const isValidSequence = wordIndex >= threshold;
  
  console.log(`[FIND-TEXT-SEQUENCE] Found ${wordIndex}/${searchWords.length} words (threshold: ${threshold}), valid: ${isValidSequence}`);
  
  return isValidSequence ? sequence : [];
}

/**
 * Finds the common parent JSX element for fragmented text nodes
 * Used to extract the containing JSX structure
 */


  // CLAUDE PROCESSING WITH ENHANCED PROMPTS
  private async processWithClaudeSnippets(
    extractedNodes: ExtractedTextNode[],
    searchTerm: string,
    replacementTerm: string,
    userPrompt: string
  ): Promise<BatchProcessingResult[]> {
    this.log(`🤖 Step 3: Claude processing with enhanced prompts for ${extractedNodes.length} nodes`);

    const batches = this.createBatches(extractedNodes, searchTerm, replacementTerm, userPrompt);
    this.log(`📦 Created ${batches.length} batches for processing`);

    const batchResults: BatchProcessingResult[] = [];
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      this.log(`🔄 Processing batch ${i + 1}/${batches.length} (${batch.extractedNodes.length} nodes)`);
      
      try {
        const result = await this.processBatchWithSnippets(batch);
        batchResults.push(result);
        
        this.log(`✅ Batch ${i + 1} completed: ${result.successfulModifications}/${result.processedNodes} successful`);
      } catch (error: any) {
        this.log(`❌ Batch ${i + 1} failed: ${error.message}`);
        batchResults.push({
          batchId: batch.batchId,
          modifications: [],
          success: false,
          errorMessage: error.message,
          processedNodes: batch.extractedNodes.length,
          successfulModifications: 0,
          overallStrategy: 'Processing failed',
          batchConfidence: 0
        });
      }
    }

    return batchResults;
  }

  // ENHANCED CLAUDE PROMPT FOR COMPLEX AND SIMPLE CASES
  private createClaudeSnippetPrompt(batch: ProcessingBatch): string {
    const nodeDescriptions = batch.extractedNodes.map((node, index) => {
      const fullSnippet = this.extractFullSnippetWithBoundaries(node);
      const tagCount = (fullSnippet.match(/<[^>]+>/g) || []).length;
      const isFragmented = node.fullSequence && node.fullSequence.length > 1;
      
      return `NODE ${index + 1}:
File: ${node.filePath}
Lines: ${node.startLine}-${node.endLine}
Tags: ${tagCount}
${isFragmented ? 'FRAGMENTED: Text spans multiple elements' : 'SIMPLE: Single text node'}

ORIGINAL CODE:
\`\`\`jsx
${fullSnippet}
\`\`\`

TARGET TEXT: "${node.content}"
REPLACEMENT: "${batch.replacementTerm}"
---`;
    }).join('\n');

    const hasMultipleTags = batch.extractedNodes.some(node => {
      const snippet = this.extractFullSnippetWithBoundaries(node);
      return (snippet.match(/<[^>]+>/g) || []).length > 1;
    });

    const hasFragmentedText = batch.extractedNodes.some(node => 
      node.fullSequence && node.fullSequence.length > 1
    );

     return `You are an INTELLIGENT JSX code editor with advanced reasoning capabilities. You specialize in complex text transformations across multiple elements and semantic content mapping.

USER REQUEST: "${batch.userPrompt}"
SEARCH TERM: "${batch.searchTerm}"
REPLACEMENT TERM: "${batch.replacementTerm}"

${nodeDescriptions}

🧠 INTELLIGENT MODIFICATION INSTRUCTIONS:

1. **COMPLEX TEXT REPLACEMENT**: Use your full analytical brainpower for intelligent replacements:
   - Example: <h1>hi<span>world</span></h1> → "hello world" should become <h1>hello <span>world</span></h1>
   - Preserve ALL intermediate tags and structure while distributing new text logically
   - Maintain the original hierarchy and formatting

2. **SEMANTIC CONTENT MAPPING**: When replacement terms are vague or need distribution:
   - Example: <title>hi</title><description>wow</description> → "hello world very good"
   - Intelligently map: title="hello world", description="very good"
   - Use context clues from element names, classes, and structure

3. **MULTI-LOCATION INTELLIGENCE**: When there are multiple places to apply changes:
   - Analyze the semantic meaning of each location
   - Distribute content based on element purpose and hierarchy
   - Prioritize more prominent/important elements for primary content

4. **ADVANCED REASONING SCENARIOS**:
   - **Fragmented Text**: If text spans multiple nested elements, preserve all intermediate tags
   - **Content Distribution**: Split replacement text intelligently across related elements
   - **Contextual Mapping**: Use element attributes (className, id, data-*) as hints for content placement
   - **Hierarchical Awareness**: Consider parent-child relationships when distributing content

CRITICAL OUTPUT RULES:
- Return ONLY valid JSON - no markdown code blocks
- No backticks around code snippets - use escaped strings only
- All code snippets must be properly escaped JSON strings
- Do not wrap JSON in \`\`\`json blocks

OUTPUT FORMAT (EXACT JSON):
{
  "modifications": [
    {
      "nodeIndex": 0,
      "originalSnippet": "exact original code as escaped string",
      "modifiedSnippet": "modified code as escaped string", 
      "originalContent": "${batch.searchTerm}",
      "modifiedContent": "${batch.replacementTerm}",
      "reasoning": "detailed explanation of intelligent reasoning applied",
      "confidence": 0.95,
      "shouldApply": true,
      "strategy": "intelligent_text_replacement",
      "warnings": []
    }
  ],
  "overallStrategy": "Intelligent content distribution and structure preservation",
  "batchConfidence": 0.95
}

🎯 CRITICAL: 
- Use your advanced reasoning to create intelligent modifications
- Return ONLY the JSON object above
- NO markdown formatting, NO code blocks, NO backticks
- All code must be properly escaped JSON strings`;
  }
// Add this method to your EnhancedLLMRipgrepProcessor class
private deduplicateNodes(nodes: ExtractedTextNode[]): ExtractedTextNode[] {
  console.log(`[DEDUPE] Starting with ${nodes.length} nodes`);
  
  const seen = new Set<string>();
  const uniqueNodes: ExtractedTextNode[] = [];
  
  for (const node of nodes) {
    // Create unique key based on file, position, and content
    const key = `${node.filePath}:${node.startLine}-${node.endLine}:${node.content.trim()}`;
    
    if (seen.has(key)) {
      console.log(`[DEDUPE] ❌ Removing duplicate: ${key}`);
      continue;
    }
    
    seen.add(key);
    uniqueNodes.push(node);
    console.log(`[DEDUPE] ✅ Keeping unique: ${key}`);
  }
  
  console.log(`[DEDUPE] Result: ${nodes.length} → ${uniqueNodes.length} (removed ${nodes.length - uniqueNodes.length} duplicates)`);
  return uniqueNodes;
}
  private async processBatchWithSnippets(batch: ProcessingBatch): Promise<BatchProcessingResult> {
    const prompt = this.createClaudeSnippetPrompt(batch);
       await this.logToFile('claude-detailed-input', {
    batchId: batch.batchId,
    requestNumber: ++this.requestCounter,
    
    // Batch metadata
    batchInfo: {
      searchTerm: batch.searchTerm,
      replacementTerm: batch.replacementTerm,
      userPrompt: batch.userPrompt,
      nodeCount: batch.extractedNodes.length,
      confidence: batch.confidence
    },
    
    // Individual node details
    nodes: batch.extractedNodes.map((node, index) => ({
      nodeIndex: index,
      nodeId: `${node.filePath}:${node.startLine}-${node.endLine}`,
      nodeType: node.nodeType,
      filePath: node.filePath,
      position: `L${node.startLine}-${node.endLine}`,
      textContent: node.content,
      outerHTML: node.outerHTML,
      relevanceScore: node.relevanceScore,
      isFragmented: !!(node.fullSequence && node.fullSequence.length > 1),
      fragmentCount: node.fullSequence?.length || 1,
      parentContext: node.parentContext,
      metadata: node.metadata,
      contextBefore: node.contextBefore,
      contextAfter: node.contextAfter,
      
      // Full snippet being sent to Claude
      fullSnippet: this.extractFullSnippetWithBoundaries(node),
      
      // Fragment details if applicable
      fragments: node.fullSequence?.map(frag => ({
        content: frag.content,
        startLine: frag.startLine,
        endLine: frag.endLine,
        filePath: frag.filePath
      })) || []
    })),
    
    // Full prompt being sent
    fullPrompt: prompt,
    promptLength: prompt.length,
    estimatedTokens: this.estimateTokens(prompt),
    
    // Prompt analysis
    promptAnalysis: {
      hasMultipleTags: batch.extractedNodes.some(node => {
        const snippet = this.extractFullSnippetWithBoundaries(node);
        return (snippet.match(/<[^>]+>/g) || []).length > 1;
      }),
      hasFragmentedText: batch.extractedNodes.some(node => 
        node.fullSequence && node.fullSequence.length > 1
      )
    }
  });
  
  // 🔥 LOG EACH NODE'S SNIPPET SEPARATELY for easier debugging
  for (let i = 0; i < batch.extractedNodes.length; i++) {
    const node = batch.extractedNodes[i];
    const snippet = this.extractFullSnippetWithBoundaries(node);
    
    await this.logToFile('claude-node-snippet', {
      batchId: batch.batchId,
      nodeIndex: i,
      filePath: node.filePath,
      nodeType: node.nodeType,
      position: `L${node.startLine}-${node.endLine}`,
      searchTerm: batch.searchTerm,
      replacementTerm: batch.replacementTerm,
      originalContent: node.content,
      fullSnippet: snippet,
      snippetLength: snippet.length,
      tagCount: (snippet.match(/<[^>]+>/g) || []).length,
      isFragmented: !!(node.fullSequence && node.fullSequence.length > 1),
      contextBefore: node.contextBefore,
      contextAfter: node.contextAfter
    });
  }
    
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      });

      const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      const claudeResponse = this.parseClaudeResponse(responseText);
   await this.logToFile('claude-response', {
  batchId: batch.batchId,
  inputTokens: response.usage.input_tokens,
  outputTokens: response.usage.output_tokens,
  responsePreview: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''),
      modificationsCount: claudeResponse.modifications.length,
      confidence: claudeResponse.batchConfidence * 100,
      success: true
});

      return {
        batchId: batch.batchId,
        modifications: claudeResponse.modifications,
        success: true,
        errorMessage: null,
        processedNodes: batch.extractedNodes.length,
        successfulModifications: claudeResponse.modifications.filter(m => m.shouldApply).length,
        overallStrategy: claudeResponse.overallStrategy,
        batchConfidence: claudeResponse.batchConfidence
      };

    } catch (error: any) {
      throw new Error(`Claude processing failed: ${error.message}`);
    }
  }

  private async logTokenUsage(): Promise<void> {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    const logPath = "C:\\Users\\KIIT\\Documents\\Lovable\\Lovable\\Deployment_backend\\backend-rep-buildora\\logs\\log.txt";
    
    let totalPromptTokens = 0;
    let totalResponseTokens = 0;
    let totalRequests = 0;
    let successfulRequests = 0;
    
    // Read the single log.txt file and parse entries
    try {
      const logContent = await fs.readFile(logPath, 'utf8');
      const logEntries = logContent.split('---\n').filter((entry: string) => entry.trim());

      
      for (const entry of logEntries) {
        try {
          const log = JSON.parse(entry);
          
          if (log.logType === 'claude-requests') {
            totalRequests++;
          } else if (log.logType === 'claude-response') {
            totalPromptTokens += log.inputTokens || 0;
            totalResponseTokens += log.outputTokens || 0;
            if (log.success) successfulRequests++;
          }
        } catch (e) {
          // Skip invalid JSON entries
        }
      }
    } catch (e) {
      // File doesn't exist yet
    }
    
    // LOG TOKEN SUMMARY
    await this.logToFile('token-usage', {
      totalPromptTokens,
      totalResponseTokens,
      totalTokens: totalPromptTokens + totalResponseTokens,
      totalRequests,
      successfulRequests,
      successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
      estimatedCost: {
        promptCost: (totalPromptTokens / 1000) * 0.003,
        responseCost: (totalResponseTokens / 1000) * 0.015,
        totalCost: ((totalPromptTokens / 1000) * 0.003) + ((totalResponseTokens / 1000) * 0.015)
      }
    });
    
  } catch (error) {
    console.warn('Failed to calculate token usage:', error);
  }
}
  private extractFullSnippetWithBoundaries(node: ExtractedTextNode): string {
    console.log(`[EXTRACT-SNIPPET] Extracting snippet for ${node.nodeType}`);
    
    // Handle fragmented text sequences
    if (node.fullSequence && node.fullSequence.length > 1) {
      return this.extractFragmentedSnippet(node);
    }

    // Use original Babel path if available
    if (node.originalPath && node.originalPath.node) {
      try {
        const fullCode = this.generateCodeFromPath(node.originalPath);
        if (fullCode) {
          console.log(`[EXTRACT-SNIPPET] Generated from Babel path`);
          return fullCode;
        }
      } catch (error) {
        console.log(`[EXTRACT-SNIPPET] Failed to generate from Babel path: ${error}`);
      }
    }

    // Fallback to file-based extraction
    try {
      const content = require('fs').readFileSync(node.absolutePath, 'utf8');
      const lines = content.split('\n');
      
      if (node.nodeType.includes('JSX')) {
        return this.extractJSXElementBoundaries(lines, node);
      }
      
      const startLine = Math.max(0, node.startLine - 2);
      const endLine = Math.min(lines.length, node.endLine + 2);
      
      return lines.slice(startLine, endLine).join('\n');
      
    } catch (error) {
      console.log(`[EXTRACT-SNIPPET] Failed to extract snippet: ${error}`);
      return node.outerHTML || node.content;
    }
  }

  // EXTRACT SNIPPET FOR FRAGMENTED TEXT
  private extractFragmentedSnippet(node: ExtractedTextNode): string {
    console.log(`[FRAGMENTED-SNIPPET] Extracting for ${node.fullSequence?.length} fragments`);
    
    if (!node.fullSequence || node.fullSequence.length === 0) {
      return node.content;
    }

    try {
      const firstNode = node.fullSequence[0];
      const lastNode = node.fullSequence[node.fullSequence.length - 1];
      
      // Find common parent JSX element
      const commonParent = this.findCommonParent(firstNode.parent, lastNode.parent);
      
      if (commonParent && commonParent.type === 'JSXElement') {
        const generatedCode = generate(commonParent, { retainLines: false }).code;
        console.log(`[FRAGMENTED-SNIPPET] Generated common parent JSX`);
        return generatedCode;
      }
      
      // Fallback: extract file lines spanning the fragments
      const content = require('fs').readFileSync(node.absolutePath, 'utf8');
      const lines = content.split('\n');
      
      const startLine = Math.max(0, firstNode.startLine - 1);
      const endLine = Math.min(lines.length, lastNode.endLine + 1);
      
      return lines.slice(startLine, endLine).join('\n');
      
    } catch (error) {
      console.log(`[FRAGMENTED-SNIPPET] Error: ${error}`);
      return node.content;
    }
  }

  // FIND COMMON PARENT FOR FRAGMENTED TEXT
  private findCommonParent(parent1: any, parent2: any): any {
    if (!parent1 || !parent2) return parent1 || parent2;
    if (parent1 === parent2) return parent1;
    
    // Walk up to find JSX element
    let current = parent1;
    while (current && current.type !== 'JSXElement') {
      current = current.parent;
    }
    return current;
  }

  // ENHANCED MODIFICATION APPLICATION
  async applyModifications(batchResults: BatchProcessingResult[]): Promise<{
    filesModified: string[];
    totalReplacements: number;
    diffs: string[];
  }> {
    this.log(`🔄 Step 4: Applying modifications with enhanced strategies`);

    const filesModified = new Set<string>();
    let totalReplacements = 0;
    const diffs: string[] = [];

    // Group modifications by file
    const fileModifications = new Map<string, Array<{
      node: ExtractedTextNode;
      modification: ClaudeModificationResult;
    }>>();
    
    for (const batchResult of batchResults) {
      if (!batchResult.success) continue;

      for (let i = 0; i < batchResult.modifications.length; i++) {
        const modification = batchResult.modifications[i];
        if (!modification.shouldApply) continue;

        const batch = this.batchStorage.get(batchResult.batchId);
        if (!batch) continue;

        const node = batch.extractedNodes[modification.nodeIndex];
        if (!node) continue;

        const filePath = node.absolutePath;
        
        if (!fileModifications.has(filePath)) {
          fileModifications.set(filePath, []);
        }
        
        fileModifications.get(filePath)!.push({
          node,
          modification
        });
      }
    }

    // Apply modifications to each file
    for (const [filePath, modifications] of fileModifications.entries()) {
      try {
        const originalContent = await fs.readFile(filePath, 'utf8');
        let modifiedContent = originalContent;

        // Sort modifications by line number (descending) to avoid position shifts
        modifications.sort((a, b) => b.node.startLine - a.node.startLine);

        for (const mod of modifications) {
          modifiedContent = this.applyModificationToContent(
            modifiedContent,
            mod.node,
            mod.modification
          );
          totalReplacements++;
        }

         await this.logToFile('file-modifications', {
        filePath: filePath,
        modificationsApplied: modifications.length,
        originalLength: originalContent.length,
        modifiedLength: modifiedContent.length,
        changesSummary: modifications.map(mod => ({
          strategy: mod.modification.strategy,
          confidence: mod.modification.confidence,
          originalContent: mod.modification.originalContent.substring(0, 100),
          modifiedContent: mod.modification.modifiedContent.substring(0, 100)
        }))
      });
        await fs.writeFile(filePath, modifiedContent, 'utf8');
        const relativePath = filePath.replace(this.projectPath, '').replace(/^\//, '');
        filesModified.add(relativePath);

        // Generate diff if enabled
        if (this.config.generateDiffs) {
          const diffText = this.generateDiff(filePath, originalContent, modifiedContent);
          diffs.push(diffText);
        }

        this.log(`✅ Applied ${modifications.length} modifications to ${relativePath}`);

      } catch (error: any) {
        this.log(`❌ Failed to apply modifications to ${filePath}: ${error.message}`);
      }
    }

    return {
      filesModified: Array.from(filesModified),
      totalReplacements,
      diffs
    };
  }

  // SMART MODIFICATION APPLICATION STRATEGY
  private applyModificationToContent(
    content: string,
    node: ExtractedTextNode,
    modification: ClaudeModificationResult
  ): string {
    console.log(`[APPLY-MOD] Strategy: ${modification.strategy}, Node: ${node.nodeType}`);
    
    // Strategy 1: Snippet replacement for complex JSX
    if (modification.originalSnippet && modification.modifiedSnippet) {
      console.log(`[APPLY-MOD] Using snippet replacement`);
      return this.applySnippetReplacement(content, modification.originalSnippet, modification.modifiedSnippet);
    }
    
    // Strategy 2: Fragmented text replacement
    if (node.fullSequence && node.fullSequence.length > 1) {
      console.log(`[APPLY-MOD] Using fragmented text replacement`);
      return this.applyFragmentedTextReplacement(content, node, modification);
    }
    
    // Strategy 3: Direct text replacement
    if (content.includes(modification.originalContent)) {
      console.log(`[APPLY-MOD] Using direct text replacement`);
      return content.replace(modification.originalContent, modification.modifiedContent);
    }
    
    // Strategy 4: Line-based replacement (fallback)
    console.log(`[APPLY-MOD] Using line-based replacement fallback`);
    return this.applyLineBasedModification(content, node, modification);
  }

  // SNIPPET REPLACEMENT FOR COMPLEX JSX
  private applySnippetReplacement(
    content: string,
    originalSnippet: string,
    modifiedSnippet: string
  ): string {
    console.log(`[SNIPPET-REPLACE] Applying snippet replacement`);
    
    // Try exact replacement first
    if (content.includes(originalSnippet)) {
      console.log(`[SNIPPET-REPLACE] ✅ Exact match found`);
      return content.replace(originalSnippet, modifiedSnippet);
    }
    
    // Try normalized replacement
    const normalizeWhitespace = (str: string) => str.replace(/\s+/g, ' ').trim();
    const normalizedOriginal = normalizeWhitespace(originalSnippet);
    
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const normalizedLine = normalizeWhitespace(lines[i]);
      if (normalizedLine.includes(normalizedOriginal)) {
        console.log(`[SNIPPET-REPLACE] ✅ Found normalized match on line ${i + 1}`);
        lines[i] = lines[i].replace(originalSnippet, modifiedSnippet);
        return lines.join('\n');
      }
    }
    
    console.log(`[SNIPPET-REPLACE] ❌ No match found`);
    return content;
  }

  // FRAGMENTED TEXT REPLACEMENT
  private applyFragmentedTextReplacement(
    content: string,
    node: ExtractedTextNode,
    modification: ClaudeModificationResult
  ): string {
    console.log(`[FRAGMENTED-REPLACE] Applying fragmented text replacement`);
    
    if (!node.fullSequence || node.fullSequence.length === 0) {
      return content;
    }

    let modifiedContent = content;
    const replacementWords = modification.modifiedContent.split(/\s+/);
    let wordIndex = 0;

    // Replace text in each fragment
    for (const fragment of node.fullSequence) {
      if (wordIndex >= replacementWords.length) break;
      
      const fragmentWords = fragment.content.split(/\s+/);
      const replacementPortion = replacementWords.slice(wordIndex, wordIndex + fragmentWords.length).join(' ');
      
      if (modifiedContent.includes(fragment.content)) {
        console.log(`[FRAGMENTED-REPLACE] Replacing "${fragment.content}" with "${replacementPortion}"`);
        modifiedContent = modifiedContent.replace(fragment.content, replacementPortion);
        wordIndex += fragmentWords.length;
      }
    }

    return modifiedContent;
  }

  // LINE-BASED MODIFICATION (FALLBACK)
  private applyLineBasedModification(
    content: string,
    node: ExtractedTextNode,
    modification: ClaudeModificationResult
  ): string {
    console.log(`[LINE-BASED] Applying line-based modification`);
    
    const lines = content.split('\n');
    const targetLineIndex = node.startLine - 1;
    
    if (targetLineIndex >= 0 && targetLineIndex < lines.length) {
      const originalLine = lines[targetLineIndex];
      if (originalLine.includes(modification.originalContent)) {
        lines[targetLineIndex] = originalLine.replace(
          modification.originalContent,
          modification.modifiedContent
        );
        console.log(`[LINE-BASED] ✅ Replaced in line ${node.startLine}`);
      } else {
        // Search in nearby lines
        for (let i = Math.max(0, targetLineIndex - 2); i < Math.min(lines.length, targetLineIndex + 3); i++) {
          if (lines[i].includes(modification.originalContent)) {
            lines[i] = lines[i].replace(modification.originalContent, modification.modifiedContent);
            console.log(`[LINE-BASED] ✅ Replaced in nearby line ${i + 1}`);
            break;
          }
        }
      }
    }
    
    return lines.join('\n');
  }

  // UTILITY METHODS

  private parseClaudeResponse(responseText: string): ClaudeResponse {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      const modifications = (parsed.modifications || []).map((mod: any) => ({
        nodeIndex: mod.nodeIndex || 0,
        originalContent: mod.originalContent || '',
        modifiedContent: mod.modifiedContent || '',
        reasoning: mod.reasoning || 'No reasoning provided',
        confidence: mod.confidence || 0.5,
        shouldApply: mod.shouldApply !== false,
        strategy: mod.strategy || 'text_replacement',
        warnings: mod.warnings || [],
        originalSnippet: mod.originalSnippet,
        modifiedSnippet: mod.modifiedSnippet
      }));
      
      return {
        modifications,
        overallStrategy: parsed.overallStrategy || 'Enhanced text modification',
        batchConfidence: parsed.batchConfidence || 0.5
      };

    } catch (error: any) {
      console.log(`[PARSE-RESPONSE] Error parsing Claude response: ${error.message}`);
      return {
        modifications: [],
        overallStrategy: 'Fallback due to parsing error',
        batchConfidence: 0.3
      };
    }
  }

  private createBatches(
    extractedNodes: ExtractedTextNode[],
    searchTerm: string,
    replacementTerm: string,
    userPrompt: string
  ): ProcessingBatch[] {
    const batches: ProcessingBatch[] = [];
    const batchSize = this.config.maxBatchSize;

    for (let i = 0; i < extractedNodes.length; i += batchSize) {
      const batchNodes = extractedNodes.slice(i, i + batchSize);
      const batchId = `batch_${Math.floor(i / batchSize) + 1}`;
      
      const batch: ProcessingBatch = {
        searchTerm,
        replacementTerm,
        userPrompt,
        extractedNodes: batchNodes,
        batchId,
        confidence: 0.8
      };

      batches.push(batch);
      this.batchStorage.set(batchId, batch);
    }

    return batches;
  }

  private createSmartSearchStrategies(searchTerm: string) {
    const strategies = [];
    
    // Strategy 1: Full exact match
    strategies.push({
      name: 'full_exact',
      test: (content: string) => content.includes(searchTerm),
      confidence: 1.0
    });
    
    // Strategy 2: Case-insensitive full match
    strategies.push({
      name: 'full_case_insensitive',
      test: (content: string) => content.toLowerCase().includes(searchTerm.toLowerCase()),
      confidence: 0.95
    });
    
    // Strategy 3: Key phrases (for long search terms)
    const keyPhrases = this.extractKeyPhrases(searchTerm);
    strategies.push({
      name: 'key_phrases',
      test: (content: string) => {
        const foundPhrases = keyPhrases.filter(phrase => 
          content.toLowerCase().includes(phrase.toLowerCase())
        );
        return foundPhrases.length >= Math.min(3, keyPhrases.length * 0.4);
      },
      confidence: 0.7
    });
    
    // Strategy 4: Word matching (60% of words must be present)
    const words = searchTerm.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    strategies.push({
      name: 'word_matching',
      test: (content: string) => {
        const contentLower = content.toLowerCase();
        const foundWords = words.filter(word => contentLower.includes(word));
        return foundWords.length >= Math.max(2, words.length * 0.6);
      },
      confidence: 0.6
    });
    
    return strategies;
  }

  private extractKeyPhrases(searchTerm: string): string[] {
    const words = searchTerm.toLowerCase().split(/\s+/);
    const keyPhrases: string[] = [];
    
    // Single meaningful words (length > 3)
    words.filter(word => word.length > 3).forEach(word => {
      keyPhrases.push(word);
    });
    
    // Two-word combinations
    for (let i = 0; i < words.length - 1; i++) {
      keyPhrases.push(`${words[i]} ${words[i + 1]}`);
    }
    
    // Three-word combinations (for longer terms)
    for (let i = 0; i < words.length - 2; i++) {
      keyPhrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
    
    return keyPhrases;
  }

  private extractWithSmartRegex(
    file: FileInfo,
    content: string,
    lines: string[],
    searchTerm: string
  ): ExtractedTextNode[] {
    const extractedNodes: ExtractedTextNode[] = [];
    
    const searchStrategies = [
      {
        name: 'exact_phrase',
        pattern: new RegExp(this.escapeRegex(searchTerm), 'gi'),
        confidence: 0.9
      },
      {
        name: 'flexible_whitespace',
        pattern: new RegExp(searchTerm.split(/\s+/).map(word => this.escapeRegex(word)).join('\\s+'), 'gi'),
        confidence: 0.8
      }
    ];
    
    lines.forEach((line, index) => {
      searchStrategies.forEach(strategy => {
        strategy.pattern.lastIndex = 0;
        const matches = [...line.matchAll(strategy.pattern)];
        
        matches.forEach(match => {
          const contextBefore = this.extractContextLines(lines, index, this.config.contextLines, 'before');
          const contextAfter = this.extractContextLines(lines, index, this.config.contextLines, 'after');
          
          extractedNodes.push({
            nodeType: `SmartRegexMatch`,
            content: match[0],
            outerHTML: line,
            filePath: file.filePath,
            absolutePath: file.absolutePath,
            startLine: index + 1,
            endLine: index + 1,
            startColumn: match.index || 0,
            endColumn: (match.index || 0) + match[0].length,
            contextBefore,
            contextAfter,
            parentContext: 'Smart regex fallback',
            containsFullSearchTerm: true,
            relevanceScore: strategy.confidence,
            metadata: { 
              fallback: true, 
              strategy: strategy.name,
              confidence: strategy.confidence
            }
          });
        });
      });
    });

    return extractedNodes;
  }

  private convertToExtractedTextNode(
    node: ExtractedNode,
    file: FileInfo,
    lines: string[],
    searchTerm: string
  ): ExtractedTextNode {
    const contextBefore = this.extractContextLines(lines, node.startLine - 1, this.config.contextLines, 'before');
    const contextAfter = this.extractContextLines(lines, node.endLine - 1, this.config.contextLines, 'after');
    
    return {
      nodeType: node.fullSequence ? 'JSXText_Fragmented' : 'JSXText',
      content: node.content,
      outerHTML: lines[node.startLine - 1] || '',
      filePath: file.filePath,
      absolutePath: file.absolutePath,
      startLine: node.startLine,
      endLine: node.endLine,
      startColumn: 0,
      endColumn: node.content.length,
      contextBefore,
      contextAfter,
      parentContext: 'JSX Element',
      containsFullSearchTerm: true,
      relevanceScore: 0.9,
      metadata: {
        fragmented: !!node.fullSequence,
        fragmentCount: node.fullSequence?.length || 1
      },
      fullSequence: node.fullSequence
    };
  }

  private generateCodeFromPath(path: any): string {
    try {
      const generated = generate(path.node, {
        retainLines: false,
        compact: false,
        concise: false
      });
      return generated.code;
    } catch (error) {
      console.log(`[GENERATE-CODE] Error: ${error}`);
      return '';
    }
  }

  private extractJSXElementBoundaries(lines: string[], node: ExtractedTextNode): string {
    console.log(`[JSX-BOUNDARIES] Extracting for lines ${node.startLine}-${node.endLine}`);
    
    const startLineIndex = node.startLine - 1;
    const endLineIndex = node.endLine - 1;
    
    // Find the actual JSX element boundaries
    let actualStartLine = startLineIndex;
    let actualEndLine = endLineIndex;
    
    // Find opening tag
    for (let i = startLineIndex; i >= Math.max(0, startLineIndex - 3); i--) {
      const line = lines[i].trim();
      if (line.includes('<') && !line.includes('</')) {
        actualStartLine = i;
        break;
      }
    }
    
    // Find closing tag
    for (let i = endLineIndex; i < Math.min(lines.length, endLineIndex + 3); i++) {
      const line = lines[i].trim();
      if (line.includes('/>') || line.includes('</')) {
        actualEndLine = i;
        break;
      }
    }
    
    return lines.slice(actualStartLine, actualEndLine + 1).join('\n');
  }

  private getFileType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const typeMap: { [key: string]: string } = {
      'tsx': 'react-typescript',
      'ts': 'typescript',
      'jsx': 'react-javascript',
      'js': 'javascript',
      'html': 'html',
      'css': 'css'
    };
    return typeMap[ext] || 'unknown';
  }

  private extractContextLines(
    lines: string[],
    lineIndex: number,
    contextSize: number,
    direction: 'before' | 'after'
  ): string[] {
    const context: string[] = [];
    
    if (direction === 'before') {
      for (let i = Math.max(0, lineIndex - contextSize); i < lineIndex; i++) {
        context.push(lines[i]);
      }
    } else {
      for (let i = lineIndex + 1; i < Math.min(lines.length, lineIndex + contextSize + 1); i++) {
        context.push(lines[i]);
      }
    }
    
    return context;
  }

  private calculateAverageConfidence(batchResults: BatchProcessingResult[]): number {
    const validResults = batchResults.filter(b => b.success);
    if (validResults.length === 0) return 0;
    
    const totalConfidence = validResults.reduce((sum, batch) => {
      const batchConfidence = batch.modifications.reduce((bSum, mod) => 
        bSum + (mod.confidence || 0), 0
      ) / Math.max(batch.modifications.length, 1);
      return sum + batchConfidence;
    }, 0);
    
    return totalConfidence / validResults.length;
  }

  private generateDiff(filePath: string, originalContent: string, modifiedContent: string): string {
    const originalLines = originalContent.split('\n');
    const modifiedLines = modifiedContent.split('\n');
    
    const diffLines: string[] = [];
    diffLines.push(`--- ${filePath}`);
    diffLines.push(`+++ ${filePath}`);
    
    for (let i = 0; i < Math.max(originalLines.length, modifiedLines.length); i++) {
      const originalLine = originalLines[i] || '';
      const modifiedLine = modifiedLines[i] || '';
      
      if (originalLine !== modifiedLine) {
        if (originalLine) diffLines.push(`- ${originalLine}`);
        if (modifiedLine) diffLines.push(`+ ${modifiedLine}`);
      }
    }
    
    return diffLines.join('\n');
  }

  private createFailureResult(message: string): HybridProcessingResult {
    return {
      success: false,
      filesModified: [],
      totalReplacements: 0,
      totalBatches: 0,
      batchResults: [],
      overallStrategy: 'Processing failed',
      diffs: [],
      averageConfidence: 0,
      processingTime: '0s',
      stats: {
        filesScanned: 0,
        nodesExtracted: 0,
        batchesProcessed: 0,
        totalBatches: 0
      },
      error: message
    };
  }

 private escapeRegex(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

  // PREVIEW METHODS
  async previewChanges(
    userPrompt: string,
    searchTerm: string,
    replacementTerm: string
  ): Promise<{
    success: boolean;
    previewNodes: ExtractedTextNode[];
    estimatedChanges: number;
    summary: string;
  }> {
    this.log(`👀 Previewing changes for "${searchTerm}" → "${replacementTerm}"`);

    try {
      const files = await this.discoverFiles(searchTerm);
      if (files.length === 0) {
        return {
          success: false,
          previewNodes: [],
          estimatedChanges: 0,
          summary: 'No files found containing the search term'
        };
      }

      const extractedNodes = await this.extractTextNodesWithBabel(files, searchTerm);
      
      return {
        success: true,
        previewNodes: extractedNodes,
        estimatedChanges: extractedNodes.length,
        summary: `Found ${extractedNodes.length} text nodes in ${files.length} files that may be modified`
      };

    } catch (error: any) {
      return {
        success: false,
        previewNodes: [],
        estimatedChanges: 0,
        summary: `Preview failed: ${error.message}`
      };
    }
  }

  // LEGACY COMPATIBILITY METHODS
  async processWithCustomStrategy(
    userPrompt: string,
    searchTerm: string,
    replacementTerm: string,
    customStrategy: {
      preProcessor?: (nodes: ExtractedTextNode[]) => ExtractedTextNode[];
      postProcessor?: (result: HybridProcessingResult) => HybridProcessingResult;
      customPrompt?: (batch: ProcessingBatch) => string;
      useSnippetMode?: boolean;
      snippetExtractor?: (node: ExtractedTextNode) => string;
    }
  ): Promise<HybridProcessingResult> {
    return this.processText(userPrompt, searchTerm, replacementTerm);
  }

  async processWithClaude(
    extractedNodes: ExtractedTextNode[],
    searchTerm: string,
    replacementTerm: string,
    userPrompt: string
  ): Promise<BatchProcessingResult[]> {
    return this.processWithClaudeSnippets(extractedNodes, searchTerm, replacementTerm, userPrompt);
  }
}

// FACTORY FUNCTIONS
export async function createHybridProcessor(
  projectPath: string,
  anthropic: any,
  config?: Partial<ProcessingConfig>
): Promise<EnhancedLLMRipgrepProcessor> {
  const processor = new EnhancedLLMRipgrepProcessor(projectPath, anthropic);
  
  // Set up streaming callback for real-time updates
  processor.setStreamCallback((message: string) => {
    console.log(`[HybridProcessor] ${message}`);
  });
  
  return processor;
}

export interface HybridProcessorOptions {
  projectPath: string;
  anthropic: any;
  config?: Partial<ProcessingConfig>;
  streamCallback?: (message: string) => void;
}

export async function processTextWithHybrid(
  options: HybridProcessorOptions,
  userPrompt: string,
  searchTerm: string,
  replacementTerm: string
): Promise<HybridProcessingResult> {
  const processor = await createHybridProcessor(
    options.projectPath,
    options.anthropic,
    options.config
  );
  
  if (options.streamCallback) {
    processor.setStreamCallback(options.streamCallback);
  }
  
  return processor.processText(userPrompt, searchTerm, replacementTerm);
}

export async function processTextWithCustomStrategy(
  options: HybridProcessorOptions,
  userPrompt: string,
  searchTerm: string,
  replacementTerm: string,
  customStrategy: {
    preProcessor?: (nodes: ExtractedTextNode[]) => ExtractedTextNode[];
    postProcessor?: (result: HybridProcessingResult) => HybridProcessingResult;
    customPrompt?: (batch: ProcessingBatch) => string;
    useSnippetMode?: boolean;
    snippetExtractor?: (node: ExtractedTextNode) => string;
  }
): Promise<HybridProcessingResult> {
  const processor = await createHybridProcessor(
    options.projectPath,
    options.anthropic,
    options.config
  );
  
  if (options.streamCallback) {
    processor.setStreamCallback(options.streamCallback);
  }
  
  return processor.processWithCustomStrategy(
    userPrompt,
    searchTerm,
    replacementTerm,
    customStrategy
  );
}

// UTILITY FUNCTIONS
export function createPreprocessorFilter(
  filters: {
    minRelevanceScore?: number;
    excludeNodeTypes?: string[];
    includeOnlyFileTypes?: string[];
  }
): (nodes: ExtractedTextNode[]) => ExtractedTextNode[] {
  return (nodes: ExtractedTextNode[]) => {
    return nodes.filter(node => {
      if (filters.minRelevanceScore && node.relevanceScore < filters.minRelevanceScore) {
        return false;
      }
      
      if (filters.excludeNodeTypes && filters.excludeNodeTypes.includes(node.nodeType)) {
        return false;
      }
      
      if (filters.includeOnlyFileTypes) {
        const fileType = node.filePath.split('.').pop()?.toLowerCase();
        if (!fileType || !filters.includeOnlyFileTypes.includes(fileType)) {
          return false;
        }
      }
      
      return true;
    });
  };
}

export function createPostprocessorReporter(
  options: {
    generateSummary?: boolean;
    includeDetailedStats?: boolean;
    logToConsole?: boolean;
  } = {}
): (result: HybridProcessingResult) => HybridProcessingResult {
  return (result: HybridProcessingResult) => {
    if (options.logToConsole) {
      console.log('🎯 Enhanced Hybrid Processing Summary:', {
        success: result.success,
        filesModified: result.filesModified.length,
        totalReplacements: result.totalReplacements,
        averageConfidence: result.averageConfidence,
        processingTime: result.processingTime
      });
    }
    
    if (options.generateSummary) {
      const summary = `
Enhanced Hybrid Text Processing Results:
- Success: ${result.success}
- Files Modified: ${result.filesModified.length}
- Total Replacements: ${result.totalReplacements}
- Average Confidence: ${(result.averageConfidence * 100).toFixed(1)}%
- Processing Time: ${result.processingTime}
- Strategy: ${result.overallStrategy}
      `.trim();
      
      console.log(summary);
    }
    
    return result;
  };
}

// STATIC UTILITY METHODS
export class ProcessorUtils {
  static extractTermsFromPrompt(prompt: string): ExtractedTerms | null {
    const patterns = [
      { pattern: /change\s+"([^"]+)"\s+to\s+"([^"]+)"/i, confidence: 95 },
      { pattern: /replace\s+"([^"]+)"\s+with\s+"([^"]+)"/i, confidence: 95 },
      { pattern: /update\s+"([^"]+)"\s+to\s+"([^"]+)"/i, confidence: 90 },
      { pattern: /change\s+'([^']+)'\s+to\s+'([^']+)'/i, confidence: 95 },
      { pattern: /replace\s+'([^']+)'\s+with\s+'([^']+)'/i, confidence: 95 }
    ];

    for (const { pattern, confidence } of patterns) {
      const match = prompt.match(pattern);
      if (match && match[1] && match[2]) {
        const searchTerm = match[1].trim();
        const replacementTerm = match[2].trim();

        if (searchTerm.toLowerCase() !== replacementTerm.toLowerCase()) {
          return {
            searchTerm,
            replacementTerm,
            extractionMethod: 'enhanced_pattern',
            confidence,
            context: match[0]
          };
        }
      }
    }

    return null;
  }

  static async validateEnvironment(): Promise<{
    available: boolean;
    version?: string;
    error?: string;
    features?: string[];
  }> {
    try {
      // Test fast-glob availability
      await fg(['*.nonexistent'], { cwd: process.cwd(), suppressErrors: true });
      
      // Test Babel availability
      const testCode = 'const x = 1;';
      parser.parse(testCode, { sourceType: 'module' });
      
      return {
        available: true,
        version: 'Enhanced Hybrid Text Processor v2.0.0',
        features: [
          'Smart file discovery with multiple strategies',
          'Enhanced Babel AST extraction with fragmented text support',
          'Intelligent Claude batch processing',
          'Context-aware JSX transformation',
          'Fragmented text handling across multiple elements',
          'Advanced snippet-based modification',
          'Comprehensive error handling and fallbacks',
          'Real-time processing feedback'
        ]
      };
    } catch (error: any) {
      return {
        available: false,
        error: `Environment validation failed: ${error.message}`
      };
    }
  }
}