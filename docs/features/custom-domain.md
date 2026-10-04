# BPB Builds custom domain

GitHub Pages for `bpbbuilds/bpbbuilds.github.io` is configured with
`bpbbuilds.com` as its custom domain. The Pages source remains the `main`
branch; no hosting migration or wildcard DNS is used.

## Cloudflare DNS records

In the `bpbbuilds.com` Cloudflare zone, add these records:

| Name | Type | Target | Proxy |
| --- | --- | --- | --- |
| `@` | A | `185.199.108.153` | DNS only |
| `@` | A | `185.199.109.153` | DNS only |
| `@` | A | `185.199.110.153` | DNS only |
| `@` | A | `185.199.111.153` | DNS only |
| `www` | CNAME | `bpbbuilds.github.io` | DNS only |
| `share` | A | `192.0.2.1` | Proxied |

The first five records are the GitHub Pages apex/`www` configuration. GitHub
will use `bpbbuilds.com` as canonical and redirect the `www` variant when both
DNS names are configured. The `share` record is only a proxied placeholder for
the deployed Cloudflare Worker route; it must not point to the FreeLLMAPI
tunnel. Do not add a wildcard and do not change `ai.bpbbuilds.com`.

After DNS is saved and visible publicly, verify with:

```powershell
Resolve-DnsName bpbbuilds.com -Type A -Server 1.1.1.1
Resolve-DnsName www.bpbbuilds.com -Type CNAME -Server 1.1.1.1
Resolve-DnsName share.bpbbuilds.com -Type A -Server 1.1.1.1
```

Then enable **Enforce HTTPS** in the repository's GitHub Pages settings. DNS
and certificate issuance can take time; do not treat an HTTP 404 during that
window as a Pages takeover or change the records to a wildcard.

## Other hostnames

`ai.bpbbuilds.com` is the existing named Cloudflare Tunnel for FreeLLMAPI and
is intentionally independent. The current Discord integration is a persistent
Discord Gateway bot (`npm run bot:watch`), so it does not receive inbound HTTP
interactions and does not need a `discord.bpbbuilds.com` Worker. Creating one
would create a second command/credential path; revisit only if the bot is
intentionally migrated to Discord HTTP Interactions.
