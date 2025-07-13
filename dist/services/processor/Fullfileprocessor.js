"use strict";
// ============================================================================
// UPGRADED FULL FILE PROCESSOR - WITH TAILWIND CONFIG AUTO-SELECTION
// ============================================================================
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FullFileProcessor = void 0;
const path_1 = require("path");
const fs_1 = require("fs");
const template_1 = require("../filemodifier/template");
// ============================================================================
// ENHANCED FILE ANALYZER WITH TAILWIND CONFIG
// ============================================================================
class EnhancedFileAnalyzer {
    constructor(anthropic) {
        this.anthropic = anthropic;
    }
    analyzeFiles(prompt, projectFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // ALWAYS include Tailwind config for color/styling context
            const tailwindConfig = this.findTailwindConfig(projectFiles);
            // Create detailed file summaries
            const fileSummaries = Array.from(projectFiles.entries())
                .map(([path, file]) => {
                const purpose = this.inferFilePurpose(file);
                const preview = file.content.substring(0, 200).replace(/\n/g, ' ');
                return `${path} (${file.lines} lines) - ${purpose}\n  Preview: ${preview}...`;
            })
                .join('\n\n');
            const tailwindContext = tailwindConfig ? `
TAILWIND CONFIG FOUND: ${tailwindConfig.path}
TAILWIND COLORS/TOKENS:
${this.extractTailwindTokens(tailwindConfig.content)}
` : 'NO TAILWIND CONFIG FOUND';
            const analysisPrompt = `
TASK: Analyze which files need modification for the user request.

USER REQUEST: "${prompt}"

${tailwindContext}

AVAILABLE FILES:
${fileSummaries}

INSTRUCTIONS:
1. ALWAYS include tailwind.config.js/ts if it exists (for color/styling context)
2. Select ONLY files that need modification for the specific request
3. Be selective - don't modify unnecessary files
4. Focus on main components and relevant files
5. For layout changes: select all components and pages (not app.tsx unless routing)
6. For color/styling changes: select all components and pages + tailwind.config.js
7. For functionality changes: select relevant components and any config files
8. Provide clear reasoning for each selection

RESPONSE FORMAT:
Return a JSON array:
[
  {
    "filePath": "tailwind.config.js",
    "relevanceScore": 95,
    "reasoning": "Always include for styling context and available colors",
    "changeType": ["config", "styling"],
    "priority": "high"
  },
  {
    "filePath": "src/App.tsx",
    "relevanceScore": 85,
    "reasoning": "This file needs modification because...",
    "changeType": ["styling", "layout"],
    "priority": "high"
  }
]

ANALYSIS:`;
            try {
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 4000,
                    temperature: 0.1,
                    messages: [{ role: 'user', content: analysisPrompt }],
                });
                const responseText = ((_a = response.content[0]) === null || _a === void 0 ? void 0 : _a.text) || '';
                const jsonMatch = responseText.match(/\[[\s\S]*\]/);
                if (!jsonMatch) {
                    return this.getFallbackFileSelection(prompt, projectFiles, tailwindConfig);
                }
                const analysisResults = JSON.parse(jsonMatch[0]);
                const relevantFiles = [];
                // Process analysis results
                for (const result of analysisResults) {
                    const file = this.findFileInProject(result.filePath, projectFiles);
                    if (file) {
                        relevantFiles.push({
                            filePath: result.filePath,
                            file,
                            relevanceScore: result.relevanceScore || 50,
                            reasoning: result.reasoning || 'Selected by analysis',
                            changeType: result.changeType || ['general'],
                            priority: result.priority || 'medium'
                        });
                    }
                }
                // CRITICAL: Always ensure Tailwind config is included if it exists
                const hasTailwindConfig = relevantFiles.some(f => f.filePath.includes('tailwind.config'));
                if (tailwindConfig && !hasTailwindConfig) {
                    relevantFiles.unshift({
                        filePath: tailwindConfig.path,
                        file: tailwindConfig.file,
                        relevanceScore: 95,
                        reasoning: 'Auto-included: Essential for styling context and available colors',
                        changeType: ['config', 'styling'],
                        priority: 'high'
                    });
                }
                return relevantFiles;
            }
            catch (error) {
                return this.getFallbackFileSelection(prompt, projectFiles, tailwindConfig);
            }
        });
    }
    /**
     * FIND TAILWIND CONFIG FILE
     */
    findTailwindConfig(projectFiles) {
        const tailwindPatterns = [
            'tailwind.config.js',
            'tailwind.config.ts',
            'tailwind.config.mjs',
            'tailwind.config.cjs',
            'src/tailwind.config.js',
            'src/tailwind.config.ts'
        ];
        for (const pattern of tailwindPatterns) {
            const file = projectFiles.get(pattern);
            if (file) {
                return {
                    path: pattern,
                    file,
                    content: file.content
                };
            }
        }
        // Try case-insensitive search
        for (const [path, file] of projectFiles) {
            if (path.toLowerCase().includes('tailwind.config')) {
                return {
                    path,
                    file,
                    content: file.content
                };
            }
        }
        return null;
    }
    /**
     * EXTRACT TAILWIND TOKENS FOR CONTEXT
     */
    extractTailwindTokens(tailwindContent) {
        const tokens = [];
        // Extract colors
        const colorMatches = tailwindContent.match(/colors?\s*:\s*\{[^}]*\}/g);
        if (colorMatches) {
            tokens.push('COLORS:', ...colorMatches.slice(0, 3));
        }
        // Extract theme extensions
        const themeMatches = tailwindContent.match(/theme\s*:\s*\{[\s\S]*?extend\s*:\s*\{[\s\S]*?\}/);
        if (themeMatches) {
            tokens.push('THEME EXTENSIONS:', themeMatches[0].substring(0, 300) + '...');
        }
        // Extract custom utilities
        const customMatches = tailwindContent.match(/plugins\s*:\s*\[[\s\S]*?\]/);
        if (customMatches) {
            tokens.push('PLUGINS:', customMatches[0].substring(0, 200) + '...');
        }
        return tokens.length > 0 ? tokens.join('\n') : 'Standard Tailwind configuration';
    }
    findFileInProject(filePath, projectFiles) {
        // Try exact match first
        let file = projectFiles.get(filePath);
        if (file)
            return file;
        // Try variations
        const variations = [
            filePath.replace(/^src\//, ''),
            `src/${filePath.replace(/^src\//, '')}`,
            filePath.replace(/\\/g, '/'),
            filePath.replace(/\//g, '\\')
        ];
        for (const variation of variations) {
            file = projectFiles.get(variation);
            if (file)
                return file;
        }
        // Try basename matching
        const fileName = (0, path_1.basename)(filePath);
        for (const [key, value] of projectFiles) {
            if ((0, path_1.basename)(key) === fileName) {
                return value;
            }
        }
        return null;
    }
    getFallbackFileSelection(prompt, projectFiles, tailwindConfig) {
        const relevantFiles = [];
        // ALWAYS include Tailwind config first if it exists
        if (tailwindConfig) {
            relevantFiles.push({
                filePath: tailwindConfig.path,
                file: tailwindConfig.file,
                relevanceScore: 95,
                reasoning: 'Auto-included: Essential for styling context and available colors',
                changeType: ['config', 'styling'],
                priority: 'high'
            });
        }
        // Enhanced fallback: select files based on prompt analysis
        const promptLower = prompt.toLowerCase();
        for (const [filePath, file] of projectFiles) {
            // Skip if already added (tailwind config)
            if (tailwindConfig && filePath === tailwindConfig.path)
                continue;
            let relevanceScore = 0;
            const changeTypes = [];
            // Main files get higher priority
            if (file.isMainFile || filePath.includes('App.')) {
                relevanceScore += 30;
                changeTypes.push('main');
            }
            // Styling-related keywords
            if (promptLower.includes('color') || promptLower.includes('style') ||
                promptLower.includes('theme') || promptLower.includes('design') ||
                promptLower.includes('background') || promptLower.includes('text')) {
                if (filePath.includes('component') || filePath.includes('page')) {
                    relevanceScore += 40;
                    changeTypes.push('styling');
                }
            }
            // Layout-related keywords
            if (promptLower.includes('layout') || promptLower.includes('grid') ||
                promptLower.includes('responsive') || promptLower.includes('flex')) {
                if (filePath.includes('component') || filePath.includes('page')) {
                    relevanceScore += 40;
                    changeTypes.push('layout');
                }
            }
            // Component-specific keywords
            if (promptLower.includes('component') || promptLower.includes('button') ||
                promptLower.includes('form') || promptLower.includes('modal')) {
                if (filePath.includes('component')) {
                    relevanceScore += 50;
                    changeTypes.push('component');
                }
            }
            // Navigation-related keywords
            if (promptLower.includes('nav') || promptLower.includes('header') ||
                promptLower.includes('footer') || promptLower.includes('menu')) {
                if (filePath.toLowerCase().includes('nav') ||
                    filePath.toLowerCase().includes('header') ||
                    filePath.toLowerCase().includes('footer')) {
                    relevanceScore += 50;
                    changeTypes.push('navigation');
                }
            }
            if (relevanceScore > 30) {
                relevantFiles.push({
                    filePath,
                    file,
                    relevanceScore,
                    reasoning: `Fallback selection based on keywords: ${changeTypes.join(', ')}`,
                    changeType: changeTypes.length > 0 ? changeTypes : ['general'],
                    priority: relevanceScore > 60 ? 'high' : relevanceScore > 40 ? 'medium' : 'low'
                });
            }
        }
        // If no files selected (except tailwind), select main files
        if (relevantFiles.length <= 1) {
            for (const [filePath, file] of projectFiles) {
                if (file.isMainFile) {
                    relevantFiles.push({
                        filePath,
                        file,
                        relevanceScore: 70,
                        reasoning: 'Main application file (emergency fallback)',
                        changeType: ['general'],
                        priority: 'high'
                    });
                }
            }
        }
        return relevantFiles;
    }
    inferFilePurpose(file) {
        if (file.isMainFile)
            return 'Main application file';
        if (file.relativePath.includes('tailwind.config'))
            return 'Tailwind CSS Configuration';
        if (file.relativePath.includes('component'))
            return 'UI Component';
        if (file.relativePath.includes('page'))
            return 'Application Page';
        if (file.relativePath.includes('hook'))
            return 'Custom Hook';
        if (file.relativePath.includes('util'))
            return 'Utility Module';
        if (file.relativePath.includes('service'))
            return 'Service Module';
        if (file.relativePath.includes('context'))
            return 'Context Provider';
        return `${file.fileType} file`;
    }
}
// ============================================================================
// ENHANCED CONTENT GENERATOR WITH TAILWIND CONTEXT
// ============================================================================
class EnhancedContentGenerator {
    constructor(anthropic) {
        this.anthropic = anthropic;
    }
    generateModifications(prompt, relevantFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            // Extract Tailwind config for styling context
            const tailwindFile = relevantFiles.find(f => f.filePath.includes('tailwind.config'));
            const tailwindContext = tailwindFile ? `
🎨 TAILWIND CONFIGURATION CONTEXT:
Available colors, themes, and custom utilities from your tailwind.config:

\`\`\`javascript
${tailwindFile.file.content}
\`\`\`

Use these custom colors and tokens when making styling changes. Prefer custom colors from the config over default Tailwind colors when available.
` : '🎨 Using standard Tailwind CSS classes.';
            const modificationPrompt = `
🚧 TASK OVERVIEW:
You are an expert TypeScript and React engineer. Modify the provided files according to the user's request while following best practices and avoiding errors related to unresolved imports, types, or external dependencies.

👤 USER REQUEST:
"${prompt}"

${tailwindContext}

🗂️ FILES TO MODIFY:

${relevantFiles.map((result, index) => `
=== FILE ${index + 1}: ${result.filePath} ===
CHANGE TYPES: ${result.changeType.join(', ')}
PRIORITY: ${result.priority}
REASONING: ${result.reasoning}

CURRENT CONTENT:
\`\`\`tsx
${result.file.content}
\`\`\`
`).join('\n')}

📏 STRICT INSTRUCTIONS:
1. Only modify the files listed above. Do NOT assume or use any files not listed.
2. If a file imports types, components, or utilities from another file that is NOT listed, you MUST:
   - Recreate the missing type locally in the file.
   - Recreate minimal versions of utilities/components **inline** inside the component or page as needed.
   - Do NOT import from unknown paths — no assumptions allowed.
3. If a type/interface is missing, define it inline at the top or near usage. Keep definitions minimal but correct.
4. Maintain TypeScript syntax correctness at all times.
5. Do not use styled-components. You MUST use **Tailwind CSS** classes for styling.
6. **USE COLORS FROM TAILWIND CONFIG**: If tailwind.config.js is provided, prioritize custom colors defined there over default Tailwind colors.
7. Keep the structure of existing components, props, and imports unless change is required by the prompt.
8. Ensure the UI remains **responsive** and **accessible**.
9. Do NOT add any new external dependencies.
10. DO NOT generate relative imports for files that are not included in the list.
11. If you must extract logic or a helper function, define it inside the same file — do NOT assume separate utility files.
12. For styling changes: Use the exact color names and custom utilities defined in tailwind.config.js when available.
13. Existing data try to preserve it.

📦 RESPONSE FORMAT:
Return each modified file in clearly marked code blocks:

\\\tsx
// FILE: ${(_a = relevantFiles[0]) === null || _a === void 0 ? void 0 : _a.filePath}
[COMPLETE MODIFIED CONTENT]
\\\

Continue for all files. Be sure to include the FILE comment for each.
`;
            try {
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 8000,
                    temperature: 0.1,
                    messages: [{ role: 'user', content: modificationPrompt }],
                    system: template_1.fullFilePrompt
                });
                console.log("📦 Claude Token Usage:");
                console.log("🔹 Input tokens:", response.usage.input_tokens);
                console.log("🔹 Output tokens:", response.usage.output_tokens);
                const responseText = ((_b = response.content[0]) === null || _b === void 0 ? void 0 : _b.text) || '';
                return this.extractModifiedFiles(responseText, relevantFiles);
            }
            catch (error) {
                console.error('Error generating modifications:', error);
                return [];
            }
        });
    }
    extractModifiedFiles(responseText, originalFiles) {
        var _a;
        const modifiedFiles = [];
        // Enhanced regex to capture file paths and content
        const codeBlockRegex = /```(?:\w+)?\s*\n(?:\/\/\s*FILE:\s*(.+?)\n)?([\s\S]*?)```/g;
        let match;
        let fileIndex = 0;
        while ((match = codeBlockRegex.exec(responseText)) !== null) {
            let filePath = (_a = match[1]) === null || _a === void 0 ? void 0 : _a.trim();
            const modifiedContent = match[2].trim();
            // If no file path in comment, use original file order
            if (!filePath && fileIndex < originalFiles.length) {
                filePath = originalFiles[fileIndex].filePath;
            }
            if (filePath && modifiedContent) {
                // Clean up the file path
                filePath = filePath.replace(/^["']|["']$/g, ''); // Remove quotes
                modifiedFiles.push({
                    filePath,
                    modifiedContent
                });
            }
            fileIndex++;
        }
        return modifiedFiles;
    }
}
// ============================================================================
// REST OF THE IMPLEMENTATION (keeping existing interfaces and classes)
// ============================================================================
// [Previous UpgradedPathManager class remains the same]
class UpgradedPathManager {
    constructor(reactBasePath) {
        this.reactBasePath = (0, path_1.resolve)(reactBasePath.replace(/builddora/g, 'buildora'));
    }
    setStreamCallback(callback) {
        this.streamCallback = callback;
    }
    streamUpdate(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
    }
    resolveFilePath(inputPath, ensureExists = false) {
        let cleanPath = inputPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        cleanPath = cleanPath.replace(/^src\/src\//, 'src/');
        if (!cleanPath.startsWith('src/') && !(0, path_1.isAbsolute)(cleanPath)) {
            cleanPath = `src/${cleanPath}`;
        }
        const fullPath = (0, path_1.isAbsolute)(cleanPath) ?
            (0, path_1.resolve)(cleanPath) :
            (0, path_1.resolve)((0, path_1.join)(this.reactBasePath, cleanPath));
        this.streamUpdate(`📍 Resolved file path: ${inputPath} → ${fullPath}`);
        return fullPath;
    }
    findExistingFile(inputPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const searchPaths = [
                this.resolveFilePath(inputPath),
                this.resolveFilePath(`src/${inputPath.replace(/^src\//, '')}`),
                this.resolveFilePath(inputPath.replace(/^src\//, '')),
                this.resolveFilePath(inputPath.replace(/\.(tsx?|jsx?)$/, '') + '.tsx'),
                this.resolveFilePath(inputPath.replace(/\.(tsx?|jsx?)$/, '') + '.jsx'),
            ];
            for (const searchPath of searchPaths) {
                try {
                    const stats = yield fs_1.promises.stat(searchPath);
                    if (stats.isFile()) {
                        this.streamUpdate(`📍 Found existing file: ${inputPath} → ${searchPath}`);
                        return searchPath;
                    }
                }
                catch (error) {
                    // Continue searching
                }
            }
            this.streamUpdate(`❌ File not found: ${inputPath}`);
            return null;
        });
    }
    safeUpdateFile(filePath, content) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const existingFilePath = yield this.findExistingFile(filePath);
                if (!existingFilePath) {
                    return {
                        success: false,
                        error: `File does not exist: ${filePath}`
                    };
                }
                const stats = yield fs_1.promises.stat(existingFilePath);
                if (!stats.isFile()) {
                    return {
                        success: false,
                        error: `Path exists but is not a file: ${existingFilePath}`
                    };
                }
                this.streamUpdate(`🔄 Updating existing file: ${existingFilePath}`);
                yield fs_1.promises.writeFile(existingFilePath, content, 'utf8');
                const newStats = yield fs_1.promises.stat(existingFilePath);
                this.streamUpdate(`✅ File updated successfully: ${existingFilePath} (${newStats.size} bytes)`);
                return {
                    success: true,
                    actualPath: existingFilePath
                };
            }
            catch (error) {
                this.streamUpdate(`❌ File update failed: ${error}`);
                return {
                    success: false,
                    error: `Failed to update file: ${error}`
                };
            }
        });
    }
    safeCreateFile(filePath, content) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fullFilePath = this.resolveFilePath(filePath);
                const directoryPath = (0, path_1.dirname)(fullFilePath);
                this.streamUpdate(`📁 Creating directory: ${directoryPath}`);
                yield fs_1.promises.mkdir(directoryPath, { recursive: true });
                this.streamUpdate(`💾 Writing file: ${fullFilePath}`);
                yield fs_1.promises.writeFile(fullFilePath, content, 'utf8');
                const stats = yield fs_1.promises.stat(fullFilePath);
                this.streamUpdate(`✅ File created successfully: ${fullFilePath} (${stats.size} bytes)`);
                return {
                    success: true,
                    actualPath: fullFilePath
                };
            }
            catch (error) {
                this.streamUpdate(`❌ File creation failed: ${error}`);
                return {
                    success: false,
                    error: `Failed to create file: ${error}`
                };
            }
        });
    }
    readFile(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const existingFilePath = yield this.findExistingFile(filePath);
                if (!existingFilePath) {
                    this.streamUpdate(`❌ File not found for reading: ${filePath}`);
                    return null;
                }
                const content = yield fs_1.promises.readFile(existingFilePath, 'utf8');
                this.streamUpdate(`📖 Read file: ${existingFilePath} (${content.length} chars)`);
                return content;
            }
            catch (error) {
                this.streamUpdate(`❌ Failed to read file ${filePath}: ${error}`);
                return null;
            }
        });
    }
}
// [Rest of FullFileProcessor class implementation remains the same with the enhanced analyzer and generator]
class FullFileProcessor {
    constructor(anthropic, tokenTracker, basePath) {
        this.anthropic = anthropic;
        this.tokenTracker = tokenTracker;
        this.basePath = (basePath || process.cwd()).replace(/builddora/g, 'buildora');
        this.pathManager = new UpgradedPathManager(this.basePath);
        this.analyzer = new EnhancedFileAnalyzer(anthropic);
        this.generator = new EnhancedContentGenerator(anthropic);
    }
    setStreamCallback(callback) {
        this.streamCallback = callback;
        this.pathManager.setStreamCallback(callback);
    }
    streamUpdate(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
        console.log(message);
    }
    processFullFileModification(prompt, folderNameOrProjectFiles, streamCallbackOrBasePath, legacyStreamCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🚀 UPGRADED: Starting file modification with Tailwind config auto-selection...');
            try {
                let projectFiles;
                let actualBasePath;
                if (typeof folderNameOrProjectFiles === 'string') {
                    const folderName = folderNameOrProjectFiles;
                    actualBasePath = this.resolveProjectPath(folderName);
                    projectFiles = yield this.loadProjectFiles(actualBasePath);
                }
                else {
                    projectFiles = folderNameOrProjectFiles;
                    actualBasePath = typeof streamCallbackOrBasePath === 'string'
                        ? streamCallbackOrBasePath
                        : this.basePath;
                }
                const actualCallback = typeof streamCallbackOrBasePath === 'function'
                    ? streamCallbackOrBasePath
                    : legacyStreamCallback;
                if (actualCallback) {
                    this.setStreamCallback(actualCallback);
                }
                this.streamUpdate(`📁 Working with ${projectFiles.size} files`);
                this.streamUpdate(`📂 Base path: ${actualBasePath}`);
                this.pathManager = new UpgradedPathManager(actualBasePath);
                this.pathManager.setStreamCallback(this.streamCallback || (() => { }));
                // STEP 1: Enhanced analysis with Tailwind config auto-selection
                this.streamUpdate('🔍 Step 1: Enhanced file analysis with Tailwind config...');
                const relevantFiles = yield this.analyzer.analyzeFiles(prompt, projectFiles);
                if (relevantFiles.length === 0) {
                    this.streamUpdate('❌ No relevant files identified');
                    return { success: false };
                }
                this.streamUpdate(`✅ Selected ${relevantFiles.length} files for modification`);
                relevantFiles.forEach(file => {
                    const icon = file.filePath.includes('tailwind.config') ? '🎨' : '📝';
                    this.streamUpdate(`   ${icon} ${file.filePath} (${file.priority} priority) - ${file.reasoning}`);
                });
                // STEP 2: Enhanced content generation with Tailwind context
                this.streamUpdate('🎨 Step 2: Enhanced content generation with Tailwind context...');
                const modifiedFiles = yield this.generator.generateModifications(prompt, relevantFiles);
                if (modifiedFiles.length === 0) {
                    this.streamUpdate('❌ No modifications generated');
                    return { success: false };
                }
                this.streamUpdate(`✅ Generated ${modifiedFiles.length} file modifications`);
                // STEP 3: Apply modifications
                this.streamUpdate('💾 Step 3: Applying modifications...');
                const applyResult = yield this.applyModificationsWithUpgradedMethod(modifiedFiles, projectFiles);
                this.streamUpdate(`🎉 SUCCESS! Applied ${applyResult.successCount}/${modifiedFiles.length} modifications`);
                return {
                    success: applyResult.successCount > 0,
                    changes: applyResult.changes,
                    modifiedFiles: applyResult.modifiedFiles
                };
            }
            catch (error) {
                this.streamUpdate(`❌ Processing failed: ${error}`);
                return { success: false };
            }
        });
    }
    applyModificationsWithUpgradedMethod(modifiedFiles, projectFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            let successCount = 0;
            const changes = [];
            const modifiedFilePaths = [];
            for (const { filePath, modifiedContent } of modifiedFiles) {
                try {
                    this.streamUpdate(`🔧 Processing: ${filePath}`);
                    const updateResult = yield this.pathManager.safeUpdateFile(filePath, modifiedContent);
                    if (updateResult.success) {
                        const existingFile = this.analyzer['findFileInProject'](filePath, projectFiles);
                        if (existingFile) {
                            existingFile.content = modifiedContent;
                            existingFile.lines = modifiedContent.split('\n').length;
                        }
                        successCount++;
                        modifiedFilePaths.push(filePath);
                        changes.push({
                            type: 'modified',
                            file: filePath,
                            description: 'Successfully updated with enhanced path handling',
                            success: true,
                            details: {
                                linesChanged: modifiedContent.split('\n').length,
                                changeType: ['update'],
                                reasoning: 'Updated using upgraded path manager'
                            }
                        });
                        this.streamUpdate(`✅ Successfully updated: ${updateResult.actualPath}`);
                    }
                    else {
                        this.streamUpdate(`❌ Failed to update ${filePath}: ${updateResult.error}`);
                        changes.push({
                            type: 'failed',
                            file: filePath,
                            description: updateResult.error || 'Update failed',
                            success: false
                        });
                    }
                }
                catch (error) {
                    this.streamUpdate(`❌ Error processing ${filePath}: ${error}`);
                    changes.push({
                        type: 'failed',
                        file: filePath,
                        description: `Error: ${error}`,
                        success: false
                    });
                }
            }
            return { successCount, changes, modifiedFiles: modifiedFilePaths };
        });
    }
    /**
     * Helper methods (enhanced)
     */
    resolveProjectPath(folderName) {
        if ((0, path_1.isAbsolute)(folderName)) {
            return folderName.replace(/builddora/g, 'buildora');
        }
        const cleanBasePath = process.cwd().replace(/builddora/g, 'buildora');
        return (0, path_1.resolve)((0, path_1.join)(cleanBasePath, 'temp-builds', folderName));
    }
    loadProjectFiles(projectPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const projectFiles = new Map();
            const scanDirectory = (dir_1, ...args_1) => __awaiter(this, [dir_1, ...args_1], void 0, function* (dir, baseDir = projectPath) {
                try {
                    const entries = yield fs_1.promises.readdir(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const fullPath = (0, path_1.join)(dir, entry.name);
                        const relativePath = (0, path_1.relative)(baseDir, fullPath).replace(/\\/g, '/');
                        if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
                            yield scanDirectory(fullPath, baseDir);
                        }
                        else if (entry.isFile() && this.isRelevantFile(entry.name)) {
                            try {
                                const content = yield fs_1.promises.readFile(fullPath, 'utf8');
                                const stats = yield fs_1.promises.stat(fullPath);
                                const projectFile = {
                                    path: fullPath,
                                    relativePath,
                                    content,
                                    lines: content.split('\n').length,
                                    isMainFile: this.isMainFile(entry.name, relativePath),
                                    fileType: this.determineFileType(entry.name),
                                    lastModified: stats.mtime
                                };
                                projectFiles.set(relativePath, projectFile);
                            }
                            catch (readError) {
                                this.streamUpdate(`⚠️ Could not read file: ${relativePath}`);
                            }
                        }
                    }
                }
                catch (error) {
                    this.streamUpdate(`⚠️ Error scanning directory ${dir}: ${error}`);
                }
            });
            yield scanDirectory(projectPath);
            return projectFiles;
        });
    }
    shouldSkipDirectory(name) {
        const skipPatterns = ['node_modules', '.git', '.next', 'dist', 'build'];
        return skipPatterns.includes(name) || name.startsWith('.');
    }
    isRelevantFile(fileName) {
        const extensions = ['.tsx', '.ts', '.jsx', '.js', '.css', '.json'];
        return extensions.some(ext => fileName.endsWith(ext));
    }
    isMainFile(fileName, relativePath) {
        return fileName === 'App.tsx' || fileName === 'App.jsx' ||
            relativePath.includes('App.') || fileName === 'index.tsx';
    }
    determineFileType(fileName) {
        if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx'))
            return 'react-component';
        if (fileName.endsWith('.ts') || fileName.endsWith('.js'))
            return 'module';
        if (fileName.endsWith('.css'))
            return 'stylesheet';
        if (fileName.endsWith('.json'))
            return 'config';
        return 'unknown';
    }
    process(prompt, projectFiles, reactBasePath, streamCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🔄 Legacy process method called');
            return this.processFullFileModification(prompt, projectFiles, reactBasePath, streamCallback);
        });
    }
    /**
     * Legacy method for compatibility
     */
    handleFullFileModification(prompt, projectFiles, modificationSummary) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🔄 Legacy handleFullFileModification called');
            const result = yield this.processFullFileModification(prompt, projectFiles, undefined, (message) => this.streamUpdate(message));
            return result.success;
        });
    }
}
exports.FullFileProcessor = FullFileProcessor;
//# sourceMappingURL=Fullfileprocessor.js.map