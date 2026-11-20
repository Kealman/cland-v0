/** Shared repository test-path grammar for plans and suite admission. */
export const diagnosticTestFile = (file: string): boolean => /^(?!.*(?:^|\/)\.\.\/)(hub\/(test|src)|nvim\/test|web\/test)\/.*\.test\.ts$/.test(file) && !/[\r\n\0\\]/.test(file) && !file.split('/').includes('.') && !file.includes('//');
