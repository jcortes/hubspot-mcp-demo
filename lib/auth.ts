import { timingSafeEqual } from "node:crypto";
import type { AuthInfo } from "@modelcontextprotocol/server";

const matches = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

export const verifyToken = async (
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> => {
  const expected = process.env.MCP_AUTH_TOKEN;
  if (!expected || !bearerToken || !matches(bearerToken, expected)) {
    return undefined;
  }
  return { token: bearerToken, clientId: "mcp-client", scopes: [] };
};
