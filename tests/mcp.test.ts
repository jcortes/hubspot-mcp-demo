import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.MCP_AUTH_TOKEN = "test-token";
process.env.HUBSPOT_TOKEN = "hubspot-test-token";

const { GET, POST } = await import("../app/api/mcp/route");

const MCP_URL = "http://localhost/api/mcp";

const hubspotCalls: { url: string; init: RequestInit }[] = [];

type HubspotReply = { status?: number; body?: unknown };

const stubHubspot = (
  reply: HubspotReply | ((url: string, init: RequestInit) => HubspotReply),
) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      hubspotCalls.push({ url, init });
      const { status = 200, body = {} } =
        typeof reply === "function" ? reply(url, init) : reply;
      return new Response(JSON.stringify(body), { status });
    }),
  );

const sentBody = (call: { init: RequestInit }) =>
  JSON.parse(call.init.body as string);

const textOf = (result: { content?: unknown }) =>
  JSON.stringify(result.content);

const dispatch = async (url: string | URL, init?: RequestInit) => {
  const request = new Request(url, init);
  if (request.method === "GET") return GET(request);
  if (request.method === "POST") return POST(request);
  return new Response(null, { status: 405 });
};

const connect = async (token = "test-token") => {
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    fetch: dispatch,
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  return client;
};

const initializeRequest = (headers: Record<string, string> = {}) =>
  new Request(MCP_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "raw", version: "1.0.0" },
      },
    }),
  });

beforeEach(() => {
  hubspotCalls.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("authentication", () => {
  it("rejects a request without a token with 401", async () => {
    const response = await POST(initializeRequest());
    expect(response.status).toBe(401);
  });

  it("rejects a request with an invalid token with 401", async () => {
    const response = await POST(
      initializeRequest({ authorization: "Bearer wrong-token" }),
    );
    expect(response.status).toBe(401);
  });
});

describe("tool annotations", () => {
  it.each(["search_contacts", "get_contact", "list_deals"])(
    "%s is listed as a read-only tool",
    async (name) => {
      const client = await connect();
      const { tools } = await client.listTools();
      expect(tools.find((tool) => tool.name === name)?.annotations?.readOnlyHint).toBe(true);
      await client.close();
    },
  );
});

describe("search_contacts", () => {
  it("tells the client when nothing matched", async () => {
    stubHubspot({ body: { results: [] } });
    const client = await connect();
    const result = await client.callTool({
      name: "search_contacts",
      arguments: { query: "Nobody" },
    });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain("No contacts matched");
    await client.close();
  });

  it("reports a HubSpot failure as an error", async () => {
    stubHubspot({ status: 500 });
    const client = await connect();
    const result = await client.callTool({
      name: "search_contacts",
      arguments: { query: "Rivera" },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("HubSpot");
    await client.close();
  });

  it("returns the contacts HubSpot finds for the query", async () => {
    stubHubspot({
      body: {
      results: [
        {
          id: "101",
          properties: {
            firstname: "Ana",
            lastname: "Rivera",
            email: "ana@example.com",
            company: "Brightside Bakery",
            jobtitle: "Owner",
            lifecyclestage: "customer",
          },
        },
      ],
      },
    });
    const client = await connect();

    const result = await client.callTool({
      name: "search_contacts",
      arguments: { query: "Rivera" },
    });

    expect(JSON.stringify(result.content)).toContain("Ana");
    expect(JSON.stringify(result.content)).toContain("ana@example.com");
    expect(JSON.stringify(result.content)).toContain("Brightside Bakery");

    const [call] = hubspotCalls;
    expect(call.url).toBe(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
    );
    expect((call.init.headers as Record<string, string>).Authorization).toBe(
      "Bearer hubspot-test-token",
    );
    expect(sentBody(call).query).toBe("Rivera");
    await client.close();
  });
});

const hubspotContact = {
  id: "101",
  properties: {
    firstname: "Ana",
    lastname: "Rivera",
    email: "ana@example.com",
    company: "Brightside Bakery",
    jobtitle: "Owner",
    lifecyclestage: "customer",
  },
};

const hubspotDeal = (properties: Record<string, string>) => ({
  id: "901",
  properties: { dealname: "Website redesign", ...properties },
});

describe("get_contact", () => {
  it("returns the contact's details", async () => {
    stubHubspot({ body: hubspotContact });
    const client = await connect();

    const result = await client.callTool({
      name: "get_contact",
      arguments: { contactId: "101" },
    });

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain("Brightside Bakery");
    expect(textOf(result)).toContain("Owner");
    expect(hubspotCalls[0].url).toContain("/crm/v3/objects/contacts/101");
    await client.close();
  });

  it("says plainly that the contact does not exist", async () => {
    stubHubspot({ status: 404, body: { category: "OBJECT_NOT_FOUND" } });
    const client = await connect();

    const result = await client.callTool({
      name: "get_contact",
      arguments: { contactId: "999" },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("No contact found");
    expect(textOf(result)).toContain("999");
    await client.close();
  });

  it("reports a HubSpot failure differently from a missing contact", async () => {
    stubHubspot({ status: 503 });
    const client = await connect();

    const result = await client.callTool({
      name: "get_contact",
      arguments: { contactId: "101" },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("HubSpot");
    expect(textOf(result)).not.toContain("No contact found");
    await client.close();
  });
});

describe("list_deals", () => {
  const results = [
    hubspotDeal({ amount: "4800", dealstage: "contractsent", closedate: "2026-11-05" }),
  ];

  it("lists deals with a readable stage and the amount", async () => {
    stubHubspot({ body: { results } });
    const client = await connect();

    const result = await client.callTool({ name: "list_deals", arguments: {} });

    expect(textOf(result)).toContain("Website redesign");
    expect(textOf(result)).toContain("4800");
    expect(textOf(result)).toContain("Contract sent");
    await client.close();
  });

  it("leaves out closed deals unless a stage is asked for", async () => {
    stubHubspot({ body: { results } });
    const client = await connect();

    await client.callTool({ name: "list_deals", arguments: {} });

    const [{ filters }] = sentBody(hubspotCalls[0]).filterGroups;
    expect(filters).toEqual([
      {
        propertyName: "dealstage",
        operator: "NOT_IN",
        values: ["closedwon", "closedlost"],
      },
    ]);
    await client.close();
  });

  it("filters by stage", async () => {
    stubHubspot({ body: { results } });
    const client = await connect();

    await client.callTool({
      name: "list_deals",
      arguments: { stage: "closedwon" },
    });

    const [{ filters }] = sentBody(hubspotCalls[0]).filterGroups;
    expect(filters).toEqual([
      { propertyName: "dealstage", operator: "EQ", value: "closedwon" },
    ]);
    await client.close();
  });

  it("filters by contact", async () => {
    stubHubspot({ body: { results } });
    const client = await connect();

    await client.callTool({
      name: "list_deals",
      arguments: { contactId: "101" },
    });

    const [{ filters }] = sentBody(hubspotCalls[0]).filterGroups;
    expect(filters).toContainEqual({
      propertyName: "associations.contact",
      operator: "EQ",
      value: "101",
    });
    await client.close();
  });

  it("tells the client when there are no deals", async () => {
    stubHubspot({ body: { results: [] } });
    const client = await connect();

    const result = await client.callTool({ name: "list_deals", arguments: {} });

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain("No deals found");
    await client.close();
  });

  it("reports a HubSpot failure as an error", async () => {
    stubHubspot({ status: 500 });
    const client = await connect();

    const result = await client.callTool({ name: "list_deals", arguments: {} });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("HubSpot");
    await client.close();
  });
});

describe("write tools", () => {
  const contactReply = (url: string, init: RequestInit): HubspotReply => {
    if (url.endsWith("/notes")) return { status: 201, body: { id: "n-1" } };
    if (url.endsWith("/tasks")) return { status: 201, body: { id: "t-1" } };
    return init.method === "GET" || !init.method
      ? { body: hubspotContact }
      : { body: {} };
  };
  const postsTo = (suffix: string) =>
    hubspotCalls.filter(({ url, init }) => init.method === "POST" && url.endsWith(suffix));

  it("exposes exactly the five tools, none that deletes or edits", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map(({ name }) => name).sort()).toEqual([
      "create_note",
      "create_task",
      "get_contact",
      "list_deals",
      "search_contacts",
    ]);
    await client.close();
  });

  it.each(["create_note", "create_task"])(
    "%s is declared as an additive write",
    async (name) => {
      const client = await connect();
      const { tools } = await client.listTools();
      const { annotations } = tools.find((tool) => tool.name === name) ?? {};
      expect(annotations?.readOnlyHint).toBe(false);
      expect(annotations?.destructiveHint).toBe(false);
      await client.close();
    },
  );

  describe("create_note", () => {
    it("adds the note to the contact in HubSpot", async () => {
      stubHubspot(contactReply);
      const client = await connect();

      const result = await client.callTool({
        name: "create_note",
        arguments: { contactId: "101", body: "Asked for a quote on the new menu" },
      });

      expect(result.isError).toBeFalsy();
      expect(textOf(result)).toContain("Ana Rivera");
      const [call] = postsTo("/crm/v3/objects/notes");
      const { properties, associations } = sentBody(call);
      expect(properties.hs_note_body).toBe("Asked for a quote on the new menu");
      expect(Number.isNaN(Date.parse(properties.hs_timestamp))).toBe(false);
      expect(associations).toEqual([
        {
          to: { id: "101" },
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }],
        },
      ]);
      await client.close();
    });

    it("writes nothing when the contact does not exist", async () => {
      stubHubspot((url) =>
        url.includes("/contacts/") ? { status: 404 } : { status: 201, body: { id: "n-1" } },
      );
      const client = await connect();

      const result = await client.callTool({
        name: "create_note",
        arguments: { contactId: "999", body: "Hello" },
      });

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("No contact found");
      expect(postsTo("/crm/v3/objects/notes")).toHaveLength(0);
      await client.close();
    });

    it("reports a HubSpot failure as an error", async () => {
      stubHubspot((url, init) =>
        init.method === "POST" ? { status: 500 } : { body: hubspotContact },
      );
      const client = await connect();

      const result = await client.callTool({
        name: "create_note",
        arguments: { contactId: "101", body: "Hello" },
      });

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("HubSpot");
      expect(textOf(result)).not.toContain("No contact found");
      await client.close();
    });
  });

  describe("create_task", () => {
    it("creates a follow-up task with a due date for the contact", async () => {
      stubHubspot(contactReply);
      const client = await connect();

      const result = await client.callTool({
        name: "create_task",
        arguments: {
          contactId: "101",
          subject: "Send the menu quote",
          dueDate: "2026-11-10",
        },
      });

      expect(result.isError).toBeFalsy();
      expect(textOf(result)).toContain("Ana Rivera");
      expect(textOf(result)).toContain("2026-11-10");
      const [call] = postsTo("/crm/v3/objects/tasks");
      const { properties, associations } = sentBody(call);
      expect(properties.hs_task_subject).toBe("Send the menu quote");
      expect(properties.hs_task_status).toBe("NOT_STARTED");
      expect(properties.hs_timestamp.startsWith("2026-11-10")).toBe(true);
      expect(associations).toEqual([
        {
          to: { id: "101" },
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 204 }],
        },
      ]);
      await client.close();
    });

    it("rejects a due date that is not a calendar date", async () => {
      stubHubspot(contactReply);
      const client = await connect();

      const result = await client
        .callTool({
          name: "create_task",
          arguments: { contactId: "101", subject: "Call", dueDate: "next friday" },
        })
        .catch((error) => ({ isError: true, content: String(error) }));

      expect(result.isError).toBe(true);
      expect(postsTo("/crm/v3/objects/tasks")).toHaveLength(0);
      await client.close();
    });

    it("writes nothing when the contact does not exist", async () => {
      stubHubspot((url) =>
        url.includes("/contacts/") ? { status: 404 } : { status: 201, body: { id: "t-1" } },
      );
      const client = await connect();

      const result = await client.callTool({
        name: "create_task",
        arguments: { contactId: "999", subject: "Call", dueDate: "2026-11-10" },
      });

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("No contact found");
      expect(postsTo("/crm/v3/objects/tasks")).toHaveLength(0);
      await client.close();
    });

    it("reports a HubSpot failure as an error", async () => {
      stubHubspot((url, init) =>
        init.method === "POST" ? { status: 502 } : { body: hubspotContact },
      );
      const client = await connect();

      const result = await client.callTool({
        name: "create_task",
        arguments: { contactId: "101", subject: "Call", dueDate: "2026-11-10" },
      });

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("HubSpot");
      await client.close();
    });
  });
});

describe("HubSpot failure messages", () => {
  const failWith = async (status: number) => {
    stubHubspot({ status });
    const client = await connect();
    const result = await client.callTool({
      name: "search_contacts",
      arguments: { query: "Rivera" },
    });
    await client.close();
    return textOf(result);
  };

  it.each([401, 403])(
    "says the credentials were rejected on %i, without suggesting a retry",
    async (status) => {
      const text = await failWith(status);
      expect(text).toContain("credentials");
      expect(text).toContain(String(status));
      expect(text).not.toContain("Try again");
    },
  );

  it.each([429, 500, 503])(
    "suggests trying again on a temporary %i",
    async (status) => {
      const text = await failWith(status);
      expect(text).toContain("Try again");
      expect(text).not.toContain("credentials");
    },
  );
});
