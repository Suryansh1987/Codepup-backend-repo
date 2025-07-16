import { FileStructure } from '../services/filemodifier/types';
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    score: number;
}
export interface StructureAnalysis {
    hasImports: boolean;
    hasExports: boolean;
    hasDefaultExport: boolean;
    componentNames: string[];
    importPaths: string[];
    exportTypes: string[];
    jsxElements: string[];
    hooks: string[];
    complexity: 'low' | 'medium' | 'high';
}
export interface RepairResult {
    success: boolean;
    repairedContent?: string;
    appliedFixes: string[];
    unresolvedIssues: string[];
}
export declare class StructureValidator {
    private streamCallback?;
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    /**
     * Extracts comprehensive file structure information
     */
    extractFileStructure(content: string): FileStructure;
    /**
     * Performs strict validation of structure preservation
     */
    validateStructurePreservation(modifiedContent: string, originalStructure: FileStructure): ValidationResult;
    /**
     * Performs relaxed validation allowing some structural changes
     */
    validateStructurePreservationRelaxed(modifiedContent: string, originalStructure: FileStructure): ValidationResult;
    /**
     * Attempts to repair file structure issues
     */
    repairFileStructure(brokenContent: string, originalStructure: FileStructure, fallbackContent: string): string | null;
    /**
     * Analyzes file structure complexity and characteristics
     */
    analyzeFileStructure(content: string): StructureAnalysis;
    /**
     * Validates TypeScript/JavaScript syntax
     */
    validateSyntax(content: string): ValidationResult;
    private generatePreservationPrompt;
    private extractImportPath;
    private extractJSXElements;
    private performStructureRepair;
    private aggressiveFileRepair;
}
