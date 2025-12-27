import { SquareClient, SquareEnvironment } from "square";

const accessToken = process.env.SQUARE_ACCESS_TOKEN;

if (!accessToken) {
  console.error("SQUARE_ACCESS_TOKEN is missing - payments will fail!");
}

// Allow explicit control of Square environment via SQUARE_ENVIRONMENT env var
// Set SQUARE_ENVIRONMENT=sandbox to force sandbox mode even in production
const getSquareEnvironment = () => {
  const explicitEnv = process.env.SQUARE_ENVIRONMENT?.toLowerCase();
  if (explicitEnv === "sandbox") return SquareEnvironment.Sandbox;
  if (explicitEnv === "production") return SquareEnvironment.Production;
  // Default based on NODE_ENV
  return process.env.NODE_ENV === "production"
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox;
};

// Initialize the Square Client
export const squareClient = new SquareClient({
  token: accessToken || "",
  environment: getSquareEnvironment(),
});