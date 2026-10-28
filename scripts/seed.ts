import { hubspotFetch } from "../lib/hubspot.ts";
import { contacts, deals, emailOf } from "./agency-data.ts";

interface SearchResponse {
  results: { id: string }[];
}

const findId = async ({
  objectType,
  property,
  value,
}: {
  objectType: "contacts" | "deals";
  property: string;
  value: string;
}) => {
  const { results } = await hubspotFetch<SearchResponse>(
    `/crm/v3/objects/${objectType}/search`,
    {
      method: "POST",
      body: {
        filterGroups: [
          { filters: [{ propertyName: property, operator: "EQ", value }] },
        ],
        limit: 1,
      },
    },
  );
  return results[0]?.id;
};

const ensureContact = async (contact: (typeof contacts)[number]) => {
  const email = emailOf(contact);
  const existing = await findId({
    objectType: "contacts",
    property: "email",
    value: email,
  });
  if (existing) return { id: existing, created: false };
  const { id } = await hubspotFetch<{ id: string }>(
    "/crm/v3/objects/contacts",
    {
      method: "POST",
      body: {
        properties: {
          email,
          firstname: contact.firstName,
          lastname: contact.lastName,
          company: contact.company,
          jobtitle: contact.jobTitle,
          lifecyclestage: contact.stage,
        },
      },
    },
  );
  return { id, created: true };
};

const ensureDeal = async ({
  deal,
  contactId,
}: {
  deal: (typeof deals)[number];
  contactId: string;
}) => {
  const existing = await findId({
    objectType: "deals",
    property: "dealname",
    value: deal.name,
  });
  if (existing) return false;
  await hubspotFetch("/crm/v3/objects/deals", {
    method: "POST",
    body: {
      properties: {
        dealname: deal.name,
        amount: String(deal.amount),
        dealstage: deal.stage,
        pipeline: "default",
        closedate: deal.closeDate,
      },
      associations: [
        {
          to: { id: contactId },
          types: [
            { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 },
          ],
        },
      ],
    },
  });
  return true;
};

const contactIds = new Map<string, string>();
let createdContacts = 0;
for (const contact of contacts) {
  const { id, created } = await ensureContact(contact);
  contactIds.set(emailOf(contact), id);
  if (created) createdContacts += 1;
}

let createdDeals = 0;
for (const deal of deals) {
  const contactId = contactIds.get(deal.contactEmail);
  if (!contactId) throw new Error(`No contact for deal: ${deal.name}`);
  if (await ensureDeal({ deal, contactId })) createdDeals += 1;
}

console.log(
  `Contacts: ${createdContacts} created, ${contacts.length - createdContacts} already existed`,
);
console.log(
  `Deals: ${createdDeals} created, ${deals.length - createdDeals} already existed`,
);
