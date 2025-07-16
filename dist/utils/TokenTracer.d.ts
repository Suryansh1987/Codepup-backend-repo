export interface TokenUsageStats {
    totalInputTokens: number;
    totalOutputTokens: number;
    apiCalls: number;
    totalTokens: number;
    estimatedCost: number;
}
export interface TokenUsageLog {
    timestamp: Date;
    operation: string;
    inputTokens: number;
    outputTokens: number;
    model: string;
    cost: number;
    stackTrace?: string;
}
export interface SessionStats {
    sessionStart: Date;
    sessionDuration: number;
    operationsPerformed: string[];
    averageTokensPerOperation: number;
    costBreakdown: {
        inputCost: number;
        outputCost: number;
        totalCost: number;
    };
}
export interface DebugInfo {
    duplicateDetection: {
        potentialDuplicates: Array<{
            indices: number[];
            operation: string;
            tokens: number;
            timeDiff: number;
        }>;
        totalDuplicateTokens: number;
    };
    operationAnalysis: {
        operationCounts: Record<string, number>;
        unusuallyLargeOperations: TokenUsageLog[];
        rapidSuccession: TokenUsageLog[];
    };
    tokenConsistency: {
        calculatedFromLogs: number;
        runningTotal: number;
        discrepancy: number;
    };
}
export declare class TokenTracker {
    private totalInputTokens;
    private totalOutputTokens;
    private apiCalls;
    private sessionStart;
    private operationLogs;
    private streamCallback?;
    private debugMode;
    private lastLogTime;
    private readonly PRICING;
    constructor(debugMode?: boolean);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    enableDebugMode(): void;
    disableDebugMode(): void;
    logUsage(usage: any, operation: string, model?: string): void;
    debugTokenDiscrepancy(): DebugInfo;
    private findPotentialDuplicates;
    private findRapidSuccessionCalls;
    private printDebugReport;
    checkForInstanceDuplication(): void;
    validateExpectedUsage(expectedCalls: number, averageTokensPerCall: number): {
        isValid: boolean;
        expectedTotal: number;
        actualTotal: number;
        deviation: number;
    };
    getStats(): TokenUsageStats;
    getDetailedStats(): SessionStats;
    getOperationLogs(): TokenUsageLog[];
    getTopExpensiveOperations(limit?: number): TokenUsageLog[];
    getOperationsByType(): Record<string, {
        count: number;
        totalCost: number;
        totalTokens: number;
    }>;
    getTotalTokens(): number;
    getEstimatedCost(): number;
    getTokensPerMinute(): number;
    getCostPerMinute(): number;
    generateUsageReport(): string;
    exportToJson(): string;
    exportToCsv(): string;
    reset(): void;
    isApproachingBudget(budgetLimit: number, warningThreshold?: number): {
        isApproaching: boolean;
        currentCost: number;
        remainingBudget: number;
        percentageUsed: number;
    };
    estimateRemainingOperations(budgetLimit: number): {
        estimatedOperations: number;
        averageCostPerOperation: number;
        remainingBudget: number;
    };
    getRecentActivity(lastN?: number): TokenUsageLog[];
    getTokenVelocity(): number;
}
