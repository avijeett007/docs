# Knotie AI Pro Documentation

Official documentation site for the **Knotie AI Pro** partner portal, built with [Mintlify](https://mintlify.com/).

This repo contains all user-facing guides, API references, use-case walkthroughs, and agent provider documentation for partners using the Knotie AI platform.

---

## Project structure

```
.
├── docs.json                 # Mintlify configuration (nav, theme, footer)
├── index.mdx                 # Landing page
├── quickstart.mdx            # Getting started guide
├── getting-started/          # Onboarding, pricing, video tutorials
├── account/                  # Sign-up, login, MFA, passkeys
├── customer-management/      # Portal modes, whitelabel, domains
├── partner-portal/           # Core partner features
│   ├── customers/            # Customer info, deals, billing
│   ├── settings/             # Whitelabel, Stripe, email, subscriptions
│   ├── vps/                  # VPS purchase, app catalog, instances
│   └── ...
├── agents/                   # Agent providers (Retell, VAPI, GHL, n8n, Knova, Hermes, etc.)
├── use-cases/                # End-to-end walkthroughs
├── api-reference/            # MCP API docs
└── images/                   # Screenshots and diagrams
```

---

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [Mintlify CLI](https://www.npmjs.com/package/mint)

### Install the CLI

```bash
npm i -g mint
```

### Local preview

Run the following command from the directory where `docs.json` lives:

```bash
mint dev
```

View your local preview at `http://localhost:3000`.

> **Note:** If the dev server fails to start, run `mint update` to ensure you have the latest CLI version.

---

## Publishing changes

1. Install the [Mintlify GitHub app](https://dashboard.mintlify.com/settings/organization/github-app) from your dashboard.
2. Push changes to the default branch.
3. Mintlify auto-deploys to production.

---

## Docs-as-Product workflow

We treat documentation as a living product. All pages are verified against the **live Knotie Partner Portal UI** using Playwright MCP snapshots before being merged.

### Journey-based verification

Major features are documented via **journeys** — end-to-end UI walkthroughs that capture:

- Exact navigation paths (sidebar menus, tabs, modals)
- Field names, labels, and placeholder text
- Buttons, badges, and status indicators
- Missing, broken, or deprecated features

Journey memory files live in `.claude/projects/.../memory/journeys/` and are referenced when refining docs.

### When to update docs

| Trigger | Action |
|---------|--------|
| New feature ships | Add page under relevant section; include screenshots |
| UI text changes | Update corresponding `.mdx`; note in changelog |
| Feature removed / 404s | Add `<Warning>` or deprecation notice; do not delete without PM approval |
| Navigation refactor | Update `docs.json` and all affected page cross-links |
| Agent provider added | Create `agents/<provider>/` folder; follow existing provider template |

### Content conventions

- **Navigation paths:** Use bold for menu items: `**Settings → Whitelabel**`
- **UI labels:** Quote exact button text: `"Send Invitation"`
- **Badges:** Document status badges (`Premium Feature`, `Beta`, `NEW`, `Coming Soon`) explicitly
- **Warnings:** Use `<Warning>` for irreversible actions or known UI traps
- **Screenshots:** Store in `/images/screenshots/`; reference with descriptive alt text
- **Code blocks:** Use `bash` for shell, `json` for API payloads, `mdx` for component examples

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `mint dev` fails | Run `mint update` |
| Page returns 404 locally | Ensure you are in a folder with a valid `docs.json` |
| Image not loading | Check path is relative to `docs/` root (e.g., `/images/screenshots/foo.png`) |
| Nav not updating | Verify `docs.json` syntax; restart `mint dev` |

---

## Resources

- [Mintlify documentation](https://mintlify.com/docs)
- [Knotie AI Pro](https://knotie-ai.pro)
- [Partner Portal](https://knotie-ai.pro/partners)
- Support: [support@knotie-ai.pro](mailto:support@knotie-ai.pro)

---

## License

See [LICENSE](./LICENSE).
