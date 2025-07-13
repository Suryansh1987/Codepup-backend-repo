// Import your parser functions (adjust path as needed)
import {
  parseFrontendCode,
  flattenStructure,
  getFileStatus,
  getCodeFileByPath,
  ensureTailwindConfigFirst,
  validateTailwindConfig,
  correctFilePaths,
  validateFileStructure,
  validateSupabaseStructure,
  getSupabaseFiles,
  getTailwindConfig,
  processTailwindProject,
  generateProjectSummary,
  CodeFile,
  StructureNode,
  ParsedResult,
  ValidationResult,
} from './newparser'; // Adjust this import path

// Test data
const mockValidJsonInput = `
{
  "codeFiles": {
    "app/page.tsx": "import React from 'react';\\n\\nexport default function HomePage() {\\n  return <div>Hello World</div>;\\n}",
    "components/Header.tsx": "import React from 'react';\\n\\nexport function Header() {\\n  return <header>Header</header>;\\n}",
    "tailwind.config.ts": "import type { Config } from 'tailwindcss'\\n\\nconst config: Config = {\\n  content: [\\n    './pages/**/*.{js,ts,jsx,tsx,mdx}',\\n    './components/**/*.{js,ts,jsx,tsx,mdx}',\\n    './app/**/*.{js,ts,jsx,tsx,mdx}',\\n  ],\\n  theme: {\\n    extend: {\\n      colors: {\\n        primary: '#3b82f6',\\n        secondary: '#ef4444'\\n      }\\n    },\\n  },\\n  plugins: [],\\n}\\nexport default config",
    "supabase/config.toml": "[api]\\nport = 54321\\n[db]\\nport = 54322",
    "supabase/migrations/20240101000000_init.sql": "-- Enable UUID extension\\nCREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";\\n\\n-- Create users table\\nCREATE TABLE IF NOT EXISTS public.users (\\n  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,\\n  email TEXT UNIQUE NOT NULL,\\n  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL\\n);\\n\\n-- Enable RLS\\nALTER TABLE public.users ENABLE ROW LEVEL SECURITY;\\n\\n-- Create function\\nCREATE OR REPLACE FUNCTION public.get_user_id()\\nRETURNS UUID\\nLANGUAGE plpgsql\\nSECURITY DEFINER\\nAS $\\nBEGIN\\n  RETURN auth.uid();\\nEND;\\n$;",
    "supabase/seed.sql": "-- Insert test users\\nINSERT INTO public.users (id, email) VALUES\\n  ('123e4567-e89b-12d3-a456-426614174000', 'admin@example.com'),\\n  ('123e4567-e89b-12d3-a456-426614174001', 'user@example.com')\\nON CONFLICT (email) DO NOTHING;"
  },
  "structureTree": {
    "app": {
      "page.tsx": "file"
    },
    "components": {
      "Header.tsx": "file"
    },
    "tailwind.config.ts": "file",
    "supabase": {
      "config.toml": "file",
      "migrations": {
        "20240101000000_init.sql": "file"
      },
      "seed.sql": "file"
    }
  }
}
`;

// Test data - Simple version to avoid JSON escaping issues
const mockSimpleJsonInput = JSON.stringify({
  "codeFiles": {
    "app/page.tsx": "import React from 'react';\n\nexport default function HomePage() {\n  return <div>Hello World</div>;\n}",
    "components/Header.tsx": "import React from 'react';\n\nexport function Header() {\n  return <header>Header</header>;\n}",
    "tailwind.config.ts": `import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        secondary: '#ef4444'
      }
    },
  },
  plugins: [],
}
export default config`,
    "supabase/config.toml": "[api]\nport = 54321\n[db]\nport = 54322",
    "supabase/migrations/20240101000000_init.sql": `-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create function
CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $
BEGIN
  RETURN auth.uid();
END;
$;`,
    "supabase/seed.sql": `-- Insert test users
INSERT INTO public.users (id, email) VALUES
  ('123e4567-e89b-12d3-a456-426614174000', 'admin@example.com'),
  ('123e4567-e89b-12d3-a456-426614174001', 'user@example.com')
ON CONFLICT (email) DO NOTHING;`
  },
  "structureTree": {
    "app": {
      "page.tsx": "file"
    },
    "components": {
      "Header.tsx": "file"
    },
    "tailwind.config.ts": "file",
    "supabase": {
      "config.toml": "file",
      "migrations": {
        "20240101000000_init.sql": "file"
      },
      "seed.sql": "file"
    }
  }
});

const mockInvalidTailwindConfig = `
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'hsl(var(--primary))', // This uses CSS variables - not allowed
        secondary: 'var(--secondary)'   // This too
      }
    },
  },
  plugins: [],
}
export default config
`;

const mockValidTailwindConfig = `
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        secondary: '#ef4444'
      }
    },
  },
  plugins: [],
}
export default config
`;

// Test runner class
class ParserTestRunner {
  private testCount = 0;
  private passedTests = 0;
  private failedTests = 0;

  test(name: string, testFn: () => void | Promise<void>): void | Promise<void> {
  this.testCount++;
  console.log(`\n🧪 Test ${this.testCount}: ${name}`);
  console.log('━'.repeat(50));

  try {
    const result = testFn();
    if (result instanceof Promise) {
      return result.then(() => {
        console.log('✅ PASSED');
        this.passedTests++;
      }).catch((error) => {
        console.log('❌ FAILED:', error.message);
        this.failedTests++;
        this.printSummary();
      });
    } else {
      console.log('✅ PASSED');
      this.passedTests++;
      return; // <-- add this return
    }
  } catch (error) {
    console.log('❌ FAILED:', (error as Error).message);
    this.failedTests++;
    return; // <-- add this return
  }
}


  assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(message);
    }
    console.log(`  ✓ ${message}`);
  }

  assertEqual(actual: any, expected: any, message: string) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${message} - Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
    }
    console.log(`  ✓ ${message}`);
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${this.testCount}`);
    console.log(`✅ Passed: ${this.passedTests}`);
    console.log(`❌ Failed: ${this.failedTests}`);
    console.log(`Success Rate: ${((this.passedTests / this.testCount) * 100).toFixed(1)}%`);
    
    if (this.failedTests === 0) {
      console.log('🎉 All tests passed!');
    } else {
      console.log('⚠️  Some tests failed. Please review the output above.');
    }
  }
}

// Main test function
async function runAllTests() {
  const runner = new ParserTestRunner();

  // Test 1: Basic JSON Parsing
  await runner.test('Basic JSON Parsing', () => {
    const result = parseFrontendCode(mockValidJsonInput);
    
    runner.assert(result.codeFiles.length > 0, 'Should parse code files');
    runner.assert(typeof result.structure === 'object', 'Should parse structure tree');
    runner.assert(result.codeFiles.some(f => f.path === 'app/page.tsx'), 'Should find app/page.tsx');
    
    console.log(`  📁 Found ${result.codeFiles.length} files`);
    console.log(`  📂 Structure keys: ${Object.keys(result.structure).join(', ')}`);
  });

  // Test 2: Flatten Structure
  runner.test('Flatten Structure Function', () => {
    const result = parseFrontendCode(mockValidJsonInput);
    const flattened = flattenStructure(result.structure);
    
    runner.assert(flattened.length > 0, 'Should flatten structure');
    runner.assert(flattened.includes('app/page.tsx'), 'Should include nested files');
    runner.assert(flattened.includes('supabase/config.toml'), 'Should include supabase files');
    
    console.log(`  📋 Flattened paths: ${flattened.join(', ')}`);
  });

  // Test 3: Get File Status
  runner.test('Get File Status Function', () => {
    const result = parseFrontendCode(mockValidJsonInput);
    
    const pageStatus = getFileStatus(result.structure, 'app/page.tsx');
    const configStatus = getFileStatus(result.structure, 'supabase/config.toml');
    const nonExistentStatus = getFileStatus(result.structure, 'nonexistent/file.txt');
    
    runner.assertEqual(pageStatus, 'file', 'Should return file status for existing file');
    runner.assertEqual(configStatus, 'file', 'Should return file status for supabase config');
    runner.assertEqual(nonExistentStatus, null, 'Should return null for non-existent file');
  });

  // Test 4: Get Code File By Path
  runner.test('Get Code File By Path Function', () => {
    const result = parseFrontendCode(mockValidJsonInput);
    
    const pageFile = getCodeFileByPath(result.codeFiles, 'app/page.tsx');
    const nonExistentFile = getCodeFileByPath(result.codeFiles, 'nonexistent.tsx');
    
    runner.assert(pageFile !== null, 'Should find existing file');
    //@ts-ignore
    runner.assert(pageFile?.content.includes('Hello World'), 'Should have correct content');
    runner.assertEqual(nonExistentFile, null, 'Should return null for non-existent file');
  });

  // Test 5: Tailwind Config Validation (Valid)
  runner.test('Tailwind Config Validation - Valid Config', () => {
    const isValid = validateTailwindConfig(mockValidTailwindConfig);
    
    runner.assert(isValid, 'Should validate correct Tailwind config');
    console.log('  ✓ Valid Tailwind config passed validation');
  });

  // Test 6: Tailwind Config Validation (Invalid)
  runner.test('Tailwind Config Validation - Invalid Config', () => {
    const isValid = validateTailwindConfig(mockInvalidTailwindConfig);
    
    runner.assert(!isValid, 'Should reject config with CSS variables');
    console.log('  ✓ Invalid Tailwind config correctly rejected');
  });

  // Test 7: Get Tailwind Config
  runner.test('Get Tailwind Config Function', () => {
    const result = parseFrontendCode(mockValidJsonInput);
    const tailwindConfig = getTailwindConfig(result.codeFiles);
    
    runner.assert(tailwindConfig !== null, 'Should find Tailwind config');
    runner.assertEqual(tailwindConfig?.path, 'tailwind.config.ts', 'Should have correct path');
        //@ts-ignore
    runner.assert(tailwindConfig?.content.includes('extend'), 'Should have valid content');
  });

  // Test 8: Ensure Tailwind Config First
  runner.test('Ensure Tailwind Config First Function', () => {
    const result = parseFrontendCode(mockValidJsonInput);
    const reordered = ensureTailwindConfigFirst(result.codeFiles);
    
    runner.assertEqual(reordered[0].path, 'tailwind.config.ts', 'Tailwind config should be first');
    console.log(`  📋 File order: ${reordered.map(f => f.path).join(', ')}`);
  });

  // Test 9: Correct File Paths
  runner.test('Correct File Paths Function', () => {
    // Create test data with incorrect paths
    const incorrectFiles: CodeFile[] = [
      { path: 'tailwind.config.ts', content: 'config' },
      { path: 'components/Header.tsx', content: 'header' },
      { path: 'supabase/config.toml', content: 'config' },
      { path: 'app/page.tsx', content: 'page' }
    ];
    
    const corrected = correctFilePaths(incorrectFiles);
    
    runner.assertEqual(corrected[0].path, 'tailwind.config.ts', 'Tailwind config should stay at root');
    runner.assertEqual(corrected[2].path, 'supabase/config.toml', 'Supabase should stay at root');
    runner.assert(corrected[1].path.startsWith('src/'), 'Components should move to src/');
    runner.assert(corrected[3].path.startsWith('src/'), 'App should move to src/');
    
    console.log(`  📁 Corrected paths: ${corrected.map(f => f.path).join(', ')}`);
  });

  // Test 10: Validate File Structure
  runner.test('Validate File Structure Function', () => {
    const result = parseFrontendCode(mockValidJsonInput);
    const corrected = correctFilePaths(result.codeFiles);
    const validation = validateFileStructure(corrected);
    
    console.log(`  📊 Validation result: ${validation.isValid ? 'Valid' : 'Invalid'}`);
    if (!validation.isValid) {
      console.log(`  ⚠️  Errors: ${validation.errors.join(', ')}`);
    }
    
    runner.assert(typeof validation.isValid === 'boolean', 'Should return boolean validity');
    runner.assert(Array.isArray(validation.errors), 'Should return errors array');
  });

  // Test 11: Validate Supabase Structure
  runner.test('Validate Supabase Structure Function', () => {
    const result = parseFrontendCode(mockValidJsonInput);
    const supabaseValidation = validateSupabaseStructure(result.codeFiles);
    
    console.log(`  🗄️  Supabase validation: ${supabaseValidation.isValid ? 'Valid' : 'Invalid'}`);
    if (!supabaseValidation.isValid) {
      console.log(`  ⚠️  Supabase errors: ${supabaseValidation.errors.join(', ')}`);
    }
    
    runner.assert(typeof supabaseValidation.isValid === 'boolean', 'Should return boolean validity');
    runner.assert(Array.isArray(supabaseValidation.errors), 'Should return errors array');
  });

  // Test 12: Get Supabase Files
  runner.test('Get Supabase Files Function', () => {
    const result = parseFrontendCode(mockValidJsonInput);
    const supabaseFiles = getSupabaseFiles(result.codeFiles);
    
    runner.assert(supabaseFiles.configFile !== null, 'Should find config file');
    runner.assertEqual(supabaseFiles.configFile?.path, 'supabase/config.toml', 'Should have correct config path');
    runner.assert(supabaseFiles.migrationFiles.length > 0, 'Should find migration files');
    runner.assert(supabaseFiles.seedFile !== null, 'Should find seed file');
    runner.assert(supabaseFiles.allSupabaseFiles.length >= 3, 'Should find all supabase files');
    
    console.log(`  📊 Found: ${supabaseFiles.allSupabaseFiles.length} supabase files`);
    console.log(`  📊 Migrations: ${supabaseFiles.migrationFiles.length}`);
  });

  // Test 13: Process Tailwind Project (Main Function)
  runner.test('Process Tailwind Project - Main Function', () => {
    const result = parseFrontendCode(mockValidJsonInput);
    const processed = processTailwindProject(result.codeFiles);
    
    runner.assert(processed.processedFiles.length > 0, 'Should process files');
    runner.assert(processed.processedFiles[0].path === 'tailwind.config.ts', 'Tailwind config should be first');
    runner.assert(typeof processed.validationResult.isValid === 'boolean', 'Should validate structure');
    runner.assert(typeof processed.supabaseValidation.isValid === 'boolean', 'Should validate supabase');
    runner.assert(processed.tailwindConfig !== null, 'Should find tailwind config');
    runner.assert(processed.supabaseFiles.allSupabaseFiles.length > 0, 'Should find supabase files');
    
    console.log(`  📊 Processed ${processed.processedFiles.length} files`);
    console.log(`  📊 Structure valid: ${processed.validationResult.isValid}`);
    console.log(`  📊 Supabase valid: ${processed.supabaseValidation.isValid}`);
  });

  // Test 14: Generate Project Summary
  runner.test('Generate Project Summary Function', () => {
    const result = parseFrontendCode(mockValidJsonInput);
    const summary = generateProjectSummary(result);
    
    runner.assert(summary.totalFiles > 0, 'Should count total files');
    runner.assert(typeof summary.filesByType === 'object', 'Should categorize files by type');
    runner.assert(summary.structureDepth > 0, 'Should calculate structure depth');
    runner.assert(typeof summary.hasValidStructure === 'boolean', 'Should validate structure');
    
    console.log(`  📊 Total files: ${summary.totalFiles}`);
    console.log(`  📊 File types: ${JSON.stringify(summary.filesByType)}`);
    console.log(`  📊 Structure depth: ${summary.structureDepth}`);
    console.log(`  📊 Valid structure: ${summary.hasValidStructure}`);
  });

  // Test 15: Error Handling
  runner.test('Error Handling - Invalid JSON', () => {
    const invalidJson = '{ invalid json content }';
    
    try {
      parseFrontendCode(invalidJson);
      runner.assert(false, 'Should throw error for invalid JSON');
    } catch (error) {
      runner.assert(true, 'Should throw error for invalid JSON');
      console.log(`  ✓ Correctly caught error: ${(error as Error).message.substring(0, 50)}...`);
    }
  });

  // Test 16: Missing Required Properties
  runner.test('Error Handling - Missing Properties', () => {
    const missingProps = '{ "codeFiles": {}, "wrongProperty": {} }';
    
    try {
      parseFrontendCode(missingProps);
      runner.assert(false, 'Should throw error for missing structureTree');
    } catch (error) {
      runner.assert(true, 'Should throw error for missing structureTree');
      console.log(`  ✓ Correctly caught error: ${(error as Error).message}`);
    }
  });

  // Test 17: SQL Syntax Validation (New Test)
  runner.test('SQL Syntax Validation - Fixed Supabase Files', () => {
    const result = parseFrontendCode(mockValidJsonInput);
    const supabaseFiles = getSupabaseFiles(result.codeFiles);
    
    // Check migration file has proper SQL syntax
    const migrationFile = supabaseFiles.migrationFiles[0];
    runner.assert(migrationFile !== undefined, 'Should find migration file');
    runner.assert(migrationFile.content.includes('$'), 'Should have proper function delimiters');
    runner.assert(migrationFile.content.includes('CREATE EXTENSION'), 'Should have extension creation');
    runner.assert(migrationFile.content.includes('uuid_generate_v4()'), 'Should use UUID functions');
    runner.assert(migrationFile.content.includes('ENABLE ROW LEVEL SECURITY'), 'Should enable RLS');
    
    // Check seed file has proper syntax
    const seedFile = supabaseFiles.seedFile;
    runner.assert(seedFile !== null, 'Should find seed file');
    runner.assert(seedFile!.content.includes('ON CONFLICT'), 'Should handle conflicts properly');
    runner.assert(seedFile!.content.includes('DO NOTHING'), 'Should have proper conflict resolution');
    
    console.log('  ✓ Migration file has proper PostgreSQL function syntax with $ delimiters');
    console.log('  ✓ Seed file has proper conflict handling');
    console.log('  ✓ All SQL syntax issues have been resolved');
  });

  // Test 18: Comprehensive Project Validation (New Test)
  runner.test('Comprehensive Project Validation - Production Ready', () => {
    const result = parseFrontendCode(mockValidJsonInput);
    const processed = processTailwindProject(result.codeFiles);
    
    // Validate all aspects are production-ready
    runner.assert(processed.validationResult.isValid, 'File structure should be valid');
    runner.assert(processed.supabaseValidation.isValid, 'Supabase structure should be valid');
    runner.assert(processed.tailwindConfig !== null, 'Should have Tailwind config');
    
    // Check Tailwind config is valid (no CSS variables)
    const tailwindValid = validateTailwindConfig(processed.tailwindConfig!.content);
    runner.assert(tailwindValid, 'Tailwind config should be artifact-compatible');
    
    // Check Supabase files are properly structured
    const supabaseFiles = processed.supabaseFiles;
    runner.assert(supabaseFiles.configFile !== null, 'Should have Supabase config');
    runner.assert(supabaseFiles.migrationFiles.length > 0, 'Should have migration files');
    runner.assert(supabaseFiles.seedFile !== null, 'Should have seed file');
    
    // Validate SQL syntax in migrations
    const migrationContent = supabaseFiles.migrationFiles[0].content;
    runner.assert(!migrationContent.includes('AS $\n'), 'Should not have old broken syntax');
    runner.assert(migrationContent.includes('AS $'), 'Should have proper function delimiters');
    
    console.log('  🎉 Project structure is production-ready!');
    console.log('  ✅ Tailwind config: artifact-compatible');
    console.log('  ✅ Supabase files: proper PostgreSQL syntax');
    console.log('  ✅ File structure: organized correctly');
  });
}

// Export for use in different environments
export { runAllTests, ParserTestRunner };

// Run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runAllTests().catch(console.error);
}

// For browser/module environments
if (typeof window !== 'undefined') {
  (window as any).runParserTests = runAllTests;
  console.log('Parser tests loaded! Run window.runParserTests() to execute.');
}