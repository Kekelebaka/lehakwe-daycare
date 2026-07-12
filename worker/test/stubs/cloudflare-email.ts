// Test stub for the Workers-runtime-only `cloudflare:email` module.
// Only used by Vitest (Node) so importing the worker doesn't fail to resolve it.
// Production uses the real module provided by the Workers runtime via Wrangler.
export class EmailMessage {
  constructor(_from: string, _to: string, _raw: string | ReadableStream) {}
}
