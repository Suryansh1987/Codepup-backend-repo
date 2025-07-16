"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFrontendCode = parseFrontendCode;
exports.flattenStructure = flattenStructure;
exports.getFileStatus = getFileStatus;
exports.getCodeFileByPath = getCodeFileByPath;
exports.ensureTailwindConfigFirst = ensureTailwindConfigFirst;
exports.validateTailwindConfig = validateTailwindConfig;
exports.correctFilePaths = correctFilePaths;
exports.validateFileStructure = validateFileStructure;
exports.validateSupabaseStructure = validateSupabaseStructure;
exports.getSupabaseFiles = getSupabaseFiles;
exports.getTailwindConfig = getTailwindConfig;
exports.processTailwindProject = processTailwindProject;
exports.generateProjectSummary = generateProjectSummary;
function unescapeString(str) {
    return str
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\r/g, "\r")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
}
function extractJsonFromText(input) {
    // Remove markdown code blocks if present
    let cleanInput = input.replace(/```json\s*\n?/g, "").replace(/```\s*$/g, "");
    // Find the first opening brace and last closing brace
    const firstBrace = cleanInput.indexOf("{");
    const lastBrace = cleanInput.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
        throw new Error("No valid JSON object found in input");
    }
    return cleanInput.substring(firstBrace, lastBrace + 1);
}
function parseFrontendCode(input) {
    try {
        // Extract JSON from the input text
        const jsonString = extractJsonFromText(input);
        const data = JSON.parse(jsonString);
        // Validate required properties
        if (!data.codeFiles || typeof data.codeFiles !== "object") {
            throw new Error("Missing or invalid codeFiles property");
        }
        if (!data.structureTree || typeof data.structureTree !== "object") {
            throw new Error("Missing or invalid structureTree property");
        }
        // Extract and unescape code files
        const codeFiles = Object.entries(data.codeFiles).map(([path, content]) => ({
            path,
            content: unescapeString(content),
        }));
        // Extract structure tree (no unescaping needed for structure)
        const structure = data.structureTree;
        return {
            codeFiles,
            structure,
        };
    }
    catch (error) {
        throw new Error(`Failed to parse frontend code data: ${error instanceof Error ? error.message : String(error)}`);
    }
}
// Helper function to flatten structure tree for easier navigation
function flattenStructure(structure, basePath = "") {
    const paths = [];
    for (const [key, value] of Object.entries(structure)) {
        const currentPath = basePath ? `${basePath}/${key}` : key;
        if (typeof value === "string") {
            // This is a file
            paths.push(currentPath);
        }
        else if (typeof value === "object" && value !== null) {
            // This is a directory, recurse
            paths.push(...flattenStructure(value, currentPath));
        }
    }
    return paths;
}
// Helper function to get file status from structure
function getFileStatus(structure, filePath) {
    const pathParts = filePath.split("/");
    let current = structure;
    for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (typeof current[part] === "object" && current[part] !== null) {
            current = current[part];
        }
        else {
            return null; // Path doesn't exist
        }
    }
    const fileName = pathParts[pathParts.length - 1];
    const fileEntry = current[fileName];
    return typeof fileEntry === "string" ? fileEntry : null;
}
// Helper function to get code file by path
function getCodeFileByPath(codeFiles, path) {
    return codeFiles.find((file) => file.path === path) || null;
}
// TAILWIND-RELATED FUNCTIONS
/**
 * Ensures tailwind.config.ts is first in the array for proper processing order
 */
function ensureTailwindConfigFirst(codeFiles) {
    const tailwindConfigIndex = codeFiles.findIndex(file => file.path === 'tailwind.config.ts' || file.path.endsWith('/tailwind.config.ts'));
    if (tailwindConfigIndex === -1) {
        console.warn('No tailwind.config.ts file found in generated files');
        return codeFiles;
    }
    if (tailwindConfigIndex !== 0) {
        const tailwindConfig = codeFiles[tailwindConfigIndex];
        const reorderedFiles = [
            tailwindConfig,
            ...codeFiles.filter((_, index) => index !== tailwindConfigIndex)
        ];
        console.log('Moved tailwind.config.ts to first position');
        return reorderedFiles;
    }
    return codeFiles;
}
/**
 * Validates Tailwind config content for common issues
 */
function validateTailwindConfig(content) {
    const requiredElements = [
        'export default',
        'content:',
        'theme:',
        'extend:',
        'colors:'
    ];
    // CSS variable patterns that should NOT be present (not supported in artifacts)
    const cssVariablePatterns = [
        'hsl(var(',
        'var(--',
        'rgb(var(',
        'rgba(var(',
        'hsla(var('
    ];
    const hasCssVariables = cssVariablePatterns.some(pattern => content.includes(pattern));
    const hasRequiredElements = requiredElements.every(element => content.includes(element));
    if (!hasRequiredElements) {
        const missing = requiredElements.filter(element => !content.includes(element));
        console.warn('Missing required elements in Tailwind config:', missing);
    }
    if (hasCssVariables) {
        const foundPatterns = cssVariablePatterns.filter(pattern => content.includes(pattern));
        console.warn('Found CSS variables (not allowed in artifacts):', foundPatterns);
    }
    return hasRequiredElements && !hasCssVariables;
}
/**
 * Corrects file paths to ensure proper structure (src/ vs root)
 */
function correctFilePaths(codeFiles) {
    return codeFiles.map(file => {
        // Files that should stay at root level
        const rootLevelFiles = [
            'tailwind.config.ts',
            '.env',
            '.env.local',
            '.env.development',
            '.env.production',
            '.env.example',
            'package.json',
            'tsconfig.json',
            'next.config.js',
            'next.config.ts',
            '.gitignore',
            'README.md',
            'docker-compose.yml',
            'Dockerfile'
        ];
        // Files/folders that should stay at root (including their subpaths)
        const rootLevelPrefixes = [
            'supabase/',
            'public/',
            '.next/',
            'node_modules/'
        ];
        // Check if this file should stay at root level
        const shouldStayAtRoot = rootLevelFiles.some(rootFile => file.path === rootFile || file.path.endsWith(`/${rootFile}`)) || rootLevelPrefixes.some(prefix => file.path.startsWith(prefix));
        if (shouldStayAtRoot) {
            return file;
        }
        // Only move to src/ if it's not already there and not a root-level file
        if (!file.path.startsWith('src/')) {
            console.log(`Correcting file path: ${file.path} -> src/${file.path}`);
            return Object.assign(Object.assign({}, file), { path: `src/${file.path}` });
        }
        return file;
    });
}
/**
 * Validates the overall file structure for common issues
 */
function validateFileStructure(codeFiles) {
    const errors = [];
    // Check for tailwind.config.ts at root level
    const tailwindConfig = codeFiles.find(f => f.path === 'tailwind.config.ts');
    if (!tailwindConfig) {
        errors.push('tailwind.config.ts not found');
    }
    else if (tailwindConfig.path !== 'tailwind.config.ts') {
        errors.push(`tailwind.config.ts should be at root level, found at: ${tailwindConfig.path}`);
    }
    // Check Supabase folder structure
    const supabaseFiles = codeFiles.filter(f => f.path.includes('supabase'));
    if (supabaseFiles.length > 0) {
        console.log('DEBUG: Found Supabase files:', supabaseFiles.map(f => f.path));
        // Files that should be at root level (supabase/)
        const correctSupabaseFiles = supabaseFiles.filter(f => f.path.startsWith('supabase/'));
        // Files incorrectly placed in src/supabase/
        const incorrectSupabaseFiles = supabaseFiles.filter(f => f.path.startsWith('src/supabase/'));
        // Files with supabase in other incorrect locations
        const otherSupabaseFiles = supabaseFiles.filter(f => !f.path.startsWith('supabase/') &&
            !f.path.startsWith('src/supabase/') &&
            f.path.includes('supabase'));
        if (incorrectSupabaseFiles.length > 0) {
            errors.push(`Supabase files should be at root level (supabase/), found in src/: ${incorrectSupabaseFiles.map(f => f.path).join(', ')}`);
        }
        if (otherSupabaseFiles.length > 0) {
            errors.push(`Supabase files found in unexpected locations: ${otherSupabaseFiles.map(f => f.path).join(', ')}`);
        }
        // Check for common Supabase files
        const expectedSupabaseFiles = [
            'supabase/config.toml',
            'supabase/seed.sql',
            'supabase/migrations'
        ];
        expectedSupabaseFiles.forEach(expectedFile => {
            const found = supabaseFiles.some(f => f.path === expectedFile || f.path.startsWith(expectedFile));
            if (!found) {
                console.warn(`Expected Supabase file/folder not found: ${expectedFile}`);
            }
        });
    }
    // Check that non-root files are in src/
    const nonRootFiles = codeFiles.filter(f => f.path !== 'tailwind.config.ts' &&
        !f.path.startsWith('supabase/') &&
        !f.path.startsWith('public/') &&
        !f.path.startsWith('.env') &&
        !f.path.includes('package.json') &&
        !f.path.includes('tsconfig.json') &&
        !f.path.includes('next.config.') &&
        !f.path.includes('.gitignore') &&
        !f.path.includes('README.md') &&
        !f.path.includes('docker-compose.yml') &&
        !f.path.includes('Dockerfile'));
    for (const file of nonRootFiles) {
        if (!file.path.startsWith('src/')) {
            errors.push(`File ${file.path} should be in src/ folder`);
        }
    }
    return {
        isValid: errors.length === 0,
        errors
    };
}
/**
 * Validates Supabase folder structure and files
 */
function validateSupabaseStructure(codeFiles) {
    const errors = [];
    const warnings = [];
    const supabaseFiles = codeFiles.filter(f => f.path.includes('supabase'));
    if (supabaseFiles.length === 0) {
        warnings.push('No Supabase files found in project');
        return { isValid: true, errors: warnings };
    }
    console.log('DEBUG: Validating Supabase structure...');
    console.log('DEBUG: Found Supabase files:', supabaseFiles.map(f => f.path));
    // Check if all Supabase files are at correct root level
    const correctFiles = supabaseFiles.filter(f => f.path.startsWith('supabase/'));
    const incorrectFiles = supabaseFiles.filter(f => !f.path.startsWith('supabase/'));
    if (incorrectFiles.length > 0) {
        errors.push(`Supabase files must be in root 'supabase/' folder. Found in wrong locations: ${incorrectFiles.map(f => f.path).join(', ')}`);
    }
    // Check for essential Supabase files
    const essentialFiles = [
        { path: 'supabase/config.toml', required: true },
        { path: 'supabase/seed.sql', required: false },
        { path: 'supabase/migrations', required: false, isFolder: true }
    ];
    essentialFiles.forEach(({ path, required, isFolder = false }) => {
        const found = supabaseFiles.some(f => isFolder ? f.path.startsWith(path) : f.path === path);
        if (!found && required) {
            errors.push(`Required Supabase file missing: ${path}`);
        }
        else if (!found) {
            warnings.push(`Common Supabase file not found: ${path}`);
        }
    });
    // Check for SQL files in migrations folder
    const migrationFiles = supabaseFiles.filter(f => f.path.startsWith('supabase/migrations/') && f.path.endsWith('.sql'));
    if (migrationFiles.length === 0) {
        warnings.push('No SQL migration files found in supabase/migrations/');
    }
    else {
        console.log(`DEBUG: Found ${migrationFiles.length} migration files`);
    }
    // Validate migration file naming convention
    migrationFiles.forEach(file => {
        const fileName = file.path.split('/').pop() || '';
        // Check if follows timestamp naming convention (YYYYMMDDHHMMSS_name.sql)
        const timestampPattern = /^\d{14}_.*\.sql$/;
        if (!timestampPattern.test(fileName)) {
            warnings.push(`Migration file doesn't follow naming convention (YYYYMMDDHHMMSS_name.sql): ${file.path}`);
        }
    });
    return {
        isValid: errors.length === 0,
        errors: [...errors, ...warnings]
    };
}
/**
 * Gets all Supabase-related files from the project
 */
function getSupabaseFiles(codeFiles) {
    const allSupabaseFiles = codeFiles.filter(f => f.path.includes('supabase'));
    const configFile = allSupabaseFiles.find(f => f.path === 'supabase/config.toml') || null;
    const seedFile = allSupabaseFiles.find(f => f.path === 'supabase/seed.sql') || null;
    const migrationFiles = allSupabaseFiles.filter(f => f.path.startsWith('supabase/migrations/') && f.path.endsWith('.sql'));
    return {
        configFile,
        migrationFiles,
        seedFile,
        allSupabaseFiles
    };
}
/**
 * Gets the Tailwind config file from the code files array
 */
function getTailwindConfig(codeFiles) {
    return codeFiles.find(file => file.path === 'tailwind.config.ts' || file.path.endsWith('/tailwind.config.ts')) || null;
}
/**
 * Processes and optimizes the code files for Tailwind-based projects
 */
function processTailwindProject(codeFiles) {
    // Step 1: Correct file paths
    let processedFiles = correctFilePaths(codeFiles);
    // Step 2: Ensure Tailwind config is first
    processedFiles = ensureTailwindConfigFirst(processedFiles);
    // Step 3: Validate file structure
    const validationResult = validateFileStructure(processedFiles);
    // Step 4: Validate Supabase structure
    const supabaseValidation = validateSupabaseStructure(processedFiles);
    // Step 5: Get Tailwind config for validation
    const tailwindConfig = getTailwindConfig(processedFiles);
    // Step 6: Get Supabase files
    const supabaseFiles = getSupabaseFiles(processedFiles);
    // Step 7: Validate Tailwind config content if it exists
    if (tailwindConfig) {
        const isValidConfig = validateTailwindConfig(tailwindConfig.content);
        if (!isValidConfig) {
            validationResult.isValid = false;
            validationResult.errors.push('Tailwind config validation failed');
        }
    }
    return {
        processedFiles,
        validationResult,
        supabaseValidation,
        tailwindConfig,
        supabaseFiles
    };
}
/**
 * Generates a summary report of the parsed project
 */
function generateProjectSummary(parsedResult) {
    const { codeFiles, structure } = parsedResult;
    // Count files by extension
    const filesByType = {};
    codeFiles.forEach(file => {
        const extension = file.path.split('.').pop() || 'no-extension';
        filesByType[extension] = (filesByType[extension] || 0) + 1;
    });
    // Calculate structure depth
    function getMaxDepth(node, currentDepth = 0) {
        let maxDepth = currentDepth;
        for (const value of Object.values(node)) {
            if (typeof value === 'object' && value !== null) {
                maxDepth = Math.max(maxDepth, getMaxDepth(value, currentDepth + 1));
            }
        }
        return maxDepth;
    }
    const structureDepth = getMaxDepth(structure);
    // Validate structure
    const validation = validateFileStructure(codeFiles);
    return {
        totalFiles: codeFiles.length,
        filesByType,
        structureDepth,
        hasValidStructure: validation.isValid
    };
}
//# sourceMappingURL=newparser.js.map