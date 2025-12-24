import { SquareClient, SquareEnvironment } from "square";

const accessToken = process.env.SQUARE_ACCESS_TOKEN || "";

// Initialize the Square Client
export const squareClient = new SquareClient({
  token: accessToken,
  environment: SquareEnvironment.Sandbox, // Switch to Production for live apps
});