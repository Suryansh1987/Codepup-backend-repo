"use strict";
// ============================================================================
// STRUCTURE VALIDATOR: utils/StructureValidator.ts
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructureValidator = void 0;
class StructureValidator {
    setStreamCallback(callback) {
        this.streamCallback = callback;
    }
    streamUpdate(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
    }
    /**
     * Extracts comprehensive file structure information
     */
    extractFileStructure(content) {
        this.streamUpdate('🔍 Extracting file structure...');
        const lines = content.split('\n');
        const imports = [];
        const exports = [];
        const components = [];
        const hooks = [];
        let componentName = null;
        let hasDefaultExport = false;
        let importEndIndex = -1;
        let exportStartIndex = lines.length;
        // Parse each line for structure elements
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Import statements
            if (line.startsWith('import ')) {
                imports.push(lines[i]);
                importEndIndex = Math.max(importEndIndex, i);
            }
            // Export statements
            if (line.startsWith('export ')) {
                exports.push(lines[i]);
                exportStartIndex = Math.min(exportStartIndex, i);
                if (line.includes('export default')) {
                    hasDefaultExport = true;
                    const defaultMatch = line.match(/export\s+default\s+(\w+)/);
                    if (defaultMatch) {
                        componentName = defaultMatch[1];
                    }
                }
            }
            // Component definitions
            const componentMatch = line.match(/(?:function|const)\s+([A-Z]\w+)/);
            if (componentMatch) {
                components.push(componentMatch[1]);
                if (!componentName) {
                    componentName = componentMatch[1];
                }
            }
            // Hook usage
            const hookMatch = line.match(/use[A-Z]\w+/g);
            if (hookMatch) {
                hooks.push(...hookMatch);
            }
        }
        // Build file structure sections
        const fileHeader = importEndIndex >= 0 ?
            lines.slice(0, importEndIndex + 1).join('\n') + '\n\n' : '';
        const fileFooter = exportStartIndex < lines.length ?
            '\n\n' + lines.slice(exportStartIndex).join('\n') : '';
        const preservationPrompt = this.generatePreservationPrompt(imports, exports, componentName, hasDefaultExport);
        this.streamUpdate(`✅ Structure extracted: ${imports.length} imports, ${exports.length} exports, ${components.length} components`);
        return {
            imports,
            exports,
            componentName,
            hasDefaultExport,
            fileHeader,
            fileFooter,
            preservationPrompt,
            components,
            hooks: [...new Set(hooks)] // Remove duplicates
        };
    }
    /**
     * Performs strict validation of structure preservation
     */
    validateStructurePreservation(modifiedContent, originalStructure) {
        this.streamUpdate('🔍 Performing strict structure validation...');
        const errors = [];
        const warnings = [];
        let score = 100;
        // Check imports preservation
        for (const originalImport of originalStructure.imports) {
            const trimmedImport = originalImport.trim();
            if (!modifiedContent.includes(trimmedImport)) {
                // Try to find import by module path
                const importMatch = trimmedImport.match(/import\s+.*?from\s+['"]([^'"]+)['"]/);
                if (importMatch) {
                    const importPath = importMatch[1];
                    if (!modifiedContent.includes(importPath)) {
                        errors.push(`Missing import: ${trimmedImport}`);
                        score -= 15;
                    }
                    else {
                        warnings.push(`Import modified but path preserved: ${importPath}`);
                        score -= 5;
                    }
                }
                else {
                    errors.push(`Missing import: ${trimmedImport}`);
                    score -= 15;
                }
            }
        }
        // Check exports preservation
        for (const originalExport of originalStructure.exports) {
            const trimmedExport = originalExport.trim();
            if (!modifiedContent.includes(trimmedExport)) {
                errors.push(`Missing export: ${trimmedExport}`);
                score -= 20;
            }
        }
        // Check component name preservation
        if (originalStructure.componentName) {
            const componentRegex = new RegExp(`\\b${originalStructure.componentName}\\b`);
            if (!componentRegex.test(modifiedContent)) {
                errors.push(`Component name '${originalStructure.componentName}' not found`);
                score -= 25;
            }
        }
        // Check default export preservation
        if (originalStructure.hasDefaultExport && !modifiedContent.includes('export default')) {
            errors.push('Default export statement missing');
            score -= 20;
        }
        // Check for unexpected modifications
        const modifiedStructure = this.extractFileStructure(modifiedContent);
        // Warn about new imports
        const newImports = modifiedStructure.imports.filter(imp => !originalStructure.imports.some(orig => orig.trim() === imp.trim() ||
            this.extractImportPath(orig) === this.extractImportPath(imp)));
        if (newImports.length > 0) {
            warnings.push(`New imports added: ${newImports.length}`);
            score -= newImports.length * 2;
        }
        // Ensure score doesn't go below 0
        score = Math.max(0, score);
        const isValid = errors.length === 0;
        this.streamUpdate(`${isValid ? '✅' : '❌'} Strict validation: ${score}/100 (${errors.length} errors, ${warnings.length} warnings)`);
        return {
            isValid,
            errors,
            warnings,
            score
        };
    }
    /**
     * Performs relaxed validation allowing some structural changes
     */
    validateStructurePreservationRelaxed(modifiedContent, originalStructure) {
        this.streamUpdate('🔍 Performing relaxed structure validation...');
        const errors = [];
        const warnings = [];
        let score = 100;
        // Check if we have at least 70% of the original imports
        let foundImports = 0;
        for (const originalImport of originalStructure.imports) {
            const trimmedImport = originalImport.trim();
            const importPath = this.extractImportPath(trimmedImport);
            if (modifiedContent.includes(trimmedImport) ||
                (importPath && modifiedContent.includes(importPath))) {
                foundImports++;
            }
        }
        const importRatio = foundImports / Math.max(1, originalStructure.imports.length);
        if (importRatio < 0.7) {
            errors.push(`Only ${Math.round(importRatio * 100)}% of imports preserved (minimum 70%)`);
            score -= 30;
        }
        else if (importRatio < 0.9) {
            warnings.push(`${Math.round(importRatio * 100)}% of imports preserved`);
            score -= 10;
        }
        // Check exports (more strict for exports)
        let foundExports = 0;
        for (const originalExport of originalStructure.exports) {
            const trimmedExport = originalExport.trim();
            if (modifiedContent.includes(trimmedExport)) {
                foundExports++;
            }
        }
        const exportRatio = foundExports / Math.max(1, originalStructure.exports.length);
        if (exportRatio < 0.8) {
            errors.push(`Only ${Math.round(exportRatio * 100)}% of exports preserved (minimum 80%)`);
            score -= 25;
        }
        // Check component name (strict)
        if (originalStructure.componentName) {
            const componentRegex = new RegExp(`\\b${originalStructure.componentName}\\b`);
            if (!componentRegex.test(modifiedContent)) {
                errors.push(`Component name '${originalStructure.componentName}' not found`);
                score -= 20;
            }
        }
        // Check default export (allow some flexibility)
        if (originalStructure.hasDefaultExport) {
            if (!modifiedContent.includes('export default')) {
                errors.push('Default export statement missing');
                score -= 15;
            }
        }
        // Allow up to 2 errors for relaxed validation
        const isValid = errors.length <= 2;
        score = Math.max(0, score);
        this.streamUpdate(`${isValid ? '✅' : '❌'} Relaxed validation: ${score}/100 (${errors.length} errors, ${warnings.length} warnings)`);
        return {
            isValid,
            errors,
            warnings,
            score
        };
    }
    /**
     * Attempts to repair file structure issues
     */
    repairFileStructure(brokenContent, originalStructure, fallbackContent) {
        this.streamUpdate('🔧 Attempting file structure repair...');
        const repairResult = this.performStructureRepair(brokenContent, originalStructure);
        if (repairResult.success && repairResult.repairedContent) {
            this.streamUpdate(`✅ Structure repaired: ${repairResult.appliedFixes.join(', ')}`);
            // Validate the repair
            const validation = this.validateStructurePreservationRelaxed(repairResult.repairedContent, originalStructure);
            if (validation.isValid) {
                return repairResult.repairedContent;
            }
            else {
                this.streamUpdate('⚠️ Repair validation failed, trying aggressive repair...');
                return this.aggressiveFileRepair(fallbackContent, brokenContent, originalStructure);
            }
        }
        else {
            this.streamUpdate('❌ Basic repair failed, trying aggressive repair...');
            return this.aggressiveFileRepair(fallbackContent, brokenContent, originalStructure);
        }
    }
    /**
     * Analyzes file structure complexity and characteristics
     */
    analyzeFileStructure(content) {
        const structure = this.extractFileStructure(content);
        // Extract JSX elements
        const jsxElements = this.extractJSXElements(content);
        // Extract import paths
        const importPaths = structure.imports.map(imp => this.extractImportPath(imp)).filter(Boolean);
        // Determine export types
        const exportTypes = structure.exports.map(exp => {
            if (exp.includes('export default'))
                return 'default';
            if (exp.includes('export const'))
                return 'const';
            if (exp.includes('export function'))
                return 'function';
            if (exp.includes('export class'))
                return 'class';
            return 'other';
        });
        // Determine complexity
        let complexity = 'low';
        const complexityScore = structure.imports.length + structure.exports.length +
            structure.components.length + jsxElements.length;
        if (complexityScore > 20)
            complexity = 'high';
        else if (complexityScore > 10)
            complexity = 'medium';
        return {
            hasImports: structure.imports.length > 0,
            hasExports: structure.exports.length > 0,
            hasDefaultExport: structure.hasDefaultExport,
            componentNames: structure.components || [],
            importPaths,
            exportTypes,
            jsxElements,
            hooks: structure.hooks || [],
            complexity
        };
    }
    /**
     * Validates TypeScript/JavaScript syntax
     */
    validateSyntax(content) {
        const errors = [];
        const warnings = [];
        let score = 100;
        // Check for basic syntax issues
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;
            // Check for unmatched brackets
            const openBrackets = (line.match(/[{[(]/g) || []).length;
            const closeBrackets = (line.match(/[}\])]/g) || []).length;
            // Check for missing semicolons in certain contexts
            if (line.trim().match(/^(import|export|const|let|var|return)\s.*[^;{}]$/)) {
                warnings.push(`Line ${lineNum}: Missing semicolon`);
                score -= 1;
            }
            // Check for invalid JSX
            if (line.includes('<') && line.includes('>')) {
                if (!line.match(/<[A-Za-z][^>]*>/)) {
                    errors.push(`Line ${lineNum}: Invalid JSX syntax`);
                    score -= 5;
                }
            }
        }
        // Check overall bracket balance
        const allOpenBrackets = (content.match(/[{[(]/g) || []).length;
        const allCloseBrackets = (content.match(/[}\])]/g) || []).length;
        if (allOpenBrackets !== allCloseBrackets) {
            errors.push('Unmatched brackets in file');
            score -= 20;
        }
        score = Math.max(0, score);
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            score
        };
    }
    // Private helper methods
    generatePreservationPrompt(imports, exports, componentName, hasDefaultExport) {
        return `
**🚨 CRITICAL PRESERVATION REQUIREMENTS:**

**ALL IMPORTS (${imports.length}) - MUST BE PRESERVED EXACTLY:**
${imports.map((imp, idx) => `${idx + 1}. ${imp}`).join('\n')}

**ALL EXPORTS (${exports.length}) - MUST BE PRESERVED EXACTLY:**
${exports.map((exp, idx) => `${idx + 1}. ${exp}`).join('\n')}

**COMPONENT IDENTITY:**
✓ Main component: ${componentName || 'Not detected'}
✓ Has default export: ${hasDefaultExport ? 'Yes' : 'No'}

**🔒 STRICT RULES:**
1. Keep ALL import statements exactly as they are
2. Keep ALL export statements exactly as they are
3. Only modify JSX content and component logic
4. Preserve component names and function signatures
    `;
    }
    extractImportPath(importStatement) {
        const match = importStatement.match(/from\s+['"]([^'"]+)['"]/);
        return match ? match[1] : null;
    }
    extractJSXElements(content) {
        const jsxMatches = content.match(/<[A-Z][A-Za-z0-9]*\b[^>]*>/g) || [];
        return [...new Set(jsxMatches.map(match => { var _a; return (_a = match.match(/<([A-Z][A-Za-z0-9]*)/)) === null || _a === void 0 ? void 0 : _a[1]; }).filter(Boolean))];
    }
    performStructureRepair(brokenContent, originalStructure) {
        const appliedFixes = [];
        const unresolvedIssues = [];
        let repairedContent = brokenContent;
        try {
            const brokenLines = brokenContent.split('\n');
            const repairedLines = [];
            // Extract existing imports from broken content
            const existingImports = new Set();
            const contentWithoutImports = [];
            let foundFirstNonImport = false;
            for (const line of brokenLines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('import ') && !foundFirstNonImport) {
                    existingImports.add(trimmed);
                }
                else if (trimmed !== '' || foundFirstNonImport) {
                    foundFirstNonImport = true;
                    contentWithoutImports.push(line);
                }
            }
            // Merge original imports with existing imports
            const finalImports = new Set();
            // Add existing imports
            existingImports.forEach(imp => finalImports.add(imp));
            // Add missing original imports
            for (const originalImport of originalStructure.imports) {
                const trimmedOriginal = originalImport.trim();
                let found = false;
                for (const existing of existingImports) {
                    const originalPath = this.extractImportPath(trimmedOriginal);
                    const existingPath = this.extractImportPath(existing);
                    if (originalPath && existingPath && originalPath === existingPath) {
                        found = true;
                        break;
                    }
                    if (existing === trimmedOriginal) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    finalImports.add(trimmedOriginal);
                    appliedFixes.push(`Added missing import: ${trimmedOriginal}`);
                }
            }
            // Build repaired content
            Array.from(finalImports)
                .sort()
                .forEach(importLine => {
                repairedLines.push(importLine);
            });
            if (finalImports.size > 0) {
                repairedLines.push('');
            }
            repairedLines.push(...contentWithoutImports);
            let finalContent = repairedLines.join('\n');
            // Add missing exports
            for (const exportLine of originalStructure.exports) {
                const trimmedExport = exportLine.trim();
                if (!finalContent.includes(trimmedExport)) {
                    if (!finalContent.endsWith('\n')) {
                        finalContent += '\n';
                    }
                    finalContent += '\n' + exportLine;
                    appliedFixes.push(`Added missing export: ${trimmedExport}`);
                }
            }
            repairedContent = finalContent;
            return {
                success: true,
                repairedContent,
                appliedFixes,
                unresolvedIssues
            };
        }
        catch (error) {
            unresolvedIssues.push(`Repair failed: ${error}`);
            return {
                success: false,
                appliedFixes,
                unresolvedIssues
            };
        }
    }
    aggressiveFileRepair(originalContent, brokenContent, originalStructure) {
        this.streamUpdate('🚨 Attempting aggressive file repair...');
        try {
            const componentName = originalStructure.componentName || 'Component';
            // Try to extract the main component function/content
            const componentRegex = new RegExp(`(function\\s+${componentName}|const\\s+${componentName}\\s*=|export\\s+default\\s+function\\s+${componentName})([\\s\\S]*?)(?=\\n\\s*export|\\n\\s*$|$)`, 'i');
            const match = brokenContent.match(componentRegex);
            let componentContent = '';
            if (match) {
                componentContent = match[0];
            }
            else {
                // Extract everything after imports
                const lines = brokenContent.split('\n');
                let startIndex = 0;
                for (let i = 0; i < lines.length; i++) {
                    if (!lines[i].trim().startsWith('import ') && lines[i].trim() !== '') {
                        startIndex = i;
                        break;
                    }
                }
                componentContent = lines.slice(startIndex).join('\n');
            }
            // Rebuild the file with original structure
            const repairedLines = [];
            // Add all original imports
            originalStructure.imports.forEach(imp => repairedLines.push(imp));
            if (originalStructure.imports.length > 0) {
                repairedLines.push('');
            }
            // Add the component content
            repairedLines.push(componentContent);
            // Add missing exports
            const contentSoFar = repairedLines.join('\n');
            for (const exp of originalStructure.exports) {
                if (!contentSoFar.includes(exp.trim())) {
                    repairedLines.push('');
                    repairedLines.push(exp);
                }
            }
            const repairedContent = repairedLines.join('\n');
            this.streamUpdate('✅ Aggressive repair completed');
            return repairedContent;
        }
        catch (error) {
            this.streamUpdate(`❌ Aggressive repair failed: ${error}`);
            return null;
        }
    }
}
exports.StructureValidator = StructureValidator;
//# sourceMappingURL=Structurevalidator.js.map