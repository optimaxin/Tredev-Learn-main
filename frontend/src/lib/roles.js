/** Each role's own portal — the destination after login and the "My Portal"
 * link. Only "learner" belongs on the learner dashboard. */
export function portalPath(role) {
  if (role === "acharya") return "/acharya";
  if (role === "academic_staff") return "/staff";
  if (role === "admin" || role === "super_admin") return "/admin";
  return "/learner";
}

/** Staff/admin get every course free by role — no enrollment, no payment. */
export const STAFF_ROLES = ["academic_staff", "admin", "super_admin"];
export const isStaffRole = (role) => STAFF_ROLES.includes(role);
