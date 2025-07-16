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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
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
    analyzeDesign(userPrompt_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (userPrompt, userId, imageData = []) {
            const messageContent = [];
            if (imageData.length > 0) {
                console.log(`📸 Processing ${imageData.length} images for Claude Vision analysis`);
                imageData.forEach((image, index) => {
                    const base64Image = image.buffer.toString("base64");
                    messageContent.push({
                        type: "image",
                        source: {
                            type: "base64",
                            media_type: image.mimetype,
                            data: base64Image,
                        },
                    });
                });
            }
            // Add text prompt after images
            messageContent.push({
                type: "text",
                text: this.buildVisionPrompt(userPrompt, imageData.length),
            });
            const message = yield this.client.messages.create({
                model: "claude-sonnet-4-0",
                max_tokens: 1000,
                temperature: 0.3,
                system: this.buildVisionSystemPrompt(imageData.length),
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
                messages: [{ role: "user", content: messageContent }],
            });
            return this.handleFunctionCall(message, userId);
        });
    }
    buildVisionPrompt(userPrompt, imageCount) {
        let prompt = userPrompt;
        if (imageCount > 0) {
            prompt = `Please analyze the ${imageCount} provided image${imageCount > 1 ? "s" : ""} along with my request:
  
  ${userPrompt}
  
  For each image, please identify:
  1. Visual design elements (colors, typography, layout, style)
  2. Branding elements (logos, visual identity, messaging)
  3. Target audience indicators
  4. Industry or business type clues
  5. Design quality and professional level
  6. Emotional tone and brand personality
  
  Then provide design recommendations that either:
  - Build upon and enhance the existing visual elements shown
  - Suggest improvements to address any design weaknesses
  - Offer alternative directions based on industry best practices
  
  Be specific about how the visual elements in the images inform your recommendations.`;
        }
        return prompt;
    }
    buildVisionSystemPrompt(imageCount) {
        let systemPrompt = `You are a professional business and design consultant with expertise in visual brand analysis.`;
        if (imageCount > 0) {
            systemPrompt += ` You have been provided with ${imageCount} image${imageCount > 1 ? "s" : ""} to analyze. Use your visual analysis capabilities to:
  
  1. Carefully examine all visual elements in the provided images
  2. Identify existing branding, color schemes, and design patterns  
  3. Assess the current design quality and professional level
  4. Consider how the visual elements relate to the business needs described
  
  Your recommendations should be informed by both the visual evidence in the images and design best practices for the identified business type. Be specific about what you observe in the images and how it influences your recommendations.`;
        }
        systemPrompt += `
  
  IMPORTANT: Always call the save_design_analysis function with your complete analysis.`;
        return systemPrompt;
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
        
        Just list what frontend and backend files need to be created and their purpose this incules all the files even login , signup pages . No config files needed ,  Also add the App.tsx  , and make a single seed file only named as seed.sql , add  backend code in a supabase folder the structure should be like all the migration files should be inside /supabase/migrations folder and  the seed files should be inside /supabase/seed.sql file. the frontend code files lucation should be relative to the src folder like ./src/pages/Home.tsx
        `;
            const message = yield this.client.messages.create({
                model: "claude-sonnet-4-0",
                max_tokens: 6000,
                temperature: 0.3,
                system: `You are a software architect creating a simple file structure plan.
  
            Just focus on:
            - Frontend files (pages, components, contexts, utils)
            - while creating the frontend files , dont create lot of files , beacuse , we will generate frontend in one llm call only we dont waant its responce to take lot of time and tokens  .
            - Backend files (database migrations, seeds) , necessary tables like profils , cart , items , etc must also be there.
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
       sql
      3.Create basic tables that are required for simple authentication and functionalities 
    -- 1. Enable RLS globally
    ALTER DATABASE postgres SET row_security = on;
    
    -- 2. Extensions (BOTH REQUIRED)
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- MUST be before crypt()
    
    -- 3. Create ALL tables first
    CREATE TABLE public.profiles (...);
    CREATE TABLE public.products (...);
    -- ... other tables
    
    -- 4. ONLY AFTER tables exist, create functions
    CREATE OR REPLACE FUNCTION public.is_admin() -- AFTER profiles table
    RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
    AS $ BEGIN
      RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
    END; $;
    
    -- 5. Then RLS policies
    -- 6. Then triggers
    
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
      
      2. Migration Structure (EXACT ORDER REQUIRED):
    - Start with: ALTER DATABASE postgres SET row_security = on;
    - Enable UUID extension: CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    - Enable pgcrypto extension: CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    - Create ALL tables first
    - THEN create is_admin() function AFTER profiles table exists
    - THEN add RLS policies for each table
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
    generateFrontendFiles(designChoices, fileStructure, backendFiles, userId, tailwindConfig, indexCss) {
        return __awaiter(this, void 0, void 0, function* () {
            const frontendPrompt = `
    Generate a complete React frontend application based on:
    
    DESIGN CHOICES:
    ${JSON.stringify(designChoices, null, 2)}

    TAILWIND CONFIG(tailwind.config.ts):
    ${JSON.stringify(tailwindConfig, null, 2)}

    INDEX CSS(src/index.css):
    ${JSON.stringify(indexCss, null, 2)}

    BACKEND SCHEMA (from migration):
    ${backendFiles["supabase/migrations/001_initial_schema.sql"]
                ? "Available - use this for database operations"
                : "Not available"}
    - EXACT FILES TO CREATE (from structure plan):
          ${JSON.stringify(fileStructure, null, 2)}
    - Dont create files such as that are present in supabse folder , tailwind.config.ts and index.css , because we already have them , 
    - CRITICAL: Create EXACTLY the files listed in the file structure plan above, .env, package.json, etc this is the current package.json {
          "name": "vite_react_shadcn_ts",
          "private": true,
          "version": "0.0.0",
          "type": "module",
          "scripts": {
            "dev": "vite",
            "build": "vite build",
            "build:dev": "vite build --mode development",
            "lint": "eslint .",
            "preview": "vite preview",
            "analyze": "tsx scripts/projectAnalyzer.ts",
            "analyze:simple": "tsx scripts/projectStructureAnalyzer.ts"
          },
          "dependencies": {
            "@hookform/resolvers": "^3.9.0",
            "@radix-ui/react-accordion": "^1.2.0",
            "@radix-ui/react-alert-dialog": "^1.1.1",
            "@radix-ui/react-aspect-ratio": "^1.1.0",
            "@radix-ui/react-avatar": "^1.1.0",
            "@radix-ui/react-checkbox": "^1.1.1",
            "@radix-ui/react-collapsible": "^1.1.0",
            "@radix-ui/react-context-menu": "^2.2.1",
            "@radix-ui/react-dialog": "^1.1.2",
            "@radix-ui/react-dropdown-menu": "^2.1.1",
            "@radix-ui/react-hover-card": "^1.1.1",
            "@radix-ui/react-label": "^2.1.0",
            "@radix-ui/react-menubar": "^1.1.1",
            "@radix-ui/react-navigation-menu": "^1.2.0",
            "@radix-ui/react-popover": "^1.1.1",
            "@radix-ui/react-progress": "^1.1.0",
            "@radix-ui/react-radio-group": "^1.2.0",
            "@radix-ui/react-scroll-area": "^1.1.0",
            "@radix-ui/react-select": "^2.1.1",
            "@radix-ui/react-separator": "^1.1.0",
            "@radix-ui/react-slider": "^1.2.0",
            "@radix-ui/react-slot": "^1.1.0",
            "@radix-ui/react-switch": "^1.1.0",
            "@radix-ui/react-tabs": "^1.1.0",
            "@radix-ui/react-toast": "^1.2.1",
            "@radix-ui/react-toggle": "^1.1.0",
            "@radix-ui/react-toggle-group": "^1.1.0",
            "@radix-ui/react-tooltip": "^1.1.4",
            "@tanstack/react-query": "^5.56.2",
            "axios": "^1.9.0",
            "class-variance-authority": "^0.7.1",
            "clsx": "^2.1.1",
            "cmdk": "^1.0.0",
            "date-fns": "^3.6.0",
            "embla-carousel-react": "^8.3.0",
            "input-otp": "^1.2.4",
            "lucide-react": "^0.462.0",
            "next-themes": "^0.3.0",
            "react": "^18.3.1",
            "react-day-picker": "^8.10.1",
            "react-dom": "^18.3.1",
            "react-hook-form": "^7.53.0",
            "react-resizable-panels": "^2.1.3",
            "react-router-dom": "^6.26.2",
            "recharts": "^2.12.7",
            "sonner": "^1.5.0",
            "tailwind-merge": "^2.5.2",
            "tailwindcss-animate": "^1.0.7",
            "vaul": "^0.9.3",
            "zod": "^3.23.8"
          },
          "devDependencies": {
            "@eslint/js": "^9.9.0",
            "@tailwindcss/typography": "^0.5.15",
            "@types/node": "^22.5.5",
            "@types/react": "^18.3.3",
            "@types/react-dom": "^18.3.0",
            "@vitejs/plugin-react-swc": "^3.5.0",
            "autoprefixer": "^10.4.20",
            "eslint": "^9.9.0",
            "eslint-plugin-react-hooks": "^5.1.0-rc.0",
            "eslint-plugin-react-refresh": "^0.4.9",
            "globals": "^15.9.0",
            "lovable-tagger": "^1.1.7",
            "postcss": "^8.4.47",
            "tailwindcss": "^3.4.11",
            "tsx": "^4.19.4",
            "typescript": "^5.5.3",
            "typescript-eslint": "^8.0.1",
            "vite": "7.0.4"
          }
        }
          make the new package.json if you are adding a new dependency other wise use this only , and we allready have all the shadcn components in the components/ui folder , so you can use them directly in your project
        :

            BACKEND TYPES:
            ${backendFiles["src/types/index.ts"] || "Generate from schema"}
            ## MANDATORY PRE-GENERATION VALIDATION:
            **BEFORE generating any code, you MUST perform these checks:**
            
            ### 1. ICON IMPORT ENFORCEMENT:
            Before writing ANY JSX component, scan your planned code for lucide-react icons and ensure ALL used icons are imported from this EXACT list: Home, Menu, Search, Settings, User, Bell, Mail, Phone, MessageCircle, Heart, Star, Bookmark, Share, Download, Upload, Edit, Delete, Plus, Minus, X, Check, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, MoreHorizontal, MoreVertical, File, FileText, Folder, FolderOpen, Save, Copy, Clipboard, Image, Video, Music, Pdf, DownloadCloud, UploadCloud, Eye, EyeOff, Lock, Unlock, Calendar, Clock, Filter, SortAsc, SortDesc, RefreshCw, Loader, ToggleLeft, ToggleRight, Slider, Send, Reply, Forward, AtSign, Hash, Link, ExternalLink, Globe, Wifi, Bluetooth, Play, Pause, Stop, SkipBack, SkipForward, Volume2, VolumeOff, Camera, Mic, MicOff, Headphones, Radio, Tv, ShoppingCart, ShoppingBag, CreditCard, DollarSign, Tag, Gift, Truck, Package, Receipt, Briefcase, Building, Calculator, ChartBar, ChartLine, ChartPie, Table, Database, Server, Code, Terminal, GitBranch, Layers, LayoutGrid, LayoutList, Info, AlertCircle, AlertTriangle, CheckCircle, XCircle, HelpCircle, Shield, ShieldCheck, ThumbsUp, ThumbsDown, CalendarDays, Clock3, Timer, AlarmClock, Hourglass, MapPin, Navigation, Car, Plane, Train, Bus, Bike, Compass, Route, Wrench, Hammer, Scissors, Ruler, Paintbrush, Pen, Pencil, Eraser, Magnet, Flashlight, HeartPulse, Activity, Pill, Thermometer, Stethoscope, Cross, Sun, Moon, Cloud, CloudRain, Snow, Wind, Leaf, Flower, Tree, Smartphone, Tablet, Laptop, Monitor, Keyboard, Mouse, Printer, HardDrive, Usb, Battery, Zap, Cpu, Coffee, Pizza, Apple, Wine, Utensils, ChefHat, Trophy, Target, Gamepad, Dumbbell, Football, Bicycle, Key, Fingerprint, ShieldLock, UserCheck, Scan, Users, UserPlus, MessageSquare, Chat, Group, Handshake, Book, Newspaper, Feather, Type, AlignLeft, AlignCenter, Bold, Italic, Underline, ArrowUpRight, ArrowDownLeft, CornerUpRight, CornerDownLeft, RotateCw, RotateCcw, Move, Maximize, Minimize, Circle, Square, Triangle, Hexagon, StarHalf, Palette, Droplet, Brush
            
            ### 2. FUNCTIONALITY VALIDATION CHECKLIST:
            - [ ] EVERY admin table has complete CRUD operations (Create, Read, Update, Delete)
            - [ ] EVERY edit button has working onClick handler and modal component
            - [ ] EVERY form has proper validation before submission
            - [ ] EVERY interactive element has proper event handlers
            - [ ] ALL routes mentioned in navigation actually exist in App.tsx
            - [ ] ALL database operations include error handling
            
            ### 3. STRUCTURE VALIDATION CHECKLIST:
            - [ ] tailwind.config.ts is the FIRST file in response
            - [ ] All 18 mandatory files are included
            - [ ] AuthContext uses REFERENCE implementation pattern
            - [ ] Admin dashboard uses separate queries (NO complex joins)
            - [ ] Environment variables use VITE_ prefix
            - [ ] SQL seed has proper escaping and ON CONFLICT clauses
            
          
            ## CRITICAL AUTHENTICATION IMPLEMENTATION RULES:
            ### REFERENCE: CORRECT AUTHCONTEXT IMPLEMENTATION
            **MANDATORY: Use this exact AuthContext pattern:**
            
            \`\`\`typescript
            import React, { createContext, useContext, useEffect, useState } from 'react';
            import { User } from '@supabase/supabase-js';
            import { useNavigate } from 'react-router-dom';
            import { supabase } from '../lib/supabase';
            import { Profile } from '../types';
            
            interface AuthContextType {
              user: User | null;
              profile: Profile | null;
              loading: boolean;
              logout: () => Promise<void>;
            }
            
            const AuthContext = createContext<AuthContextType | undefined>(undefined);
            
            export const useAuth = () => {
              const context = useContext(AuthContext);
              if (context === undefined) {
                throw new Error('useAuth must be used within an AuthProvider');
              }
              return context;
            };
            
            export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
              const [user, setUser] = useState<User | null>(null);
              const [profile, setProfile] = useState<Profile | null>(null);
              const [loading, setLoading] = useState(true);
              const [initialized, setInitialized] = useState(false);
              const navigate = useNavigate();
            
              useEffect(() => {
                let isMounted = true;
                
                const initializeAuth = async () => {
                  try {
                    console.log('Initializing auth...');
                    
                    // 1. Always get initial session explicitly
                    const { data: { session } } = await supabase.auth.getSession();
                    
                    if (isMounted) {
                      if (session?.user) {
                        console.log('Session found:', session.user.id);
                        setUser(session.user);
                        await fetchProfile(session.user.id);
                      } else {
                        console.log('No session found');
                        setUser(null);
                        setProfile(null);
                      }
                    }
                  } catch (error) {
                    console.error('Auth initialization error:', error);
                    if (isMounted) {
                      setUser(null);
                      setProfile(null);
                    }
                  } finally {
                    // ALWAYS resolve loading - CRITICAL for preventing infinite loading
                    if (isMounted) {
                      setLoading(false);
                      setInitialized(true);
                    }
                  }
                };
                
                // 2. Initialize first
                initializeAuth();
                
                // 3. Then set up listener with guards
                const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
                  if (!isMounted || !initialized) return; // Guard clause
                  
                  // Ignore INITIAL_SESSION - we handle this manually above
                  if (event === 'INITIAL_SESSION') return;
                  
                  console.log('Auth state change:', event, session?.user?.id);
                  
                  try {
                    if (session?.user) {
                      setUser(session.user);
                      // Only navigate on SIGNED_IN event (actual login), not on other events
                      const shouldNavigate = event === 'SIGNED_IN';
                      await fetchProfile(session.user.id, shouldNavigate);
                    } else {
                      setUser(null);
                      setProfile(null);
                    }
                  } catch (error) {
                    console.error('Auth state change error:', error);
                  }
                });
                
                return () => {
                  isMounted = false;
                  subscription.unsubscribe();
                };
              }, [navigate]);
            
              const fetchProfile = async (userId: string, shouldNavigate: boolean = false) => {
                try {
                  console.log('Fetching profile for user:', userId);
                  
                  const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', userId)
                    .single();
                  
                  if (error) {
                    console.error('Profile fetch error:', error);
                    throw error;
                  }
                  
                  console.log('Profile fetched:', data);
                  setProfile(data);
                  
                  // Navigation logic ONLY after login, not on every profile fetch
                  if (shouldNavigate) {
                    if (data?.role === 'admin') {
                      navigate('/admin');
                    } else {
                      navigate('/dashboard');
                    }
                  }
                } catch (error: any) {
                  console.error('Profile fetch failed:', error);
                  // If profile doesn't exist, create it
                  if (error.code === 'PGRST116') {
                    await createProfile(userId);
                  } else {
                    throw error;
                  }
                }
              };
            
              const createProfile = async (userId: string) => {
                try {
                  console.log('Creating profile for user:', userId);
                  
                  const { data: userData } = await supabase.auth.getUser();
                  
                  const { data, error } = await supabase
                    .from('profiles')
                    .insert({
                      id: userId,
                      email: userData.user?.email || '',
                      full_name: userData.user?.user_metadata?.full_name || '',
                      role: 'user'
                    })
                    .select()
                    .single();
                  
                  if (error) throw error;
                  
                  console.log('Profile created:', data);
                  setProfile(data);
                  navigate('/dashboard');
                } catch (error) {
                  console.error('Profile creation failed:', error);
                  throw error;
                }
              };
            
              const logout = async () => {
                try {
                  console.log('Logging out...');
                  setLoading(true);
                  
                  // 1. Clear state FIRST
                  setUser(null);
                  setProfile(null);
                  
                  // 2. Then sign out
                  await supabase.auth.signOut();
                  
                  // 3. Clear localStorage
                  Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('sb-')) {
                      localStorage.removeItem(key);
                    }
                  });
                  
                  // 4. Navigate with delay
                  setTimeout(() => {
                    navigate('/');
                    setLoading(false);
                  }, 100);
                } catch (error) {
                  console.error('Logout error:', error);
                  setLoading(false);
                  throw error;
                }
              };
            
              const value: AuthContextType = {
                user,
                profile,
                loading,
                logout
              };
            
              return (
                <AuthContext.Provider value={value}>
                  {children}
                </AuthContext.Provider>
              );
            };
            \`\`\`
            
            ## CRITICAL NAVIGATION RULES:
            ### Landing Page Sections:
            - If sections like About, Services, Menu, Contact, Testimonials are part of the landing page, they should NOT be separate routes
            - Use smooth scroll navigation to these sections on the landing page
            - Navigation links should use href='#section-id' and onClick handlers for smooth scrolling
            - **IMPORTANT**: Landing page should fetch ALL data from database (products, testimonials, etc.) - NO hardcoded dummy data
            
            Example implementation:
            \`\`\`typescript
            const scrollToSection = (sectionId: string) => {
              const element = document.getElementById(sectionId);
              element?.scrollIntoView({ behavior: 'smooth' });
            };
            
            // In navigation
            <a 
              href='#about' 
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('about');
              }}
            >
              About
            </a>
            \`\`\`
            
            ### Separate Page Routes:
            Only create separate routes for:
            - Login (/login)
            - Signup (/signup)
            - User Dashboard (/dashboard)
            - Admin Dashboard (/admin)
            - User Profile (/profile)
            - Specific functional pages like booking, checkout, etc.
            
            ## CRITICAL FORM PATTERNS:
            ### Login Form (NO navigation logic):
            \`\`\`typescript
            const handleLogin = async (e: React.FormEvent) => {
              e.preventDefault();
              setLoading(true);
              setError('');
              
              try {
                const { data, error } = await supabase.auth.signInWithPassword({
                  email,
                  password,
                });
                
                if (error) throw error;
                
                if (data.user) {
                  toast.success('Login successful!');
                  // NO navigate() here - let AuthContext handle it
                }
              } catch (error: any) {
                setError('Invalid email or password. Please try again.');
              } finally {
                setLoading(false);
              }
            };
            \`\`\`
            
            ### Admin Dashboard Query Pattern (MANDATORY):
            \`\`\`typescript
            // NEVER use complex joins - use separate queries
            const fetchAdminData = async () => {
              try {
                setLoading(true);
                
                // Step 1: Fetch all tables separately
                const [productsRes, ordersRes, profilesRes] = await Promise.all([
                  supabase.from('products').select('*'),
                  supabase.from('orders').select('*').order('created_at', { ascending: false }),
                  supabase.from('profiles').select('*')
                ]);
                
                // Step 2: Check for errors
                if (productsRes.error) throw productsRes.error;
                if (ordersRes.error) throw ordersRes.error;
                if (profilesRes.error) throw profilesRes.error;
                
                // Step 3: Manually join data in JavaScript
                const ordersWithDetails = ordersRes.data?.map(order => {
                  const userProfile = profilesRes.data?.find(p => p.id === order.user_id);
                  return {
                    ...order,
                    profiles: userProfile ? { 
                      full_name: userProfile.full_name, 
                      email: userProfile.email 
                    } : null
                  };
                });
                
                setProducts(productsRes.data || []);
                setOrders(ordersWithDetails || []);
                
              } catch (error: any) {
                console.error('Error fetching admin data:', error);
                toast.error('Failed to load dashboard data');
              } finally {
                setLoading(false);
              }
            };
            \`\`\`
            
            ## CRITICAL ENVIRONMENT VARIABLES FOR VITE:
            ### Correct .env File Format:
            \`\`\`bash
            VITE_SUPABASE_URL=your_supabase_project_url
            VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
            \`\`\`
            
            ### Correct Supabase Client Setup:
            \`\`\`typescript
            // src/lib/supabase.ts
            import { createClient } from '@supabase/supabase-js';
            
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            
            if (!supabaseUrl || !supabaseAnonKey) {
              throw new Error('Missing Supabase environment variables');
            }
            
            export const supabase = createClient(supabaseUrl, supabaseAnonKey);
            \`\`\`
            
            ## CART FUNCTIONALITY (MANDATORY):
            \`\`\`typescript
            const addToCart = async (product: any) => {
              if (!user) {
                navigate('/login');
                return;
              }
              
              try {
                // Check if item already in cart
                const { data: existingItem } = await supabase
                  .from('cart_items')
                  .select('*')
                  .eq('user_id', user.id)
                  .eq('product_id', product.id)
                  .single();
                
                if (existingItem) {
                  // Update quantity
                  await supabase
                    .from('cart_items')
                    .update({ quantity: existingItem.quantity + 1 })
                    .eq('id', existingItem.id);
                } else {
                  // Add new item
                  await supabase
                    .from('cart_items')
                    .insert({
                      user_id: user.id,
                      product_id: product.id,
                      quantity: 1
                    });
                }
                
                fetchCartItems();
                toast.success('Item added to cart!');
              } catch (error) {
                console.error('Add to cart error:', error);
                toast.error('Failed to add item to cart');
              }
            };
            \`\`\`
            ## RESPONCE FORMAT SHOULD BE JSON (it should be exactly like how iam describing it now ) 
            {
            codefiles:{
            "src/App.tsx": "// Complete App.tsx code",' 
            "src/pages/Home.tsx": "// Complete Home.tsx code",
            etc al should be like this 
            }
            }
          
            ## FINAL VALIDATION CHECKLIST (MANDATORY):
            Before generating response, verify ALL of these:
            - [ ] ALL lucide-react icons used are imported from approved list
            - [ ] ALL custom components referenced are created
            - [ ] ALL routes in navigation exist in App.tsx
            - [ ] ALL admin tables have complete CRUD operations
            - [ ] ALL edit buttons have working onClick handlers
            - [ ] AuthContext uses REFERENCE implementation
            - [ ] Admin dashboard uses separate queries (NO joins)
            - [ ] Environment variables use VITE_ prefix
            - [ ] Landing page fetches real data from database
            - [ ] Basic website functionality works (cart, auth, CRUD)
            
            Generate a complete, working React frontend application  using shadcn/ui components that integrates perfectly with the provided backend schema.
              `;
            const stream = yield this.client.messages
                .stream({
                model: "claude-sonnet-4-0",
                max_tokens: 64000,
                temperature: 0.1,
                stream: true,
                system: `You are the Frontend Generator Agent. Generate a complete React application that works with the provided backend and try to stick responce within the limit of 80000 words and plan accordingly.
            
            CRITICAL RULES FROM BASE PROMPT:
            
            2. AUTHENTICATION PATTERN (MANDATORY):
              - Use REFERENCE AuthContext implementation
              - Centralized navigation in AuthContext ONLY
              - Login/Signup pages have NO navigation logic
              - Proper loading state management
              - Check profile before rendering admin components
            
            3. DATABASE QUERIES (CRITICAL):
              - Landing page fetches real data from database
              - Admin dashboard uses SEPARATE queries, NO complex joins
              - Manual JavaScript joins for related data
              - Proper error handling with console.log
            
            4. CART FUNCTIONALITY:
              - Authentication check before adding items
              - Database-backed cart (cart_items table)
              - Quantity updates and removals
              - Checkout process
            
            5. ADMIN DASHBOARD:
              - Complete CRUD operations for ALL business tables
              - Working edit buttons with onClick handlers
              - Separate queries for each table
              - Manual data joining in JavaScript
            
            6. ENVIRONMENT & DEPENDENCIES:
              - VITE_ prefix for all environment variables
              - import.meta.env instead of process.env
              - Only approved Lucide React icons
              - Complete package.json with all dependencies
            
            7. FORM VALIDATION:
              - Client-side validation before submission
              - Proper error messages and loading states
              - Success feedback after operations
            
            `,
                // tools: [
                //   {
                //     name: "generate_frontend_application",
                //     description: "Generate complete React frontend application",
                //     input_schema: {
                //       type: "object",
                //       properties: {
                //         files: {
                //           type: "object",
                //           description:
                //             "Generated files as key-value pairs (filename: content)",
                //           additionalProperties: { type: "string" },
                //         },
                //         componentsSummary: {
                //           type: "object",
                //           properties: {
                //             pages: {
                //               type: "array",
                //               items: {
                //                 type: "object",
                //                 properties: {
                //                   name: { type: "string" },
                //                   purpose: { type: "string" },
                //                   features: {
                //                     type: "array",
                //                     items: { type: "string" },
                //                   },
                //                 },
                //               },
                //             },
                //             components: {
                //               type: "array",
                //               items: {
                //                 type: "object",
                //                 properties: {
                //                   name: { type: "string" },
                //                   purpose: { type: "string" },
                //                   reusable: { type: "boolean" },
                //                 },
                //               },
                //             },
                //             contexts: {
                //               type: "array",
                //               items: {
                //                 type: "object",
                //                 properties: {
                //                   name: { type: "string" },
                //                   purpose: { type: "string" },
                //                   features: {
                //                     type: "array",
                //                     items: { type: "string" },
                //                   },
                //                 },
                //               },
                //             },
                //           },
                //         },
                //         technicalSpecs: {
                //           type: "object",
                //           properties: {
                //             authenticationFlow: { type: "string" },
                //             databaseIntegration: { type: "string" },
                //             adminFeatures: { type: "array", items: { type: "string" } },
                //             cartFeatures: { type: "array", items: { type: "string" } },
                //             responsiveDesign: { type: "string" },
                //             iconLibrary: { type: "string" },
                //             environmentSetup: { type: "string" },
                //           },
                //         },
                //         usageInstructions: {
                //           type: "string",
                //           description: "Setup and deployment instructions",
                //         },
                //         newDependencies: {
                //           type: "array",
                //           items: { type: "string" },
                //           description:
                //             "Any new dependencies added beyond base package.json",
                //         },
                //       },
                //       required: [
                //         "files",
                //         "componentsSummary",
                //         "technicalSpecs",
                //         "usageInstructions",
                //       ],
                //     },
                //   },
                // ],
                // tool_choice: { type: "tool", name: "generate_frontend_application" },
                messages: [{ role: "user", content: frontendPrompt }],
            })
                .on("text", (text) => {
                console.log("text", text);
            });
            const data = yield stream.finalMessage();
            return data;
        });
    }
    generateFrontendFilesWithProgress(designChoices, fileStructure, backendFiles, userId, onProgress) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            var _d, _e;
            const frontendPrompt = `
    Generate a complete React frontend application based on:
    
    DESIGN CHOICES:
    ${JSON.stringify(designChoices, null, 2)}
    
    EXACT FILES TO CREATE (from structure plan):
    ${JSON.stringify(fileStructure, null, 2)}
    
    BACKEND SCHEMA:
    ${backendFiles["supabase/migrations/001_initial_schema.sql"]
                ? "Available - use this for database operations"
                : "Not available"}
    
    BACKEND TYPES:
            ${backendFiles["src/types/index.ts"] || "Generate from schema"}
            
            CRITICAL: Create EXACTLY the files listed in the file structure plan above.
            Include all mandatory files: tailwind.config.ts, .env, package.json, etc.
            
            BACKEND SCHEMA (from migration):
            ${backendFiles["supabase/migrations/001_initial_schema.sql"]
                ? "Available - use this for database operations"
                : "Not available"}
            CRITICAL: Create EXACTLY the files listed in the file structure plan above.
          Include all mandatory files: tailwind.config.ts, .env, package.json, etc this is the current package.json {
          "name": "vite_react_shadcn_ts",
          "private": true,
          "version": "0.0.0",
          "type": "module",
          "scripts": {
            "dev": "vite",
            "build": "vite build",
            "build:dev": "vite build --mode development",
            "lint": "eslint .",
            "preview": "vite preview",
            "analyze": "tsx scripts/projectAnalyzer.ts",
            "analyze:simple": "tsx scripts/projectStructureAnalyzer.ts"
          },
          "dependencies": {
            "@hookform/resolvers": "^3.9.0",
            "@radix-ui/react-accordion": "^1.2.0",
            "@radix-ui/react-alert-dialog": "^1.1.1",
            "@radix-ui/react-aspect-ratio": "^1.1.0",
            "@radix-ui/react-avatar": "^1.1.0",
            "@radix-ui/react-checkbox": "^1.1.1",
            "@radix-ui/react-collapsible": "^1.1.0",
            "@radix-ui/react-context-menu": "^2.2.1",
            "@radix-ui/react-dialog": "^1.1.2",
            "@radix-ui/react-dropdown-menu": "^2.1.1",
            "@radix-ui/react-hover-card": "^1.1.1",
            "@radix-ui/react-label": "^2.1.0",
            "@radix-ui/react-menubar": "^1.1.1",
            "@radix-ui/react-navigation-menu": "^1.2.0",
            "@radix-ui/react-popover": "^1.1.1",
            "@radix-ui/react-progress": "^1.1.0",
            "@radix-ui/react-radio-group": "^1.2.0",
            "@radix-ui/react-scroll-area": "^1.1.0",
            "@radix-ui/react-select": "^2.1.1",
            "@radix-ui/react-separator": "^1.1.0",
            "@radix-ui/react-slider": "^1.2.0",
            "@radix-ui/react-slot": "^1.1.0",
            "@radix-ui/react-switch": "^1.1.0",
            "@radix-ui/react-tabs": "^1.1.0",
            "@radix-ui/react-toast": "^1.2.1",
            "@radix-ui/react-toggle": "^1.1.0",
            "@radix-ui/react-toggle-group": "^1.1.0",
            "@radix-ui/react-tooltip": "^1.1.4",
            "@tanstack/react-query": "^5.56.2",
            "axios": "^1.9.0",
            "class-variance-authority": "^0.7.1",
            "clsx": "^2.1.1",
            "cmdk": "^1.0.0",
            "date-fns": "^3.6.0",
            "embla-carousel-react": "^8.3.0",
            "input-otp": "^1.2.4",
            "lucide-react": "^0.462.0",
            "next-themes": "^0.3.0",
            "react": "^18.3.1",
            "react-day-picker": "^8.10.1",
            "react-dom": "^18.3.1",
            "react-hook-form": "^7.53.0",
            "react-resizable-panels": "^2.1.3",
            "react-router-dom": "^6.26.2",
            "recharts": "^2.12.7",
            "sonner": "^1.5.0",
            "tailwind-merge": "^2.5.2",
            "tailwindcss-animate": "^1.0.7",
            "vaul": "^0.9.3",
            "zod": "^3.23.8"
          },
          "devDependencies": {
            "@eslint/js": "^9.9.0",
            "@tailwindcss/typography": "^0.5.15",
            "@types/node": "^22.5.5",
            "@types/react": "^18.3.3",
            "@types/react-dom": "^18.3.0",
            "@vitejs/plugin-react-swc": "^3.5.0",
            "autoprefixer": "^10.4.20",
            "eslint": "^9.9.0",
            "eslint-plugin-react-hooks": "^5.1.0-rc.0",
            "eslint-plugin-react-refresh": "^0.4.9",
            "globals": "^15.9.0",
            "lovable-tagger": "^1.1.7",
            "postcss": "^8.4.47",
            "tailwindcss": "^3.4.11",
            "tsx": "^4.19.4",
            "typescript": "^5.5.3",
            "typescript-eslint": "^8.0.1",
            "vite": "7.0.4"
          }
        }
          make the new package.json if you are adding a new dependency other wise use this only , and we allready have all the shadcn components in the components/ui folder , so you can use them directly in your project
        :

            BACKEND TYPES:
            ${backendFiles["src/types/index.ts"] || "Generate from schema"}
            ## MANDATORY PRE-GENERATION VALIDATION:
            **BEFORE generating any code, you MUST perform these checks:**
            
            ### 1. ICON IMPORT ENFORCEMENT:
            Before writing ANY JSX component, scan your planned code for lucide-react icons and ensure ALL used icons are imported from this EXACT list: Home, Menu, Search, Settings, User, Bell, Mail, Phone, MessageCircle, Heart, Star, Bookmark, Share, Download, Upload, Edit, Delete, Plus, Minus, X, Check, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, MoreHorizontal, MoreVertical, File, FileText, Folder, FolderOpen, Save, Copy, Clipboard, Image, Video, Music, Pdf, DownloadCloud, UploadCloud, Eye, EyeOff, Lock, Unlock, Calendar, Clock, Filter, SortAsc, SortDesc, RefreshCw, Loader, ToggleLeft, ToggleRight, Slider, Send, Reply, Forward, AtSign, Hash, Link, ExternalLink, Globe, Wifi, Bluetooth, Play, Pause, Stop, SkipBack, SkipForward, Volume2, VolumeOff, Camera, Mic, MicOff, Headphones, Radio, Tv, ShoppingCart, ShoppingBag, CreditCard, DollarSign, Tag, Gift, Truck, Package, Receipt, Briefcase, Building, Calculator, ChartBar, ChartLine, ChartPie, Table, Database, Server, Code, Terminal, GitBranch, Layers, LayoutGrid, LayoutList, Info, AlertCircle, AlertTriangle, CheckCircle, XCircle, HelpCircle, Shield, ShieldCheck, ThumbsUp, ThumbsDown, CalendarDays, Clock3, Timer, AlarmClock, Hourglass, MapPin, Navigation, Car, Plane, Train, Bus, Bike, Compass, Route, Wrench, Hammer, Scissors, Ruler, Paintbrush, Pen, Pencil, Eraser, Magnet, Flashlight, HeartPulse, Activity, Pill, Thermometer, Stethoscope, Cross, Sun, Moon, Cloud, CloudRain, Snow, Wind, Leaf, Flower, Tree, Smartphone, Tablet, Laptop, Monitor, Keyboard, Mouse, Printer, HardDrive, Usb, Battery, Zap, Cpu, Coffee, Pizza, Apple, Wine, Utensils, ChefHat, Trophy, Target, Gamepad, Dumbbell, Football, Bicycle, Key, Fingerprint, ShieldLock, UserCheck, Scan, Users, UserPlus, MessageSquare, Chat, Group, Handshake, Book, Newspaper, Feather, Type, AlignLeft, AlignCenter, Bold, Italic, Underline, ArrowUpRight, ArrowDownLeft, CornerUpRight, CornerDownLeft, RotateCw, RotateCcw, Move, Maximize, Minimize, Circle, Square, Triangle, Hexagon, StarHalf, Palette, Droplet, Brush
            
            ### 2. FUNCTIONALITY VALIDATION CHECKLIST:
            - [ ] EVERY admin table has complete CRUD operations (Create, Read, Update, Delete)
            - [ ] EVERY edit button has working onClick handler and modal component
            - [ ] EVERY form has proper validation before submission
            - [ ] EVERY interactive element has proper event handlers
            - [ ] ALL routes mentioned in navigation actually exist in App.tsx
            - [ ] ALL database operations include error handling
            
            ### 3. STRUCTURE VALIDATION CHECKLIST:
            - [ ] tailwind.config.ts is the FIRST file in response
            - [ ] All 18 mandatory files are included
            - [ ] AuthContext uses REFERENCE implementation pattern
            - [ ] Admin dashboard uses separate queries (NO complex joins)
            - [ ] Environment variables use VITE_ prefix
            - [ ] SQL seed has proper escaping and ON CONFLICT clauses
            
          
            ## CRITICAL AUTHENTICATION IMPLEMENTATION RULES:
            ### REFERENCE: CORRECT AUTHCONTEXT IMPLEMENTATION
            **MANDATORY: Use this exact AuthContext pattern:**
            
            \`\`\`typescript
            import React, { createContext, useContext, useEffect, useState } from 'react';
            import { User } from '@supabase/supabase-js';
            import { useNavigate } from 'react-router-dom';
            import { supabase } from '../lib/supabase';
            import { Profile } from '../types';
            
            interface AuthContextType {
              user: User | null;
              profile: Profile | null;
              loading: boolean;
              logout: () => Promise<void>;
            }
            
            const AuthContext = createContext<AuthContextType | undefined>(undefined);
            
            export const useAuth = () => {
              const context = useContext(AuthContext);
              if (context === undefined) {
                throw new Error('useAuth must be used within an AuthProvider');
              }
              return context;
            };
            
            export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
              const [user, setUser] = useState<User | null>(null);
              const [profile, setProfile] = useState<Profile | null>(null);
              const [loading, setLoading] = useState(true);
              const [initialized, setInitialized] = useState(false);
              const navigate = useNavigate();
            
              useEffect(() => {
                let isMounted = true;
                
                const initializeAuth = async () => {
                  try {
                    console.log('Initializing auth...');
                    
                    // 1. Always get initial session explicitly
                    const { data: { session } } = await supabase.auth.getSession();
                    
                    if (isMounted) {
                      if (session?.user) {
                        console.log('Session found:', session.user.id);
                        setUser(session.user);
                        await fetchProfile(session.user.id);
                      } else {
                        console.log('No session found');
                        setUser(null);
                        setProfile(null);
                      }
                    }
                  } catch (error) {
                    console.error('Auth initialization error:', error);
                    if (isMounted) {
                      setUser(null);
                      setProfile(null);
                    }
                  } finally {
                    // ALWAYS resolve loading - CRITICAL for preventing infinite loading
                    if (isMounted) {
                      setLoading(false);
                      setInitialized(true);
                    }
                  }
                };
                
                // 2. Initialize first
                initializeAuth();
                
                // 3. Then set up listener with guards
                const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
                  if (!isMounted || !initialized) return; // Guard clause
                  
                  // Ignore INITIAL_SESSION - we handle this manually above
                  if (event === 'INITIAL_SESSION') return;
                  
                  console.log('Auth state change:', event, session?.user?.id);
                  
                  try {
                    if (session?.user) {
                      setUser(session.user);
                      // Only navigate on SIGNED_IN event (actual login), not on other events
                      const shouldNavigate = event === 'SIGNED_IN';
                      await fetchProfile(session.user.id, shouldNavigate);
                    } else {
                      setUser(null);
                      setProfile(null);
                    }
                  } catch (error) {
                    console.error('Auth state change error:', error);
                  }
                });
                
                return () => {
                  isMounted = false;
                  subscription.unsubscribe();
                };
              }, [navigate]);
            
              const fetchProfile = async (userId: string, shouldNavigate: boolean = false) => {
                try {
                  console.log('Fetching profile for user:', userId);
                  
                  const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', userId)
                    .single();
                  
                  if (error) {
                    console.error('Profile fetch error:', error);
                    throw error;
                  }
                  
                  console.log('Profile fetched:', data);
                  setProfile(data);
                  
                  // Navigation logic ONLY after login, not on every profile fetch
                  if (shouldNavigate) {
                    if (data?.role === 'admin') {
                      navigate('/admin');
                    } else {
                      navigate('/dashboard');
                    }
                  }
                } catch (error: any) {
                  console.error('Profile fetch failed:', error);
                  // If profile doesn't exist, create it
                  if (error.code === 'PGRST116') {
                    await createProfile(userId);
                  } else {
                    throw error;
                  }
                }
              };
            
              const createProfile = async (userId: string) => {
                try {
                  console.log('Creating profile for user:', userId);
                  
                  const { data: userData } = await supabase.auth.getUser();
                  
                  const { data, error } = await supabase
                    .from('profiles')
                    .insert({
                      id: userId,
                      email: userData.user?.email || '',
                      full_name: userData.user?.user_metadata?.full_name || '',
                      role: 'user'
                    })
                    .select()
                    .single();
                  
                  if (error) throw error;
                  
                  console.log('Profile created:', data);
                  setProfile(data);
                  navigate('/dashboard');
                } catch (error) {
                  console.error('Profile creation failed:', error);
                  throw error;
                }
              };
            
              const logout = async () => {
                try {
                  console.log('Logging out...');
                  setLoading(true);
                  
                  // 1. Clear state FIRST
                  setUser(null);
                  setProfile(null);
                  
                  // 2. Then sign out
                  await supabase.auth.signOut();
                  
                  // 3. Clear localStorage
                  Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('sb-')) {
                      localStorage.removeItem(key);
                    }
                  });
                  
                  // 4. Navigate with delay
                  setTimeout(() => {
                    navigate('/');
                    setLoading(false);
                  }, 100);
                } catch (error) {
                  console.error('Logout error:', error);
                  setLoading(false);
                  throw error;
                }
              };
            
              const value: AuthContextType = {
                user,
                profile,
                loading,
                logout
              };
            
              return (
                <AuthContext.Provider value={value}>
                  {children}
                </AuthContext.Provider>
              );
            };
            \`\`\`
            
            ## CRITICAL NAVIGATION RULES:
            ### Landing Page Sections:
            - If sections like About, Services, Menu, Contact, Testimonials are part of the landing page, they should NOT be separate routes
            - Use smooth scroll navigation to these sections on the landing page
            - Navigation links should use href='#section-id' and onClick handlers for smooth scrolling
            - **IMPORTANT**: Landing page should fetch ALL data from database (products, testimonials, etc.) - NO hardcoded dummy data
            
            Example implementation:
            \`\`\`typescript
            const scrollToSection = (sectionId: string) => {
              const element = document.getElementById(sectionId);
              element?.scrollIntoView({ behavior: 'smooth' });
            };
            
            // In navigation
            <a 
              href='#about' 
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('about');
              }}
            >
              About
            </a>
            \`\`\`
            
            ### Separate Page Routes:
            Only create separate routes for:
            - Login (/login)
            - Signup (/signup)
            - User Dashboard (/dashboard)
            - Admin Dashboard (/admin)
            - User Profile (/profile)
            - Specific functional pages like booking, checkout, etc.
            
            ## CRITICAL FORM PATTERNS:
            ### Login Form (NO navigation logic):
            \`\`\`typescript
            const handleLogin = async (e: React.FormEvent) => {
              e.preventDefault();
              setLoading(true);
              setError('');
              
              try {
                const { data, error } = await supabase.auth.signInWithPassword({
                  email,
                  password,
                });
                
                if (error) throw error;
                
                if (data.user) {
                  toast.success('Login successful!');
                  // NO navigate() here - let AuthContext handle it
                }
              } catch (error: any) {
                setError('Invalid email or password. Please try again.');
              } finally {
                setLoading(false);
              }
            };
            \`\`\`
            
            ### Admin Dashboard Query Pattern (MANDATORY):
            \`\`\`typescript
            // NEVER use complex joins - use separate queries
            const fetchAdminData = async () => {
              try {
                setLoading(true);
                
                // Step 1: Fetch all tables separately
                const [productsRes, ordersRes, profilesRes] = await Promise.all([
                  supabase.from('products').select('*'),
                  supabase.from('orders').select('*').order('created_at', { ascending: false }),
                  supabase.from('profiles').select('*')
                ]);
                
                // Step 2: Check for errors
                if (productsRes.error) throw productsRes.error;
                if (ordersRes.error) throw ordersRes.error;
                if (profilesRes.error) throw profilesRes.error;
                
                // Step 3: Manually join data in JavaScript
                const ordersWithDetails = ordersRes.data?.map(order => {
                  const userProfile = profilesRes.data?.find(p => p.id === order.user_id);
                  return {
                    ...order,
                    profiles: userProfile ? { 
                      full_name: userProfile.full_name, 
                      email: userProfile.email 
                    } : null
                  };
                });
                
                setProducts(productsRes.data || []);
                setOrders(ordersWithDetails || []);
                
              } catch (error: any) {
                console.error('Error fetching admin data:', error);
                toast.error('Failed to load dashboard data');
              } finally {
                setLoading(false);
              }
            };
            \`\`\`
            
            ## CRITICAL ENVIRONMENT VARIABLES FOR VITE:
            ### Correct .env File Format:
            \`\`\`bash
            VITE_SUPABASE_URL=your_supabase_project_url
            VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
            \`\`\`
            
            ### Correct Supabase Client Setup:
            \`\`\`typescript
            // src/lib/supabase.ts
            import { createClient } from '@supabase/supabase-js';
            
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            
            if (!supabaseUrl || !supabaseAnonKey) {
              throw new Error('Missing Supabase environment variables');
            }
            
            export const supabase = createClient(supabaseUrl, supabaseAnonKey);
            \`\`\`
            
            ## CART FUNCTIONALITY (MANDATORY):
            \`\`\`typescript
            const addToCart = async (product: any) => {
              if (!user) {
                navigate('/login');
                return;
              }
              
              try {
                // Check if item already in cart
                const { data: existingItem } = await supabase
                  .from('cart_items')
                  .select('*')
                  .eq('user_id', user.id)
                  .eq('product_id', product.id)
                  .single();
                
                if (existingItem) {
                  // Update quantity
                  await supabase
                    .from('cart_items')
                    .update({ quantity: existingItem.quantity + 1 })
                    .eq('id', existingItem.id);
                } else {
                  // Add new item
                  await supabase
                    .from('cart_items')
                    .insert({
                      user_id: user.id,
                      product_id: product.id,
                      quantity: 1
                    });
                }
                
                fetchCartItems();
                toast.success('Item added to cart!');
              } catch (error) {
                console.error('Add to cart error:', error);
                toast.error('Failed to add item to cart');
              }
            };
            \`\`\`
            
          
            ## FINAL VALIDATION CHECKLIST (MANDATORY):
            Before generating response, verify ALL of these:
            - [ ] ALL lucide-react icons used are imported from approved list
            - [ ] ALL custom components referenced are created
            - [ ] ALL routes in navigation exist in App.tsx
            - [ ] ALL admin tables have complete CRUD operations
            - [ ] ALL edit buttons have working onClick handlers
            - [ ] AuthContext uses REFERENCE implementation
            - [ ] Admin dashboard uses separate queries (NO joins)
            - [ ] Environment variables use VITE_ prefix
            - [ ] Landing page fetches real data from database
            - [ ] Basic website functionality works (cart, auth, CRUD)
            
            Generate a complete, working React frontend application that integrates perfectly with the provided backend schema.
              
    `;
            const stream = yield this.client.messages.create({
                model: "claude-sonnet-4-0",
                max_tokens: 30000,
                temperature: 0.5,
                stream: true,
                system: `You are the Frontend Generator Agent. Generate a complete React application that works with the provided backend.`,
                tools: [
                    {
                        name: "generate_frontend_application",
                        description: "Generate complete React frontend application",
                        input_schema: {
                            type: "object",
                            properties: {
                                files: {
                                    type: "object",
                                    description: "Generated files as key-value pairs (filename: content)",
                                    additionalProperties: { type: "string" },
                                },
                                componentsSummary: {
                                    type: "object",
                                    properties: {
                                        pages: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    name: { type: "string" },
                                                    purpose: { type: "string" },
                                                    features: { type: "array", items: { type: "string" } },
                                                },
                                            },
                                        },
                                        components: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    name: { type: "string" },
                                                    purpose: { type: "string" },
                                                    reusable: { type: "boolean" },
                                                },
                                            },
                                        },
                                        contexts: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    name: { type: "string" },
                                                    purpose: { type: "string" },
                                                    features: { type: "array", items: { type: "string" } },
                                                },
                                            },
                                        },
                                    },
                                },
                                technicalSpecs: {
                                    type: "object",
                                    properties: {
                                        authenticationFlow: { type: "string" },
                                        databaseIntegration: { type: "string" },
                                        adminFeatures: { type: "array", items: { type: "string" } },
                                        cartFeatures: { type: "array", items: { type: "string" } },
                                        responsiveDesign: { type: "string" },
                                        iconLibrary: { type: "string" },
                                        environmentSetup: { type: "string" },
                                    },
                                },
                                usageInstructions: {
                                    type: "string",
                                    description: "Setup and deployment instructions",
                                },
                                newDependencies: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "Any new dependencies added beyond base package.json",
                                },
                            },
                            required: [
                                "files",
                                "componentsSummary",
                                "technicalSpecs",
                                "usageInstructions",
                            ],
                        },
                    },
                ],
                tool_choice: { type: "tool", name: "generate_frontend_application" },
                messages: [{ role: "user", content: frontendPrompt }],
            });
            let fullTextContent = "";
            let toolUse = null;
            let usage = null;
            let stopReason = null;
            let messageId = null;
            // 🔥 Enhanced progress tracking
            let jsonBuffer = "";
            let lastProgressUpdate = Date.now();
            let filesInProgress = [];
            let detectedFiles = new Set();
            let currentStage = "Initializing...";
            // Send initial progress
            onProgress === null || onProgress === void 0 ? void 0 : onProgress({
                stage: "Starting Claude generation...",
                filesGenerated: [],
                totalSize: 0,
                percentage: 0,
            });
            try {
                for (var _f = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = yield stream_1.next(), _a = stream_1_1.done, !_a; _f = true) {
                    _c = stream_1_1.value;
                    _f = false;
                    const messageStreamEvent = _c;
                    console.log("📝 Stream event:", messageStreamEvent.type);
                    switch (messageStreamEvent.type) {
                        case "message_start":
                            console.log("🎬 Message started:", messageStreamEvent.message.id);
                            messageId = messageStreamEvent.message.id;
                            usage = messageStreamEvent.message.usage;
                            onProgress === null || onProgress === void 0 ? void 0 : onProgress({
                                stage: "Claude is analyzing your requirements...",
                                filesGenerated: [],
                                totalSize: 0,
                                percentage: 5,
                            });
                            break;
                        case "content_block_start":
                            if (messageStreamEvent.content_block.type === "tool_use") {
                                console.log("🛠️ Function being called:", messageStreamEvent.content_block.name);
                                currentStage = "Setting up file generation...";
                                onProgress === null || onProgress === void 0 ? void 0 : onProgress({
                                    stage: currentStage,
                                    filesGenerated: [],
                                    totalSize: 0,
                                    percentage: 10,
                                });
                            }
                            break;
                        case "content_block_delta":
                            if (messageStreamEvent.delta.type === "input_json_delta") {
                                const jsonChunk = messageStreamEvent.delta.partial_json;
                                jsonBuffer += jsonChunk;
                                const now = Date.now();
                                if (now - lastProgressUpdate > 1500) {
                                    // Update every 1.5 seconds
                                    lastProgressUpdate = now;
                                    // 🔥 Detect files being generated
                                    const fileMatches = jsonBuffer.match(/"([^"]*\.(tsx?|css|json|env|md|ts))"\s*:/g);
                                    if (fileMatches) {
                                        const currentFiles = fileMatches.map((match) => match.replace(/"/g, "").replace(":", "").trim());
                                        const newFiles = currentFiles.filter((file) => !detectedFiles.has(file));
                                        if (newFiles.length > 0) {
                                            newFiles.forEach((file) => detectedFiles.add(file));
                                            filesInProgress.push(...newFiles);
                                            // Update current stage based on file type
                                            const latestFile = newFiles[newFiles.length - 1];
                                            if (latestFile.includes("tailwind.config")) {
                                                currentStage = "🎨 Creating design system...";
                                            }
                                            else if (latestFile.includes("App.tsx")) {
                                                currentStage = "⚛️ Building main application...";
                                            }
                                            else if (latestFile.includes("AuthContext")) {
                                                currentStage = "🔐 Setting up authentication...";
                                            }
                                            else if (latestFile.includes("AdminDashboard")) {
                                                currentStage = "👑 Creating admin dashboard...";
                                            }
                                            else if (latestFile.includes("Home.tsx")) {
                                                currentStage = "🏠 Building landing page...";
                                            }
                                            else if (latestFile.includes("Cart")) {
                                                currentStage = "🛒 Adding shopping cart...";
                                            }
                                            else if (latestFile.includes("components/")) {
                                                currentStage = "🧩 Creating UI components...";
                                            }
                                            else if (latestFile.includes("pages/")) {
                                                currentStage = "📄 Building application pages...";
                                            }
                                            else if (latestFile.includes("package.json")) {
                                                currentStage = "📦 Finalizing dependencies...";
                                            }
                                            else {
                                                currentStage = `📝 Creating ${latestFile}...`;
                                            }
                                            console.log(`📁 New files detected: ${newFiles.join(", ")}`);
                                        }
                                    }
                                    // Calculate progress percentage (estimate based on file count and size)
                                    const estimatedTotalFiles = 15; // Rough estimate
                                    const fileProgress = Math.min(90, (filesInProgress.length / estimatedTotalFiles) * 85);
                                    const sizeProgress = Math.min(10, (jsonBuffer.length / 100000) * 10); // Size factor
                                    const totalProgress = Math.min(95, fileProgress + sizeProgress + 10); // +10 for initial setup
                                    onProgress === null || onProgress === void 0 ? void 0 : onProgress({
                                        stage: currentStage,
                                        filesGenerated: [...filesInProgress],
                                        totalSize: jsonBuffer.length,
                                        currentFile: filesInProgress[filesInProgress.length - 1],
                                        percentage: totalProgress,
                                    });
                                    console.log(`🔧 Progress: ${totalProgress.toFixed(1)}% - ${currentStage} (${Math.floor(jsonBuffer.length / 1000)}KB)`);
                                }
                            }
                            break;
                        case "content_block_stop":
                            console.log("✅ Content block stopped"); //@ts-ignore
                            if (((_d = messageStreamEvent.content_block) === null || _d === void 0 ? void 0 : _d.type) === "tool_use") {
                                //@ts-ignore
                                toolUse = messageStreamEvent.content_block;
                                console.log("🛠️ Tool use captured:", toolUse.name);
                                if ((_e = toolUse.input) === null || _e === void 0 ? void 0 : _e.files) {
                                    const fileCount = Object.keys(toolUse.input.files).length;
                                    console.log(`📁 Frontend generation completed! Generated ${fileCount} files.`);
                                    onProgress === null || onProgress === void 0 ? void 0 : onProgress({
                                        stage: "✅ Frontend generation completed!",
                                        filesGenerated: Object.keys(toolUse.input.files),
                                        totalSize: JSON.stringify(toolUse.input.files).length,
                                        percentage: 100,
                                    });
                                }
                            }
                            break;
                        case "message_delta":
                            if (messageStreamEvent.delta.stop_reason) {
                                stopReason = messageStreamEvent.delta.stop_reason;
                            } //@ts-ignore
                            if (messageStreamEvent.delta.usage) {
                                //@ts-ignore
                                usage = messageStreamEvent.delta.usage;
                            }
                            break;
                        case "message_stop":
                            console.log("🏁 Frontend generation completed successfully!");
                            break;
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_f && !_a && (_b = stream_1.return)) yield _b.call(stream_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            // Build reconstructed message and handle function call
            const reconstructedMessage = {
                id: messageId,
                content: [],
                stop_reason: stopReason,
                usage: usage || { input_tokens: 0, output_tokens: 0 },
            };
            if (fullTextContent.trim()) {
                //@ts-ignore
                reconstructedMessage.content.push({
                    type: "text",
                    text: fullTextContent,
                });
            }
            if (toolUse) {
                //@ts-ignore
                reconstructedMessage.content.push({
                    type: "tool_use",
                    id: toolUse.id,
                    name: toolUse.name,
                    input: toolUse.input,
                });
                reconstructedMessage.stop_reason = "tool_use";
            }
            return this.handleFunctionCall(reconstructedMessage, userId);
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
                        case "generate_frontend_application":
                            response.step = "frontend_completed";
                            response.files = toolUse.input.files;
                            response.componentsSummary = toolUse.input.componentsSummary;
                            response.technicalSpecs = toolUse.input.technicalSpecs;
                            response.usageInstructions = toolUse.input.usageInstructions;
                            response.newDependencies = toolUse.input.newDependencies;
                            response.message = "Frontend application generated successfully!";
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