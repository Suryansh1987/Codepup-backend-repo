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
declare class LLMCodeParser {
    /**
     * Unescapes JSON escaped strings
     */
    private static unescapeString;
    /**
     * Extracts JSON from text, handling various formats
     */
    private static extractJsonFromText;
    /**
     * Generates a file structure tree from code files
     */
    private static generateStructureTree;
    /**
     * Main parsing function - matches your parseFrontendCode signature
     */
    static parseFrontendCode(input: string): ParsedResult;
    /**
     * Write files to disk
     */
    /**
     * Get file by path
     */
    static getCodeFileByPath(codeFiles: CodeFile[], path: string): CodeFile | null;
    /**
     * Get files by extension
     */
    static getFilesByExtension(codeFiles: CodeFile[], extension: string): CodeFile[];
    /**
     * Get files by directory
     */
    static getFilesByDirectory(codeFiles: CodeFile[], directory: string): CodeFile[];
    /**
     * Preview files (useful for debugging)
     */
    static previewFiles(parsedResult: ParsedResult): void;
    /**
     * Validate files (check for common issues)
     */
    /**
     * Flatten structure tree for easier navigation
     */
    static flattenStructure(structure: StructureNode, basePath?: string): string[];
    /**
     * Get file status from structure
     */
    static getFileStatus(structure: StructureNode, filePath: string): string | null;
}
export default LLMCodeParser;
export { CodeFile, StructureNode, ParsedResult, ValidationResult };
