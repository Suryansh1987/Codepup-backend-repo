interface CodeFile {
    path: string;
    content: string;
}
interface StructureNode {
    [key: string]: StructureNode | string;
}
interface ParsedResult {
    codeFiles: CodeFile[];
    structure: StructureNode;
}
interface ValidationResult {
    isValid: boolean;
    errors: string[];
}
declare function parseFrontendCode(input: string): ParsedResult;
declare function flattenStructure(structure: StructureNode, basePath?: string): string[];
declare function getFileStatus(structure: StructureNode, filePath: string): string | null;
declare function getCodeFileByPath(codeFiles: CodeFile[], path: string): CodeFile | null;
/**
 * Ensures tailwind.config.ts is first in the array for proper processing order
 */
declare function ensureTailwindConfigFirst(codeFiles: CodeFile[]): CodeFile[];
/**
 * Validates Tailwind config content for common issues
 */
declare function validateTailwindConfig(content: string): boolean;
/**
 * Corrects file paths to ensure proper structure (src/ vs root)
 */
declare function correctFilePaths(codeFiles: CodeFile[]): CodeFile[];
/**
 * Validates the overall file structure for common issues
 */
declare function validateFileStructure(codeFiles: CodeFile[]): ValidationResult;
/**
 * Validates Supabase folder structure and files
 */
declare function validateSupabaseStructure(codeFiles: CodeFile[]): ValidationResult;
/**
 * Gets all Supabase-related files from the project
 */
declare function getSupabaseFiles(codeFiles: CodeFile[]): {
    configFile: CodeFile | null;
    migrationFiles: CodeFile[];
    seedFile: CodeFile | null;
    allSupabaseFiles: CodeFile[];
};
/**
 * Gets the Tailwind config file from the code files array
 */
declare function getTailwindConfig(codeFiles: CodeFile[]): CodeFile | null;
/**
 * Processes and optimizes the code files for Tailwind-based projects
 */
declare function processTailwindProject(codeFiles: CodeFile[]): {
    processedFiles: CodeFile[];
    validationResult: ValidationResult;
    supabaseValidation: ValidationResult;
    tailwindConfig: CodeFile | null;
    supabaseFiles: ReturnType<typeof getSupabaseFiles>;
};
/**
 * Generates a summary report of the parsed project
 */
declare function generateProjectSummary(parsedResult: ParsedResult): {
    totalFiles: number;
    filesByType: Record<string, number>;
    structureDepth: number;
    hasValidStructure: boolean;
};
export { parseFrontendCode, flattenStructure, getFileStatus, getCodeFileByPath, ensureTailwindConfigFirst, validateTailwindConfig, correctFilePaths, validateFileStructure, validateSupabaseStructure, getSupabaseFiles, getTailwindConfig, processTailwindProject, generateProjectSummary, CodeFile, StructureNode, ParsedResult, ValidationResult, };
