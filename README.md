# HubSpot MCP demo

A remote [MCP](https://modelcontextprotocol.io) server that lets Claude look up contacts in HubSpot. It runs as a Next.js app, speaks Streamable HTTP at `/api/mcp`, and rejects any request that does not carry the right bearer token.

All data used in this demo is fictional.

## Setup

```bash
pnpm install
cp .env.example .env.local   # then fill in both values
pnpm dev
```

| Variable | Purpose |
| --- | --- |
| `MCP_AUTH_TOKEN` | Bearer token clients must send to `/api/mcp` |
| `HUBSPOT_TOKEN` | HubSpot service key (see below) |

## HubSpot credential

Create a [service key](https://developers.hubspot.com/blog/hubspot-service-keys-the-right-api-credential-for-data-integrations) in HubSpot (Settings > Integrations > Service Keys) and put it in `HUBSPOT_TOKEN`. Give it these scopes:

| Scope | Used for |
| --- | --- |
| `crm.objects.contacts.read` | searching and reading contacts |
| `crm.objects.deals.read` | listing deals |
| `crm.objects.contacts.write` | creating notes and tasks on contacts, and loading demo contacts |
| `crm.objects.deals.write` | loading demo deals (only the seed script needs it) |

Notes and tasks have no scope of their own in the scope picker. With the four scopes above, creating a note and a task on a contact worked against a real account. Which of them is strictly required for notes and tasks has not been tested one by one.

## Demo data

The demo uses a fictional agency, Lumen & Pine Studio: 20 contacts and 8 deals.

```bash
pnpm seed           # load the demo data into your HubSpot account
pnpm manual-check   # run a read against the real account (not part of the tests)
```

`pnpm seed` is safe to run again: it looks contacts up by email and deals by name, and only creates what is missing. HubSpot indexes new records with a short delay, so wait a few seconds before re-running it.

## Tools

| Tool | Kind | Description |
| --- | --- | --- |
| `search_contacts` | read-only | Search contacts by name, company or email |
| `get_contact` | read-only | Get one contact's details by id |
| `list_deals` | read-only | List deals with stage, amount and close date; open deals by default, filter by contact or stage |
| `create_note` | additive write | Add a note to a contact |
| `create_task` | additive write | Create a follow-up task with a due date (`YYYY-MM-DD`) for a contact |

The server has no tool that deletes or edits records. Writes only add new notes and tasks, and they check that the contact exists first.

## Tests

```bash
pnpm test
```

Tests call the MCP endpoint through the official MCP client, with HubSpot's API simulated. They need no internet and no HubSpot account.

## License

MIT
