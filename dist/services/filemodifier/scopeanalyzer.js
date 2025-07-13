"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScopeAnalyzer = void 0;
// Token Tracker class
class TokenTracker {
    constructor() {
        this.totalInputTokens = 0;
        this.totalOutputTokens = 0;
        this.totalCacheCreationTokens = 0;
        this.totalCacheReadTokens = 0;
        this.apiCalls = 0;
        this.operationHistory = [];
    }
    logUsage(usage, operation) {
        const inputTokens = usage.input_tokens || 0;
        const outputTokens = usage.output_tokens || 0;
        const cacheCreation = usage.cache_creation_input_tokens || 0;
        const cacheRead = usage.cache_read_input_tokens || 0;
        this.totalInputTokens += inputTokens;
        this.totalOutputTokens += outputTokens;
        this.totalCacheCreationTokens += cacheCreation;
        this.totalCacheReadTokens += cacheRead;
        this.apiCalls++;
        // Log operation
        this.operationHistory.push({
            operation,
            inputTokens,
            outputTokens,
            cacheCreation: cacheCreation > 0 ? cacheCreation : undefined,
            cacheRead: cacheRead > 0 ? cacheRead : undefined,
            timestamp: new Date()
        });
        console.log(`[SCOPE-TOKEN] ${operation}: ${inputTokens} in, ${outputTokens} out${cacheCreation > 0 ? `, ${cacheCreation} cache` : ''}${cacheRead > 0 ? `, ${cacheRead} cache-read` : ''}`);
    }
    getStats() {
        return {
            totalTokens: this.totalInputTokens + this.totalOutputTokens,
            inputTokens: this.totalInputTokens,
            outputTokens: this.totalOutputTokens,
            cacheCreationTokens: this.totalCacheCreationTokens,
            cacheReadTokens: this.totalCacheReadTokens,
            effectiveInputTokens: this.totalInputTokens - this.totalCacheReadTokens,
            apiCalls: this.apiCalls,
            averageInputPerCall: this.apiCalls > 0 ? Math.round(this.totalInputTokens / this.apiCalls) : 0,
            averageOutputPerCall: this.apiCalls > 0 ? Math.round(this.totalOutputTokens / this.apiCalls) : 0,
            operationHistory: this.operationHistory
        };
    }
    getDetailedReport() {
        const stats = this.getStats();
        const report = [
            `📊 SCOPE ANALYZER TOKEN USAGE REPORT`,
            `═══════════════════════════════════════`,
            `🔢 Total API Calls: ${stats.apiCalls}`,
            `📥 Total Input Tokens: ${stats.inputTokens.toLocaleString()}`,
            `📤 Total Output Tokens: ${stats.outputTokens.toLocaleString()}`,
            `🎯 Total Tokens Used: ${stats.totalTokens.toLocaleString()}`,
            ``
        ];
        if (stats.cacheCreationTokens > 0 || stats.cacheReadTokens > 0) {
            report.push(`💾 CACHE EFFICIENCY:`, `   Cache Creation: ${stats.cacheCreationTokens.toLocaleString()} tokens`, `   Cache Reads: ${stats.cacheReadTokens.toLocaleString()} tokens`, `   Effective Input: ${stats.effectiveInputTokens.toLocaleString()} tokens`, `   Cache Savings: ${((stats.cacheReadTokens / stats.totalTokens) * 100).toFixed(1)}%`, ``);
        }
        report.push(`📈 AVERAGES:`, `   Input per call: ${stats.averageInputPerCall} tokens`, `   Output per call: ${stats.averageOutputPerCall} tokens`, ``);
        if (stats.operationHistory.length > 0) {
            report.push(`🔍 OPERATION BREAKDOWN:`);
            const operationSummary = new Map();
            stats.operationHistory.forEach(op => {
                if (!operationSummary.has(op.operation)) {
                    operationSummary.set(op.operation, { calls: 0, totalInput: 0, totalOutput: 0 });
                }
                const summary = operationSummary.get(op.operation);
                summary.calls++;
                summary.totalInput += op.inputTokens;
                summary.totalOutput += op.outputTokens;
            });
            operationSummary.forEach((summary, operation) => {
                const avgInput = Math.round(summary.totalInput / summary.calls);
                const avgOutput = Math.round(summary.totalOutput / summary.calls);
                report.push(`   ${operation}: ${summary.calls} calls, avg ${avgInput}/${avgOutput} tokens`);
            });
        }
        return report.join('\n');
    }
    reset() {
        this.totalInputTokens = 0;
        this.totalOutputTokens = 0;
        this.totalCacheCreationTokens = 0;
        this.totalCacheReadTokens = 0;
        this.apiCalls = 0;
        this.operationHistory = [];
    }
}
class ScopeAnalyzer {
    constructor(anthropic) {
        this.anthropic = anthropic;
        this.tokenTracker = new TokenTracker();
    }
    setStreamCallback(callback) {
        this.streamCallback = callback;
    }
    streamUpdate(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
    }
    // Public method to get token tracker
    getTokenTracker() {
        return this.tokenTracker;
    }
    // Public method to get token stats
    getTokenStats() {
        return this.tokenTracker.getStats();
    }
    // Public method to get detailed token report
    getTokenReport() {
        return this.tokenTracker.getDetailedReport();
    }
    /**
     * Main scope analysis with TAILWIND_CHANGE support and token tracking
     */
    analyzeScope(prompt, projectSummary, conversationContext, dbSummary) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🤖 Starting enhanced AI-based method determination...');
            // First do a quick heuristic check
            const heuristicResult = this.performHeuristicAnalysis(prompt);
            this.streamUpdate(`💡 Heuristic analysis suggests: ${heuristicResult.suggestedScope} (confidence: ${heuristicResult.confidence}%)`);
            // AI CALL: Determine modification method with improved prompt (with token tracking)
            const method = yield this.determineModificationMethod(prompt, dbSummary || projectSummary, conversationContext, heuristicResult);
            const finalScope = Object.assign(Object.assign(Object.assign({ scope: method.scope, files: [], reasoning: method.reasoning }, (method.scope === "COMPONENT_ADDITION" && {
                componentName: this.extractComponentName(prompt),
                componentType: this.determineComponentType(prompt),
                dependencies: [] // Dependencies will be determined later
            })), (method.scope === "TAILWIND_CHANGE" && {
                colorChanges: this.extractColorChanges(prompt)
            })), (method.scope === "TEXT_BASED_CHANGE" && method.textChangeAnalysis && {
                textChangeAnalysis: method.textChangeAnalysis
            }));
            this.streamUpdate(`✅ Final method determination: ${finalScope.scope}`);
            // Log token summary
            const tokenStats = this.tokenTracker.getStats();
            this.streamUpdate(`💰 Scope Analysis Tokens: ${tokenStats.totalTokens} total (${tokenStats.apiCalls} API calls)`);
            return finalScope;
        });
    }
    /**
     * Enhanced heuristic analysis with TAILWIND_CHANGE detection
     */
    performHeuristicAnalysis(prompt) {
        const promptLower = prompt.toLowerCase();
        // Strong indicators for TEXT_BASED_CHANGE (highest priority for simple text replacements)
        const textChangePatterns = [
            /change\s+["']([^"']+)["']\s+to\s+["']([^"']+)["']/i,
            /replace\s+["']([^"']+)["']\s+with\s+["']([^"']+)["']/i,
            /update\s+["']([^"']+)["']\s+to\s+["']([^"']+)["']/i,
            /change\s+(\w+)\s+to\s+(\w+)/i,
            /replace\s+(\w+)\s+with\s+(\w+)/i,
            /update.*text.*to/i,
            /change.*heading.*to/i,
            /change.*label.*to/i,
            /update.*button.*text/i
        ];
        // Strong indicators for TAILWIND_CHANGE
        const tailwindChangeKeywords = [
            'change color', 'change background', 'change theme', 'change colors',
            'make it red', 'make it blue', 'make it green', 'make background',
            'color scheme', 'color palette', 'change to red', 'change to blue',
            'button color', 'text color', 'background color', 'primary color',
            'secondary color', 'accent color', 'theme color'
        ];
        // Strong indicators for COMPONENT_ADDITION
        const componentAdditionKeywords = [
            'create', 'add new', 'build new', 'make new', 'new component',
            'new page', 'new feature', 'add a', 'build a', 'create a'
        ];
        // Strong indicators for TARGETED_NODES
        const targetedKeywords = [
            'change button', 'make button', 'this button', 'the button',
            'change text', 'update text', 'modify text', 'this text',
            'change label', 'update label', 'modify label', 'the label',
            'one button', 'single button', 'specific', 'only', 'just change', 'just update'
        ];
        // Strong indicators for FULL_FILE
        const fullFileKeywords = [
            'redesign', 'overhaul', 'complete', 'entire', 'whole',
            'layout', 'responsive', 'mobile', 'restructure', 'rearrange',
            'organize', 'reorder', 'multiple', 'several', 'all buttons',
            'all text', 'dark mode', 'light mode', 'header', 'footer', 'navigation'
        ];
        let textChangeScore = 0;
        let tailwindScore = 0;
        let targetedScore = 0;
        let fullFileScore = 0;
        let componentScore = 0;
        // Score TEXT_BASED_CHANGE (highest priority for simple text replacements)
        for (const pattern of textChangePatterns) {
            if (pattern.test(prompt)) {
                textChangeScore += 50; // Very high score for explicit text replacement patterns
                break; // Only count once
            }
        }
        // Additional text change indicators
        if (promptLower.includes('change') && (promptLower.includes('text') || promptLower.includes('label') || promptLower.includes('heading'))) {
            textChangeScore += 25;
        }
        // Check for non-specific color changes (key indicator for TAILWIND_CHANGE)
        const hasColorKeyword = tailwindChangeKeywords.some(keyword => promptLower.includes(keyword));
        const hasSpecificTarget = promptLower.match(/\b(this|that|the|specific)\s+(button|text|element|component)/);
        const isGlobalColorChange = hasColorKeyword && !hasSpecificTarget;
        if (isGlobalColorChange) {
            tailwindScore += 40; // High priority for global color changes
            // Additional scoring for tailwind-specific patterns
            if (promptLower.match(/\b(primary|secondary|accent|theme)\s+(color|colors)/)) {
                tailwindScore += 30;
            }
            if (promptLower.match(/\b(change|make|set)\s+(background|bg)\s+(color|to)/)) {
                tailwindScore += 25;
            }
            if (promptLower.match(/\b(color\s+scheme|color\s+palette|theme\s+colors)/)) {
                tailwindScore += 35;
            }
        }
        // Score each category
        for (const keyword of componentAdditionKeywords) {
            if (promptLower.includes(keyword)) {
                componentScore += 20;
            }
        }
        for (const keyword of targetedKeywords) {
            if (promptLower.includes(keyword)) {
                targetedScore += 15;
            }
        }
        for (const keyword of fullFileKeywords) {
            if (promptLower.includes(keyword)) {
                fullFileScore += 10;
            }
        }
        // Additional scoring logic
        const wordCount = prompt.split(' ').length;
        if (wordCount <= 5 && textChangeScore === 0 && !isGlobalColorChange) {
            targetedScore += 20; // Short requests are usually targeted
        }
        else if (wordCount > 15) {
            fullFileScore += 10; // Long requests often need full file changes
        }
        // Check for specific patterns
        if (promptLower.match(/\b(one|single|specific|this|that)\s+(button|text|color|element)/)) {
            targetedScore += 25;
        }
        if (promptLower.match(/\b(all|every|multiple|several)\s+(button|text|element)/)) {
            fullFileScore += 20;
        }
        // Determine winner
        const maxScore = Math.max(textChangeScore, tailwindScore, targetedScore, fullFileScore, componentScore);
        let suggestedScope;
        let confidence;
        let reasoning;
        if (textChangeScore === maxScore && textChangeScore > 0) {
            suggestedScope = "TEXT_BASED_CHANGE";
            confidence = Math.min(95, textChangeScore);
            reasoning = "Simple text replacement pattern detected";
        }
        else if (tailwindScore === maxScore && tailwindScore > 0) {
            suggestedScope = "TAILWIND_CHANGE";
            confidence = Math.min(95, tailwindScore);
            reasoning = "Global color change detected - will modify tailwind.config.ts";
        }
        else if (componentScore === maxScore && componentScore > 0) {
            suggestedScope = "COMPONENT_ADDITION";
            confidence = Math.min(95, componentScore);
            reasoning = "Keywords suggest creating new component/page";
        }
        else if (targetedScore === maxScore && targetedScore > 0) {
            suggestedScope = "TARGETED_NODES";
            confidence = Math.min(95, targetedScore);
            reasoning = "Keywords suggest specific element modification";
        }
        else {
            suggestedScope = "FULL_FILE";
            confidence = Math.min(95, Math.max(50, fullFileScore)); // Minimum 50% for fallback
            reasoning = fullFileScore > 0 ? "Keywords suggest comprehensive changes" : "Default for unclear requests";
        }
        return { suggestedScope, confidence, reasoning };
    }
    /**
     * AI CALL: Enhanced method determination with TAILWIND_CHANGE support and token tracking
     */
    determineModificationMethod(prompt, projectSummary, conversationContext, heuristicResult) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const methodPrompt = `
**USER REQUEST:** "${prompt}"

**PROJECT SUMMARY:**
${projectSummary}

${conversationContext ? `**CONVERSATION CONTEXT:**\n${conversationContext}\n` : ''}

${heuristicResult ? `**HEURISTIC ANALYSIS:**\nSuggested: ${heuristicResult.suggestedScope} (${heuristicResult.confidence}% confidence)\nReason: ${heuristicResult.reasoning}\n` : ''}

**TASK:** Choose the MOST SPECIFIC modification method that can fulfill this request.

**METHOD OPTIONS (in order of preference - choose the most specific that applies):**

1. **TEXT_BASED_CHANGE** – For simple text replacements:
✅ CHOOSE THIS IF the request involves:
- Changing specific text content (labels, headings, button text)
- Replacing exact words or phrases
- Content updates without styling changes
- Requests like:
  "change 'Welcome' to 'Hello'"
  "update button text from 'Submit' to 'Send'"
  "replace 'Contact Us' with 'Get In Touch'"
  "change the heading to say 'About Our Company'"

**For TEXT_BASED_CHANGE requests, you MUST:**
1. **Extract exact search terms** from the user's request
2. **Identify exact replacement terms** the user wants
3. **Provide multiple search variations** (case variations, partial matches, etc.)

2. **TAILWIND_CHANGE** – For global color/theme changes without specific targets:
✅ CHOOSE THIS IF the request involves:
- Global color changes without specifying exact elements
- Theme color modifications (primary, secondary, accent colors)
- Background color changes for the entire site
- Color scheme or palette changes
- Requests like:
  "change background color to blue"
  "make the primary color red"
  "change button colors to green" (without specifying which buttons)
  "update the color scheme"
  "change theme colors"
  "make it more colorful"

3. **TARGETED_NODES** – For specific existing element changes:
✅ CHOOSE THIS IF the request targets:
- A specific existing element like a button, color, image, or style
- Modifying a single UI component or element (not adding)
- Requests with words like:
  "change THis "button text" button color to this"
  "make THIS text bold"
  "update SPECIFIC heading font"
  "replace THE image"
  "make THAT title larger"

4. **COMPONENT_ADDITION** – For creating new UI elements or features or pages:
✅ CHOOSE THIS IF the request involves:
- Adding new components, pages, or UI elements
- Creating something that doesn't exist yet
- Phrases like:
  "add a button"
  "create a card"
  "make a new page"
  "build user profile component"

5. **FULL_FILE** - For comprehensive changes (LAST RESORT):
✅ CHOOSE THIS ONLY IF the request requires:
- Multiple related changes across a file
- Layout restructuring or major design changes
- Changes that impact file structure or organization
- change in navbar and add navigation of cart page to carticon this is also in full file
-change the navbar and connect the profile page to user icon

**DECISION PRIORITY:**
1. If it's a simple TEXT replacement → TEXT_BASED_CHANGE
2. If it's about GLOBAL COLORS without specific targets → TAILWIND_CHANGE
3. If it's about ONE specific thing → TARGETED_NODES
4. If it's creating something NEW → COMPONENT_ADDITION  
5. If it needs MULTIPLE changes → FULL_FILE

**RESPOND WITH JSON:**
For TEXT_BASED_CHANGE, include textChangeAnalysis:
\`\`\`json
{
  "scope": "TEXT_BASED_CHANGE",
  "reasoning": "This is a simple text replacement request.",
  "textChangeAnalysis": {
    "searchTerm": "exact text to search for",
    "replacementTerm": "exact text to replace with",
    "searchVariations": ["variation1", "variation2", "case sensitive", "CASE SENSITIVE"]
  }
}
\`\`\`

For other methods:
\`\`\`json
{
  "scope": "TAILWIND_CHANGE",
  "reasoning": "This request involves global color changes that should be handled by modifying the tailwind.config.ts file to update theme colors."
}
\`\`\`
    `.trim();
            try {
                this.streamUpdate('🤖 Sending method determination request to AI...');
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 400,
                    temperature: 0,
                    messages: [{ role: 'user', content: methodPrompt }],
                });
                // Track token usage
                this.tokenTracker.logUsage(response.usage, 'Method Determination');
                const text = ((_a = response.content[0]) === null || _a === void 0 ? void 0 : _a.type) === 'text' ? response.content[0].text : '';
                return this.parseMethodResponse(text, heuristicResult);
            }
            catch (error) {
                this.streamUpdate(`❌ Method determination failed: ${error}`);
                // Use heuristic result as fallback
                const fallbackScope = (heuristicResult === null || heuristicResult === void 0 ? void 0 : heuristicResult.suggestedScope) || "FULL_FILE";
                return {
                    scope: fallbackScope,
                    reasoning: `API error - using heuristic fallback: ${(heuristicResult === null || heuristicResult === void 0 ? void 0 : heuristicResult.reasoning) || "Default to FULL_FILE"}`
                };
            }
        });
    }
    parseMethodResponse(text, heuristicResult) {
        try {
            // Extract JSON from the response
            const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            const parsed = JSON.parse(jsonMatch[1]);
            // Validate scope
            const validScopes = ["FULL_FILE", "TARGETED_NODES", "COMPONENT_ADDITION", "TAILWIND_CHANGE", "TEXT_BASED_CHANGE"];
            if (!validScopes.includes(parsed.scope)) {
                throw new Error(`Invalid scope: ${parsed.scope}`);
            }
            const result = {
                scope: parsed.scope,
                reasoning: parsed.reasoning || "No reasoning provided"
            };
            // Add textChangeAnalysis if present and scope is TEXT_BASED_CHANGE
            if (parsed.scope === "TEXT_BASED_CHANGE" && parsed.textChangeAnalysis) {
                result.textChangeAnalysis = {
                    searchTerm: parsed.textChangeAnalysis.searchTerm || "",
                    replacementTerm: parsed.textChangeAnalysis.replacementTerm || "",
                    searchVariations: parsed.textChangeAnalysis.searchVariations || []
                };
            }
            return result;
        }
        catch (error) {
            this.streamUpdate(`❌ Failed to parse method response: ${error}`);
            // Fallback to heuristic result or default
            const fallbackScope = (heuristicResult === null || heuristicResult === void 0 ? void 0 : heuristicResult.suggestedScope) || "FULL_FILE";
            return {
                scope: fallbackScope,
                reasoning: `Parse error - using fallback: ${(heuristicResult === null || heuristicResult === void 0 ? void 0 : heuristicResult.reasoning) || "Default to FULL_FILE"}`
            };
        }
    }
    extractSearchReplaceTerms(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const extractionPrompt = `
**USER REQUEST:** "${prompt}"

**TASK:** Extract the exact search and replacement terms from this request.

**INSTRUCTIONS:**
1. Identify what text the user wants to FIND/SEARCH for
2. Identify what text the user wants to REPLACE it with
3. Generate variations of the search term (case variations, partial matches, etc.)
4. Provide a confidence score (0-100) for the extraction accuracy

**COMMON PATTERNS:**
- "change 'X' to 'Y'" → search: "X", replace: "Y"
- "update X to Y" → search: "X", replace: "Y"
- "replace X with Y" → search: "X", replace: "Y"
- "make the heading say 'Y'" → search: [infer from context], replace: "Y"

**RESPOND WITH JSON:**
\`\`\`json
{
  "searchTerm": "exact text to search for",
  "replacementTerm": "exact text to replace with",
  "searchVariations": [
    "original term",
    "Original Term",
    "ORIGINAL TERM",
    "original",
    "partial match"
  ],
  "confidence": 95
}
\`\`\`
    `.trim();
            try {
                this.streamUpdate('🤖 Extracting search/replace terms with AI...');
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 300,
                    temperature: 0,
                    messages: [{ role: 'user', content: extractionPrompt }],
                });
                // Track token usage
                this.tokenTracker.logUsage(response.usage, 'Search/Replace Term Extraction');
                const text = ((_a = response.content[0]) === null || _a === void 0 ? void 0 : _a.type) === 'text' ? response.content[0].text : '';
                const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
                if (!jsonMatch) {
                    throw new Error('No JSON found in extraction response');
                }
                const parsed = JSON.parse(jsonMatch[1]);
                return {
                    searchTerm: parsed.searchTerm || "",
                    replacementTerm: parsed.replacementTerm || "",
                    searchVariations: parsed.searchVariations || [],
                    confidence: parsed.confidence || 0
                };
            }
            catch (error) {
                this.streamUpdate(`❌ Failed to extract search/replace terms: ${error}`);
                return {
                    searchTerm: "",
                    replacementTerm: "",
                    searchVariations: [],
                    confidence: 0
                };
            }
        });
    }
    generateSearchVariations(searchTerm) {
        const variations = new Set();
        // Add original term
        variations.add(searchTerm);
        // Case variations
        variations.add(searchTerm.toLowerCase());
        variations.add(searchTerm.toUpperCase());
        variations.add(searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1).toLowerCase());
        // Remove quotes if present
        const withoutQuotes = searchTerm.replace(/['"]/g, '');
        if (withoutQuotes !== searchTerm) {
            variations.add(withoutQuotes);
            variations.add(withoutQuotes.toLowerCase());
            variations.add(withoutQuotes.toUpperCase());
        }
        // Partial matches (first and last words for multi-word terms)
        const words = searchTerm.split(/\s+/);
        if (words.length > 1) {
            variations.add(words[0]);
            variations.add(words[words.length - 1]);
        }
        // Remove empty strings
        return Array.from(variations).filter(v => v.trim().length > 0);
    }
    suggestTargetFiles(searchTerm, projectSummary) {
        const targetFiles = [];
        // Common file patterns based on search term content
        const lowerSearchTerm = searchTerm.toLowerCase();
        // Navigation/header content
        if (lowerSearchTerm.includes('nav') || lowerSearchTerm.includes('menu') || lowerSearchTerm.includes('header')) {
            targetFiles.push('components/Navigation.tsx', 'components/Header.tsx', 'components/Navbar.tsx');
        }
        // Footer content
        if (lowerSearchTerm.includes('footer') || lowerSearchTerm.includes('contact') || lowerSearchTerm.includes('copyright')) {
            targetFiles.push('components/Footer.tsx');
        }
        // Button text
        if (lowerSearchTerm.includes('button') || lowerSearchTerm.includes('submit') || lowerSearchTerm.includes('click')) {
            targetFiles.push('components/Button.tsx', 'components/Forms.tsx');
        }
        // Page content
        if (lowerSearchTerm.includes('welcome') || lowerSearchTerm.includes('home') || lowerSearchTerm.includes('landing')) {
            targetFiles.push('pages/index.tsx', 'pages/Home.tsx', 'components/Hero.tsx');
        }
        // About content
        if (lowerSearchTerm.includes('about') || lowerSearchTerm.includes('company') || lowerSearchTerm.includes('team')) {
            targetFiles.push('pages/about.tsx', 'pages/About.tsx');
        }
        // Default fallback files
        if (targetFiles.length === 0) {
            targetFiles.push('pages/index.tsx', 'components/Layout.tsx', 'app/page.tsx');
        }
        return targetFiles;
    }
    /**
     * Extract color changes from prompt (for TAILWIND_CHANGE)
     */
    extractColorChanges(prompt) {
        const changes = [];
        const promptLower = prompt.toLowerCase();
        // Color extraction patterns
        const colorPatterns = [
            // Direct color mentions
            /(?:change|make|set)\s+(?:the\s+)?(?:background|bg)\s+(?:color\s+)?(?:to\s+)?([a-zA-Z]+|#[0-9a-fA-F]{3,6})/g,
            /(?:change|make|set)\s+(?:the\s+)?(?:primary|secondary|accent)\s+color\s+(?:to\s+)?([a-zA-Z]+|#[0-9a-fA-F]{3,6})/g,
            /(?:change|make|set)\s+(?:the\s+)?(?:button|text)\s+color\s+(?:to\s+)?([a-zA-Z]+|#[0-9a-fA-F]{3,6})/g,
            /make\s+it\s+([a-zA-Z]+)/g,
            /color\s+(?:scheme|palette)\s+(?:to\s+)?([a-zA-Z]+)/g
        ];
        colorPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(promptLower)) !== null) {
                const color = match[1];
                let type = 'general';
                if (match[0].includes('background') || match[0].includes('bg')) {
                    type = 'background';
                }
                else if (match[0].includes('primary')) {
                    type = 'primary';
                }
                else if (match[0].includes('secondary')) {
                    type = 'secondary';
                }
                else if (match[0].includes('accent')) {
                    type = 'accent';
                }
                else if (match[0].includes('button')) {
                    type = 'button';
                }
                else if (match[0].includes('text')) {
                    type = 'text';
                }
                changes.push({ type, color });
            }
        });
        // If no specific changes found, extract general color
        if (changes.length === 0) {
            const generalColorMatch = promptLower.match(/\b(red|blue|green|yellow|purple|orange|pink|black|white|gray|grey)\b/);
            if (generalColorMatch) {
                changes.push({ type: 'general', color: generalColorMatch[1] });
            }
        }
        return changes;
    }
    /**
     * Extract component name from prompt (for COMPONENT_ADDITION)
     */
    extractComponentName(prompt) {
        const patterns = [
            /(?:add|create|build|make|new)\s+(?:a\s+)?([A-Z][a-zA-Z]+)/i,
            /([A-Z][a-zA-Z]+)\s+(?:component|page)/i,
            /(?:component|page)\s+(?:called|named)\s+([A-Z][a-zA-Z]+)/i
        ];
        for (const pattern of patterns) {
            const match = prompt.match(pattern);
            if (match && match[1]) {
                const name = match[1].trim();
                return name.charAt(0).toUpperCase() + name.slice(1);
            }
        }
        return 'NewComponent'; // Default name
    }
    /**
     * Determine component type (for COMPONENT_ADDITION)
     */
    determineComponentType(prompt) {
        const promptLower = prompt.toLowerCase();
        if (promptLower.includes('page') || promptLower.includes('route') || promptLower.includes('screen')) {
            return 'page';
        }
        if (promptLower.includes('app') || promptLower.includes('main') || promptLower.includes('application')) {
            return 'app';
        }
        return 'component';
    }
    // Legacy methods for backward compatibility - enhanced with TAILWIND_CHANGE logic
    shouldUseFallbackSearch(prompt, initialFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            return false;
        });
    }
    determineModificationIntensity(prompt) {
        const heuristic = this.performHeuristicAnalysis(prompt);
        if (heuristic.suggestedScope === 'TAILWIND_CHANGE')
            return 'TAILWIND_CHANGE';
        return heuristic.suggestedScope === 'TARGETED_NODES' ? 'TARGETED_NODES' : 'FULL_FILE';
    }
    identifyDependencies(componentType, componentName, existingFiles) {
        if (componentType === 'page') {
            return existingFiles.filter(f => f.includes('App.tsx') || f.includes('App.jsx'));
        }
        return [];
    }
    validateScope(scope, projectFiles) {
        return Object.assign(Object.assign({}, scope), { files: [] });
    }
    generateReasoningText(prompt, scope, files, componentInfo, colorChanges, textChangeAnalysis) {
        const baseReasoning = `Method determination: ${scope} approach selected for request: "${prompt}"`;
        if (scope === 'COMPONENT_ADDITION' && componentInfo) {
            return `${baseReasoning}. Will create new ${componentInfo.type}: ${componentInfo.name}`;
        }
        if (scope === 'TAILWIND_CHANGE' && colorChanges && colorChanges.length > 0) {
            const colorSummary = colorChanges.map(change => `${change.type}: ${change.color}`).join(', ');
            return `${baseReasoning}. Will modify tailwind.config.ts to update colors: ${colorSummary}`;
        }
        if (scope === 'TEXT_BASED_CHANGE' && textChangeAnalysis) {
            return `${baseReasoning}. Will perform text replacement: "${textChangeAnalysis.searchTerm}" → "${textChangeAnalysis.replacementTerm}"`;
        }
        return `${baseReasoning}. File analysis and element tree generation will determine specific targets.`;
    }
}
exports.ScopeAnalyzer = ScopeAnalyzer;
//# sourceMappingURL=scopeanalyzer.js.map