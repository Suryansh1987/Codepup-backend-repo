"use strict";
// Enhanced Hybrid Text Processor: Fast-glob + Babel AST + Claude + Batch Processing
// Production-ready TypeScript implementation with fragmented text support
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessorUtils = exports.EnhancedLLMRipgrepProcessor = void 0;
exports.createHybridProcessor = createHybridProcessor;
exports.processTextWithHybrid = processTextWithHybrid;
exports.processTextWithCustomStrategy = processTextWithCustomStrategy;
exports.createPreprocessorFilter = createPreprocessorFilter;
exports.createPostprocessorReporter = createPostprocessorReporter;
const fs_1 = require("fs");
const path_1 = require("path");
const fast_glob_1 = __importDefault(require("fast-glob"));
const parser = __importStar(require("@babel/parser"));
const traverse_1 = __importDefault(require("@babel/traverse"));
const generator_1 = __importDefault(require("@babel/generator"));
/**
 * Enhanced Hybrid Text Processor
 * Combines fast-glob file discovery + improved Babel AST extraction + Claude batch processing
 */
class EnhancedLLMRipgrepProcessor {
    constructor(projectPath, anthropic) {
        this.enableFileLogging = true;
        this.requestCounter = 0;
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
    setStreamCallback(callback) {
        this.streamCallback = callback;
    }
    log(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
        console.log(message);
    }
    logToFile(logType, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.enableFileLogging)
                return;
            const fs = require('fs').promises;
            const path = require('path');
            try {
                const timestamp = new Date().toISOString();
                const logEntry = Object.assign({ timestamp,
                    logType }, data);
                // CHANGE THIS LINE to control where log.txt is written:
                const logPath = "C:\\Users\\KIIT\\Documents\\Lovable\\Lovable\\Deployment_backend\\backend-rep-buildora\\logs\\log.txt"; // Current working directory
                // OR: const logPath = path.join(this.projectPath, 'log.txt'); // Project directory (current)
                // OR: const logPath = '/custom/path/log.txt'; // Absolute path
                yield fs.appendFile(logPath, JSON.stringify(logEntry, null, 2) + '\n---\n');
            }
            catch (error) {
                console.warn(`Failed to write to log.txt:`, error);
            }
        });
    }
    estimateTokens(text) {
        return Math.ceil(text.length / 4); // ~4 chars per token
    }
    processText(userPrompt, searchTerm, replacementTerm) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`\n=== ENHANCED HYBRID PROCESSOR START ===`);
            console.log(`[HYBRID-PROCESS] Search: "${searchTerm}"`);
            console.log(`[HYBRID-PROCESS] Replace: "${replacementTerm}"`);
            this.log(`🚀 Starting Enhanced Hybrid Text Processing`);
            this.log(`   🔎 Search: "${searchTerm}"`);
            this.log(`   ✏️  Replace: "${replacementTerm}"`);
            const startTime = Date.now();
            try {
                // Step 1: Smart file discovery
                const files = yield this.discoverFiles(searchTerm);
                if (files.length === 0) {
                    // LOG FAILURE
                    yield this.logToFile('processing-summary', {
                        success: false,
                        error: 'No files found containing the search term',
                        searchTerm: searchTerm.substring(0, 100),
                        replacementTerm: replacementTerm.substring(0, 100),
                        processingTimeMs: Date.now() - startTime
                    });
                    return this.createFailureResult('No files found containing the search term');
                }
                // Step 2: Enhanced Babel AST extraction with fragmented text support
                const extractedNodes = yield this.extractTextNodesWithBabel(files, searchTerm);
                if (extractedNodes.length === 0) {
                    // LOG FAILURE
                    yield this.logToFile('processing-summary', {
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
                const batchResults = yield this.processWithClaudeSnippets(extractedNodes, searchTerm, replacementTerm, userPrompt);
                // Step 4: Apply modifications with enhanced strategies
                const applyResult = yield this.applyModifications(batchResults);
                const endTime = Date.now();
                const processingTime = `${(endTime - startTime) / 1000}s`;
                const result = {
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
                yield this.logToFile('processing-summary', {
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
                yield this.logTokenUsage();
                return result;
            }
            catch (error) {
                const processingTime = `${(Date.now() - startTime) / 1000}s`;
                // LOG ERROR
                yield this.logToFile('processing-summary', {
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
        });
    }
    // ENHANCED FILE DISCOVERY
    discoverFiles(searchTerm) {
        return __awaiter(this, void 0, void 0, function* () {
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
                const files = yield (0, fast_glob_1.default)(includePatterns, {
                    cwd: this.projectPath,
                    ignore: ignorePatterns,
                    onlyFiles: true,
                    suppressErrors: true,
                    absolute: false,
                    dot: false
                });
                const matchingFiles = [];
                const searchStrategies = this.createSmartSearchStrategies(searchTerm);
                for (const file of files) {
                    try {
                        const filePath = (0, path_1.join)(this.projectPath, file);
                        const content = yield fs_1.promises.readFile(filePath, 'utf8');
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
                    }
                    catch (error) {
                        this.log(`⚠️ Error reading ${file}: ${error.message}`);
                    }
                }
                const scanTimeMs = Date.now() - startTime; // ADD THIS
                // LOG TO FILE
                yield this.logToFile('glob-scan', {
                    searchTerm: searchTerm.substring(0, 100),
                    patternsUsed: includePatterns,
                    filesScanned: files.length,
                    matchingFiles: matchingFiles.length,
                    scanTimeMs, // ADD THIS
                    strategies: searchStrategies.map(s => s.name)
                });
                this.log(`✅ Found ${matchingFiles.length} files using smart search strategies`);
                return matchingFiles;
            }
            catch (error) {
                // LOG ERROR
                yield this.logToFile('glob-scan', {
                    error: error.message,
                    searchTerm: searchTerm.substring(0, 100),
                    success: false,
                    scanTimeMs: Date.now() - startTime
                });
                this.log(`❌ File discovery failed: ${error.message}`);
                return [];
            }
        });
    }
    // ENHANCED BABEL AST EXTRACTION WITH FRAGMENTED TEXT SUPPORT
    extractTextNodesWithBabel(files, searchTerm) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log(`🔧 Step 2: Enhanced Babel AST extraction for: "${searchTerm}"`);
            const allExtractedNodes = [];
            for (const file of files) {
                try {
                    this.currentFilePath = file.filePath;
                    const content = yield fs_1.promises.readFile(file.absolutePath, 'utf8');
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
                        const formattedNodes = extractedNodes.map(node => this.convertToExtractedTextNode(node, file, lines, searchTerm));
                        allExtractedNodes.push(...formattedNodes);
                    }
                    catch (babelError) {
                        this.log(`⚠️ Babel parsing failed for ${file.filePath}, using regex fallback`);
                        const fallbackNodes = this.extractWithSmartRegex(file, content, lines, searchTerm);
                        allExtractedNodes.push(...fallbackNodes);
                    }
                }
                catch (error) {
                    this.log(`❌ Error processing file ${file.filePath}: ${error.message}`);
                }
            }
            const uniqueNodes = this.deduplicateNodes(allExtractedNodes);
            this.log(`🎯 Extracted ${uniqueNodes.length} unique text nodes (removed ${allExtractedNodes.length - uniqueNodes.length} duplicates)`);
            return uniqueNodes;
        });
    }
    // IMPROVED TEXT NODE EXTRACTION WITH FRAGMENTED TEXT SUPPORT
    // Enhanced text node extraction methods for fragmented text support
    /**
     * Extracts text nodes from AST with support for fragmented text across multiple JSX elements
     */
    extractTextNodes(ast, searchTerm) {
        const nodes = [];
        const searchWords = searchTerm.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
        const allTextNodes = [];
        const filePath = this.currentFilePath; // ✅ Capture class property
        (0, traverse_1.default)(ast, {
            JSXText(path) {
                var _a, _b, _c, _d, _e;
                const content = (_a = path.node.value) === null || _a === void 0 ? void 0 : _a.trim();
                if (content && content.length > 0) {
                    allTextNodes.push({
                        content,
                        startLine: ((_c = (_b = path.node.loc) === null || _b === void 0 ? void 0 : _b.start) === null || _c === void 0 ? void 0 : _c.line) || 0,
                        endLine: ((_e = (_d = path.node.loc) === null || _d === void 0 ? void 0 : _d.end) === null || _e === void 0 ? void 0 : _e.line) || 0,
                        filePath, // ✅ Use captured variable
                        node: path.node,
                        parent: path.parent
                    });
                }
            },
            JSXExpressionContainer(path) {
                var _a, _b, _c, _d, _e, _f;
                if (((_a = path.node.expression) === null || _a === void 0 ? void 0 : _a.type) === 'StringLiteral') {
                    const content = (_b = path.node.expression.value) === null || _b === void 0 ? void 0 : _b.trim();
                    if (content && content.length > 0) {
                        allTextNodes.push({
                            content,
                            startLine: ((_d = (_c = path.node.loc) === null || _c === void 0 ? void 0 : _c.start) === null || _d === void 0 ? void 0 : _d.line) || 0,
                            endLine: ((_f = (_e = path.node.loc) === null || _e === void 0 ? void 0 : _e.end) === null || _f === void 0 ? void 0 : _f.line) || 0,
                            filePath,
                            node: path.node,
                            parent: path.parent
                        });
                    }
                }
            },
            StringLiteral(path) {
                var _a, _b, _c, _d, _e;
                const content = (_a = path.node.value) === null || _a === void 0 ? void 0 : _a.trim();
                if (content && content.length > 3) {
                    allTextNodes.push({
                        content,
                        startLine: ((_c = (_b = path.node.loc) === null || _b === void 0 ? void 0 : _b.start) === null || _c === void 0 ? void 0 : _c.line) || 0,
                        endLine: ((_e = (_d = path.node.loc) === null || _d === void 0 ? void 0 : _d.end) === null || _e === void 0 ? void 0 : _e.line) || 0,
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
    findTextSequence(textNodes, startIndex, searchWords) {
        const sequence = [];
        let wordIndex = 0;
        const maxLookAhead = 5; // Prevent infinite loops
        console.log(`[FIND-TEXT-SEQUENCE] Starting search from index ${startIndex} for words: [${searchWords.join(', ')}]`);
        for (let i = startIndex; i < textNodes.length && i < startIndex + maxLookAhead && wordIndex < searchWords.length; i++) {
            const nodeContent = textNodes[i].content.toLowerCase();
            const nodeWords = nodeContent
                .split(/\s+/)
                .filter((w) => w.length > 0);
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
            }
            else if (sequence.length > 0) {
                // If we have a partial sequence but this node doesn't match,
                // check if the next node might have what we need
                const hasNextMatch = i + 1 < textNodes.length &&
                    wordIndex < searchWords.length &&
                    textNodes[i + 1].content.toLowerCase()
                        .split(/\s+/)
                        .some((word) => word.includes(searchWords[wordIndex]));
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
    processWithClaudeSnippets(extractedNodes, searchTerm, replacementTerm, userPrompt) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log(`🤖 Step 3: Claude processing with enhanced prompts for ${extractedNodes.length} nodes`);
            const batches = this.createBatches(extractedNodes, searchTerm, replacementTerm, userPrompt);
            this.log(`📦 Created ${batches.length} batches for processing`);
            const batchResults = [];
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                this.log(`🔄 Processing batch ${i + 1}/${batches.length} (${batch.extractedNodes.length} nodes)`);
                try {
                    const result = yield this.processBatchWithSnippets(batch);
                    batchResults.push(result);
                    this.log(`✅ Batch ${i + 1} completed: ${result.successfulModifications}/${result.processedNodes} successful`);
                }
                catch (error) {
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
        });
    }
    // ENHANCED CLAUDE PROMPT FOR COMPLEX AND SIMPLE CASES
    createClaudeSnippetPrompt(batch) {
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
        const hasFragmentedText = batch.extractedNodes.some(node => node.fullSequence && node.fullSequence.length > 1);
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
    deduplicateNodes(nodes) {
        console.log(`[DEDUPE] Starting with ${nodes.length} nodes`);
        const seen = new Set();
        const uniqueNodes = [];
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
    processBatchWithSnippets(batch) {
        return __awaiter(this, void 0, void 0, function* () {
            const prompt = this.createClaudeSnippetPrompt(batch);
            yield this.logToFile('claude-detailed-input', {
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
                nodes: batch.extractedNodes.map((node, index) => {
                    var _a, _b;
                    return ({
                        nodeIndex: index,
                        nodeId: `${node.filePath}:${node.startLine}-${node.endLine}`,
                        nodeType: node.nodeType,
                        filePath: node.filePath,
                        position: `L${node.startLine}-${node.endLine}`,
                        textContent: node.content,
                        outerHTML: node.outerHTML,
                        relevanceScore: node.relevanceScore,
                        isFragmented: !!(node.fullSequence && node.fullSequence.length > 1),
                        fragmentCount: ((_a = node.fullSequence) === null || _a === void 0 ? void 0 : _a.length) || 1,
                        parentContext: node.parentContext,
                        metadata: node.metadata,
                        contextBefore: node.contextBefore,
                        contextAfter: node.contextAfter,
                        // Full snippet being sent to Claude
                        fullSnippet: this.extractFullSnippetWithBoundaries(node),
                        // Fragment details if applicable
                        fragments: ((_b = node.fullSequence) === null || _b === void 0 ? void 0 : _b.map(frag => ({
                            content: frag.content,
                            startLine: frag.startLine,
                            endLine: frag.endLine,
                            filePath: frag.filePath
                        }))) || []
                    });
                }),
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
                    hasFragmentedText: batch.extractedNodes.some(node => node.fullSequence && node.fullSequence.length > 1)
                }
            });
            // 🔥 LOG EACH NODE'S SNIPPET SEPARATELY for easier debugging
            for (let i = 0; i < batch.extractedNodes.length; i++) {
                const node = batch.extractedNodes[i];
                const snippet = this.extractFullSnippetWithBoundaries(node);
                yield this.logToFile('claude-node-snippet', {
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
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 4000,
                    messages: [{ role: 'user', content: prompt }]
                });
                const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
                const claudeResponse = this.parseClaudeResponse(responseText);
                yield this.logToFile('claude-response', {
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
            }
            catch (error) {
                throw new Error(`Claude processing failed: ${error.message}`);
            }
        });
    }
    logTokenUsage() {
        return __awaiter(this, void 0, void 0, function* () {
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
                    const logContent = yield fs.readFile(logPath, 'utf8');
                    const logEntries = logContent.split('---\n').filter((entry) => entry.trim());
                    for (const entry of logEntries) {
                        try {
                            const log = JSON.parse(entry);
                            if (log.logType === 'claude-requests') {
                                totalRequests++;
                            }
                            else if (log.logType === 'claude-response') {
                                totalPromptTokens += log.inputTokens || 0;
                                totalResponseTokens += log.outputTokens || 0;
                                if (log.success)
                                    successfulRequests++;
                            }
                        }
                        catch (e) {
                            // Skip invalid JSON entries
                        }
                    }
                }
                catch (e) {
                    // File doesn't exist yet
                }
                // LOG TOKEN SUMMARY
                yield this.logToFile('token-usage', {
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
            }
            catch (error) {
                console.warn('Failed to calculate token usage:', error);
            }
        });
    }
    extractFullSnippetWithBoundaries(node) {
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
            }
            catch (error) {
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
        }
        catch (error) {
            console.log(`[EXTRACT-SNIPPET] Failed to extract snippet: ${error}`);
            return node.outerHTML || node.content;
        }
    }
    // EXTRACT SNIPPET FOR FRAGMENTED TEXT
    extractFragmentedSnippet(node) {
        var _a;
        console.log(`[FRAGMENTED-SNIPPET] Extracting for ${(_a = node.fullSequence) === null || _a === void 0 ? void 0 : _a.length} fragments`);
        if (!node.fullSequence || node.fullSequence.length === 0) {
            return node.content;
        }
        try {
            const firstNode = node.fullSequence[0];
            const lastNode = node.fullSequence[node.fullSequence.length - 1];
            // Find common parent JSX element
            const commonParent = this.findCommonParent(firstNode.parent, lastNode.parent);
            if (commonParent && commonParent.type === 'JSXElement') {
                const generatedCode = (0, generator_1.default)(commonParent, { retainLines: false }).code;
                console.log(`[FRAGMENTED-SNIPPET] Generated common parent JSX`);
                return generatedCode;
            }
            // Fallback: extract file lines spanning the fragments
            const content = require('fs').readFileSync(node.absolutePath, 'utf8');
            const lines = content.split('\n');
            const startLine = Math.max(0, firstNode.startLine - 1);
            const endLine = Math.min(lines.length, lastNode.endLine + 1);
            return lines.slice(startLine, endLine).join('\n');
        }
        catch (error) {
            console.log(`[FRAGMENTED-SNIPPET] Error: ${error}`);
            return node.content;
        }
    }
    // FIND COMMON PARENT FOR FRAGMENTED TEXT
    findCommonParent(parent1, parent2) {
        if (!parent1 || !parent2)
            return parent1 || parent2;
        if (parent1 === parent2)
            return parent1;
        // Walk up to find JSX element
        let current = parent1;
        while (current && current.type !== 'JSXElement') {
            current = current.parent;
        }
        return current;
    }
    // ENHANCED MODIFICATION APPLICATION
    applyModifications(batchResults) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log(`🔄 Step 4: Applying modifications with enhanced strategies`);
            const filesModified = new Set();
            let totalReplacements = 0;
            const diffs = [];
            // Group modifications by file
            const fileModifications = new Map();
            for (const batchResult of batchResults) {
                if (!batchResult.success)
                    continue;
                for (let i = 0; i < batchResult.modifications.length; i++) {
                    const modification = batchResult.modifications[i];
                    if (!modification.shouldApply)
                        continue;
                    const batch = this.batchStorage.get(batchResult.batchId);
                    if (!batch)
                        continue;
                    const node = batch.extractedNodes[modification.nodeIndex];
                    if (!node)
                        continue;
                    const filePath = node.absolutePath;
                    if (!fileModifications.has(filePath)) {
                        fileModifications.set(filePath, []);
                    }
                    fileModifications.get(filePath).push({
                        node,
                        modification
                    });
                }
            }
            // Apply modifications to each file
            for (const [filePath, modifications] of fileModifications.entries()) {
                try {
                    const originalContent = yield fs_1.promises.readFile(filePath, 'utf8');
                    let modifiedContent = originalContent;
                    // Sort modifications by line number (descending) to avoid position shifts
                    modifications.sort((a, b) => b.node.startLine - a.node.startLine);
                    for (const mod of modifications) {
                        modifiedContent = this.applyModificationToContent(modifiedContent, mod.node, mod.modification);
                        totalReplacements++;
                    }
                    yield this.logToFile('file-modifications', {
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
                    yield fs_1.promises.writeFile(filePath, modifiedContent, 'utf8');
                    const relativePath = filePath.replace(this.projectPath, '').replace(/^\//, '');
                    filesModified.add(relativePath);
                    // Generate diff if enabled
                    if (this.config.generateDiffs) {
                        const diffText = this.generateDiff(filePath, originalContent, modifiedContent);
                        diffs.push(diffText);
                    }
                    this.log(`✅ Applied ${modifications.length} modifications to ${relativePath}`);
                }
                catch (error) {
                    this.log(`❌ Failed to apply modifications to ${filePath}: ${error.message}`);
                }
            }
            return {
                filesModified: Array.from(filesModified),
                totalReplacements,
                diffs
            };
        });
    }
    // SMART MODIFICATION APPLICATION STRATEGY
    applyModificationToContent(content, node, modification) {
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
    applySnippetReplacement(content, originalSnippet, modifiedSnippet) {
        console.log(`[SNIPPET-REPLACE] Applying snippet replacement`);
        // Try exact replacement first
        if (content.includes(originalSnippet)) {
            console.log(`[SNIPPET-REPLACE] ✅ Exact match found`);
            return content.replace(originalSnippet, modifiedSnippet);
        }
        // Try normalized replacement
        const normalizeWhitespace = (str) => str.replace(/\s+/g, ' ').trim();
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
    applyFragmentedTextReplacement(content, node, modification) {
        console.log(`[FRAGMENTED-REPLACE] Applying fragmented text replacement`);
        if (!node.fullSequence || node.fullSequence.length === 0) {
            return content;
        }
        let modifiedContent = content;
        const replacementWords = modification.modifiedContent.split(/\s+/);
        let wordIndex = 0;
        // Replace text in each fragment
        for (const fragment of node.fullSequence) {
            if (wordIndex >= replacementWords.length)
                break;
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
    applyLineBasedModification(content, node, modification) {
        console.log(`[LINE-BASED] Applying line-based modification`);
        const lines = content.split('\n');
        const targetLineIndex = node.startLine - 1;
        if (targetLineIndex >= 0 && targetLineIndex < lines.length) {
            const originalLine = lines[targetLineIndex];
            if (originalLine.includes(modification.originalContent)) {
                lines[targetLineIndex] = originalLine.replace(modification.originalContent, modification.modifiedContent);
                console.log(`[LINE-BASED] ✅ Replaced in line ${node.startLine}`);
            }
            else {
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
    parseClaudeResponse(responseText) {
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in Claude response');
            }
            const parsed = JSON.parse(jsonMatch[0]);
            const modifications = (parsed.modifications || []).map((mod) => ({
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
        }
        catch (error) {
            console.log(`[PARSE-RESPONSE] Error parsing Claude response: ${error.message}`);
            return {
                modifications: [],
                overallStrategy: 'Fallback due to parsing error',
                batchConfidence: 0.3
            };
        }
    }
    createBatches(extractedNodes, searchTerm, replacementTerm, userPrompt) {
        const batches = [];
        const batchSize = this.config.maxBatchSize;
        for (let i = 0; i < extractedNodes.length; i += batchSize) {
            const batchNodes = extractedNodes.slice(i, i + batchSize);
            const batchId = `batch_${Math.floor(i / batchSize) + 1}`;
            const batch = {
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
    createSmartSearchStrategies(searchTerm) {
        const strategies = [];
        // Strategy 1: Full exact match
        strategies.push({
            name: 'full_exact',
            test: (content) => content.includes(searchTerm),
            confidence: 1.0
        });
        // Strategy 2: Case-insensitive full match
        strategies.push({
            name: 'full_case_insensitive',
            test: (content) => content.toLowerCase().includes(searchTerm.toLowerCase()),
            confidence: 0.95
        });
        // Strategy 3: Key phrases (for long search terms)
        const keyPhrases = this.extractKeyPhrases(searchTerm);
        strategies.push({
            name: 'key_phrases',
            test: (content) => {
                const foundPhrases = keyPhrases.filter(phrase => content.toLowerCase().includes(phrase.toLowerCase()));
                return foundPhrases.length >= Math.min(3, keyPhrases.length * 0.4);
            },
            confidence: 0.7
        });
        // Strategy 4: Word matching (60% of words must be present)
        const words = searchTerm.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        strategies.push({
            name: 'word_matching',
            test: (content) => {
                const contentLower = content.toLowerCase();
                const foundWords = words.filter(word => contentLower.includes(word));
                return foundWords.length >= Math.max(2, words.length * 0.6);
            },
            confidence: 0.6
        });
        return strategies;
    }
    extractKeyPhrases(searchTerm) {
        const words = searchTerm.toLowerCase().split(/\s+/);
        const keyPhrases = [];
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
    extractWithSmartRegex(file, content, lines, searchTerm) {
        const extractedNodes = [];
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
    convertToExtractedTextNode(node, file, lines, searchTerm) {
        var _a;
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
                fragmentCount: ((_a = node.fullSequence) === null || _a === void 0 ? void 0 : _a.length) || 1
            },
            fullSequence: node.fullSequence
        };
    }
    generateCodeFromPath(path) {
        try {
            const generated = (0, generator_1.default)(path.node, {
                retainLines: false,
                compact: false,
                concise: false
            });
            return generated.code;
        }
        catch (error) {
            console.log(`[GENERATE-CODE] Error: ${error}`);
            return '';
        }
    }
    extractJSXElementBoundaries(lines, node) {
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
    getFileType(filePath) {
        var _a;
        const ext = ((_a = filePath.split('.').pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
        const typeMap = {
            'tsx': 'react-typescript',
            'ts': 'typescript',
            'jsx': 'react-javascript',
            'js': 'javascript',
            'html': 'html',
            'css': 'css'
        };
        return typeMap[ext] || 'unknown';
    }
    extractContextLines(lines, lineIndex, contextSize, direction) {
        const context = [];
        if (direction === 'before') {
            for (let i = Math.max(0, lineIndex - contextSize); i < lineIndex; i++) {
                context.push(lines[i]);
            }
        }
        else {
            for (let i = lineIndex + 1; i < Math.min(lines.length, lineIndex + contextSize + 1); i++) {
                context.push(lines[i]);
            }
        }
        return context;
    }
    calculateAverageConfidence(batchResults) {
        const validResults = batchResults.filter(b => b.success);
        if (validResults.length === 0)
            return 0;
        const totalConfidence = validResults.reduce((sum, batch) => {
            const batchConfidence = batch.modifications.reduce((bSum, mod) => bSum + (mod.confidence || 0), 0) / Math.max(batch.modifications.length, 1);
            return sum + batchConfidence;
        }, 0);
        return totalConfidence / validResults.length;
    }
    generateDiff(filePath, originalContent, modifiedContent) {
        const originalLines = originalContent.split('\n');
        const modifiedLines = modifiedContent.split('\n');
        const diffLines = [];
        diffLines.push(`--- ${filePath}`);
        diffLines.push(`+++ ${filePath}`);
        for (let i = 0; i < Math.max(originalLines.length, modifiedLines.length); i++) {
            const originalLine = originalLines[i] || '';
            const modifiedLine = modifiedLines[i] || '';
            if (originalLine !== modifiedLine) {
                if (originalLine)
                    diffLines.push(`- ${originalLine}`);
                if (modifiedLine)
                    diffLines.push(`+ ${modifiedLine}`);
            }
        }
        return diffLines.join('\n');
    }
    createFailureResult(message) {
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
    escapeRegex(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    // PREVIEW METHODS
    previewChanges(userPrompt, searchTerm, replacementTerm) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log(`👀 Previewing changes for "${searchTerm}" → "${replacementTerm}"`);
            try {
                const files = yield this.discoverFiles(searchTerm);
                if (files.length === 0) {
                    return {
                        success: false,
                        previewNodes: [],
                        estimatedChanges: 0,
                        summary: 'No files found containing the search term'
                    };
                }
                const extractedNodes = yield this.extractTextNodesWithBabel(files, searchTerm);
                return {
                    success: true,
                    previewNodes: extractedNodes,
                    estimatedChanges: extractedNodes.length,
                    summary: `Found ${extractedNodes.length} text nodes in ${files.length} files that may be modified`
                };
            }
            catch (error) {
                return {
                    success: false,
                    previewNodes: [],
                    estimatedChanges: 0,
                    summary: `Preview failed: ${error.message}`
                };
            }
        });
    }
    // LEGACY COMPATIBILITY METHODS
    processWithCustomStrategy(userPrompt, searchTerm, replacementTerm, customStrategy) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.processText(userPrompt, searchTerm, replacementTerm);
        });
    }
    processWithClaude(extractedNodes, searchTerm, replacementTerm, userPrompt) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.processWithClaudeSnippets(extractedNodes, searchTerm, replacementTerm, userPrompt);
        });
    }
}
exports.EnhancedLLMRipgrepProcessor = EnhancedLLMRipgrepProcessor;
// FACTORY FUNCTIONS
function createHybridProcessor(projectPath, anthropic, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const processor = new EnhancedLLMRipgrepProcessor(projectPath, anthropic);
        // Set up streaming callback for real-time updates
        processor.setStreamCallback((message) => {
            console.log(`[HybridProcessor] ${message}`);
        });
        return processor;
    });
}
function processTextWithHybrid(options, userPrompt, searchTerm, replacementTerm) {
    return __awaiter(this, void 0, void 0, function* () {
        const processor = yield createHybridProcessor(options.projectPath, options.anthropic, options.config);
        if (options.streamCallback) {
            processor.setStreamCallback(options.streamCallback);
        }
        return processor.processText(userPrompt, searchTerm, replacementTerm);
    });
}
function processTextWithCustomStrategy(options, userPrompt, searchTerm, replacementTerm, customStrategy) {
    return __awaiter(this, void 0, void 0, function* () {
        const processor = yield createHybridProcessor(options.projectPath, options.anthropic, options.config);
        if (options.streamCallback) {
            processor.setStreamCallback(options.streamCallback);
        }
        return processor.processWithCustomStrategy(userPrompt, searchTerm, replacementTerm, customStrategy);
    });
}
// UTILITY FUNCTIONS
function createPreprocessorFilter(filters) {
    return (nodes) => {
        return nodes.filter(node => {
            var _a;
            if (filters.minRelevanceScore && node.relevanceScore < filters.minRelevanceScore) {
                return false;
            }
            if (filters.excludeNodeTypes && filters.excludeNodeTypes.includes(node.nodeType)) {
                return false;
            }
            if (filters.includeOnlyFileTypes) {
                const fileType = (_a = node.filePath.split('.').pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase();
                if (!fileType || !filters.includeOnlyFileTypes.includes(fileType)) {
                    return false;
                }
            }
            return true;
        });
    };
}
function createPostprocessorReporter(options = {}) {
    return (result) => {
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
class ProcessorUtils {
    static extractTermsFromPrompt(prompt) {
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
    static validateEnvironment() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Test fast-glob availability
                yield (0, fast_glob_1.default)(['*.nonexistent'], { cwd: process.cwd(), suppressErrors: true });
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
            }
            catch (error) {
                return {
                    available: false,
                    error: `Environment validation failed: ${error.message}`
                };
            }
        });
    }
}
exports.ProcessorUtils = ProcessorUtils;
//# sourceMappingURL=text-modifier.js.map