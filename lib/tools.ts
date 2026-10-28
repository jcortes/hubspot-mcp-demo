import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  type Contact,
  createNote,
  createTask,
  DEAL_STAGES,
  type DealStage,
  getContact,
  HubspotError,
  listDeals,
  searchContacts,
} from "./hubspot";

const READ_ONLY = { readOnlyHint: true, openWorldHint: true };
const ADDITIVE_WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
};

const fullName = ({ firstName, lastName }: Contact) =>
  [firstName, lastName].filter(Boolean).join(" ") || "the contact";

const contactNotFound = (contactId: string) =>
  `No contact found with id ${contactId}.`;

const textResult = (text: string, isError = false) => ({
  content: [{ type: "text" as const, text }],
  ...(isError && { isError }),
});

const json = (value: unknown) => textResult(JSON.stringify(value, null, 2));

const run = async ({
  action,
  notFound,
}: {
  action: () => Promise<ReturnType<typeof textResult>>;
  notFound?: string;
}) => {
  try {
    return await action();
  } catch (error) {
    if (notFound && error instanceof HubspotError && error.status === 404) {
      return textResult(notFound, true);
    }
    const status = error instanceof HubspotError ? ` (status ${error.status})` : "";
    return textResult(
      `HubSpot could not be reached or returned an error${status}. Try again in a moment.`,
      true,
    );
  }
};

export const registerTools = (server: McpServer) => {
  server.registerTool(
    "search_contacts",
    {
      description:
        "Search HubSpot contacts by name, company or email. Returns up to 10 matches, each with the contact id.",
      inputSchema: z.object({
        query: z.string().min(1).describe("Name, company or email to look for"),
      }),
      annotations: READ_ONLY,
    },
    ({ query }) =>
      run({
        action: async () => {
          const contacts = await searchContacts({ query });
          return contacts.length
            ? json(contacts)
            : textResult(`No contacts matched "${query}".`);
        },
      }),
  );

  server.registerTool(
    "get_contact",
    {
      description:
        "Get the details of one HubSpot contact (name, email, company, job title, lifecycle stage) by contact id.",
      inputSchema: z.object({
        contactId: z.string().min(1).describe("HubSpot contact id, from search_contacts"),
      }),
      annotations: READ_ONLY,
    },
    ({ contactId }) =>
      run({
        action: async () => json(await getContact({ contactId })),
        notFound: contactNotFound(contactId),
      }),
  );

  server.registerTool(
    "list_deals",
    {
      description:
        "List HubSpot deals with name, amount, stage and close date. Without a stage, only open deals are listed; ask for closedwon or closedlost to see closed ones. Optionally filter by contact id.",
      inputSchema: z.object({
        contactId: z.string().min(1).optional().describe("Only deals associated with this contact id"),
        stage: z
          .enum(Object.keys(DEAL_STAGES) as [DealStage, ...DealStage[]])
          .optional()
          .describe("Only deals in this stage"),
      }),
      annotations: READ_ONLY,
    },
    ({ contactId, stage }) =>
      run({
        action: async () => {
          const deals = await listDeals({ contactId, stage });
          if (deals.length) return json(deals);
          return textResult(
            stage
              ? "No deals found."
              : "No deals found among open deals. Use stage closedwon or closedlost to see closed ones.",
          );
        },
      }),
  );

  server.registerTool(
    "create_note",
    {
      description:
        "Add a note to a HubSpot contact. Only adds; it never edits or deletes existing notes.",
      inputSchema: z.object({
        contactId: z.string().min(1).describe("HubSpot contact id, from search_contacts"),
        body: z.string().min(1).describe("Text of the note"),
      }),
      annotations: ADDITIVE_WRITE,
    },
    ({ contactId, body }) =>
      run({
        action: async () => {
          const contact = await getContact({ contactId });
          const { id } = await createNote({ contactId, body });
          return json({ created: "note", id, contact: fullName(contact) });
        },
        notFound: contactNotFound(contactId),
      }),
  );

  server.registerTool(
    "create_task",
    {
      description:
        "Create a follow-up task for a HubSpot contact with a due date. Only adds; it never edits or deletes existing tasks.",
      inputSchema: z.object({
        contactId: z.string().min(1).describe("HubSpot contact id, from search_contacts"),
        subject: z.string().min(1).describe("What needs to be done"),
        dueDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
          .describe("Due date as YYYY-MM-DD"),
      }),
      annotations: ADDITIVE_WRITE,
    },
    ({ contactId, subject, dueDate }) =>
      run({
        action: async () => {
          const contact = await getContact({ contactId });
          const { id } = await createTask({ contactId, subject, dueDate });
          return json({ created: "task", id, contact: fullName(contact), dueDate });
        },
        notFound: contactNotFound(contactId),
      }),
  );
};
