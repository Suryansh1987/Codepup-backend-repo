"use strict";
// fallbackMechanism.ts - Traditional full file approach fallback
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
exports.FallbackMechanism = void 0;
const fs_1 = require("fs");
class FallbackMechanism {
    constructor(anthropic) {
        this.anthropic = anthropic;
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
     * Main fallback method - traditional full file approach with user prompt
     */
    executeComprehensiveFallback(prompt, projectFiles, failedApproach, originalFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate(`🔄 Starting traditional full file fallback mechanism...`);
            this.streamUpdate(`📊 Using direct user prompt approach on ${projectFiles.size} files`);
            const results = {
                success: false,
                modifiedFiles: [],
                approach: 'TRADITIONAL_FULL_FILE',
                reasoning: `Fallback from failed ${failedApproach} approach using traditional full file modification`
            };
            // Step 1: Quick filter files that are likely to be relevant
            const candidateFiles = this.quickFilterRelevantFiles(prompt, projectFiles);
            if (candidateFiles.length === 0) {
                this.streamUpdate('❌ No candidate files found for traditional fallback');
                results.error = 'No candidate files found for traditional fallback';
                return results;
            }
            this.streamUpdate(`🎯 Found ${candidateFiles.length} candidate files for traditional full file modification`);
            // Step 2: Apply traditional full file modifications
            const modificationResults = yield this.applyTraditionalFullFileModifications(prompt, candidateFiles);
            results.success = modificationResults.modifiedCount > 0;
            results.modifiedFiles = modificationResults.modifiedFiles;
            results.reasoning += `. Modified ${modificationResults.modifiedCount} files using traditional approach.`;
            if (modificationResults.modifiedCount === 0) {
                results.error = 'No applicable modifications found in candidate files';
            }
            if (results.success) {
                this.streamUpdate(`✅ Traditional fallback succeeded! Modified ${results.modifiedFiles.length} files`);
            }
            else {
                this.streamUpdate('❌ Traditional fallback found no applicable modifications');
            }
            return results;
        });
    }
    /**
     * Quick filter to identify potentially relevant files
     */
    quickFilterRelevantFiles(prompt, projectFiles) {
        this.streamUpdate('🔍 Quick filtering files for relevance...');
        const candidates = [];
        const promptLower = prompt.toLowerCase();
        // Keywords that indicate UI modifications
        const uiKeywords = ['button', 'signin', 'login', 'form', 'page', 'component', 'style', 'color', 'theme', 'layout'];
        const authKeywords = ['signin', 'login', 'auth', 'user', 'account'];
        const styleKeywords = ['color', 'theme', 'dark', 'light', 'style', 'css'];
        for (const [filePath, file] of projectFiles) {
            let priority = 0;
            const fileContent = file.content.toLowerCase();
            const fileName = filePath.toLowerCase();
            // Skip utility and config files
            if (this.shouldSkipFileInFallback(filePath, file)) {
                continue;
            }
            // Priority scoring based on content and keywords
            // High priority: Main app files
            if (file.isMainFile) {
                priority += 30;
            }
            // Check for UI-related keywords in prompt matching file content
            uiKeywords.forEach(keyword => {
                if (promptLower.includes(keyword)) {
                    if (fileContent.includes(keyword))
                        priority += 15;
                    if (fileName.includes(keyword))
                        priority += 10;
                }
            });
            // Auth-related files get higher priority for auth requests
            authKeywords.forEach(keyword => {
                if (promptLower.includes(keyword)) {
                    if (file.hasSignin || fileContent.includes(keyword))
                        priority += 20;
                }
            });
            // Style-related files for style requests
            styleKeywords.forEach(keyword => {
                if (promptLower.includes(keyword)) {
                    if (fileContent.includes(keyword))
                        priority += 15;
                }
            });
            // Button-related requests
            if (promptLower.includes('button') && file.hasButtons) {
                priority += 25;
            }
            // Component files are generally good candidates
            if (file.componentName && filePath.includes('component')) {
                priority += 10;
            }
            // Page files for page-level changes
            if (filePath.includes('page') || filePath.includes('Page')) {
                priority += 15;
            }
            // Files with JSX content are more likely to need UI changes
            if (fileContent.includes('jsx') || fileContent.includes('<')) {
                priority += 10;
            }
            // Add to candidates if it has any relevance
            if (priority > 0) {
                candidates.push({ filePath, file, priority });
            }
        }
        // Sort by priority (highest first) and limit to top candidates
        candidates.sort((a, b) => b.priority - a.priority);
        const topCandidates = candidates.slice(0, 8); // Limit to top 8 files
        this.streamUpdate(`📋 Selected ${topCandidates.length} files based on content relevance:`);
        topCandidates.forEach(candidate => {
            this.streamUpdate(`   • ${candidate.filePath} (priority: ${candidate.priority})`);
        });
        return topCandidates;
    }
    /**
     * Check if file should be skipped in fallback
     */
    shouldSkipFileInFallback(filePath, file) {
        const skipPatterns = [
            /\.d\.ts$/,
            /test\.|spec\./,
            /\.test\.|\.spec\./,
            /config\./,
            /types\.ts$/,
            /constants\.ts$/,
            /utils\.ts$/,
            /helpers?\./,
            /api\//,
            /services\//,
            /node_modules/,
            /\.git/
        ];
        // Skip if matches skip patterns
        if (skipPatterns.some(pattern => pattern.test(filePath))) {
            return true;
        }
        // Skip very small files (likely utilities)
        if (file.lines < 5) {
            return true;
        }
        // Skip files without JSX or component content
        if (!file.content.includes('<') && !file.content.includes('component') && !file.content.includes('Component')) {
            return true;
        }
        return false;
    }
    /**
     * Apply traditional full file modifications using direct user prompt
     */
    applyTraditionalFullFileModifications(prompt, candidates) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🔧 Applying traditional full file modifications...');
            const results = {
                modifiedCount: 0,
                modifiedFiles: [],
                details: []
            };
            for (const candidate of candidates) {
                this.streamUpdate(`🔧 Processing ${candidate.filePath}...`);
                try {
                    const modificationResult = yield this.applyTraditionalModification(prompt, candidate.filePath, candidate.file);
                    if (modificationResult.success) {
                        results.modifiedCount++;
                        results.modifiedFiles.push(candidate.filePath);
                        results.details.push(`✅ ${candidate.filePath}: ${modificationResult.description}`);
                        this.streamUpdate(`✅ Successfully modified ${candidate.filePath}`);
                    }
                    else {
                        results.details.push(`⚠️ ${candidate.filePath}: ${modificationResult.description}`);
                        this.streamUpdate(`⚠️ No changes applied to ${candidate.filePath}: ${modificationResult.description}`);
                    }
                    // Limit modifications to avoid too many changes
                    if (results.modifiedCount >= 5) {
                        this.streamUpdate('🛑 Reached maximum file modification limit (5 files)');
                        break;
                    }
                }
                catch (error) {
                    results.details.push(`❌ ${candidate.filePath}: Error - ${error}`);
                    this.streamUpdate(`❌ Error processing ${candidate.filePath}: ${error}`);
                }
            }
            return results;
        });
    }
    /**
     * Apply traditional modification to a single file
     */
    applyTraditionalModification(prompt, filePath, file) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            // Extract file structure for preservation
            const structure = this.extractFileStructure(file.content);
            const modificationPrompt = `
USER REQUEST: "${prompt}"

FILE TO MODIFY: ${filePath}

CURRENT FILE CONTENT:
\`\`\`jsx
${file.content}
\`\`\`

TASK: Modify this React file to fulfill the user's request.

PRESERVATION REQUIREMENTS:
${structure.preservationPrompt}

MODIFICATION GUIDELINES:
1. Read the user's request carefully and determine what changes are needed
2. Apply the changes while preserving the file structure (imports, exports, component names)
3. Make comprehensive changes to fulfill the request (colors, layout, styling, functionality)
4. Ensure the component still works after modifications
5. Keep existing functionality intact unless the request specifically asks to change it

EXAMPLES OF VALID MODIFICATIONS:
- Changing button colors, styles, or text
- Adding dark/light theme support
- Modifying layouts and component structure
- Updating styling and visual appearance
- Adding new functionality while keeping existing features

RESPONSE: Return ONLY the complete modified file content in a code block:

\`\`\`jsx
[COMPLETE MODIFIED FILE CONTENT]
\`\`\`

If no modifications are needed, respond with:
NO_MODIFICATIONS_NEEDED: [brief explanation why]
    `;
            try {
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 4000,
                    temperature: 0.1, // Slightly higher temperature for more creative modifications
                    messages: [{ role: 'user', content: modificationPrompt }],
                });
                const text = ((_a = response.content[0]) === null || _a === void 0 ? void 0 : _a.type) === 'text' ? response.content[0].text : '';
                // Check if no modifications were needed
                if (text.includes('NO_MODIFICATIONS_NEEDED:')) {
                    const reason = ((_b = text.split('NO_MODIFICATIONS_NEEDED:')[1]) === null || _b === void 0 ? void 0 : _b.trim()) || 'No specific reason provided';
                    return { success: false, description: `No modifications needed: ${reason}` };
                }
                // Extract code from response
                const codeMatch = text.match(/```(?:jsx|tsx|javascript|typescript|js|ts)?\n?([\s\S]*?)```/);
                if (!codeMatch) {
                    return { success: false, description: 'Could not extract code from response' };
                }
                const modifiedContent = codeMatch[1].trim();
                // Validate the modified content
                const validationResult = this.validateFileStructure(modifiedContent, structure);
                if (!validationResult.isValid) {
                    // Attempt repair
                    const repairResult = this.repairFileStructure(modifiedContent, structure, file.content);
                    if (repairResult.success && repairResult.repairedContent) {
                        yield fs_1.promises.writeFile(file.path, repairResult.repairedContent, 'utf8');
                        return { success: true, description: 'Successfully applied modifications (with structure repair)' };
                    }
                    else {
                        return {
                            success: false,
                            description: `Structure validation failed: ${validationResult.errors.join(', ')}`
                        };
                    }
                }
                // Apply the changes
                yield fs_1.promises.writeFile(file.path, modifiedContent, 'utf8');
                return { success: true, description: 'Successfully applied modifications' };
            }
            catch (error) {
                return { success: false, description: `Error during modification: ${error}` };
            }
        });
    }
    /**
     * Extract file structure for preservation
     */
    extractFileStructure(content) {
        const lines = content.split('\n');
        const imports = [];
        const exports = [];
        const components = [];
        const hooks = [];
        let componentName = null;
        let hasDefaultExport = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('import ')) {
                imports.push(lines[i]);
            }
            if (line.startsWith('export ')) {
                exports.push(lines[i]);
                if (line.includes('export default')) {
                    hasDefaultExport = true;
                    const defaultMatch = line.match(/export\s+default\s+(\w+)/);
                    if (defaultMatch) {
                        componentName = defaultMatch[1];
                    }
                }
            }
            // Extract component names
            const componentMatch = line.match(/(?:function|const)\s+([A-Z]\w+)/);
            if (componentMatch) {
                components.push(componentMatch[1]);
                if (!componentName) {
                    componentName = componentMatch[1];
                }
            }
            // Extract hooks
            const hookMatch = line.match(/use[A-Z]\w*/g);
            if (hookMatch) {
                hooks.push(...hookMatch);
            }
        }
        const preservationPrompt = `
**CRITICAL PRESERVATION REQUIREMENTS:**

**ALL IMPORTS (${imports.length}) - MUST BE PRESERVED:**
${imports.map(imp => `✓ ${imp}`).join('\n') || '(No imports found)'}

**ALL EXPORTS (${exports.length}) - MUST BE PRESERVED:**
${exports.map(exp => `✓ ${exp}`).join('\n') || '(No exports found)'}

**COMPONENT NAME - MUST NOT CHANGE:**
✓ Main component: ${componentName || 'Not detected'}
✓ Has default export: ${hasDefaultExport ? 'Yes' : 'No'}

**STRUCTURE RULES:**
1. Keep ALL import statements at the top
2. Keep ALL export statements exactly as they are
3. DO NOT change component/function names
4. Only modify the INTERNAL content of components
    `;
        return {
            imports,
            exports,
            componentName,
            hasDefaultExport,
            fileHeader: imports.join('\n'),
            fileFooter: exports.join('\n'),
            preservationPrompt,
            components,
            hooks: hooks.length > 0 ? Array.from(new Set(hooks)) : undefined
        };
    }
    /**
     * Validate file structure preservation
     */
    validateFileStructure(modifiedContent, structure) {
        const errors = [];
        const warnings = [];
        // Check imports
        for (const originalImport of structure.imports) {
            if (!modifiedContent.includes(originalImport.trim())) {
                errors.push(`Missing import: ${originalImport.trim()}`);
            }
        }
        // Check exports
        for (const originalExport of structure.exports) {
            if (!modifiedContent.includes(originalExport.trim())) {
                errors.push(`Missing export: ${originalExport.trim()}`);
            }
        }
        // Check component name
        if (structure.componentName) {
            const componentRegex = new RegExp(`\\b${structure.componentName}\\b`);
            if (!componentRegex.test(modifiedContent)) {
                errors.push(`Component name '${structure.componentName}' not found`);
            }
        }
        // Check default export
        if (structure.hasDefaultExport && !modifiedContent.includes('export default')) {
            errors.push('Default export statement missing');
        }
        // Check for potential issues (warnings)
        if (structure.components.length > 0) {
            structure.components.forEach(comp => {
                if (!modifiedContent.includes(comp)) {
                    warnings.push(`Component '${comp}' may have been removed or renamed`);
                }
            });
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            score: errors.length === 0 ? 100 : Math.max(0, 100 - (errors.length * 20) - (warnings.length * 5))
        };
    }
    /**
     * Attempt to repair file structure
     */
    repairFileStructure(brokenContent, structure, originalContent) {
        const appliedFixes = [];
        const unresolvedIssues = [];
        try {
            const brokenLines = brokenContent.split('\n');
            const repairedLines = [];
            // Add missing imports at the top
            structure.imports.forEach(importLine => {
                if (!brokenContent.includes(importLine.trim())) {
                    repairedLines.push(importLine);
                    appliedFixes.push(`Added missing import: ${importLine.trim()}`);
                }
            });
            // Add existing content, filtering out duplicate imports
            let inImportSection = true;
            for (const line of brokenLines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('import ') &&
                    structure.imports.some(imp => imp.trim() === trimmed)) {
                    continue;
                }
                if (inImportSection && trimmed !== '' && !trimmed.startsWith('import ')) {
                    inImportSection = false;
                    if (repairedLines.length > 0 && !repairedLines[repairedLines.length - 1].trim()) {
                        // Don't add extra empty line
                    }
                    else {
                        repairedLines.push('');
                    }
                }
                repairedLines.push(line);
            }
            // Ensure all exports are present at the end
            let finalContent = repairedLines.join('\n');
            for (const exportLine of structure.exports) {
                if (!finalContent.includes(exportLine.trim())) {
                    if (!finalContent.endsWith('\n')) {
                        finalContent += '\n';
                    }
                    finalContent += exportLine + '\n';
                    appliedFixes.push(`Added missing export: ${exportLine.trim()}`);
                }
            }
            const finalValidation = this.validateFileStructure(finalContent, structure);
            if (!finalValidation.isValid) {
                unresolvedIssues.push(...finalValidation.errors);
            }
            return {
                success: finalValidation.isValid,
                repairedContent: finalValidation.isValid ? finalContent : undefined,
                appliedFixes,
                unresolvedIssues
            };
        }
        catch (error) {
            unresolvedIssues.push(`Repair process failed: ${error}`);
            return {
                success: false,
                appliedFixes,
                unresolvedIssues
            };
        }
    }
    /**
     * Get fallback statistics and summary
     */
    getFallbackSummary(results) {
        if (!results.success) {
            const errorInfo = results.error ? ` Error: ${results.error}` : '';
            return `❌ Traditional full file fallback mechanism could not find applicable modifications.${errorInfo} This suggests the request may need clarification or the project structure may not contain the targeted elements.`;
        }
        return `
✅ **TRADITIONAL FULL FILE FALLBACK SUCCESS**

**Approach:** ${results.approach}
**Files Modified:** ${results.modifiedFiles.length}
**Reasoning:** ${results.reasoning}

**Modified Files:**
${results.modifiedFiles.map(f => `  ✅ ${f}`).join('\n')}

**Summary:** The traditional fallback mechanism successfully applied comprehensive modifications using the original user prompt, demonstrating the effectiveness of the direct approach when AST-driven methods don't find matches.
    `.trim();
    }
}
exports.FallbackMechanism = FallbackMechanism;
//# sourceMappingURL=fallback.js.map