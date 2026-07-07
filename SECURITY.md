# Security

## Reporting

Email security issues to `support@alwakeelo.com and alwakeeloneon@gmail.com`. Do not open public issues for vulnerabilities.

## Known accepted vulnerabilities

`npm audit` reports 4 critical and 1 high vulnerabilities in the `@xenova/transformers` dependency chain:

- `protobufjs` — arbitrary code execution (GHSA-xq3m-2v4x-88gg)
- `onnx-proto` — depends on vulnerable `protobufjs`
- `onnxruntime-web` — depends on vulnerable `onnx-proto`
- `@xenova/transformers` — depends on vulnerable `onnxruntime-web`

### Why we accept them

`@xenova/transformers` is loaded **only** when the env var `RAG_EMBEDDING_PROVIDER=semantic`. See [`server/rag/embedding-local.ts`](server/rag/embedding-local.ts#L4-L7).

Production (`render.yaml:48`) sets `RAG_EMBEDDING_PROVIDER=hashing`, so the vulnerable code is never imported and the CVEs are unreachable in deployed environments.

The available upstream fix (`npm audit fix --force`) downgrades `@xenova/transformers` to `2.0.1`, which would regress tokenizer correctness and model compatibility — worse than the disease for our deployment.

### When to revisit

When `@xenova/transformers` upstream releases a version pinned to `onnxruntime-web` ≥ 1.17 (which carries a patched `protobufjs`), bump and re-run `npm audit`.

## Operational safeguards

- Production must keep `RAG_EMBEDDING_PROVIDER=hashing`. Do not set `semantic` in any deployed environment.
- Local development with `semantic` is acceptable since RAG input is internal-only.
