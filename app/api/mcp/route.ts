import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyToken } from "../../../lib/auth";
import { registerTools } from "../../../lib/tools";

const handler = createMcpHandler(registerTools, {
  serverInfo: { name: "hubspot-mcp-demo", version: "1.0.0" },
});

const authHandler = withMcpAuth(handler, verifyToken, { required: true });

export { authHandler as GET, authHandler as POST };
