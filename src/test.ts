// scope-test.ts - Independent Scope Analyzer for CLI Testing
import Anthropic from '@anthropic-ai/sdk';

// Scope types
type ModificationScope = "FULL_FILE" | "TARGETED_NODES" | "COMPONENT_ADDITION" | "TAILWIND_CHANGE" | "TEXT_BASED_CHANGE";

interface ScopeResult {
  scope: ModificationScope;
  reasoning: string;
  textChangeAnalysis?: {
    searchTerm: string;
    replacementTerm: string;
    searchVariations: string[];
  };
  colorChanges?: Array<{
    type: string;
    color: string;
    target?: string;
  }>;
  componentName?: string;
  componentType?: 'component' | 'page' | 'app';
}

export class ScopeTest {
  private anthropic: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Test scope determination for a given prompt
   */
  async testScope(prompt: string): Promise<ScopeResult> {
    console.log(`🔍 Testing prompt: "${prompt}"`);
    console.log('🤖 Analyzing with AI...');

    const result = await this.determineScope(prompt);
    
    console.log(`✅ Result: ${result.scope}`);
    console.log(`💭 Reasoning: ${result.reasoning}`);
    
    if (result.textChangeAnalysis) {
      console.log(`📝 Text Change: "${result.textChangeAnalysis.searchTerm}" → "${result.textChangeAnalysis.replacementTerm}"`);
    }
    
    if (result.colorChanges && result.colorChanges.length > 0) {
      console.log(`🎨 Color Changes: ${result.colorChanges.map(c => `${c.type}:${c.color}`).join(', ')}`);
    }
    
    if (result.componentName) {
      console.log(`🧩 Component: ${result.componentName} (${result.componentType})`);
    }

    return result;
  }

  /**
   * AI-based scope determination
   */
  private async determineScope(prompt: string): Promise<ScopeResult> {
    const scopePrompt = `
**USER REQUEST:** "${prompt}"

**TASK:** Choose the MOST SPECIFIC modification method that can fulfill this request.

**METHOD OPTIONS (in order of preference - choose the most specific that applies):**

1. **TEXT_BASED_CHANGE** – For pure content replacement:
✅ CHOOSE THIS IF the request involves:
- Only changing text content (no styling, positioning, or visual changes)
- Simple word/phrase replacements across the entire page/component
- Content updates without any visual modifications or specific element targeting
- Requests like:
  "change 'Welcome' to 'Hello'"
  "replace 'Contact Us' with 'Get in Touch'"
  "update all instances of 'Services' to 'Our Services'"
  "change 'Copyright 2024' to 'Copyright 2025'"

For TEXT_BASED_CHANGE requests, you MUST:
- Extract exact search terms from the user's request
- Identify exact replacement terms the user wants
- Provide multiple search variations (case variations, partial matches, etc.)

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

3. **TARGETED_NODES** – For specific element modifications:
✅ CHOOSE THIS IF the request targets:
- Specific existing elements with any kind of modification
- Descriptive targeting of particular UI components or locations
- Changes that specify WHERE the modification should happen
- Any styling, visual, or structural changes to specific elements
- Requests with descriptive targeting like:
  "change this button's color to blue"
  "make that title larger and bold"
  "update the footer background"
  "replace the header image"
  "in footer visit us today change location to bangalore,India"
  "make this specific text bold"
  "update the navigation menu links"
  "change the sidebar content"

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
- Change in navbar and add navigation of cart page to carticon
- Change the navbar and connect the profile page to user icon

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

For TAILWIND_CHANGE, include colorChanges:
\`\`\`json
{
  "scope": "TAILWIND_CHANGE",
  "reasoning": "This request involves global color changes that should be handled by modifying the tailwind.config.ts file.",
  "colorChanges": [
    {"type": "background", "color": "blue"},
    {"type": "primary", "color": "red"}
  ]
}
\`\`\`

For COMPONENT_ADDITION, include component details:
\`\`\`json
{
  "scope": "COMPONENT_ADDITION",
  "reasoning": "This request involves creating a new component.",
  "componentName": "UserProfile",
  "componentType": "component"
}
\`\`\`

For other methods:
\`\`\`json
{
  "scope": "TARGETED_NODES",
  "reasoning": "This request targets specific elements for modification."
}
\`\`\`
    `.trim();

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 600,
        temperature: 0,
        messages: [{ role: 'user', content: scopePrompt }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
      return this.parseResponse(text);
    } catch (error) {
      console.error(`❌ API error: ${error}`);
      return { 
        scope: "FULL_FILE", 
        reasoning: `API error - defaulting to FULL_FILE: ${error}` 
      };
    }
  }

  /**
   * Parse AI response into structured result
   */
  private parseResponse(text: string): ScopeResult {
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[1]);
      
      // Validate scope
      const validScopes: ModificationScope[] = ["FULL_FILE", "TARGETED_NODES", "COMPONENT_ADDITION", "TAILWIND_CHANGE", "TEXT_BASED_CHANGE"];
      if (!validScopes.includes(parsed.scope)) {
        throw new Error(`Invalid scope: ${parsed.scope}`);
      }

      const result: ScopeResult = {
        scope: parsed.scope,
        reasoning: parsed.reasoning || "No reasoning provided"
      };

      // Add specific analysis based on scope type
      if (parsed.scope === "TEXT_BASED_CHANGE" && parsed.textChangeAnalysis) {
        result.textChangeAnalysis = {
          searchTerm: parsed.textChangeAnalysis.searchTerm || "",
          replacementTerm: parsed.textChangeAnalysis.replacementTerm || "",
          searchVariations: parsed.textChangeAnalysis.searchVariations || []
        };
      }

      if (parsed.scope === "TAILWIND_CHANGE" && parsed.colorChanges) {
        result.colorChanges = parsed.colorChanges;
      }

      if (parsed.scope === "COMPONENT_ADDITION") {
        result.componentName = parsed.componentName || "NewComponent";
        result.componentType = parsed.componentType || "component";
      }

      return result;
    } catch (error) {
      console.error(`❌ Failed to parse response: ${error}`);
      return { 
        scope: "FULL_FILE", 
        reasoning: `Parse error - defaulting to FULL_FILE: ${error}` 
      };
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: npm run test-scope "your prompt here"');
    console.log('Example: npm run test-scope "change Welcome to Hello"');
    process.exit(1);
  }

  const prompt = args.join(' ');
  const tester = new ScopeTest();
  
  try {
    await tester.testScope(prompt);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export default ScopeTest;