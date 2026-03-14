import "@testing-library/jest-dom/vitest";

// Set mock environment variables for tests
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.BETTER_AUTH_SECRET = "test-secret-for-testing-only-do-not-use-in-production";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.GOOGLE_MAPS_API_KEY = "test-google-maps-key";
