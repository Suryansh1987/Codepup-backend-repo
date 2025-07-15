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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeFunctionService = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
class ClaudeFunctionService {
    constructor() {
        this.client = new sdk_1.default();
    }
    analyzeDesign(userPrompt, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const message = yield this.client.messages.create({
                model: "claude-sonnet-4-0",
                max_tokens: 1000,
                temperature: 0.3,
                system: `You are a business and design consultant. Analyze the user's business requirements and provide design recommendations.

           IMPORTANT: Always call the save_design_analysis function with your analysis.`,
                tools: [
                    {
                        name: "save_design_analysis",
                        description: "Save the design analysis and recommendations for the user's business",
                        input_schema: {
                            type: "object",
                            properties: {
                                businessType: {
                                    type: "string",
                                    description: "Type of business detected",
                                },
                                businessName: {
                                    type: "string",
                                    description: "Name of the business",
                                },
                                recommendedColors: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "Array of recommended hex colors",
                                },
                                allColorOptions: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "All available color options",
                                },
                                recommendedLayout: {
                                    type: "string",
                                    description: "Best layout for this business",
                                },
                                recommendedLayoutExplanation: {
                                    type: "string",
                                    description: "Why this layout works",
                                },
                                colorExplanation: {
                                    type: "string",
                                    description: "Why these colors work",
                                },
                                vibe: {
                                    type: "string",
                                    description: "Overall design vibe/style",
                                },
                                differentSections: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "Recommended page sections",
                                },
                                differentLayouts: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "Different layout options",
                                },
                                layoutStyles: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "Different style approaches",
                                },
                            },
                            required: [
                                "businessType",
                                "recommendedColors",
                                "recommendedLayout",
                                "vibe",
                            ],
                        },
                    },
                ],
                messages: [{ role: "user", content: userPrompt }],
            });
            return this.handleFunctionCall(message, userId);
        });
    }
    handleUserFeedback(feedback, userId, currentDesign) {
        return __awaiter(this, void 0, void 0, function* () {
            const contextPrompt = `
      Current design choices:
      ${JSON.stringify(currentDesign, null, 2)}

      User feedback: "${feedback}"

      Based on the user's feedback, decide what to do next. If they want changes, update the design. If they're satisfied, proceed to generate files.`;
            const message = yield this.client.messages.create({
                model: "claude-sonnet-4-0",
                max_tokens: 1500,
                temperature: 0.3,
                system: `You are helping refine a website design based on user feedback. 

                You have two options:
                1. If user wants changes: Update the design and call update_design_choices
                2. If user is satisfied: Call proceed_to_generation

                Analyze their feedback and choose the appropriate action.`,
                tools: [
                    {
                        name: "update_design_choices",
                        description: "Update the design choices based on user feedback",
                        input_schema: {
                            type: "object",
                            properties: {
                                updatedDesign: {
                                    type: "object",
                                    properties: {
                                        businessType: { type: "string" },
                                        businessName: { type: "string" },
                                        recommendedColors: {
                                            type: "array",
                                            items: { type: "string" },
                                        },
                                        allColorOptions: { type: "array", items: { type: "string" } },
                                        recommendedLayout: { type: "string" },
                                        recommendedLayoutExplanation: { type: "string" },
                                        colorExplanation: { type: "string" },
                                        vibe: { type: "string" },
                                        differentSections: {
                                            type: "array",
                                            items: { type: "string" },
                                        },
                                        differentLayouts: {
                                            type: "array",
                                            items: { type: "string" },
                                        },
                                        layoutStyles: { type: "array", items: { type: "string" } },
                                    },
                                    required: [
                                        "businessType",
                                        "recommendedColors",
                                        "recommendedLayout",
                                        "vibe",
                                    ],
                                },
                                explanation: {
                                    type: "string",
                                    description: "Brief explanation of what was changed and why",
                                },
                                needsMoreInfo: {
                                    type: "boolean",
                                    description: "Whether you need more information from the user",
                                },
                                question: {
                                    type: "string",
                                    description: "Follow-up question if needsMoreInfo is true",
                                },
                            },
                            required: ["updatedDesign", "explanation", "needsMoreInfo"],
                        },
                    },
                    {
                        name: "proceed_to_generation",
                        description: "User is satisfied with the design, proceed to file generation",
                        input_schema: {
                            type: "object",
                            properties: {
                                finalDesign: {
                                    type: "object",
                                    description: "The final approved design choices",
                                },
                                message: {
                                    type: "string",
                                    description: "Confirmation message to user",
                                },
                            },
                            required: ["finalDesign", "message"],
                        },
                    },
                ],
                messages: [{ role: "user", content: contextPrompt }],
            });
            return this.handleFunctionCall(message, userId);
        });
    }
    generateDesignFiles(finalDesign, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const generationPrompt = `Create files for: ${JSON.stringify(finalDesign, null, 2)}`;
            const message = yield this.client.messages.create({
                model: "claude-sonnet-4-0",
                max_tokens: 8000,
                temperature: 0.1, // Very low temperature for predictable behavior
                system: `Call generate_design_files function immediately. No explanations.`,
                tools: [
                    {
                        name: "generate_design_files",
                        description: "Generate design system files",
                        input_schema: {
                            type: "object",
                            properties: {
                                files: {
                                    type: "object",
                                    properties: {
                                        "tailwind.config.ts": {
                                            type: "string",
                                            description: "Concise Tailwind config with essential colors only",
                                        },
                                        "globals.css": {
                                            type: "string",
                                            description: "Essential global CSS, keep it minimal",
                                        },
                                        "design-system.md": {
                                            type: "string",
                                            description: "Brief design system documentation",
                                        },
                                    },
                                    required: ["tailwind.config.ts", "globals.css"],
                                },
                                summary: { type: "string" },
                            },
                            required: ["files", "summary"],
                        },
                    },
                ],
                tool_choice: { type: "tool", name: "generate_design_files" },
                messages: [{ role: "user", content: generationPrompt }],
            });
            return this.handleFunctionCall(message, userId);
        });
    }
    generateFileStructurePlan(designChoices, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const planningPrompt = `
        Based on this design analysis:
        ${JSON.stringify(designChoices, null, 2)}
        
        Create a simple file structure plan for a full-stack e-commerce application.
        
        Just list what frontend and backend files need to be created and their purpose. No config files needed , and make a single seed file only named as seed.sql , make  backend code in a supabase folder the structure should be like all the migration files should be inside /supabase/migrations folder and  the seed files should be inside /supabase/seed.sql file. the frontend code files lucation should be relative to the src folder like ./src/pages/Home.tsx
        `;
            const message = yield this.client.messages.create({
                model: "claude-sonnet-4-0",
                max_tokens: 6000,
                temperature: 0.3,
                system: `You are a software architect creating a simple file structure plan.
  
            Just focus on:
            - Frontend files (pages, components, contexts, utils)
            - Backend files (database migrations, seeds)
            - Brief purpose for each file
            
            No config files needed - keep it simple.
            
            You MUST call the generate_file_structure_plan function.`,
                tools: [
                    {
                        name: "generate_file_structure_plan",
                        description: "Generate simple file structure plan",
                        input_schema: {
                            type: "object",
                            properties: {
                                fileStructure: {
                                    type: "object",
                                    properties: {
                                        frontend: {
                                            type: "object",
                                            properties: {
                                                pages: {
                                                    type: "array",
                                                    items: {
                                                        type: "object",
                                                        properties: {
                                                            filePath: { type: "string" },
                                                            purpose: { type: "string" },
                                                        },
                                                    },
                                                },
                                                components: {
                                                    type: "array",
                                                    items: {
                                                        type: "object",
                                                        properties: {
                                                            filePath: { type: "string" },
                                                            purpose: { type: "string" },
                                                        },
                                                    },
                                                },
                                                contexts: {
                                                    type: "array",
                                                    items: {
                                                        type: "object",
                                                        properties: {
                                                            filePath: { type: "string" },
                                                            purpose: { type: "string" },
                                                        },
                                                    },
                                                },
                                                utils: {
                                                    type: "array",
                                                    items: {
                                                        type: "object",
                                                        properties: {
                                                            filePath: { type: "string" },
                                                            purpose: { type: "string" },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                        backend: {
                                            type: "object",
                                            properties: {
                                                database: {
                                                    type: "array",
                                                    items: {
                                                        type: "object",
                                                        properties: {
                                                            filePath: { type: "string" },
                                                            purpose: { type: "string" },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                                totalFileCount: { type: "number" },
                            },
                            required: ["fileStructure", "totalFileCount"],
                        },
                    },
                ],
                tool_choice: { type: "tool", name: "generate_file_structure_plan" },
                messages: [{ role: "user", content: planningPrompt }],
            });
            return this.handleFunctionCall(message, userId);
        });
    }
    updateDocumentationWithStructure(designChoices, structurePlan, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const updatePrompt = `
  Update documentation with the file structure plan.
  
  Design choices:
  ${JSON.stringify(designChoices, null, 2)}
  
  File structure:
  ${JSON.stringify(structurePlan, null, 2)}
  
  Create:
  1. Updated design-system.md (add file structure section)
  2. New project-structure.md (list all files and their purposes)
  `;
            const message = yield this.client.messages.create({
                model: "claude-sonnet-4-0",
                max_tokens: 6000,
                temperature: 0.2,
                system: `Update project documentation with the file structure.
  
  Create simple, clear documentation that lists:
  - What files will be created
  - Purpose of each file
  - Basic organization
  
  Keep it simple and focused.`,
                tools: [
                    {
                        name: "update_documentation",
                        description: "Update documentation with file structure",
                        input_schema: {
                            type: "object",
                            properties: {
                                updatedFiles: {
                                    type: "object",
                                    properties: {
                                        "design-system.md": {
                                            type: "string",
                                            description: "Updated design system with file structure info",
                                        },
                                        "project-structure.md": {
                                            type: "string",
                                            description: "New file listing all project files and purposes",
                                        },
                                    },
                                    required: ["design-system.md", "project-structure.md"],
                                },
                            },
                            required: ["updatedFiles"],
                        },
                    },
                ],
                tool_choice: { type: "tool", name: "update_documentation" },
                messages: [{ role: "user", content: updatePrompt }],
            });
            return this.handleFunctionCall(message, userId);
        });
    }
    generateBackendFiles(designChoices, structurePlan, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const backendPrompt = `
      Generate Supabase backend files for this e-commerce application:
      
      Design Analysis:
      ${JSON.stringify(designChoices, null, 2)}
      
      File Structure Plan:
      ${JSON.stringify(structurePlan, null, 2)}
      
      Create:
      1. Complete database migration with proper RLS policies
      2. Comprehensive seed data with admin user
      3. TypeScript interfaces for all entities
      
      Follow these CRITICAL rules from the base prompt:
      - RLS policies use SECURITY DEFINER functions in PUBLIC schema
      - Admin user created in both auth.users AND profiles tables
      - All inserts use ON CONFLICT DO NOTHING for idempotency
      - Use single quotes for strings, proper UUID escaping
      - Include trigger function for new user signup
      `;
            const message = yield this.client.messages.create({
                model: "claude-sonnet-4-0",
                max_tokens: 15000,
                temperature: 0.1,
                system: `You are a Supabase database architect specializing in secure e-commerce applications.
  
      CRITICAL DATABASE RULES (MANDATORY):
      
      1. RLS Policy Syntax:
      - Use SECURITY DEFINER functions in PUBLIC schema (NOT auth schema)
      - Basic user access: auth.uid() = user_id
      - Admin access: public.is_admin() function
      - NEVER use EXISTS() on the same table (infinite recursion)
      
      2. Migration Structure:
      - Start with: ALTER DATABASE postgres SET row_security = on;
      - Enable UUID extension
      - Create tables with proper relationships
      - Add RLS policies for each table
      - Include trigger function for new user signup
      
      3. Seed Data Rules:
      - Use single quotes around values: 'value'
      - Escape apostrophes: 'I''m happy'
      - UUID format: '00000000-0000-0000-0000-000000000001'
      - All inserts use ON CONFLICT DO NOTHING
      - Create admin in auth.users AND profiles
      
      4. Required Tables for E-commerce:
      - profiles (user management)
      - products (inventory)
      - categories (product organization)
      - orders (customer orders)
      - order_items (order details)
      - cart_items (shopping cart)
      - reviews (optional)
      
      You MUST call the generate_backend_files function.`,
                tools: [
                    {
                        name: "generate_backend_files",
                        description: "Generate complete Supabase backend files",
                        input_schema: {
                            type: "object",
                            properties: {
                                files: {
                                    type: "object",
                                    properties: {
                                        "supabase/migrations/001_initial_schema.sql": {
                                            type: "string",
                                            description: "Complete database migration with RLS policies",
                                        },
                                        "supabase/seed.sql": {
                                            type: "string",
                                            description: "Seed data with admin user and sample content",
                                        },
                                        "src/types/index.ts": {
                                            type: "string",
                                            description: "TypeScript interfaces for all database entities",
                                        },
                                    },
                                    required: [
                                        "supabase/migrations/001_initial_schema.sql",
                                        "supabase/seed.sql",
                                        "src/types/index.ts",
                                    ],
                                },
                                summary: {
                                    type: "string",
                                    description: "Brief summary of what was created",
                                },
                                databaseSchema: {
                                    type: "object",
                                    properties: {
                                        tables: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    name: { type: "string" },
                                                    purpose: { type: "string" },
                                                    keyFields: { type: "array", items: { type: "string" } },
                                                },
                                            },
                                        },
                                        relationships: {
                                            type: "array",
                                            items: { type: "string" },
                                        },
                                    },
                                },
                            },
                            required: ["files", "summary", "databaseSchema"],
                        },
                    },
                ],
                tool_choice: { type: "tool", name: "generate_backend_files" },
                messages: [{ role: "user", content: backendPrompt }],
            });
            return this.handleFunctionCall(message, userId);
        });
    }
    // Handle function call responses
    handleFunctionCall(message, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = {
                success: false,
                tokenused: message.usage.output_tokens,
                inputTokens: message.usage.input_tokens,
                stopReason: message.stop_reason,
            };
            console.log(`🔍 Claude response stop_reason: ${message.stop_reason}`);
            console.log(`🔍 Claude response content:`, JSON.stringify(message.content, null, 2));
            // Check if Claude wants to use a tool
            if (message.stop_reason === "tool_use") {
                const toolUse = message.content.find((content) => content.type === "tool_use");
                if (toolUse) {
                    console.log(`🛠️ Function called: ${toolUse.name}`);
                    console.log(`📋 Function input:`, JSON.stringify(toolUse.input, null, 2));
                    response.success = true;
                    response.functionCalled = toolUse.name;
                    response.functionInput = toolUse.input;
                    response.toolId = toolUse.id;
                    // Handle different function types
                    switch (toolUse.name) {
                        case "save_design_analysis":
                            response.step = "review";
                            response.designChoices = toolUse.input;
                            response.message =
                                "Here's my design analysis. Please review these choices and let me know what you'd like to change, or tell me if you'd like to proceed!";
                            break;
                        case "update_design_choices":
                            response.step = toolUse.input.needsMoreInfo ? "refine" : "review";
                            response.designChoices = toolUse.input.updatedDesign;
                            response.explanation = toolUse.input.explanation;
                            response.needsMoreInfo = toolUse.input.needsMoreInfo;
                            response.question = toolUse.input.question;
                            response.message = toolUse.input.needsMoreInfo
                                ? toolUse.input.question
                                : `${toolUse.input.explanation} Please review the updated design or let me know if you'd like more changes.`;
                            break;
                        case "proceed_to_generation":
                            response.step = "generate";
                            response.finalDesign = toolUse.input.finalDesign;
                            response.message = toolUse.input.message;
                            response.readyToGenerate = true;
                            break;
                        case "generate_design_files":
                            console.log(`✅ Files generated successfully!`);
                            console.log(`📁 File count:`, Object.keys(toolUse.input.files || {}).length);
                            response.step = "completed";
                            response.files = toolUse.input.files;
                            response.summary = toolUse.input.summary;
                            response.usageInstructions = toolUse.input.usage_instructions;
                            response.message =
                                "Your design files have been generated successfully!";
                            break;
                        case "generate_file_structure_plan":
                            response.step = "structure_planned";
                            response.fileStructure = toolUse.input.fileStructure;
                            response.totalFileCount = toolUse.input.totalFileCount;
                            response.message = "File structure plan generated!";
                            break;
                        case "update_documentation":
                            response.step = "documentation_updated";
                            response.updatedFiles = toolUse.input.updatedFiles;
                            response.message = "Documentation updated!";
                            break;
                        case "generate_backend_files":
                            console.log(`✅ Backend files generated successfully!`);
                            console.log(`📁 File count:`, Object.keys(toolUse.input.files || {}).length);
                            response.step = "backend_completed";
                            response.files = toolUse.input.files;
                            response.summary = toolUse.input.summary;
                            response.databaseSchema = toolUse.input.databaseSchema;
                            response.message =
                                "Backend files (migration, seed, types) generated successfully!";
                            break;
                    }
                }
                else {
                    console.log("❌ No tool_use found in content");
                    response.error = "Claude didn't call the expected function.";
                    response.message = "No tool use found in response";
                }
            }
            else {
                // No function call, just regular response
                console.log("❌ Claude didn't use a tool, regular response instead");
                const textContent = message.content.find((c) => c.type === "text");
                response.message =
                    (textContent === null || textContent === void 0 ? void 0 : textContent.text) || "I couldn't process that request properly.";
                response.error = `Expected tool_use but got ${message.stop_reason}`;
                // For generation step, this is an error since we need the function call
                if (response.message.includes("generate") ||
                    response.message.includes("create")) {
                    response.error =
                        "Claude responded with text instead of calling generate_design_files function.";
                }
            }
            return response;
        });
    }
}
exports.ClaudeFunctionService = ClaudeFunctionService;
//# sourceMappingURL=claude-function-service.js.map