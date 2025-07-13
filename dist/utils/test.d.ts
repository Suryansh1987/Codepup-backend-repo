declare class ParserTestRunner {
    private testCount;
    private passedTests;
    private failedTests;
    test(name: string, testFn: () => void | Promise<void>): void | Promise<void>;
    assert(condition: boolean, message: string): void;
    assertEqual(actual: any, expected: any, message: string): void;
    printSummary(): void;
}
declare function runAllTests(): Promise<void>;
export { runAllTests, ParserTestRunner };
