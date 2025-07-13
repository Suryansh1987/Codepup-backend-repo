interface ProjectFile {
    path: string;
    relativePath: string;
    content: string;
    lines: number;
    isMainFile: boolean;
    fileType: string;
    lastModified?: Date;
}
interface ChangeRecord {
    type: string;
    file: string;
    description: string;
    success: boolean;
    details?: {
        linesChanged?: number;
        changeType?: string[];
        reasoning?: string;
    };
}
interface TokenTracker {
    logUsage(usage: any, description: string): void;
    getStats(): {
        totalTokens: number;
        estimatedCost: number;
    };
}
export declare class FullFileProcessor {
    private anthropic;
    private tokenTracker;
    private streamCallback?;
    private basePath;
    private pathManager;
    private analyzer;
    private generator;
    constructor(anthropic: any, tokenTracker: TokenTracker, basePath?: string);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    processFullFileModification(prompt: string, folderNameOrProjectFiles: string | Map<string, ProjectFile>, streamCallbackOrBasePath?: ((message: string) => void) | string, legacyStreamCallback?: (message: string) => void): Promise<{
        success: boolean;
        changes?: ChangeRecord[];
        modifiedFiles?: string[];
    }>;
    private applyModificationsWithUpgradedMethod;
    /**
     * Helper methods (enhanced)
     */
    private resolveProjectPath;
    private loadProjectFiles;
    private shouldSkipDirectory;
    private isRelevantFile;
    private isMainFile;
    private determineFileType;
    process(prompt: string, projectFiles: Map<string, ProjectFile>, reactBasePath: string, streamCallback: (message: string) => void): Promise<{
        success: boolean;
        changes?: ChangeRecord[];
        modifiedFiles?: string[];
    }>;
    /**
     * Legacy method for compatibility
     */
    handleFullFileModification(prompt: string, projectFiles: Map<string, ProjectFile>, modificationSummary?: any): Promise<boolean>;
}
export {};
