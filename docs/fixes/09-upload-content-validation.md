# Upload Content Validation

Priority: High
Effort: Medium
Session: 1
Estimated time: 60 minutes

## What is wrong

The audit found that `backend/src/modules/upload/upload.service.ts` checks an allowed MIME type and file size, but no file-signature or magic-byte validation was identified in the reviewed code. Verify the current upload implementation and supported file types before treating this as a confirmed vulnerability.

## Why it matters

Client-provided MIME types can be misleading and should not be the only evidence that a file matches its claimed format. Validating file content where appropriate can reduce the risk of accepting unexpected or disguised file types.

## Files involved

- `backend/src/modules/upload/upload.service.ts` — verify existing MIME allowlist, size limits, and content validation.
- `backend/src/modules/upload/upload.controller.ts` — verify upload request handling and existing validation.
- Existing upload tests — VERIFY exact paths before editing.
- Existing attachment and storage integration — VERIFY exact paths and behavior before changing how uploaded files are handled.

## Steps

1. Inspect the current upload service and controller. Record actual line numbers and establish which formats, size limits, and upload paths are supported.
2. Verify whether file-signature validation is absent, already implemented elsewhere, or intentionally inapplicable to any supported format. Identify any special handling for formats that do not have a reliable fixed signature.
3. If a gap is confirmed, add the smallest content-validation correction consistent with the existing allowlist and upload contract. Preserve existing API responses and storage behavior unless a verified requirement requires a change.
4. Add regression tests for a valid supported file, a mismatched or forged content type, an unsupported format, and an oversized file where those cases apply. Ensure rejected uploads do not get persisted.
5. Run relevant backend tests and `npm run build --workspace=backend`.
6. Review the diff and stage only the verified changes and tests: `git add <reviewed-files>` followed by `git commit -m "fix(upload): validate uploaded file content"`.
7. Confirm the intended branch and reviewed diff before pushing. If fixing `master`, use `git push origin master`.

## Acceptance criteria

- [ ] Existing upload allowlist and size limits have been verified.
- [ ] The need for content-signature validation has been assessed for each supported file type.
- [ ] Confirmed gaps are corrected without changing unrelated upload behavior.
- [ ] Regression tests cover valid files and relevant invalid upload cases.
- [ ] Rejected files are not persisted.
- [ ] Build passes.
- [ ] Commit pushed.

## Do NOT do

- Do not assume every file format supports the same signature-validation method.
- Do not invent new allowed file types, upload endpoints, or storage behavior.
- Do not remove existing size or MIME checks.
- Do not log or expose uploaded sensitive content.
- Do not modify unrelated files or include unrelated existing work in the commit.

## Notes

The audit did not identify magic-byte validation in the reviewed upload paths. Verify the current implementation and any shared validation utilities before adding a new mechanism.
