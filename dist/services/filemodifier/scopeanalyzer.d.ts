import Anthropic from '@anthropic-ai/sdk';
import { ModificationScope } from './types';
interface TokenUsage {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
    Usage?: number;
}
declare class TokenTracker {
    private totalInputTokens;
    private totalOutputTokens;
    private totalCacheCreationTokens;
    private totalCacheReadTokens;
    private apiCalls;
    private operationHistory;
    logUsage(usage: TokenUsage, operation: string): void;
    getStats(): {
        totalTokens: number;
        inputTokens: number;
        outputTokens: number;
        cacheCreationTokens: number;
        cacheReadTokens: number;
        effectiveInputTokens: number;
        apiCalls: number;
        averageInputPerCall: number;
        averageOutputPerCall: number;
        operationHistory: {
            operation: string;
            inputTokens: number;
            outputTokens: number;
            cacheCreation?: number;
            cacheRead?: number;
            timestamp: Date;
        }[];
    };
    getDetailedReport(): string;
    reset(): void;
}
export declare class ScopeAnalyzer {
    private anthropic;
    private streamCallback?;
    private tokenTracker;
    constructor(anthropic: Anthropic);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    getTokenTracker(): TokenTracker;
    getTokenStats(): {
        totalTokens: number;
        inputTokens: number;
        outputTokens: number;
        cacheCreationTokens: number;
        cacheReadTokens: number;
        effectiveInputTokens: number;
        apiCalls: number;
        averageInputPerCall: number;
        averageOutputPerCall: number;
        operationHistory: {
            operation: string;
            inputTokens: number;
            outputTokens: number;
            cacheCreation?: number;
            cacheRead?: number;
            timestamp: Date;
        }[];
    };
    getTokenReport(): string;
    /**
     * Main scope analysis with TAILWIND_CHANGE support and token tracking
     */
    analyzeScope(prompt: string, projectSummary: string, conversationContext?: string, dbSummary?: string): Promise<ModificationScope>;
    /**
     * Enhanced heuristic analysis with TAILWIND_CHANGE detection
     */
    private performHeuristicAnalysis;
    /**
     * AI CALL: Enhanced method determination with TAILWIND_CHANGE support and token tracking
     */
    private determineModificationMethod;
    private parseMethodResponse;
    private extractSearchReplaceTerms;
    private generateSearchVariations;
    private suggestTargetFiles;
    /**
     * Extract color changes from prompt (for TAILWIND_CHANGE)
     */
    private extractColorChanges;
    /**
     * Extract component name from prompt (for COMPONENT_ADDITION)
     */
    private extractComponentName;
    /**
     * Determine component type (for COMPONENT_ADDITION)
     */
    private determineComponentType;
    shouldUseFallbackSearch(prompt: string, initialFiles: string[]): Promise<boolean>;
    determineModificationIntensity(prompt: string): 'FULL_FILE' | 'TARGETED_NODES' | 'TAILWIND_CHANGE';
    identifyDependencies(componentType: 'component' | 'page' | 'app', componentName: string, existingFiles: string[]): string[];
    validateScope(scope: ModificationScope, projectFiles: string[]): ModificationScope;
    generateReasoningText(prompt: string, scope: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'TAILWIND_CHANGE' | 'TEXT_BASED_CHANGE', files: string[], componentInfo?: {
        name?: string;
        type?: string;
    }, colorChanges?: Array<{
        type: string;
        color: string;
        target?: string;
    }>, textChangeAnalysis?: {
        searchTerm: string;
        replacementTerm: string;
        searchVariations: string[];
    }): string;
}
export {};
