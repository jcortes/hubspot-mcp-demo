const BASE_URL = "https://api.hubapi.com";

const CONTACT_PROPERTIES = [
  "firstname",
  "lastname",
  "email",
  "company",
  "jobtitle",
  "lifecyclestage",
];

const DEAL_PROPERTIES = ["dealname", "amount", "dealstage", "closedate"];

export const DEAL_STAGES = {
  appointmentscheduled: "Appointment scheduled",
  qualifiedtobuy: "Qualified to buy",
  presentationscheduled: "Presentation scheduled",
  decisionmakerboughtin: "Decision maker bought-in",
  contractsent: "Contract sent",
  closedwon: "Closed won",
  closedlost: "Closed lost",
} as const;

export type DealStage = keyof typeof DEAL_STAGES;

const CLOSED_STAGES: DealStage[] = ["closedwon", "closedlost"];

export class HubspotError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`HubSpot request failed with status ${status}`);
    this.status = status;
  }
}

export interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  jobTitle?: string;
  stage?: string;
}

export interface Deal {
  id: string;
  name?: string;
  amount?: number;
  stage?: string;
  closeDate?: string;
}

interface HubspotObject {
  id: string;
  properties: Record<string, string | null | undefined>;
}

export async function hubspotFetch<T>(
  path: string,
  { method = "GET", body }: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.HUBSPOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new HubspotError(response.status);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const toContact = ({ id, properties: p }: HubspotObject): Contact => ({
  id,
  firstName: p.firstname ?? undefined,
  lastName: p.lastname ?? undefined,
  email: p.email ?? undefined,
  company: p.company ?? undefined,
  jobTitle: p.jobtitle ?? undefined,
  stage: p.lifecyclestage ?? undefined,
});

const toDeal = ({ id, properties: p }: HubspotObject): Deal => ({
  id,
  name: p.dealname ?? undefined,
  amount: p.amount ? Number(p.amount) : undefined,
  stage: p.dealstage
    ? (DEAL_STAGES[p.dealstage as DealStage] ?? p.dealstage)
    : undefined,
  closeDate: p.closedate ? p.closedate.slice(0, 10) : undefined,
});

export async function searchContacts({
  query,
}: {
  query: string;
}): Promise<Contact[]> {
  const { results } = await hubspotFetch<{ results: HubspotObject[] }>(
    "/crm/v3/objects/contacts/search",
    {
      method: "POST",
      body: { query, limit: 10, properties: CONTACT_PROPERTIES },
    },
  );
  return results.map(toContact);
}

export async function getContact({
  contactId,
}: {
  contactId: string;
}): Promise<Contact> {
  const properties = CONTACT_PROPERTIES.join(",");
  const contact = await hubspotFetch<HubspotObject>(
    `/crm/v3/objects/contacts/${encodeURIComponent(contactId)}?properties=${properties}`,
  );
  return toContact(contact);
}

export async function listDeals({
  contactId,
  stage,
}: {
  contactId?: string;
  stage?: DealStage;
}): Promise<Deal[]> {
  const filters = [
    ...(contactId
      ? [{ propertyName: "associations.contact", operator: "EQ", value: contactId }]
      : []),
    stage
      ? { propertyName: "dealstage", operator: "EQ", value: stage }
      : { propertyName: "dealstage", operator: "NOT_IN", values: CLOSED_STAGES },
  ];
  const { results } = await hubspotFetch<{ results: HubspotObject[] }>(
    "/crm/v3/objects/deals/search",
    {
      method: "POST",
      body: {
        filterGroups: [{ filters }],
        sorts: [{ propertyName: "closedate", direction: "ASCENDING" }],
        limit: 20,
        properties: DEAL_PROPERTIES,
      },
    },
  );
  return results.map(toDeal);
}

const NOTE_TO_CONTACT = 202;
const TASK_TO_CONTACT = 204;

const associateWith = ({
  contactId,
  typeId,
}: {
  contactId: string;
  typeId: number;
}) => [
  {
    to: { id: contactId },
    types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: typeId }],
  },
];

export async function createNote({
  contactId,
  body,
}: {
  contactId: string;
  body: string;
}): Promise<{ id: string }> {
  const { id } = await hubspotFetch<{ id: string }>("/crm/v3/objects/notes", {
    method: "POST",
    body: {
      properties: {
        hs_timestamp: new Date().toISOString(),
        hs_note_body: body,
      },
      associations: associateWith({ contactId, typeId: NOTE_TO_CONTACT }),
    },
  });
  return { id };
}

export async function createTask({
  contactId,
  subject,
  dueDate,
}: {
  contactId: string;
  subject: string;
  dueDate: string;
}): Promise<{ id: string }> {
  const { id } = await hubspotFetch<{ id: string }>("/crm/v3/objects/tasks", {
    method: "POST",
    body: {
      properties: {
        hs_timestamp: `${dueDate}T09:00:00.000Z`,
        hs_task_subject: subject,
        hs_task_status: "NOT_STARTED",
      },
      associations: associateWith({ contactId, typeId: TASK_TO_CONTACT }),
    },
  });
  return { id };
}
