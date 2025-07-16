"use strict";
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
exports.OptimizedBatchProcessor = exports.TargetedNodesProcessor = exports.GranularASTProcessor = exports.BatchASTProcessor = exports.TwoPhaseASTProcessor = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const parser_1 = require("@babel/parser");
const traverse_1 = __importDefault(require("@babel/traverse"));
const crypto = __importStar(require("crypto"));
// ============================================================================
// TOKEN TRACKER
// ============================================================================
class TokenTracker {
    constructor() {
        this.totalInputTokens = 0;
        this.totalOutputTokens = 0;
        this.apiCalls = 0;
    }
    logUsage(usage, operation) {
        this.totalInputTokens += usage.input_tokens || 0;
        this.totalOutputTokens += usage.output_tokens || 0;
        this.apiCalls++;
        console.log(`[TOKEN] ${operation}: ${usage.input_tokens || 0} in, ${usage.output_tokens || 0} out`);
    }
    getStats() {
        return {
            totalTokens: this.totalInputTokens + this.totalOutputTokens,
            inputTokens: this.totalInputTokens,
            outputTokens: this.totalOutputTokens,
            apiCalls: this.apiCalls
        };
    }
    reset() {
        this.totalInputTokens = 0;
        this.totalOutputTokens = 0;
        this.apiCalls = 0;
    }
}
// ============================================================================
// COMPLETE DYNAMIC AST ANALYZER
// ============================================================================
class DynamicASTAnalyzer {
    constructor() {
        this.nodeCache = new Map();
        // Store full node cache
        this.fileNodeCache = new Map();
    }
    setStreamCallback(callback) {
        this.streamCallback = callback;
    }
    streamUpdate(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
    }
    createStableNodeId(node, content, index) {
        var _a, _b, _c, _d;
        const tagName = ((_b = (_a = node.openingElement) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b.name) || 'unknown';
        const startLine = ((_c = node.loc) === null || _c === void 0 ? void 0 : _c.start.line) || 1;
        const startColumn = ((_d = node.loc) === null || _d === void 0 ? void 0 : _d.start.column) || 0;
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
    calculatePosition(node, content) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const lines = content.split('\n');
        const startLine = (((_b = (_a = node.loc) === null || _a === void 0 ? void 0 : _a.start) === null || _b === void 0 ? void 0 : _b.line) || 1) - 1;
        const endLine = (((_d = (_c = node.loc) === null || _c === void 0 ? void 0 : _c.end) === null || _d === void 0 ? void 0 : _d.line) || 1) - 1;
        const startColumn = ((_f = (_e = node.loc) === null || _e === void 0 ? void 0 : _e.start) === null || _f === void 0 ? void 0 : _f.column) || 0;
        const endColumn = ((_h = (_g = node.loc) === null || _g === void 0 ? void 0 : _g.end) === null || _h === void 0 ? void 0 : _h.column) || 0;
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
        }
        else if (lineBasedStart >= 0 && lineBasedEnd > lineBasedStart && lineBasedEnd <= content.length) {
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
    // UNIVERSAL: Extract elements from any file
    extractElementData(node, content) {
        var _a, _b, _c, _d, _e;
        const props = {};
        let isInteractive = false;
        // Extract all props
        if ((_a = node.openingElement) === null || _a === void 0 ? void 0 : _a.attributes) {
            for (const attr of node.openingElement.attributes) {
                if (attr.type === 'JSXAttribute' && ((_b = attr.name) === null || _b === void 0 ? void 0 : _b.name)) {
                    const propName = attr.name.name;
                    if (((_c = attr.value) === null || _c === void 0 ? void 0 : _c.type) === 'StringLiteral') {
                        props[propName] = attr.value.value;
                    }
                    else if (((_d = attr.value) === null || _d === void 0 ? void 0 : _d.type) === 'JSXExpressionContainer') {
                        if (((_e = attr.value.expression) === null || _e === void 0 ? void 0 : _e.type) === 'Identifier') {
                            props[propName] = `{${attr.value.expression.name}}`;
                        }
                        else {
                            props[propName] = '{...}';
                        }
                    }
                    else if (!attr.value) {
                        props[propName] = true;
                    }
                    // Detect interactivity
                    if (propName.startsWith('on') || propName === 'href' || propName === 'to') {
                        isInteractive = true;
                    }
                }
            }
        }
        // Extract all text content
        let displayText;
        if (node.children) {
            const extractText = (child, depth = 0) => {
                var _a, _b;
                if (!child || depth > 5)
                    return '';
                if (child.type === 'JSXText') {
                    return child.value.trim();
                }
                else if (child.type === 'JSXExpressionContainer') {
                    if (((_a = child.expression) === null || _a === void 0 ? void 0 : _a.type) === 'StringLiteral') {
                        return child.expression.value;
                    }
                    else if (((_b = child.expression) === null || _b === void 0 ? void 0 : _b.type) === 'Identifier') {
                        return `{${child.expression.name}}`;
                    }
                }
                else if (child.type === 'JSXElement' && child.children) {
                    return child.children
                        .map((grandChild) => extractText(grandChild, depth + 1))
                        .filter((text) => text.trim().length > 0)
                        .join(' ');
                }
                return '';
            };
            const allText = node.children
                .map((child) => extractText(child))
                .filter((text) => text.trim().length > 0)
                .join(' ')
                .trim();
            if (allText) {
                displayText = allText.length > 100 ? allText.substring(0, 97) + '...' : allText;
            }
        }
        return { displayText, props, isInteractive };
    }
    parseAndCacheNodes(filePath, content) {
        const cacheKey = `${filePath}_${content.length}`;
        if (this.nodeCache.has(cacheKey)) {
            return this.nodeCache.get(cacheKey);
        }
        try {
            const ast = (0, parser_1.parse)(content, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript'],
                ranges: true
            });
            const nodes = [];
            let nodeIndex = 0;
            const parentStack = [];
            (0, traverse_1.default)(ast, {
                JSXElement: {
                    enter: (path) => {
                        var _a, _b, _c, _d, _e, _f;
                        const node = path.node;
                        nodeIndex++;
                        let tagName = 'unknown';
                        if (((_b = (_a = node.openingElement) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b.type) === 'JSXIdentifier') {
                            tagName = node.openingElement.name.name;
                        }
                        else if (((_d = (_c = node.openingElement) === null || _c === void 0 ? void 0 : _c.name) === null || _d === void 0 ? void 0 : _d.type) === 'JSXMemberExpression') {
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
                                startLine: ((_e = parent.loc) === null || _e === void 0 ? void 0 : _e.start.line) || 1,
                                endLine: ((_f = parent.loc) === null || _f === void 0 ? void 0 : _f.end.line) || 1
                            };
                        }
                        const enhancedNode = Object.assign(Object.assign({}, node), { _id: stableId, _tagName: tagName, _index: nodeIndex, _filePath: filePath, _parentInfo: parentInfo });
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
        }
        catch (error) {
            this.streamUpdate(`❌ Parsing failed: ${error}`);
            return [];
        }
    }
    // PHASE 1: Extract minimal data for analysis
    extractMinimalNodes(filePath, projectFiles) {
        var _a, _b;
        if (!filePath.match(/\.(tsx?|jsx?)$/i)) {
            return [];
        }
        const file = projectFiles.get(filePath);
        if (!file) {
            return [];
        }
        const nodes = this.parseAndCacheNodes(filePath, file.content);
        const minimalNodes = [];
        for (const node of nodes) {
            const { displayText, props, isInteractive } = this.extractElementData(node, file.content);
            const minimalNode = {
                id: node._id,
                tagName: node._tagName,
                className: props.className,
                startLine: ((_a = node.loc) === null || _a === void 0 ? void 0 : _a.start.line) || 1,
                endLine: ((_b = node.loc) === null || _b === void 0 ? void 0 : _b.end.line) || 1,
                displayText,
                props,
                isInteractive
            };
            minimalNodes.push(minimalNode);
        }
        return minimalNodes;
    }
    // PHASE 2: Extract full nodes for modification
    extractFullNodes(filePath, nodeIds, projectFiles) {
        var _a, _b, _c, _d;
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
                const fullNode = {
                    id: node._id,
                    tagName: node._tagName,
                    className: props.className,
                    startLine: ((_a = node.loc) === null || _a === void 0 ? void 0 : _a.start.line) || 1,
                    endLine: ((_b = node.loc) === null || _b === void 0 ? void 0 : _b.end.line) || 1,
                    startColumn: ((_c = node.loc) === null || _c === void 0 ? void 0 : _c.start.column) || 0,
                    endColumn: ((_d = node.loc) === null || _d === void 0 ? void 0 : _d.end.column) || 0,
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
        const result = [];
        for (const nodeId of nodeIds) {
            const node = fullNodesMap.get(nodeId);
            if (node) {
                result.push(node);
            }
        }
        return result;
    }
    // Generate compact tree for AI
    generateCompactTree(files) {
        return files.map(file => {
            const nodeList = file.nodes.map(node => {
                const className = node.className ? `.${node.className.split(' ')[0]}` : '';
                const text = node.displayText ? `"${node.displayText}"` : '';
                const hasHandlers = Object.keys(node.props || {}).some(key => key.startsWith('on')) ? '{interactive}' : '';
                const lines = `(L${node.startLine}${node.endLine !== node.startLine ? `-${node.endLine}` : ''})`;
                return `${node.id}:${node.tagName}${className}${text}${hasHandlers}${lines}`;
            }).join('\n    ');
            return `📁 ${file.filePath}:\n    ${nodeList}`;
        }).join('\n\n');
    }
    clearCache() {
        this.nodeCache.clear();
        this.fileNodeCache.clear();
    }
}
// ============================================================================
// COMPLETE TWO-PHASE AST PROCESSOR
// ============================================================================
class TwoPhaseASTProcessor {
    constructor(anthropic, reactBasePath) {
        this.anthropic = anthropic;
        this.tokenTracker = new TokenTracker();
        this.astAnalyzer = new DynamicASTAnalyzer();
        this.reactBasePath = (reactBasePath || process.cwd()).replace(/builddora/g, 'buildora');
    }
    setStreamCallback(callback) {
        this.streamCallback = callback;
        this.astAnalyzer.setStreamCallback(callback);
    }
    streamUpdate(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
        console.log(message);
    }
    // Main processing method
    processBatchModification(prompt, projectFiles, reactBasePath, streamCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            this.setStreamCallback(streamCallback);
            if (reactBasePath) {
                this.reactBasePath = reactBasePath.replace(/builddora/g, 'buildora');
            }
            // Clear cache at start
            this.astAnalyzer.clearCache();
            try {
                this.streamUpdate(`🚀 TWO-PHASE: Starting processing...`);
                // PHASE 1: Build minimal AST tree
                this.streamUpdate(`📋 PHASE 1: Building minimal AST tree...`);
                const fileStructures = this.buildMinimalTree(projectFiles);
                if (fileStructures.length === 0) {
                    this.streamUpdate(`❌ No relevant files found`);
                    return { success: false, changes: [] };
                }
                const totalNodes = fileStructures.reduce((sum, f) => sum + f.nodes.length, 0);
                this.streamUpdate(`✅ Built tree: ${fileStructures.length} files, ${totalNodes} nodes`);
                // PHASE 1: AI Analysis
                this.streamUpdate(`🧠 PHASE 1: Sending tree for AI analysis...`);
                const analysisResult = yield this.analyzeTree(prompt, fileStructures);
                if (!analysisResult.needsModification || analysisResult.targetNodes.length === 0) {
                    this.streamUpdate(`⏭️ No modifications needed: ${analysisResult.reasoning}`);
                    return {
                        success: false,
                        changes: [{
                                type: 'analysis_complete',
                                file: 'system',
                                description: `Analysis complete - no changes needed: ${analysisResult.reasoning}`,
                                success: true,
                                details: { totalFiles: fileStructures.length, totalNodes }
                            }]
                    };
                }
                this.streamUpdate(`✅ AI identified ${analysisResult.targetNodes.length} nodes for modification`);
                // PHASE 2: Extract and modify
                this.streamUpdate(`🔧 PHASE 2: Extracting full nodes and applying modifications...`);
                const modificationResults = yield this.extractAndModify(analysisResult.targetNodes, projectFiles, prompt);
                const changes = this.buildChangeReport(modificationResults, fileStructures, analysisResult);
                const successCount = modificationResults.filter(r => r.success).length;
                this.streamUpdate(`\n🎉 TWO-PHASE COMPLETE!`);
                this.streamUpdate(`   ✅ Modified: ${successCount}/${modificationResults.length} files`);
                this.streamUpdate(`   📊 Total nodes processed: ${totalNodes}`);
                const tokenStats = this.tokenTracker.getStats();
                this.streamUpdate(`💰 Tokens used: ${tokenStats.totalTokens} (${tokenStats.apiCalls} API calls)`);
                return {
                    success: successCount > 0,
                    updatedProjectFiles: projectFiles,
                    projectFiles: projectFiles,
                    changes: changes
                };
            }
            catch (error) {
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
        });
    }
    // PHASE 1: Build minimal AST tree
    buildMinimalTree(projectFiles) {
        const fileStructures = [];
        for (const [filePath, projectFile] of projectFiles) {
            if (!this.shouldAnalyzeFile(filePath)) {
                continue;
            }
            const nodes = this.astAnalyzer.extractMinimalNodes(filePath, projectFiles);
            if (nodes.length === 0) {
                continue;
            }
            const normalizedPath = projectFile.relativePath || this.normalizeFilePath(filePath);
            fileStructures.push({
                filePath: normalizedPath,
                nodes
            });
            this.streamUpdate(`📄 ${normalizedPath}: ${nodes.length} nodes`);
        }
        return fileStructures;
    }
    // PHASE 1: AI analysis of minimal tree
    analyzeTree(userRequest, fileStructures) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const compactTree = this.astAnalyzer.generateCompactTree(fileStructures);
            const analysisPrompt = `
TASK: Analyze the project tree and identify nodes that need modification.

USER REQUEST: "${userRequest}"

PROJECT TREE:
${compactTree}

FORMAT: nodeId:tagName.className"displayText"(LineNumbers)

INSTRUCTIONS:
1. Identify which specific nodes need modification for the user request
2. Focus on tagName, className, and displayText to understand each node
3. Return ONLY nodes that actually need changes
4. Use exact nodeId from the tree

RESPONSE FORMAT (JSON):
{
  "needsModification": true/false,
  "targetNodes": [
    {
      "filePath": "src/pages/Home.tsx",
      "nodeId": "A1b2C3d4E5f6",
      "reason": "Description of needed change"
    }
  ],
  "reasoning": "Overall explanation"
}

ANALYSIS:`;
            try {
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 2000,
                    temperature: 0.1,
                    messages: [{ role: 'user', content: analysisPrompt }],
                });
                this.tokenTracker.logUsage(response.usage, `Phase 1: Tree Analysis`);
                const responseText = ((_a = response.content[0]) === null || _a === void 0 ? void 0 : _a.text) || '';
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const analysis = JSON.parse(jsonMatch[0]);
                    this.streamUpdate(`📊 Analysis: ${analysis.needsModification ? 'NEEDS CHANGES' : 'NO CHANGES'}`);
                    this.streamUpdate(`🎯 Target nodes: ${(analysis.targetNodes || []).length}`);
                    return {
                        needsModification: analysis.needsModification || false,
                        targetNodes: analysis.targetNodes || [],
                        reasoning: analysis.reasoning || 'Analysis completed'
                    };
                }
                else {
                    throw new Error('No valid JSON response from AI');
                }
            }
            catch (error) {
                this.streamUpdate(`❌ Analysis error: ${error}`);
                return {
                    needsModification: false,
                    targetNodes: [],
                    reasoning: `Analysis error: ${error}`
                };
            }
        });
    }
    // PHASE 2: Extract and modify nodes
    extractAndModify(targetNodes, projectFiles, userRequest) {
        return __awaiter(this, void 0, void 0, function* () {
            // Group by file
            const nodesByFile = new Map();
            for (const target of targetNodes) {
                const actualKey = this.findFileKey(target.filePath, projectFiles);
                if (!actualKey) {
                    this.streamUpdate(`❌ File not found: ${target.filePath}`);
                    continue;
                }
                if (!nodesByFile.has(actualKey)) {
                    nodesByFile.set(actualKey, []);
                }
                nodesByFile.get(actualKey).push({ nodeId: target.nodeId, reason: target.reason });
            }
            const results = [];
            // Process each file
            for (const [actualFileKey, fileTargets] of nodesByFile) {
                try {
                    const file = projectFiles.get(actualFileKey);
                    const displayPath = (file === null || file === void 0 ? void 0 : file.relativePath) || actualFileKey;
                    this.streamUpdate(`🔍 Extracting full nodes for ${fileTargets.length} targets in ${displayPath}...`);
                    const nodeIds = fileTargets.map(t => t.nodeId);
                    this.streamUpdate(`🔍 Extracting full nodes for ${fileTargets.length} targets...`);
                    const fullNodes = this.astAnalyzer.extractFullNodes(actualFileKey, nodeIds, projectFiles);
                    this.streamUpdate(`📊 DEBUG: Found ${fullNodes.length} full nodes for IDs: ${nodeIds.join(', ')}`);
                    if (fullNodes.length === 0) {
                        results.push({
                            filePath: displayPath,
                            success: false,
                            modificationsApplied: 0,
                            error: 'No full nodes extracted'
                        });
                        continue;
                    }
                    this.streamUpdate(`✅ Extracted ${fullNodes.length} full nodes`);
                    // Generate modifications
                    const modifications = yield this.generateModifications(fullNodes, fileTargets, userRequest, displayPath);
                    this.streamUpdate(`📊 DEBUG: Generating modifications for ${fullNodes.length} nodes`);
                    if (modifications.length === 0) {
                        results.push({
                            filePath: displayPath,
                            success: false,
                            modificationsApplied: 0,
                            error: 'No modifications generated'
                        });
                        continue;
                    }
                    // Apply modifications
                    const applyResult = yield this.applyModificationsFixed(modifications, actualFileKey, projectFiles, fullNodes);
                    this.streamUpdate(`📊 DEBUG: Applying ${modifications.length} modifications`);
                    results.push({
                        filePath: displayPath,
                        success: applyResult.success,
                        modificationsApplied: applyResult.modificationsApplied,
                        error: applyResult.error
                    });
                }
                catch (error) {
                    const file = projectFiles.get(actualFileKey);
                    const displayPath = (file === null || file === void 0 ? void 0 : file.relativePath) || actualFileKey;
                    results.push({
                        filePath: displayPath,
                        success: false,
                        modificationsApplied: 0,
                        error: `${error}`
                    });
                }
            }
            return results;
        });
    }
    // Enhanced AI modification generation with better prompts
    generateModifications(fullNodes, targets, userRequest, filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
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
REASON: ${(target === null || target === void 0 ? void 0 : target.reason) || 'modification needed'}
CURRENT CODE:
${node.fullCode}
`;
            }).join('\n---\n');
            const modificationPrompt = `You are an EXPERT JSX CODE TRANSFORMER with advanced visual design capabilities. You specialize in comprehensive UI modifications that go beyond simple text changes.

USER REQUEST: "${userRequest}"
FILE: ${filePath}

NODES TO MODIFY WITH FULL CONTEXT:
${nodeDetails}

🎨 COMPREHENSIVE MODIFICATION INSTRUCTIONS:

1. **VISUAL TRANSFORMATION PRIORITY**:
   - When user requests color changes, modify BOTH text content AND visual styling
   - Apply changes to className, style props, and CSS classes
   - Consider the ENTIRE visual appearance, not just text

2. **INTELLIGENT COLOR MAPPING - OVERRIDE TAILWIND CONFIG**:
   - ⚠️ CRITICAL: If element uses Tailwind classes, REMOVE them and use inline styles instead
   - Tailwind config may have custom colors that don't match user expectations
   - "blue" → style={{backgroundColor: '#3B82F6', color: 'white'}} (true blue, not config blue)
   - "red" → style={{backgroundColor: '#EF4444', color: 'white'}} (true red)
   - "green" → style={{backgroundColor: '#10B981', color: 'white'}} (true green)
   - Add hover effects with onMouseEnter/onMouseLeave for true colors

3. **BUTTON-SPECIFIC TRANSFORMATIONS - INLINE STYLE PRIORITY**:
   - ALWAYS use inline styles for colors to override any Tailwind configuration
   - Remove ALL Tailwind color classes (bg-*, text-*, border-* colors)
   - Keep layout classes (flex, grid, p-*, m-*, rounded-*) but override colors
   - Apply inline styles: backgroundColor, color, borderColor
   - Ensure text remains readable with proper contrast

4. **COMPREHENSIVE STYLE UPDATES - BYPASS TAILWIND CONFIG**:
   - Replace Tailwind color classes with inline style objects
   - Use standard web colors that match user expectations
   - Remove conflicting Tailwind classes entirely
   - Maintain responsive design with Tailwind layout classes only
   - Preserve accessibility with proper contrast ratios

5. **ADVANCED PATTERN RECOGNITION**:
   - "change [element] to [color]" = Full visual transformation
   - "make [element] [color]" = Complete color scheme update
   - "update [element] color" = Comprehensive styling change

6. **STYLE CLASS INTELLIGENCE**:
   - Analyze existing className for current color scheme
   - Replace entire color families (primary-* → blue-*, accent-* → green-*)
   - Maintain design system consistency
   - Preserve layout classes (flex, grid, spacing)

🔧 TECHNICAL REQUIREMENTS:

- Return COMPLETE, VALID JSX with full styling applied
- Preserve ALL existing functionality and event handlers
- Maintain semantic HTML structure
- Apply modern Tailwind CSS best practices
- Ensure cross-browser compatibility

📐 EXAMPLE TRANSFORMATIONS - INLINE STYLE PRIORITY:

OLD: className="bg-primary-600 hover:bg-primary-700 text-white"
NEW: className="px-6 py-2 rounded-lg font-semibold transition-colors" style={{backgroundColor: '#3B82F6', color: 'white'}}

OLD: <Button variant="outline" className="bg-blue-500">Order Now</Button>  
NEW: <Button className="px-6 py-2 rounded-lg font-semibold transition-colors" style={{backgroundColor: '#3B82F6', color: 'white', border: '2px solid #3B82F6'}} onMouseEnter={(e) => e.target.style.backgroundColor = '#2563EB'} onMouseLeave={(e) => e.target.style.backgroundColor = '#3B82F6'}>Order Now</Button>

OLD: className="btn-primary text-blue-600"
NEW: className="px-4 py-2 rounded-md font-medium" style={{backgroundColor: '#3B82F6', color: 'white'}}

🎨 COLOR REFERENCE (Use these exact hex values):
- Blue: #3B82F6 (background), #2563EB (hover), #1D4ED8 (active)
- Red: #EF4444 (background), #DC2626 (hover), #B91C1C (active)  
- Green: #10B981 (background), #059669 (hover), #047857 (active)
- Yellow: #F59E0B (background), #D97706 (hover), #B45309 (active)
- Purple: #8B5CF6 (background), #7C3AED (hover), #6D28D9 (active)

You must respond with ONLY a valid JSON object in this exact format:

{
  "modifications": [
    {
      "filePath": "${filePath}",
      "nodeId": "exact_node_id_from_above",
      "newCode": "complete JSX element with comprehensive visual styling applied",
      "reasoning": "detailed explanation of all visual changes applied, including specific color classes, hover states, and design improvements made"
    }
  ]
}

⚡ CRITICAL: Focus on VISUAL IMPACT with TRUE COLORS. When user requests color changes:
1. REMOVE all Tailwind color classes (bg-*, text-*, border-* colors)
2. USE inline styles with exact hex colors that match user expectations  
3. IGNORE Tailwind configuration - it may have custom colors
4. ENSURE the color is unmistakably the requested color (true blue, not config blue)
5. Transform the ENTIRE appearance, not just text content!

Do not include any text before or after the JSON object.`;
            try {
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 4000,
                    temperature: 0.1,
                    messages: [{ role: 'user', content: modificationPrompt }],
                });
                this.tokenTracker.logUsage(response.usage, `Phase 2: Code Modification Generation`);
                const responseText = ((_a = response.content[0]) === null || _a === void 0 ? void 0 : _a.text) || '';
                // Extract JSON from response
                let jsonData = null;
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        jsonData = JSON.parse(jsonMatch[0]);
                    }
                    catch (parseError) {
                        this.streamUpdate(`⚠️ JSON parse error: ${parseError}`);
                    }
                }
                if (jsonData && jsonData.modifications) {
                    this.streamUpdate(`✅ Generated ${jsonData.modifications.length} modifications`);
                    return jsonData.modifications;
                }
                else {
                    this.streamUpdate(`⚠️ No valid JSON found, generating fallback modifications`);
                    return this.generateFallbackModifications(fullNodes, targets, userRequest, filePath);
                }
            }
            catch (error) {
                this.streamUpdate(`❌ Modification generation error: ${error}`);
                return this.generateFallbackModifications(fullNodes, targets, userRequest, filePath);
            }
        });
    }
    // Fallback modification generation
    generateFallbackModifications(fullNodes, targets, userRequest, filePath) {
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
    // Enhanced modification application with multiple strategies
    applyModificationsFixed(modifications, fileKey, projectFiles, fullNodes) {
        return __awaiter(this, void 0, void 0, function* () {
            const projectFile = projectFiles.get(fileKey);
            const displayPath = (projectFile === null || projectFile === void 0 ? void 0 : projectFile.relativePath) || fileKey;
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
            // Sort modifications by position (reverse order to avoid offset issues)
            const sortedMods = modifications
                .map(mod => (Object.assign(Object.assign({}, mod), { node: fullNodes.find(n => n.id === mod.nodeId) })))
                .filter(mod => mod.node)
                .sort((a, b) => {
                const aPos = a.node.lineBasedStart || a.node.startPos;
                const bPos = b.node.lineBasedStart || b.node.startPos;
                return bPos - aPos;
            });
            // Apply each modification with multiple strategies
            for (const mod of sortedMods) {
                const node = mod.node;
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
                    }
                    catch (regexError) {
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
                }
                else {
                    this.streamUpdate(`   ❌ Failed to apply modification for ${node.id}`);
                }
            }
            // Write file if modifications applied
            if (appliedCount > 0) {
                try {
                    const actualPath = this.resolveFilePath(projectFile);
                    yield fs_1.promises.writeFile(actualPath, content, 'utf8');
                    // Update in-memory file
                    projectFile.content = content;
                    projectFile.lines = content.split('\n').length;
                    projectFile.size = content.length;
                    this.streamUpdate(`💾 Saved ${appliedCount}/${modifications.length} modifications to ${displayPath}`);
                }
                catch (writeError) {
                    this.streamUpdate(`💥 Write error: ${writeError}`);
                    return { filePath: displayPath, success: false, modificationsApplied: 0, error: `Write failed: ${writeError}` };
                }
            }
            return { filePath: displayPath, success: appliedCount > 0, modificationsApplied: appliedCount };
        });
    }
    // Helper methods
    escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\      if (jsonData');
    }
    calculateSimilarity(str1, str2) {
        if (str1 === str2)
            return 1.0;
        if (str1.length === 0 || str2.length === 0)
            return 0.0;
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        if (longer.length === 0)
            return 1.0;
        let matches = 0;
        const maxLength = Math.max(str1.length, str2.length);
        for (let i = 0; i < shorter.length; i++) {
            if (str1[i] === str2[i])
                matches++;
        }
        return matches / maxLength;
    }
    buildChangeReport(applyResults, fileStructures, analysisResult) {
        const changes = [];
        // Add summary
        changes.push({
            type: 'two_phase_analysis',
            file: 'system',
            description: `Two-phase processing: ${fileStructures.length} files, ${fileStructures.reduce((sum, f) => sum + f.nodes.length, 0)} nodes analyzed`,
            success: true,
            details: {
                filesAnalyzed: fileStructures.length,
                totalNodes: fileStructures.reduce((sum, f) => sum + f.nodes.length, 0),
                targetNodesIdentified: analysisResult.targetNodes.length,
                reasoning: analysisResult.reasoning
            }
        });
        // Add file results
        for (const result of applyResults) {
            if (result.success) {
                changes.push({
                    type: 'file_modified',
                    file: result.filePath,
                    description: `Applied ${result.modificationsApplied} modifications`,
                    success: true,
                    details: {
                        modificationsApplied: result.modificationsApplied
                    }
                });
            }
            else {
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
    findFileKey(relativePath, projectFiles) {
        var _a;
        // Normalize the target path
        const normalizedTarget = relativePath.replace(/\\/g, '/');
        // Direct match
        if (projectFiles.has(relativePath)) {
            return relativePath;
        }
        // Try normalized version
        for (const [key, file] of projectFiles) {
            const normalizedKey = key.replace(/\\/g, '/');
            const normalizedFileRelative = (_a = file.relativePath) === null || _a === void 0 ? void 0 : _a.replace(/\\/g, '/');
            if (normalizedKey === normalizedTarget ||
                normalizedFileRelative === normalizedTarget ||
                normalizedKey.endsWith('/' + normalizedTarget) ||
                (normalizedFileRelative === null || normalizedFileRelative === void 0 ? void 0 : normalizedFileRelative.endsWith('/' + normalizedTarget))) {
                return key;
            }
        }
        // Fallback: exact filename match (TypeScript-safe)
        const targetFilename = normalizedTarget.split('/').pop();
        if (targetFilename) { // ✅ Check if targetFilename exists
            for (const [key, file] of projectFiles) {
                if (key.includes(targetFilename) ||
                    (file.relativePath && file.relativePath.includes(targetFilename))) { // ✅ Safe check
                    return key;
                }
            }
        }
        return null;
    }
    resolveFilePath(projectFile) {
        if ((0, path_1.isAbsolute)(projectFile.path)) {
            return projectFile.path.replace(/builddora/g, 'buildora');
        }
        if (projectFile.relativePath) {
            return (0, path_1.join)(this.reactBasePath, projectFile.relativePath);
        }
        return projectFile.path.replace(/builddora/g, 'buildora');
    }
    normalizeFilePath(filePath) {
        return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
    }
    shouldAnalyzeFile(filePath) {
        return filePath.match(/\.(tsx?|jsx?)$/i) !== null;
    }
    // Backward compatibility methods
    processTargetedModification(prompt, projectFiles, reactBasePath, streamCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.processBatchModification(prompt, projectFiles, reactBasePath, streamCallback);
        });
    }
    process(prompt, projectFiles, reactBasePath, streamCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.processBatchModification(prompt, projectFiles, reactBasePath, streamCallback);
        });
    }
    getTokenTracker() {
        return this.tokenTracker;
    }
}
exports.TwoPhaseASTProcessor = TwoPhaseASTProcessor;
exports.BatchASTProcessor = TwoPhaseASTProcessor;
exports.GranularASTProcessor = TwoPhaseASTProcessor;
exports.TargetedNodesProcessor = TwoPhaseASTProcessor;
exports.OptimizedBatchProcessor = TwoPhaseASTProcessor;
// Exports
exports.default = TwoPhaseASTProcessor;
//# sourceMappingURL=TargettedNodes.js.map