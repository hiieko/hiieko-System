# Signup Password Policy Consistency

Priority: Medium
Effort: Small
Session: 1
Estimated time: 25 minutes

## What is wrong

The audit identified a mismatch between the signup form and backend password policy. The frontend at `web/src/app/signup/page.tsx` accepts a minimum password length of 6, while `backend/src/modules/auth/password-policy.ts` specifies a minimum of 8. This can allow the form to accept a password that the backend rejects.

## Why it matters

Users may complete the signup form only to receive a backend validation error. Matching the frontend validation to the established backend policy makes the requirement clear before submission.

## Files involved

- `web/src/app/signup/page.tsx` — align client-side minimum-length validation and user-facing text with the existing backend policy.
- `backend/src/modules/auth/password-policy.ts` — reference the existing authoritative policy; change it only if a separate, verified requirement calls for it.
- Existing signup tests — VERIFY exact paths before editing.

## Steps

1. Verify the current rule and line numbers in `backend/src/modules/auth/password-policy.ts` and `web/src/app/signup/page.tsx`. Confirm the backend minimum is still 8 and locate every signup validation message.
2. Update the frontend validation and displayed guidance to match the existing backend minimum. Keep the backend policy unchanged unless a documented requirement says otherwise.
3. Check related signup form validation so the same rule is applied consistently without changing unrelated password requirements.
4. Add or update a test confirming that a password below the backend minimum is rejected by the frontend and that a password meeting the minimum passes this length check. Preserve other existing validation rules.
5. Run the relevant frontend tests and `npm run build --workspace=web`. If shared or backend tests are affected, run the relevant tests for those workspaces too.
6. Review the diff and stage only the verified changes: `git add <reviewed-files>` followed by `git commit -m "fix(auth): align signup password validation"`.
7. Confirm the intended branch and reviewed diff before pushing. If fixing `master`, use `git push origin master`.

## Acceptance criteria

- [ ] The backend password policy has been verified.
- [ ] Signup frontend validation matches the established backend minimum.
- [ ] User-facing validation text clearly states the correct requirement.
- [ ] Regression tests cover the mismatch.
- [ ] No unrelated files or authentication behavior are changed.
- [ ] Build passes.
- [ ] Commit pushed.

## Do NOT do

- Do not weaken or change the backend password policy just to match the frontend.
- Do not invent additional password-complexity requirements.
- Do not change login, password reset, or session behavior.
- Do not modify unrelated files or include unrelated existing work in the commit.

## Notes

The audit finding was a frontend minimum of 6 versus a backend minimum of 8. Verify both values against the current repository before editing.
