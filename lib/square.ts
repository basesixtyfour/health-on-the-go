import { SquareClient, SquareEnvironment } from "square";

const accessToken = process.env.SQUARE_ACCESS_TOKEN;

if (!accessToken) {
  // throw new Error("SQUARE_ACCESS_TOKEN is missing");
  console.warn("SQUARE_ACCESS_TOKEN is missing");
}

// Initialize the Square Client
export const squareClient = new SquareClient({
  token: accessToken || "mock_token",
  environment: process.env.NODE_ENV === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
});