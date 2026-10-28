// Manual check against the real HubSpot account. Not part of `pnpm test`.
import {
  getContact,
  HubspotError,
  listDeals,
  searchContacts,
} from "../lib/hubspot.ts";

const query = process.argv[2] ?? "Rivera";

const show = async (label: string, action: () => Promise<unknown>) => {
  try {
    console.log(`${label}\n${JSON.stringify(await action(), null, 2)}\n`);
  } catch (error) {
    const status = error instanceof HubspotError ? error.status : "?";
    console.log(`${label}\nFAILED (status ${status})\n`);
  }
};

const [contact] = await searchContacts({ query });
await show(`search_contacts("${query}")`, async () => [contact]);

if (contact) {
  await show(`get_contact(${contact.id})`, () =>
    getContact({ contactId: contact.id }),
  );
  await show(`list_deals(contact ${contact.id}, open only)`, () =>
    listDeals({ contactId: contact.id }),
  );
  await show(`list_deals(contact ${contact.id}, closedwon)`, () =>
    listDeals({ contactId: contact.id, stage: "closedwon" }),
  );
}

await show("list_deals() all open deals", async () =>
  (await listDeals({})).map(({ name, stage }) => `${name} [${stage}]`),
);
await show("list_deals(closedwon)", async () =>
  (await listDeals({ stage: "closedwon" })).map(({ name }) => name),
);
await show("get_contact(missing id)", () =>
  getContact({ contactId: "999999999999" }),
);
