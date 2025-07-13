interface ProjectFile {
    path: string;
    relativePath?: string;
    content: string;
    lines: number;
    size: number;
    lastModified?: Date;
}
interface TokenUsage {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
}
declare class TokenTracker {
    private totalInputTokens;
    private totalOutputTokens;
    private apiCalls;
    logUsage(usage: TokenUsage, operation: string): void;
    getStats(): {
        totalTokens: number;
        inputTokens: number;
        outputTokens: number;
        apiCalls: number;
    };
    reset(): void;
}
export declare class TwoPhaseASTProcessor {
    private anthropic;
    private tokenTracker;
    private astAnalyzer;
    private streamCallback?;
    private reactBasePath;
    constructor(anthropic: any, reactBasePath?: string);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    processBatchModification(prompt: string, projectFiles: Map<string, ProjectFile>, reactBasePath: string, streamCallback: (message: string) => void): Promise<{
        success: boolean;
        projectFiles?: Map<string, ProjectFile>;
        updatedProjectFiles?: Map<string, ProjectFile>;
        changes?: Array<{
            type: string;
            file: string;
            description: string;
            success: boolean;
            details?: any;
        }>;
    }>;
    private buildMinimalTree;
    private analyzeTree;
    private extractAndModify;
    private generateModifications;
    private generateIntelligentFallbackModifications;
    private applyModificationsFixed;
    private escapeRegExp;
    private calculateSimilarity;
    private findFileKey;
    private buildChangeReport;
    private resolveFilePath;
    private normalizeFilePath;
    private shouldAnalyzeFile;
    processTargetedModification(prompt: string, projectFiles: Map<string, ProjectFile>, reactBasePath: string, streamCallback: (message: string) => void): Promise<{
        success: boolean;
        projectFiles?: Map<string, ProjectFile>;
        updatedProjectFiles?: Map<string, ProjectFile>;
        changes?: Array<{
            type: string;
            file: string;
            description: string;
            success: boolean;
            details?: any;
        }>;
    }>;
    process(prompt: string, projectFiles: Map<string, ProjectFile>, reactBasePath: string, streamCallback: (message: string) => void): Promise<{
        success: boolean;
        projectFiles?: Map<string, ProjectFile>;
        updatedProjectFiles?: Map<string, ProjectFile>;
        changes?: Array<{
            type: string;
            file: string;
            description: string;
            success: boolean;
            details?: any;
        }>;
    }>;
    handleTargetedModification(prompt: string, projectFiles: Map<string, ProjectFile>, modificationSummary?: any): Promise<boolean>;
    processGranularModification(prompt: string, projectFiles: Map<string, ProjectFile>, reactBasePath: string, streamCallback: (message: string) => void): Promise<{
        success: boolean;
        projectFiles?: Map<string, ProjectFile>;
        updatedProjectFiles?: Map<string, ProjectFile>;
        changes?: Array<{
            type: string;
            file: string;
            description: string;
            success: boolean;
            details?: any;
        }>;
    }>;
    getTokenTracker(): TokenTracker;
}
export default TwoPhaseASTProcessor;
export { TwoPhaseASTProcessor as BatchASTProcessor };
export { TwoPhaseASTProcessor as GranularASTProcessor };
export { TwoPhaseASTProcessor as TargetedNodesProcessor };
export { TwoPhaseASTProcessor as OptimizedBatchProcessor };
