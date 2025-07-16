"use strict";
// ============================================================================
// FILESYSTEM CACHE SYNC FIX: Enhanced ProjectAnalyzer with Real-time Verification
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
exports.ProjectAnalyzer = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
class ProjectAnalyzer {
    constructor(reactBasePath) {
        this.reactBasePath = reactBasePath;
    }
    setStreamCallback(callback) {
        this.streamCallback = callback;
    }
    streamUpdate(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
    }
    /**
     * ENHANCED: Real-time filesystem verification during cache building
     */
    buildProjectTree(projectFiles, dependencyManager, streamCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            if (streamCallback) {
                this.setStreamCallback(streamCallback);
            }
            this.streamUpdate('🔍 Starting comprehensive project analysis with real-time filesystem verification...');
            const srcPath = (0, path_1.join)(this.reactBasePath, 'src');
            try {
                yield fs_1.promises.access(srcPath);
                this.streamUpdate('✅ Found src directory! Scanning React components and project structure...');
            }
            catch (error) {
                this.streamUpdate('❌ No src directory found. Invalid React project structure.');
                return;
            }
            let totalFiles = 0;
            let excludedFiles = 0;
            let analyzedFiles = 0;
            let verificationErrors = 0;
            const scanDir = (dir_1, ...args_1) => __awaiter(this, [dir_1, ...args_1], void 0, function* (dir, relativePath = '') {
                try {
                    const entries = yield fs_1.promises.readdir(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const fullPath = (0, path_1.join)(dir, entry.name);
                        const relPath = relativePath ? (0, path_1.join)(relativePath, entry.name) : entry.name;
                        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                            // Skip entire UI directories
                            if (entry.name === 'ui' && relativePath.includes('component')) {
                                this.streamUpdate(`⏭️ Skipping entire UI directory: ${relPath}`);
                                continue;
                            }
                            yield scanDir(fullPath, relPath);
                        }
                        else if (entry.isFile() && /\.(js|jsx|ts|tsx)$/.test(entry.name)) {
                            totalFiles++;
                            // Check if file should be excluded
                            if (this.shouldExcludeFile(relPath, fullPath)) {
                                excludedFiles++;
                                continue;
                            }
                            // ENHANCED: Verify file exists and is accessible before analyzing
                            const analyzeResult = yield this.analyzeFileWithVerification(fullPath, relPath, projectFiles);
                            if (analyzeResult === 'analyzed') {
                                analyzedFiles++;
                            }
                            else if (analyzeResult === 'excluded') {
                                excludedFiles++;
                            }
                            else if (analyzeResult === 'error') {
                                verificationErrors++;
                            }
                        }
                    }
                }
                catch (error) {
                    this.streamUpdate(`⚠️ Error scanning ${dir}: ${error}`);
                }
            });
            // Clear the map and populate it with fresh data
            projectFiles.clear();
            yield scanDir(srcPath);
            // ENHANCED: Post-build verification
            this.streamUpdate('🔍 Performing post-build filesystem verification...');
            const verificationResults = yield this.verifyProjectFilesCache(projectFiles);
            this.streamUpdate(`✅ Project analysis complete!`);
            this.streamUpdate(`📊 Files processed: ${totalFiles} total, ${analyzedFiles} analyzed, ${excludedFiles} excluded, ${verificationErrors} verification errors`);
            this.streamUpdate(`📁 Found ${projectFiles.size} verified React files for modification`);
            this.streamUpdate(`🔍 Verification: ${verificationResults.verified} verified, ${verificationResults.missing} missing from filesystem`);
            if (verificationResults.missing > 0) {
                this.streamUpdate(`⚠️ Warning: ${verificationResults.missing} files in cache don't exist on filesystem`);
            }
        });
    }
    /**
     * ENHANCED: Analyze file with real-time filesystem verification
     */
    analyzeFileWithVerification(filePath, relativePath, projectFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Double-check file exists and is readable
                yield fs_1.promises.access(filePath, fs_1.promises.constants.R_OK);
                const content = yield fs_1.promises.readFile(filePath, 'utf8');
                // Additional content-based exclusion
                if (this.isUILibraryFile(content, (0, path_1.basename)(filePath))) {
                    this.streamUpdate(`⏭️ Excluding UI library file: ${relativePath}`);
                    return 'excluded';
                }
                const stats = yield fs_1.promises.stat(filePath);
                const lines = content.split('\n');
                //@ts-ignore
                const projectFile = {
                    name: (0, path_1.basename)(filePath),
                    path: filePath, // Store absolute path for reliability
                    relativePath: `src/${relativePath}`,
                    content,
                    lines: lines.length,
                    size: stats.size,
                    snippet: lines.slice(0, 15).join('\n'),
                    componentName: this.extractComponentNameFromContent(content),
                    hasButtons: this.checkForButtons(content),
                    hasSignin: this.checkForSignin(content),
                    isMainFile: this.isMainFile(filePath, content)
                };
                // ENHANCED: Verify the file can be written to
                try {
                    yield fs_1.promises.access(filePath, fs_1.promises.constants.W_OK);
                }
                catch (writeError) {
                    this.streamUpdate(`⚠️ Warning: ${relativePath} is read-only or write-protected`);
                    // Still add to cache but note the issue
                }
                projectFiles.set(projectFile.relativePath, projectFile);
                this.streamUpdate(`📄 Analyzed & Verified: ${projectFile.relativePath} (${projectFile.componentName})`);
                return 'analyzed';
            }
            catch (error) {
                this.streamUpdate(`❌ Failed to analyze/verify file ${relativePath}: ${error}`);
                return 'error';
            }
        });
    }
    /**
     * NEW: Verify all cached project files actually exist on filesystem
     */
    verifyProjectFilesCache(projectFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            let verified = 0;
            let missing = 0;
            const missingFiles = [];
            for (const [relativePath, file] of projectFiles) {
                try {
                    yield fs_1.promises.access(file.path, fs_1.promises.constants.R_OK | fs_1.promises.constants.W_OK);
                    verified++;
                }
                catch (error) {
                    missing++;
                    missingFiles.push(relativePath);
                    this.streamUpdate(`❌ Cache verification failed for ${relativePath}: file not accessible at ${file.path}`);
                    // Try to find the file in alternative locations
                    const alternativePath = yield this.findFileInAlternativeLocation(file);
                    if (alternativePath) {
                        this.streamUpdate(`✅ Found ${relativePath} at alternative location: ${alternativePath}`);
                        // Update the file path in cache
                        file.path = alternativePath;
                        verified++;
                        missing--;
                        missingFiles.pop(); // Remove from missing list
                    }
                }
            }
            // Remove missing files from cache to prevent modification attempts
            for (const missingFile of missingFiles) {
                this.streamUpdate(`🗑️ Removing ${missingFile} from cache (file not found on filesystem)`);
                projectFiles.delete(missingFile);
            }
            return { verified, missing: missingFiles.length, missingFiles };
        });
    }
    /**
     * NEW: Try to find file in alternative locations
     */
    findFileInAlternativeLocation(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const alternativePaths = [
                // Try with different base paths
                (0, path_1.join)(this.reactBasePath, file.relativePath),
                (0, path_1.join)(this.reactBasePath, file.relativePath.replace(/^src[\/\\]/, '')),
                (0, path_1.join)(this.reactBasePath, 'src', file.relativePath.replace(/^src[\/\\]/, '')),
                // Try with different file extensions
                file.path.replace(/\.tsx$/, '.jsx'),
                file.path.replace(/\.jsx$/, '.tsx'),
                file.path.replace(/\.ts$/, '.js'),
                file.path.replace(/\.js$/, '.ts'),
                // Try case variations
                file.path.toLowerCase(),
                file.path.toUpperCase(),
            ];
            for (const altPath of alternativePaths) {
                try {
                    yield fs_1.promises.access(altPath, fs_1.promises.constants.R_OK | fs_1.promises.constants.W_OK);
                    return altPath;
                }
                catch (_a) {
                    // Continue trying
                }
            }
            return null;
        });
    }
    /**
     * NEW: Clean up stale cache entries
     */
    cleanupStaleCache(projectFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🧹 Cleaning up stale cache entries...');
            const stalePaths = [];
            for (const [relativePath, file] of projectFiles) {
                try {
                    yield fs_1.promises.access(file.path);
                }
                catch (_a) {
                    stalePaths.push(relativePath);
                }
            }
            for (const stalePath of stalePaths) {
                projectFiles.delete(stalePath);
                this.streamUpdate(`🗑️ Removed stale cache entry: ${stalePath}`);
            }
            this.streamUpdate(`✅ Cleanup complete: removed ${stalePaths.length} stale entries`);
        });
    }
    /**
     * NEW: Force refresh a specific file in cache
     */
    refreshFileInCache(filePath, projectFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate(`🔄 Refreshing ${filePath} in cache...`);
            const existingFile = projectFiles.get(filePath);
            if (!existingFile) {
                this.streamUpdate(`❌ File ${filePath} not found in cache`);
                return false;
            }
            try {
                // Re-read the file from filesystem
                const content = yield fs_1.promises.readFile(existingFile.path, 'utf8');
                const stats = yield fs_1.promises.stat(existingFile.path);
                const lines = content.split('\n');
                // Update the cached file
                existingFile.content = content;
                existingFile.lines = lines.length;
                existingFile.size = stats.size;
                existingFile.snippet = lines.slice(0, 15).join('\n');
                existingFile.componentName = this.extractComponentNameFromContent(content);
                existingFile.hasButtons = this.checkForButtons(content);
                existingFile.hasSignin = this.checkForSignin(content);
                this.streamUpdate(`✅ Successfully refreshed ${filePath} in cache`);
                return true;
            }
            catch (error) {
                this.streamUpdate(`❌ Failed to refresh ${filePath}: ${error}`);
                return false;
            }
        });
    }
    // [Keep all existing helper methods: shouldExcludeFile, isUILibraryFile, etc.]
    shouldExcludeFile(relativePath, fullPath) {
        const excludePatterns = [
            /src[\/\\]components?[\/\\]ui[\/\\]/i,
            /components?[\/\\]ui[\/\\]/i,
            /ui[\/\\](button|input|card|dialog|dropdown|select|textarea|checkbox|radio|switch|slider|progress|alert|badge|avatar|separator|skeleton|toast|tooltip|popover|command|calendar|accordion|tabs|sheet|scroll-area|menubar|navigation-menu|context-menu|hover-card|label|aspect-ratio|collapsible|toggle|form)\.tsx?$/i,
            /ui[\/\\](components?|elements?|primitives?)[\/\\]/i,
            /test\.|spec\./,
            /\.test\.|\.spec\./,
            /__tests__[\/\\]/,
            /\.d\.ts$/,
            /utils?\.tsx?$/i,
            /helpers?\.tsx?$/i,
            /constants?\.tsx?$/i,
            /config\.tsx?$/i,
            /types\.tsx?$/i,
            /lib[\/\\]/,
            /vendor[\/\\]/,
            /third-party[\/\\]/,
            /node_modules[\/\\]/,
            /\.git[\/\\]/,
            /dist[\/\\]/,
            /build[\/\\]/,
            /\.stories?\./,
            /\.css$/,
            /\.scss$/,
            /\.sass$/,
            /\.less$/,
            /\.styl$/
        ];
        return excludePatterns.some(pattern => pattern.test(relativePath) || pattern.test(fullPath));
    }
    isUILibraryFile(content, fileName) {
        if (/^(button|input|card|dialog|dropdown|select|textarea|checkbox|radio|switch|slider|progress|alert|badge|avatar|separator|skeleton|toast|tooltip|popover|command|calendar|accordion|tabs|sheet|scroll-area|menubar|navigation-menu|context-menu|hover-card|label|aspect-ratio|collapsible|toggle|form)\.tsx?$/i.test(fileName)) {
            return true;
        }
        const uiLibraryIndicators = [
            /@\/lib\/utils/,
            /class-variance-authority/,
            /clsx.*cn/,
            /React\.forwardRef.*displayName/,
            /@radix-ui\//,
            /Primitive\./,
            /styled-components/,
            /@emotion\//,
            /chakra-ui/,
            /mantine/,
            /interface.*Props.*extends.*React\./,
            /VariantProps/,
            /cva\(/,
            /export.*const.*=.*React\.forwardRef/,
            /export.*\{.*as.*\}/
        ];
        const hasUIIndicators = uiLibraryIndicators.some(pattern => pattern.test(content));
        const isBasicWrapper = content.includes('React.forwardRef') &&
            /return\s*<(div|span|button|input|textarea|select|label|p|h[1-6])\s/.test(content) &&
            content.split('\n').length < 50;
        return hasUIIndicators || isBasicWrapper;
    }
    // [Include all other existing methods: buildProjectSummary, extractComponentNameFromContent, etc.]
    buildProjectSummary(projectFiles) {
        let summary = "**COMPLETE PROJECT STRUCTURE (UI Components Excluded):**\n\n";
        summary += "**ANALYZED REACT FILES WITH METADATA:**\n\n";
        const sortedFiles = Array.from(projectFiles.values())
            .sort((a, b) => {
            if (a.isMainFile && !b.isMainFile)
                return -1;
            if (!a.isMainFile && b.isMainFile)
                return 1;
            return a.relativePath.localeCompare(b.relativePath);
        });
        summary += `**Total Relevant React Files Found: ${sortedFiles.length}**\n`;
        summary += `**Note: UI library components (src/components/ui/*) excluded from analysis**\n\n`;
        sortedFiles.forEach(file => {
            summary += `**${file.relativePath}**\n`;
            summary += `- Component: ${file.componentName || 'Unknown'}\n`;
            summary += `- Has buttons: ${file.hasButtons ? 'Yes' : 'No'}\n`;
            summary += `- Has signin: ${file.hasSignin ? 'Yes' : 'No'}\n`;
            summary += `- Is main file: ${file.isMainFile ? 'Yes' : 'No'}\n\n`;
        });
        return summary;
    }
    extractComponentNameFromContent(content) {
        const patterns = [
            /(?:function|const)\s+([A-Z]\w+)/,
            /export\s+default\s+([A-Z]\w+)/,
            /class\s+([A-Z]\w+)/
        ];
        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return 'Unknown';
    }
    checkForButtons(content) {
        return /button|Button|btn|<button|type.*submit/i.test(content);
    }
    checkForSignin(content) {
        return /signin|sign.?in|login|log.?in|auth/i.test(content);
    }
    isMainFile(filePath, content) {
        const fileName = (0, path_1.basename)(filePath).toLowerCase();
        const isMainName = /^(app|index|main|home)\./.test(fileName);
        const hasMainContent = /export\s+default|function\s+App|class\s+App/i.test(content);
        return isMainName || hasMainContent;
    }
}
exports.ProjectAnalyzer = ProjectAnalyzer;
//# sourceMappingURL=projectanalyzer.js.map