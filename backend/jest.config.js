export default {
  testEnvironment: "node",
  testMatch: ["**/__tests__/test-jest/**/*.test.js"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/__tests__/tests-vitest/"
  ]
};