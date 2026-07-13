// Compute a child's age as years + months from date of birth and today.
// e.g. "2 yr 3 mo", "7 mo", "4 yr". Returns '' when no valid DOB.
export function formatAge(dob?: string | null): string {
  if (!dob) return '';
  const b = new Date(dob);
  if (isNaN(b.getTime())) return '';
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 0) months = 0;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y <= 0) return `${m} mo`;
  if (m === 0) return `${y} yr`;
  return `${y} yr ${m} mo`;
}
