import { ProjectFile, ASTNode, FileRelevanceResult } from '../filemodifier/types';
import { TokenTracker } from '../../utils/TokenTracer';
export declare class ASTAnalyzer {
    private streamCallback?;
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    /**
     * Check if a file should be excluded from AST analysis
     */
    private shouldExcludeFile;
    /**
     * Enhanced file parsing that respects exclusions
     */
    parseFileWithAST(filePath: string, projectFiles: Map<string, ProjectFile>): ASTNode[];
    /**
     * Detect if file content suggests it's a UI library file
     */
    private isUILibraryFile;
    /**
     * Check if a JSX tag name represents a UI library component
     */
    private isUILibraryComponent;
    /**
     * Enhanced file relevance analysis with UI exclusion
     */
    analyzeFileRelevance(prompt: string, filePath: string, astNodes: ASTNode[], modificationMethod: 'FULL_FILE' | 'TARGETED_NODES', projectFiles: Map<string, ProjectFile>, anthropic: any, tokenTracker: TokenTracker): Promise<FileRelevanceResult>;
    private parseSimpleRelevanceResponse;
    /**
     * Enhanced forced analysis that respects exclusions
     */
    forceAnalyzeSpecificFiles(prompt: string, filePaths: string[], method: 'FULL_FILE' | 'TARGETED_NODES', projectFiles: Map<string, ProjectFile>, anthropic: any, tokenTracker: TokenTracker): Promise<Array<{
        filePath: string;
        isRelevant: boolean;
        score: number;
        reasoning: string;
        targetNodes?: ASTNode[];
    }>>;
    /**
     * Get statistics about filtered components
     */
    getFilteringStats(projectFiles: Map<string, ProjectFile>): {
        totalFiles: number;
        excludedFiles: number;
        analyzableFiles: number;
        excludedPaths: string[];
    };
}
