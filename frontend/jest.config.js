// Unit tests for logic layers only (Redux slices + pure helpers), per frontend/CLAUDE.md
// — presentational components are verified visually, not here. jest-expo gives the
// babel/TS transform; moduleNameMapper mirrors the tsconfig `@/` path alias.
//
// transformIgnorePatterns extends jest-expo's default allow-list to also transform
// Redux Toolkit + immer, which ship ESM that jest can't parse untransformed.
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@reduxjs/toolkit|immer|redux|reselect|redux-thunk))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
};
