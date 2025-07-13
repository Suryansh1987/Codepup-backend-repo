import Anthropic from '@anthropic-ai/sdk';
import { ProjectFile, FallbackResult } from './types';
export declare class FallbackMechanism {
    private anthropic;
    private streamCallback?;
    constructor(anthropic: Anthropic);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    /**
     * Main fallback method - traditional full file approach with user prompt
     */
    executeComprehensiveFallback(prompt: string, projectFiles: Map<string, ProjectFile>, failedApproach: 'FULL_FILE' | 'TARGETED_NODES', originalFiles: string[]): Promise<FallbackResult>;
    /**
     * Quick filter to identify potentially relevant files
     */
    private quickFilterRelevantFiles;
    /**
     * Check if file should be skipped in fallback
     */
    private shouldSkipFileInFallback;
    /**
     * Apply traditional full file modifications using direct user prompt
     */
    private applyTraditionalFullFileModifications;
    /**
     * Apply traditional modification to a single file
     */
    private applyTraditionalModification;
    /**
     * Extract file structure for preservation
     */
    private extractFileStructure;
    /**
     * Validate file structure preservation
     */
    private validateFileStructure;
    /**
     * Attempt to repair file structure
     */
    private repairFileStructure;
    /**
     * Get fallback statistics and summary
     */
    getFallbackSummary(results: FallbackResult): string;
}
