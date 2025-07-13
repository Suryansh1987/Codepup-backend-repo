import * as diff from 'diff';
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
    metadata: {
        [key: string]: any;
    };
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
export declare class EnhancedLLMRipgrepProcessor {
    private projectPath;
    private anthropic;
    private config;
    private streamCallback;
    private batchStorage;
    private currentFilePath;
    private enableFileLogging;
    private requestCounter;
    constructor(projectPath: string, anthropic: any);
    setStreamCallback(callback: (message: string) => void): void;
    private log;
    private logToFile;
    private estimateTokens;
    processText(userPrompt: string, searchTerm: string, replacementTerm: string): Promise<HybridProcessingResult>;
    discoverFiles(searchTerm: string): Promise<FileInfo[]>;
    extractTextNodesWithBabel(files: FileInfo[], searchTerm: string): Promise<ExtractedTextNode[]>;
    /**
     * Extracts text nodes from AST with support for fragmented text across multiple JSX elements
     */
    private extractTextNodes;
    /**
     * Finds sequences of text nodes that together form the search term
     * Handles cases where text is split across multiple JSX elements
     */
    private findTextSequence;
    /**
     * Finds the common parent JSX element for fragmented text nodes
     * Used to extract the containing JSX structure
     */
    private processWithClaudeSnippets;
    private createClaudeSnippetPrompt;
    private deduplicateNodes;
    private processBatchWithSnippets;
    private logTokenUsage;
    private extractFullSnippetWithBoundaries;
    private extractFragmentedSnippet;
    private findCommonParent;
    applyModifications(batchResults: BatchProcessingResult[]): Promise<{
        filesModified: string[];
        totalReplacements: number;
        diffs: string[];
    }>;
    private applyModificationToContent;
    private applySnippetReplacement;
    private applyFragmentedTextReplacement;
    private applyLineBasedModification;
    private parseClaudeResponse;
    private createBatches;
    private createSmartSearchStrategies;
    private extractKeyPhrases;
    private extractWithSmartRegex;
    private convertToExtractedTextNode;
    private generateCodeFromPath;
    private extractJSXElementBoundaries;
    private getFileType;
    private extractContextLines;
    private calculateAverageConfidence;
    private generateDiff;
    private createFailureResult;
    private escapeRegex;
    previewChanges(userPrompt: string, searchTerm: string, replacementTerm: string): Promise<{
        success: boolean;
        previewNodes: ExtractedTextNode[];
        estimatedChanges: number;
        summary: string;
    }>;
    processWithCustomStrategy(userPrompt: string, searchTerm: string, replacementTerm: string, customStrategy: {
        preProcessor?: (nodes: ExtractedTextNode[]) => ExtractedTextNode[];
        postProcessor?: (result: HybridProcessingResult) => HybridProcessingResult;
        customPrompt?: (batch: ProcessingBatch) => string;
        useSnippetMode?: boolean;
        snippetExtractor?: (node: ExtractedTextNode) => string;
    }): Promise<HybridProcessingResult>;
    processWithClaude(extractedNodes: ExtractedTextNode[], searchTerm: string, replacementTerm: string, userPrompt: string): Promise<BatchProcessingResult[]>;
}
export declare function createHybridProcessor(projectPath: string, anthropic: any, config?: Partial<ProcessingConfig>): Promise<EnhancedLLMRipgrepProcessor>;
export interface HybridProcessorOptions {
    projectPath: string;
    anthropic: any;
    config?: Partial<ProcessingConfig>;
    streamCallback?: (message: string) => void;
}
export declare function processTextWithHybrid(options: HybridProcessorOptions, userPrompt: string, searchTerm: string, replacementTerm: string): Promise<HybridProcessingResult>;
export declare function processTextWithCustomStrategy(options: HybridProcessorOptions, userPrompt: string, searchTerm: string, replacementTerm: string, customStrategy: {
    preProcessor?: (nodes: ExtractedTextNode[]) => ExtractedTextNode[];
    postProcessor?: (result: HybridProcessingResult) => HybridProcessingResult;
    customPrompt?: (batch: ProcessingBatch) => string;
    useSnippetMode?: boolean;
    snippetExtractor?: (node: ExtractedTextNode) => string;
}): Promise<HybridProcessingResult>;
export declare function createPreprocessorFilter(filters: {
    minRelevanceScore?: number;
    excludeNodeTypes?: string[];
    includeOnlyFileTypes?: string[];
}): (nodes: ExtractedTextNode[]) => ExtractedTextNode[];
export declare function createPostprocessorReporter(options?: {
    generateSummary?: boolean;
    includeDetailedStats?: boolean;
    logToConsole?: boolean;
}): (result: HybridProcessingResult) => HybridProcessingResult;
export declare class ProcessorUtils {
    static extractTermsFromPrompt(prompt: string): ExtractedTerms | null;
    static validateEnvironment(): Promise<{
        available: boolean;
        version?: string;
        error?: string;
        features?: string[];
    }>;
}
