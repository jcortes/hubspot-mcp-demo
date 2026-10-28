# HubSpot MCP demo

A remote [MCP](https://modelcontextprotocol.io) server that lets Claude work with your HubSpot CRM: look up contacts and deals, add notes, and create follow-up tasks. It runs as a Next.js app on Vercel, speaks Streamable HTTP at `/api/mcp`, and rejects any request that does not carry the right bearer token.

All data in this demo is fictional. The agency name, people, companies and email addresses are invented, and any resemblance to a real business is a coincidence.

## What you need

- Node 20 or later and [pnpm](https://pnpm.io)
- A HubSpot account (the free plan works)
- A [Vercel](https://vercel.com) account
- A Claude plan that supports custom connectors (the free plan allows one)

## Tools

| Tool | Kind | Description |
| --- | --- | --- |
| `search_contacts` | read-only | Search contacts by name, company or email |
| `get_contact` | read-only | Get one contact's details by id |
| `list_deals` | read-only | List deals with stage, amount and close date; open deals by default, filter by contact or stage |
| `create_note` | additive write | Add a note to a contact |
| `create_task` | additive write | Create a follow-up task with a due date (`YYYY-MM-DD`) for a contact |

The server has no tool that deletes or edits records. Writes only add new notes and tasks, and they check that the contact exists first. If HubSpot rejects the server's credentials, the tools say so plainly; for temporary failures they suggest trying again.

## 1. Run it locally

```bash
pnpm install
cp .env.example .env.local   # then fill in both values
pnpm dev
```

| Variable | Purpose |
| --- | --- |
| `MCP_AUTH_TOKEN` | The bearer token clients must send to `/api/mcp`. Generate one with `openssl rand -hex 32` |
| `HUBSPOT_TOKEN` | A HubSpot service key (next section) |

`MCP_AUTH_TOKEN` and `HUBSPOT_TOKEN` must be two different secrets. The first is what Claude shows to this server; the second is what this server shows to HubSpot. If they were the same, anyone holding the connector token would hold your HubSpot key.

## 2. HubSpot credential

Create a [service key](https://developers.hubspot.com/blog/hubspot-service-keys-the-right-api-credential-for-data-integrations) in HubSpot (Settings > Integrations > Service Keys) and put it in `HUBSPOT_TOKEN`.

For the deployed server, create a key with only these scopes:

| Scope | Used for |
| --- | --- |
| `crm.objects.contacts.read` | searching and reading contacts |
| `crm.objects.deals.read` | listing deals |
| `crm.objects.contacts.write` | creating notes and tasks on contacts |

Notes and tasks have no scope of their own in the scope picker. With these three scopes, all five tools worked against a real account. The key can still archive notes and tasks through HubSpot's API, so the server's protection is that it exposes no delete tool, not that the key cannot delete.

The seed script (next section) also needs `crm.objects.deals.write` and `crm.objects.contacts.write`. Use a separate key with those four scopes for local use, and keep the three-scope key for production.

## 3. Demo data

The demo uses a fictional agency, Lumen & Pine Studio: 20 contacts and 8 deals.

```bash
pnpm seed           # load the demo data into your HubSpot account
pnpm manual-check   # run reads against the real account (not part of the tests)
```

`pnpm seed` is safe to run again: it looks contacts up by email and deals by name, and only creates what is missing. HubSpot indexes new records with a short delay, so wait a few seconds before re-running it.

## 4. Deploy to Vercel

```bash
pnpm dlx vercel login
pnpm dlx vercel link --yes --project hubspot-mcp-demo
```

Add both secrets as sensitive production variables. These commands read the values from your shell; do not paste secrets into files you commit:

```bash
printf '%s' "$MCP_AUTH_TOKEN" | pnpm dlx vercel env add MCP_AUTH_TOKEN production --sensitive
printf '%s' "$HUBSPOT_TOKEN"  | pnpm dlx vercel env add HUBSPOT_TOKEN  production --sensitive
pnpm dlx vercel deploy --prod --yes
```

Check the deployment before connecting Claude. Without a token you should get `401`; with the token, `tools/list` should return the five tools:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://YOUR-APP.vercel.app/api/mcp \
  -H "content-type: application/json" -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

The server is stateless: each request stands alone, so it fits Vercel's serverless functions. Environment variable changes only apply to the next deployment, so redeploy after changing any of them.

## 5. Connect Claude

In Claude, go to **Customize > Connectors**, click **+ Add** and then **Add custom connector**.

1. Give it a name and enter `https://YOUR-APP.vercel.app/api/mcp` as the URL.
2. Under **Authentication**, choose **No sign in**. This server does not use OAuth, and Claude may detect "Sign in now" by default, so change it.
3. Under **Request headers**, add a header named `Authorization` with the value `Bearer <your MCP_AUTH_TOKEN>`.
4. Leave the transport as **Streamable HTTP**.
5. Click **Add**.

Claude shows the five tools, grouped as read-only and write. A sensible setup is to allow the three read-only tools and keep **Requires approval** on `create_note` and `create_task`. To use the connector, enable it in a conversation from the **+** button, then **Connectors**.

Header values are stored securely and never shown again. If you need to change one, delete the header and add it again.

Try: "What happened with Ana Rivera?", then "Leave a note on Ana Rivera: she asked for a quote on the menu page", then "Create a task for November 10: send Ana the quote".

## Rotating secrets

- **Connector token:** generate a new value, run `vercel env add MCP_AUTH_TOKEN production --force --sensitive`, redeploy, then replace the `Authorization` header in the Claude connector. The old token stops working with the new deployment.
- **HubSpot key:** create a new service key (or use Rotate in HubSpot), update `HUBSPOT_TOKEN` the same way, and redeploy.

## What this demo does not include

This demo uses one shared bearer token: everyone who uses the connector shares the same credential. A production setup for a team would use OAuth, so each person signs in and access can be revoked per user. That is not implemented here; it is the natural upgrade for a larger engagement.

## Tests

```bash
pnpm test
pnpm typecheck
```

Tests call the MCP endpoint through the official MCP client, with HubSpot's API simulated at the network boundary. They need no internet and no HubSpot account. `pnpm manual-check` is the separate check against a real account.

## License

MIT
