import { redirect } from 'next/navigation';

/**
 * Deprecated route. `/qa` is the canonical QA/QC page (D5 — resolve duplication).
 * The old `/qa-qc` URL is kept alive as a permanent-in-spirit redirect.
 */
export default function QaQcRedirectPage() {
  redirect('/qa');
}
