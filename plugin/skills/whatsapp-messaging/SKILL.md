---
name: whatsapp-messaging
description: Send WhatsApp text, images, PDFs, files, or fast bundles through KOSIF WhatsApp; check connection and delivery; and use account-linking tools exposed by the bridge.
---

# KOSIF WhatsApp

Use the MCP tools from `kosif-whatsapp`. This plugin is intended to work from ordinary ChatGPT chats as well as Work.

## Fast sending
When recipient and content are clear, send immediately with one appropriate send call. Do not preflight status unless the user explicitly asks for status or a send fails for a connection reason. Normalize the number. Supply a fresh idempotencyKey for each new send and reuse that exact key on retries. If the outcome is uncertain, check get_whatsapp_job before retrying. Report the returned message ID and actual state. Never claim delivered or read without a receipt.

## Authentication and account linking
Never expose, repeat, log, or store bridge secrets in plugin files or normal prose.
If the currently exposed MCP send tool still requires a `key`, use it only when it is securely available in the active tool context. If it is unavailable, do not invent one.
Use pair_whatsapp with method qr or code (phone is required for code). These tools still require a securely available bridge key; pairing WhatsApp does not replace bridge authentication. Never ask for secrets in normal chat. Return the actual QR/pairing result from the tool and never fabricate a code.

## Text
Use `send_whatsapp_message` for a text-only send. Preserve the user's message exactly unless they ask for editing.

## Files and bundles
Use `send_whatsapp_bundle` once when sending text plus one or more attachments. For saved CVs prefer `{"stored":"cv-ar"}` and `{"stored":"cv-en"}`. For a single attachment use `send_whatsapp_file`; prefer stored files, then HTTPS URL, then base64 when bytes are available. Include filename and MIME type when known.

## Multi-recipient pacing
Preserve a requested legitimate pacing interval. Queue/batch only when the MCP exposes the required dispatcher capability. Do not describe pacing as a way to bypass WhatsApp restrictions.

## Delivery
Use `get_whatsapp_job` when the user asks to verify a queued or idempotent send. A completed bridge job confirms sending only; it is not proof of delivered/read receipts.

## Connection
Use `get_whatsapp_status` when explicitly requested or after a connection-related failure. If linking tools are exposed and status indicates unlinked/disconnected, use the linking flow.

