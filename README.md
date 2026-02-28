# Key Ceremony

Document your Bitcoin multisig wallet setup. Guide key holders through a structured ceremony, verify each signer can access their key, document recovery procedures, and generate a professional ceremony record PDF.

Free, open source, and self-hostable. No email or password required — secured with passkeys.

**Live instance:** [ceremony.dpinkerton.com](https://ceremony.dpinkerton.com)

## What it does

Bitcoin multisig wallets are hard to recover. Seed words in a safe aren't enough — without the output descriptor, derivation paths, quorum requirements, and knowledge of which device holds which key, a multisig wallet is unrecoverable. Key Ceremony solves this by guiding you through documenting everything needed to reconstruct your wallet.

### Ceremony flow

1. **Wallet descriptor** — Paste, scan, or upload your wallet output descriptor. The tool parses it and displays the multisig type, quorum (m-of-n), xpubs with fingerprints, and address type.

2. **Key holders** — For each key, record who holds it: name, role (Primary Holder, Trustee, Spouse, Backup, etc.), device type (Coldcard, SeedSigner, Ledger, Trezor, etc.), device storage location, and seed backup location. Multiple people can be assigned to a single key.

3. **Verification** — Optionally prove each key holder can sign by having them sign a challenge message. Supports QR codes (SeedSigner), file-based signing (Coldcard), paste, and remote signing via shareable links for distributed key holders.

4. **Recovery instructions** — Document how to reconstruct the wallet: recommended software, where the descriptor is stored, step-by-step emergency recovery procedure, and emergency contacts.

5. **Review & generate** — Review all sections and generate a ceremony record PDF with a verification grade (A+/A/F based on how many keys were verified).

### Encrypted vault

Save your wallet descriptor to the vault using WebAuthn PRF — a zero-knowledge encryption scheme where the encryption key is derived from your passkey and never leaves your browser. The server stores only ciphertext. Only you can decrypt it.

## Self-hosting

### Prerequisites

- Docker and Docker Compose
- A reverse proxy with TLS (e.g., Caddy, nginx, Traefik) — passkeys require HTTPS

### Quick start

```sh
git clone https://github.com/AusDavo/key-ceremony.git
cd key-ceremony
cp .env.example .env
```

Generate an encryption key and add it to `.env`:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Edit `.env` with your domain:

```
ENCRYPTION_KEY=<generated key>
RP_NAME=Key Ceremony
RP_ID=ceremony.yourdomain.com
RP_ORIGIN=https://ceremony.yourdomain.com
```

Build and run:

```sh
docker compose up -d
```

The app listens on port 3000. Point your reverse proxy at it.

#### Caddy example

```
ceremony.yourdomain.com {
    reverse_proxy key-ceremony:3000
}
```

If Caddy runs in Docker on the same network, use the container name. If Caddy runs on the host, use `localhost:3000` and add a port mapping to `docker-compose.yml`:

```yaml
ports:
  - "127.0.0.1:3000:3000"
```

### Docker networking

The default `docker-compose.yml` expects an external Docker network called `caddy_rev-proxy`. If your setup differs, adjust the `networks` section or add port mappings.

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ENCRYPTION_KEY` | Yes | 32-byte hex key for encrypting workflow data at rest |
| `RP_NAME` | No | WebAuthn relying party display name (default: "Key Ceremony") |
| `RP_ID` | Yes | Your domain (e.g., `ceremony.yourdomain.com`) |
| `RP_ORIGIN` | Yes | Full origin URL (e.g., `https://ceremony.yourdomain.com`) |
| `DB_PATH` | No | SQLite database path (default: `./data/key-ceremony.db`) |
| `BTCPAY_URL` | No | BTCPay Server URL for donation invoices |
| `BTCPAY_STORE_ID` | No | BTCPay store ID |
| `BTCPAY_API_KEY` | No | BTCPay API key |
| `BTCPAY_WEBHOOK_SECRET` | No | BTCPay webhook secret |

BTCPay variables are optional — if omitted, the donation button is hidden.

## Development

```sh
npm install
npm run dev
```

The dev server runs at `http://localhost:5173`. Set `RP_ID=localhost` and `RP_ORIGIN=http://localhost:5173` in `.env` for local development.

### Project structure

```
src/
  lib/
    server/
      auth.js              # WebAuthn registration/authentication
      bitcoin-utils.js     # Address derivation and signature validation
      db.js                # SQLite schema and prepared statements
      descriptor-parser.js # Wallet output descriptor parsing
      donation.js          # BTCPay Server integration
      electrs-client.js    # Signing challenge generation
      encryption.js        # AES-256-GCM encryption for workflow data
      purge.js             # Scheduled cleanup of abandoned accounts
      report-generator.js  # Ceremony PDF generation via Chromium
      workflow.js          # Workflow state machine
    components/
      PrfEncryption.svelte # WebAuthn PRF key derivation + AES-GCM
      SignatureInput.svelte # QR scanner + file upload for signatures
  routes/
    ceremony/
      descriptor/          # Step 1: Wallet descriptor input
      key-holders/         # Step 2: Key holder identification
      verification/        # Step 3: Challenge signing
      recovery/            # Step 4: Recovery instructions
      review/              # Step 5: Review and PDF generation
      dashboard/           # Post-completion: download, vault, donate
      download/            # PDF download endpoint
    sign/[token]/          # Remote signing page
    vault/                 # Encrypted descriptor vault
    settings/              # Passkey management and account deletion
    verify/                # Ceremony record hash verification
    api/
      vault/               # Vault CRUD endpoints
      donate/              # BTCPay donation redirect
      derive-address/      # Address derivation helper
templates/
  ceremony-template.html   # HTML template for ceremony PDF
```

### Key technical details

- **SvelteKit 2** with **Svelte 5** runes (`$state`, `$derived`, `$props`)
- **SQLite** (better-sqlite3) with WAL mode
- **WebAuthn** via @simplewebauthn for passwordless auth
- **WebAuthn PRF** extension for zero-knowledge vault encryption
- **Chromium headless** for PDF generation from HTML templates
- **BIP-137 / BIP-322** message signing verification
- Workflow state machine with high-water mark pattern (state never regresses)
- Server-side AES-256-GCM encryption for workflow data at rest

### Data lifecycle

- User registers with a passkey. A 90-day auto-purge timer is set for abandoned accounts.
- As the user progresses through the ceremony, workflow data is encrypted and stored in the database.
- On ceremony completion, the purge timer is cleared. The user's account and data persist until they choose to delete it.
- The vault stores PRF-encrypted descriptors separately. The server cannot decrypt vault contents.
- Users can delete their account from the Settings page, which permanently removes all data.

## Hardware wallet support

Tested with:

- **Coldcard** (Mk4, Q) — File-based signing via SD card
- **SeedSigner** — QR code scanning (requires message signing enabled in settings; multisig paths require [modified firmware](https://github.com/SeedSigner/seedsigner/pull/874))
- **Ledger** — BIP-137 message signing
- **Trezor** — BIP-137 message signing

Any wallet that supports BIP-137 or BIP-322 message signing should work.

## Related projects

- **[CertainKey](https://app.certainkey.dpinkerton.com)** — Audit-ready Bitcoin proof-of-reserves reports for SMSFs and institutions
- **[My Bitcoin Will](https://mybitcoinwill.com)** — Bitcoin inheritance planning (Dale Warburton, Q2 2026)

## License

MIT
