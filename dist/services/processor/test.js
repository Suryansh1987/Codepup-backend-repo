"use strict";
// SUPER SIMPLE TEST - Just copy and paste this code and run it
// Test 1: Simple string search
function testStringSearch() {
    console.log('🔍 Test 1: Simple string search');
    const testContent = `import React from 'react';

const TestComponent = () => {
  return (
    <div>
      <h1>Hello virat!</h1>
      <p>This is a test with virat in it.</p>
      <button>Click me, virat!</button>
    </div>
  );
};

export default TestComponent;`;
    const searchTerm = 'virat';
    const lines = testContent.split('\n');
    console.log(`📄 Content has ${lines.length} lines`);
    console.log(`🔍 Searching for "${searchTerm}"`);
    let foundCount = 0;
    lines.forEach((line, index) => {
        const lowerLine = line.toLowerCase();
        const lowerSearchTerm = searchTerm.toLowerCase();
        if (lowerLine.includes(lowerSearchTerm)) {
            foundCount++;
            console.log(`✅ Line ${index + 1}: "${line}"`);
        }
    });
    console.log(`📊 Found ${foundCount} matches\n`);
    return foundCount > 0;
}
// Test 2: Exact same logic as your processor
function testProcessorLogic() {
    console.log('🔍 Test 2: Exact processor logic');
    const testContent = `import React from 'react';

const TestComponent = () => {
  return (
    <div>
      <h1>Hello virat!</h1>
      <p>This is a test with virat in it.</p>
      <button>Click me, virat!</button>
    </div>
  );
};

export default TestComponent;`;
    const searchTerm = 'virat';
    const filePath = 'test-file.tsx';
    // This is EXACTLY your simpleSearchInFile logic
    const lines = testContent.split('\n');
    const results = [];
    console.log(`📄 Processing file: ${filePath}`);
    console.log(`📊 Content length: ${testContent.length}`);
    console.log(`📊 Lines: ${lines.length}`);
    lines.forEach((line, index) => {
        // Case-insensitive search
        const lowerLine = line.toLowerCase();
        const lowerSearchTerm = searchTerm.toLowerCase();
        let startIndex = 0;
        while (true) {
            const matchIndex = lowerLine.indexOf(lowerSearchTerm, startIndex);
            if (matchIndex === -1)
                break;
            // Get the actual matched text from original line
            const actualMatch = line.substring(matchIndex, matchIndex + searchTerm.length);
            results.push({
                path: { text: filePath },
                lines: { text: line },
                line_number: index + 1,
                absolute_offset: 0,
                submatches: [{
                        match: { text: actualMatch },
                        start: matchIndex,
                        end: matchIndex + actualMatch.length
                    }]
            });
            console.log(`✅ Match found:`);
            console.log(`   Line ${index + 1}: "${line}"`);
            console.log(`   Match: "${actualMatch}" at position ${matchIndex}`);
            startIndex = matchIndex + 1;
        }
    });
    console.log(`📊 Total results: ${results.length}\n`);
    return results;
}
// Test 3: Test with different search terms
function testDifferentTerms() {
    console.log('🔍 Test 3: Different search terms');
    const testContent = `import React from 'react';

const TestComponent = () => {
  return (
    <div>
      <h1>Hello virat!</h1>
      <p>This is a test with virat in it.</p>
      <button>Click me, virat!</button>
    </div>
  );
};

export default TestComponent;`;
    const searchTerms = ['virat', 'react', 'test', 'hello', 'component', 'xyz'];
    searchTerms.forEach(term => {
        const lowerContent = testContent.toLowerCase();
        const found = lowerContent.includes(term.toLowerCase());
        console.log(`📊 "${term}": ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
    });
    console.log('');
}
// Test 4: Test empty content
function testEmptyContent() {
    console.log('🔍 Test 4: Empty content');
    const testCases = [
        { name: 'Empty string', content: '' },
        { name: 'Only whitespace', content: '   \n\n  \t  ' },
        { name: 'Only newlines', content: '\n\n\n' },
        { name: 'Single word', content: 'virat' },
        { name: 'Case mismatch', content: 'VIRAT' }
    ];
    testCases.forEach(testCase => {
        const found = testCase.content.toLowerCase().includes('virat');
        console.log(`📊 ${testCase.name}: ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
    });
    console.log('');
}
// RUN ALL TESTS
console.log('🚀 Starting super simple tests...\n');
const test1Result = testStringSearch();
const test2Result = testProcessorLogic();
testDifferentTerms();
testEmptyContent();
console.log('📊 SUMMARY:');
console.log(`Test 1 (String search): ${test1Result ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`Test 2 (Processor logic): ${test2Result.length > 0 ? '✅ PASSED' : '❌ FAILED'}`);
if (test1Result && test2Result.length > 0) {
    console.log('✅ All tests passed! The search logic works correctly.');
    console.log('🤔 The issue might be:');
    console.log('   1. Files don\'t actually contain "virat"');
    console.log('   2. File reading is failing');
    console.log('   3. File encoding issues');
}
else {
    console.log('❌ Tests failed! There\'s a problem with the search logic.');
}
// BONUS: Test your actual fast-glob extraction if you have it
/*
To test your actual code, uncomment and modify this:

import { EnhancedLLMRipgrepProcessor } from './your-processor-file';

async function testRealProcessor() {
  const processor = new EnhancedLLMRipgrepProcessor('any-path', null);
  
  // Test term extraction
  const terms = EnhancedLLMRipgrepProcessor.extractTermsFromPrompt('change "virat" to "woww"');
  console.log('Term extraction:', terms);
  
  // Test validation
  const validation = await EnhancedL**/ 
//# sourceMappingURL=test.js.map