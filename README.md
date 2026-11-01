# spendee-importer

Turns bank and wallet exports, and screenshots of bank receipts, into categorized transactions and records them in [Wallet by Budget Bakers](https://budgetbakers.com/). It is built so an AI agent can run it: see [AGENTS.md](AGENTS.md).

## Supported sources

| Source | Description | Formats |
|--------|-------------|---------|
| `mercantil` | Mercantil Bank (Panama) | `.xlsx`, `.xls` |
| `banesco` | Banesco Panamá | `.xls`, `.xlsx` |
| `banescoVE` | Banesco Venezuela | `.xls`, `.xlsx` |
| `bancamiga` | Bancamiga Venezuela | `.xls`, `.xlsx`, `.html`, `.htm` |
| `binance` | Binance exchange | `.csv`, `.xlsx` |
| `payoneer` | Payoneer | `.csv`, `.xlsx` |
| `exodus` | Exodus wallet | `.csv`, `.xlsx` |
| `spendee` | Spendee export | `.csv`, `.xlsx`, `.xls` |

## Quick start

```bash
npm install
cp .env.example .env   # add WALLET_API_KEY
npm test
```

See what a file would do, without writing anything:

```bash
npm run import-to-wallet -- ~/Descargas/Estados_de_cuenta.xls
```

Upload it:

```bash
npm run import-to-wallet -- ~/Descargas/Estados_de_cuenta.xls --apply
```

The source is detected from the file's contents, and re-running a file doesn't create duplicates. Each source and currency needs its Wallet account id in `wallet-accounts.json` (gitignored; copy `wallet-accounts.example.json`).

## CLI

```
node scripts/import-to-wallet.js <file> [--source=<id>] [--apply] [--json]
  [--account=<id>] [--accept=<tag,...>] [--category=<name>] [--output=<xlsx>] [--<source option>=<value>]
```

- `--source`: skip detection.
- `--apply`: write to Wallet. Without it, nothing is written.
- `--json`: machine-readable report.
- `--account`: send every row to this account.
- `--accept`: create rows held as possible duplicates, by tag.
- `--category`: force every row to one category.
- `--output`: write a flat spreadsheet to `exports/` instead of using the API.
- Source options: `--exchangeRate`, `--startDate`, `--endDate`, `--wallet`.

## Agents

- **Files:** hand the agent a statement and it uploads it.
- **Screenshots:** a recurring run records Banesco Venezuela and Binance Pay receipts from a synced folder.
- **Questions:** Wallet's official MCP server, read-only.

Setup for any client, and for OpenClaw, is in [AGENTS.md](AGENTS.md). Skills are in [skills/](skills/).

## Legacy Spendee flow

The original `index.js` and `spendee-to-wallet.js` scripts still generate Spendee-format Excel files from bank exports for manual import into Spendee.

## Security

- `.env` is gitignored. Never commit API keys.
- Keep exports out of the repository: `data/`, `state/`, `tmp/` and `exports/` are gitignored.
