---
name: GPT-5 completion constraints
description: Compatibility requirements for GPT-5 chat-completion calls through the configured OpenAI-compatible integration.
---

For GPT-5 chat-completion requests, do not send a non-default `temperature` value. When using JSON-object response mode, the prompt must explicitly mention JSON.

**Why:** The configured endpoint rejects `temperature: 0.7` for GPT-5 and rejects JSON-object mode when the request does not state that JSON is expected, even though earlier model calls accepted the former pattern.

**How to apply:** Leave temperature unset on GPT-5 calls unless the provider explicitly documents a supported alternative. Keep an explicit JSON output instruction in any prompt that requests JSON-object responses.