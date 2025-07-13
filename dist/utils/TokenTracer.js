"use strict";
// ============================================================================
// TOKEN TRACKER: utils/TokenTracker.ts - Enhanced with Debugging
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenTracker = void 0;
class TokenTracker {
    constructor(debugMode = false) {
        this.totalInputTokens = 0;
        this.totalOutputTokens = 0;
        this.apiCalls = 0;
        this.sessionStart = new Date();
        this.operationLogs = [];
        this.debugMode = false;
        this.lastLogTime = 0;
        // Claude Sonnet pricing (as of 2024)
        this.PRICING = {
            'claude-3-5-sonnet-20240620': {
                input: 0.000003, // $3 per 1M input tokens
                output: 0.000015 // $15 per 1M output tokens
            },
            'claude-3-sonnet': {
                input: 0.000003,
                output: 0.000015
            },
            'claude-3-opus': {
                input: 0.000015,
                output: 0.000075
            },
            'claude-3-haiku': {
                input: 0.00000025,
                output: 0.00000125
            }
        };
        this.sessionStart = new Date();
        this.debugMode = debugMode;
        if (this.debugMode) {
            console.log('🐛 TokenTracker initialized in DEBUG MODE');
        }
    }
    setStreamCallback(callback) {
        this.streamCallback = callback;
    }
    streamUpdate(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
    }
    enableDebugMode() {
        this.debugMode = true;
        this.streamUpdate('🐛 Debug mode enabled - will track call stack traces');
    }
    disableDebugMode() {
        this.debugMode = false;
        this.streamUpdate('🐛 Debug mode disabled');
    }
    logUsage(usage, operation, model = 'claude-3-5-sonnet-20240620') {
        var _a;
        if (!usage) {
            this.streamUpdate(`⚠️ No usage data provided for operation: ${operation}`);
            return;
        }
        const inputTokens = usage.input_tokens || 0;
        const outputTokens = usage.output_tokens || 0;
        const currentTime = Date.now();
        // 🐛 DEBUGGING: Check for rapid successive calls with same tokens
        if (this.debugMode) {
            const timeSinceLastLog = currentTime - this.lastLogTime;
            if (timeSinceLastLog < 100 && this.operationLogs.length > 0) {
                const lastLog = this.operationLogs[this.operationLogs.length - 1];
                if (lastLog.inputTokens === inputTokens && lastLog.outputTokens === outputTokens) {
                    console.warn(`🚨 POTENTIAL DUPLICATE: ${operation} - Same tokens (${inputTokens}+${outputTokens}) logged ${timeSinceLastLog}ms apart`);
                    this.streamUpdate(`🚨 POTENTIAL DUPLICATE DETECTED: ${operation}`);
                }
            }
        }
        this.lastLogTime = currentTime;
        // Calculate cost for this operation
        const pricing = this.PRICING[model] || this.PRICING['claude-3-5-sonnet-20240620'];
        const operationCost = (inputTokens * pricing.input) + (outputTokens * pricing.output);
        // 🐛 DEBUGGING: Capture stack trace if in debug mode
        let stackTrace;
        if (this.debugMode) {
            stackTrace = (_a = new Error().stack) === null || _a === void 0 ? void 0 : _a.split('\n').slice(2, 8).join('\n');
        }
        // Update totals
        this.totalInputTokens += inputTokens;
        this.totalOutputTokens += outputTokens;
        this.apiCalls++;
        // Log this operation
        const logEntry = {
            timestamp: new Date(),
            operation,
            inputTokens,
            outputTokens,
            model,
            cost: operationCost,
            stackTrace
        };
        this.operationLogs.push(logEntry);
        // 🐛 DEBUGGING: Verify totals consistency
        if (this.debugMode) {
            const calculatedTotal = this.operationLogs.reduce((sum, log) => sum + log.inputTokens + log.outputTokens, 0);
            const runningTotal = this.totalInputTokens + this.totalOutputTokens;
            if (calculatedTotal !== runningTotal) {
                console.error(`🚨 TOKEN MISMATCH: Calculated=${calculatedTotal}, Running=${runningTotal}`);
                this.streamUpdate(`🚨 TOKEN CONSISTENCY ERROR DETECTED!`);
            }
        }
        // Stream updates
        this.streamUpdate(`📊 ${operation}`);
        this.streamUpdate(`  📥 Input: ${inputTokens.toLocaleString()} tokens`);
        this.streamUpdate(`  📤 Output: ${outputTokens.toLocaleString()} tokens`);
        this.streamUpdate(`  💰 Cost: $${operationCost.toFixed(6)}`);
        this.streamUpdate(`🔢 Session Totals:`);
        this.streamUpdate(`  📊 Total: ${this.getTotalTokens().toLocaleString()} tokens`);
        this.streamUpdate(`  🎯 API Calls: ${this.apiCalls}`);
        this.streamUpdate(`  💵 Total Cost: $${this.getEstimatedCost().toFixed(6)}`);
        // 🐛 DEBUGGING: Alert on unusually large token counts
        const totalForThisCall = inputTokens + outputTokens;
        if (totalForThisCall > 8000) {
            this.streamUpdate(`⚠️ LARGE OPERATION: ${operation} used ${totalForThisCall.toLocaleString()} tokens`);
        }
    }
    // 🐛 NEW: Comprehensive debugging method
    debugTokenDiscrepancy() {
        console.log('\n🐛 === TOKEN TRACKING DEBUG ANALYSIS ===');
        // Calculate totals from logs vs running totals
        const calculatedInput = this.operationLogs.reduce((sum, log) => sum + log.inputTokens, 0);
        const calculatedOutput = this.operationLogs.reduce((sum, log) => sum + log.outputTokens, 0);
        const calculatedTotal = calculatedInput + calculatedOutput;
        const runningTotal = this.totalInputTokens + this.totalOutputTokens;
        const discrepancy = runningTotal - calculatedTotal;
        console.log(`Expected total (17 × 1657): 28,169 tokens`);
        console.log(`Calculated from logs: ${calculatedTotal.toLocaleString()} tokens`);
        console.log(`Running total: ${runningTotal.toLocaleString()} tokens`);
        console.log(`Discrepancy: ${discrepancy.toLocaleString()} tokens`);
        console.log(`Multiplier factor: ${(runningTotal / 28169).toFixed(2)}x`);
        // Detect potential duplicates
        const duplicates = this.findPotentialDuplicates();
        // Analyze operations
        const operationCounts = {};
        this.operationLogs.forEach(log => {
            const baseOp = log.operation.split(':')[0];
            operationCounts[baseOp] = (operationCounts[baseOp] || 0) + 1;
        });
        // Find unusually large operations
        const unusuallyLarge = this.operationLogs.filter(log => (log.inputTokens + log.outputTokens) > 8000);
        // Find rapid succession calls
        const rapidSuccession = this.findRapidSuccessionCalls();
        const debugInfo = {
            duplicateDetection: {
                potentialDuplicates: duplicates,
                totalDuplicateTokens: duplicates.reduce((sum, dup) => sum + dup.tokens, 0)
            },
            operationAnalysis: {
                operationCounts,
                unusuallyLargeOperations: unusuallyLarge,
                rapidSuccession
            },
            tokenConsistency: {
                calculatedFromLogs: calculatedTotal,
                runningTotal,
                discrepancy
            }
        };
        this.printDebugReport(debugInfo);
        return debugInfo;
    }
    findPotentialDuplicates() {
        const duplicates = [];
        for (let i = 0; i < this.operationLogs.length - 1; i++) {
            const current = this.operationLogs[i];
            const next = this.operationLogs[i + 1];
            const timeDiff = next.timestamp.getTime() - current.timestamp.getTime();
            if (current.inputTokens === next.inputTokens &&
                current.outputTokens === next.outputTokens &&
                timeDiff < 1000) { // Within 1 second
                duplicates.push({
                    indices: [i, i + 1],
                    operation: current.operation,
                    tokens: current.inputTokens + current.outputTokens,
                    timeDiff
                });
            }
        }
        return duplicates;
    }
    findRapidSuccessionCalls() {
        const rapidCalls = [];
        for (let i = 1; i < this.operationLogs.length; i++) {
            const current = this.operationLogs[i];
            const previous = this.operationLogs[i - 1];
            const timeDiff = current.timestamp.getTime() - previous.timestamp.getTime();
            if (timeDiff < 100) { // Less than 100ms apart
                rapidCalls.push(current);
            }
        }
        return rapidCalls;
    }
    printDebugReport(debugInfo) {
        console.log('\n📊 DUPLICATE ANALYSIS:');
        if (debugInfo.duplicateDetection.potentialDuplicates.length > 0) {
            debugInfo.duplicateDetection.potentialDuplicates.forEach((dup, i) => {
                console.log(`  ${i + 1}. ${dup.operation}: ${dup.tokens} tokens (${dup.timeDiff}ms apart)`);
            });
            console.log(`  Total duplicate tokens: ${debugInfo.duplicateDetection.totalDuplicateTokens.toLocaleString()}`);
        }
        else {
            console.log('  ✅ No obvious duplicates found');
        }
        console.log('\n📈 OPERATION FREQUENCY:');
        Object.entries(debugInfo.operationAnalysis.operationCounts)
            .sort(([, a], [, b]) => b - a)
            .forEach(([op, count]) => {
            console.log(`  ${op}: ${count} calls`);
        });
        console.log('\n🔍 LARGE OPERATIONS:');
        if (debugInfo.operationAnalysis.unusuallyLargeOperations.length > 0) {
            debugInfo.operationAnalysis.unusuallyLargeOperations.forEach(log => {
                const total = log.inputTokens + log.outputTokens;
                console.log(`  ${log.operation}: ${total.toLocaleString()} tokens`);
            });
        }
        else {
            console.log('  ✅ No unusually large operations');
        }
        console.log('\n⚡ RAPID SUCCESSION CALLS:');
        if (debugInfo.operationAnalysis.rapidSuccession.length > 0) {
            debugInfo.operationAnalysis.rapidSuccession.forEach(log => {
                console.log(`  ${log.operation}: ${log.inputTokens + log.outputTokens} tokens`);
            });
        }
        else {
            console.log('  ✅ No rapid succession calls detected');
        }
    }
    // 🐛 NEW: Method to check if this tracker instance has been duplicated
    checkForInstanceDuplication() {
        // This would help detect if multiple TokenTracker instances are being used
        const key = '__TOKEN_TRACKER_INSTANCE_COUNT__';
        const globalObj = globalThis;
        if (!globalObj[key]) {
            globalObj[key] = 0;
        }
        globalObj[key]++;
        if (globalObj[key] > 1) {
            console.warn(`🚨 MULTIPLE TOKEN TRACKER INSTANCES: ${globalObj[key]} instances detected`);
            this.streamUpdate(`🚨 WARNING: ${globalObj[key]} TokenTracker instances detected - this may cause double counting!`);
        }
    }
    // 🐛 NEW: Method to validate against expected token count
    validateExpectedUsage(expectedCalls, averageTokensPerCall) {
        const expectedTotal = expectedCalls * averageTokensPerCall;
        const actualTotal = this.getTotalTokens();
        const deviation = ((actualTotal - expectedTotal) / expectedTotal) * 100;
        const result = {
            isValid: Math.abs(deviation) < 10, // Within 10% is considered valid
            expectedTotal,
            actualTotal,
            deviation
        };
        console.log('\n🎯 EXPECTED VS ACTUAL VALIDATION:');
        console.log(`Expected: ${expectedTotal.toLocaleString()} tokens (${expectedCalls} calls × ${averageTokensPerCall} avg)`);
        console.log(`Actual: ${actualTotal.toLocaleString()} tokens`);
        console.log(`Deviation: ${deviation.toFixed(1)}%`);
        console.log(`Status: ${result.isValid ? '✅ VALID' : '❌ SUSPICIOUS'}`);
        return result;
    }
    getStats() {
        const totalTokens = this.totalInputTokens + this.totalOutputTokens;
        const estimatedCost = this.getEstimatedCost();
        return {
            totalInputTokens: this.totalInputTokens,
            totalOutputTokens: this.totalOutputTokens,
            apiCalls: this.apiCalls,
            totalTokens,
            estimatedCost
        };
    }
    getDetailedStats() {
        const now = new Date();
        const sessionDuration = (now.getTime() - this.sessionStart.getTime()) / (1000 * 60); // in minutes
        const operationsPerformed = this.operationLogs.map(log => log.operation);
        const averageTokensPerOperation = this.apiCalls > 0 ?
            (this.totalInputTokens + this.totalOutputTokens) / this.apiCalls : 0;
        const inputCost = this.operationLogs.reduce((sum, log) => {
            const pricing = this.PRICING[log.model] || this.PRICING['claude-3-5-sonnet-20240620'];
            return sum + (log.inputTokens * pricing.input);
        }, 0);
        const outputCost = this.operationLogs.reduce((sum, log) => {
            const pricing = this.PRICING[log.model] || this.PRICING['claude-3-5-sonnet-20240620'];
            return sum + (log.outputTokens * pricing.output);
        }, 0);
        return {
            sessionStart: this.sessionStart,
            sessionDuration,
            operationsPerformed,
            averageTokensPerOperation,
            costBreakdown: {
                inputCost,
                outputCost,
                totalCost: inputCost + outputCost
            }
        };
    }
    getOperationLogs() {
        return [...this.operationLogs];
    }
    getTopExpensiveOperations(limit = 5) {
        return [...this.operationLogs]
            .sort((a, b) => b.cost - a.cost)
            .slice(0, limit);
    }
    getOperationsByType() {
        const operationSummary = {};
        this.operationLogs.forEach(log => {
            const baseOperation = log.operation.split(':')[0]; // Extract base operation name
            if (!operationSummary[baseOperation]) {
                operationSummary[baseOperation] = { count: 0, totalCost: 0, totalTokens: 0 };
            }
            operationSummary[baseOperation].count++;
            operationSummary[baseOperation].totalCost += log.cost;
            operationSummary[baseOperation].totalTokens += log.inputTokens + log.outputTokens;
        });
        return operationSummary;
    }
    getTotalTokens() {
        return this.totalInputTokens + this.totalOutputTokens;
    }
    getEstimatedCost() {
        return this.operationLogs.reduce((sum, log) => sum + log.cost, 0);
    }
    getTokensPerMinute() {
        const sessionDurationMinutes = (new Date().getTime() - this.sessionStart.getTime()) / (1000 * 60);
        return sessionDurationMinutes > 0 ? this.getTotalTokens() / sessionDurationMinutes : 0;
    }
    getCostPerMinute() {
        const sessionDurationMinutes = (new Date().getTime() - this.sessionStart.getTime()) / (1000 * 60);
        return sessionDurationMinutes > 0 ? this.getEstimatedCost() / sessionDurationMinutes : 0;
    }
    generateUsageReport() {
        const stats = this.getDetailedStats();
        const operationsByType = this.getOperationsByType();
        const topExpensive = this.getTopExpensiveOperations();
        let report = `
🔍 **TOKEN USAGE REPORT**
═══════════════════════════════════════

📊 **SESSION OVERVIEW**
- Session Duration: ${stats.sessionDuration.toFixed(1)} minutes
- Total API Calls: ${this.apiCalls}
- Total Tokens: ${this.getTotalTokens().toLocaleString()}
- Total Cost: $${this.getEstimatedCost().toFixed(6)}

📈 **PERFORMANCE METRICS**
- Tokens per Minute: ${this.getTokensPerMinute().toFixed(0)}
- Cost per Minute: $${this.getCostPerMinute().toFixed(6)}
- Average Tokens per Operation: ${stats.averageTokensPerOperation.toFixed(0)}

💰 **COST BREAKDOWN**
- Input Tokens Cost: $${stats.costBreakdown.inputCost.toFixed(6)}
- Output Tokens Cost: $${stats.costBreakdown.outputCost.toFixed(6)}
- Total Cost: $${stats.costBreakdown.totalCost.toFixed(6)}

🎯 **OPERATIONS BY TYPE**
`;
        Object.entries(operationsByType)
            .sort(([, a], [, b]) => b.totalCost - a.totalCost)
            .forEach(([operation, data]) => {
            report += `- ${operation}: ${data.count} calls, ${data.totalTokens.toLocaleString()} tokens, $${data.totalCost.toFixed(6)}\n`;
        });
        report += `\n💸 **TOP EXPENSIVE OPERATIONS**\n`;
        topExpensive.forEach((log, index) => {
            report += `${index + 1}. ${log.operation}: $${log.cost.toFixed(6)} (${(log.inputTokens + log.outputTokens).toLocaleString()} tokens)\n`;
        });
        return report;
    }
    exportToJson() {
        return JSON.stringify({
            sessionStats: this.getDetailedStats(),
            operationLogs: this.operationLogs,
            summary: this.getStats(),
            debugInfo: this.debugMode ? this.debugTokenDiscrepancy() : null
        }, null, 2);
    }
    exportToCsv() {
        const headers = ['Timestamp', 'Operation', 'Input Tokens', 'Output Tokens', 'Total Tokens', 'Model', 'Cost'];
        const rows = this.operationLogs.map(log => [
            log.timestamp.toISOString(),
            log.operation,
            log.inputTokens.toString(),
            log.outputTokens.toString(),
            (log.inputTokens + log.outputTokens).toString(),
            log.model,
            log.cost.toFixed(8)
        ]);
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
    reset() {
        const oldStats = this.getStats();
        this.totalInputTokens = 0;
        this.totalOutputTokens = 0;
        this.apiCalls = 0;
        this.sessionStart = new Date();
        this.operationLogs = [];
        this.streamUpdate('🔄 Token tracking reset');
        this.streamUpdate(`📊 Previous session: ${oldStats.totalTokens.toLocaleString()} tokens, $${oldStats.estimatedCost.toFixed(6)}`);
        this.streamUpdate('🆕 Starting new tracking session...');
    }
    // Utility method for budget tracking
    isApproachingBudget(budgetLimit, warningThreshold = 0.8) {
        const currentCost = this.getEstimatedCost();
        const percentageUsed = currentCost / budgetLimit;
        const isApproaching = percentageUsed >= warningThreshold;
        const remainingBudget = budgetLimit - currentCost;
        if (isApproaching) {
            this.streamUpdate(`⚠️ Budget Warning: ${(percentageUsed * 100).toFixed(1)}% of budget used`);
            this.streamUpdate(`💰 Current: $${currentCost.toFixed(6)} / Budget: $${budgetLimit.toFixed(6)}`);
            this.streamUpdate(`📉 Remaining: $${remainingBudget.toFixed(6)}`);
        }
        return {
            isApproaching,
            currentCost,
            remainingBudget,
            percentageUsed
        };
    }
    // Method to estimate remaining operations given a budget
    estimateRemainingOperations(budgetLimit) {
        const currentCost = this.getEstimatedCost();
        const remainingBudget = budgetLimit - currentCost;
        const averageCostPerOperation = this.apiCalls > 0 ? currentCost / this.apiCalls : 0;
        const estimatedOperations = averageCostPerOperation > 0 ?
            Math.floor(remainingBudget / averageCostPerOperation) : 0;
        return {
            estimatedOperations,
            averageCostPerOperation,
            remainingBudget
        };
    }
    // Method to get recent activity (last N operations)
    getRecentActivity(lastN = 10) {
        return this.operationLogs.slice(-lastN);
    }
    // Method to track token velocity (tokens per second)
    getTokenVelocity() {
        const sessionDurationSeconds = (new Date().getTime() - this.sessionStart.getTime()) / 1000;
        return sessionDurationSeconds > 0 ? this.getTotalTokens() / sessionDurationSeconds : 0;
    }
}
exports.TokenTracker = TokenTracker;
//# sourceMappingURL=TokenTracer.js.map