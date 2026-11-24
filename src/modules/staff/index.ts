// Public surface of the staff module. Server-only: never import from a client component.
// Every module with admin pages or staff actions depends on staff; staff depends on no business module.
export { ManagerOnly, StaffLoginPage, StaffMenu, StaffOnly, StaffTable } from "./ui/pages";
export {
  getCurrentStaff,
  getStaffNames,
  noteStaffAction,
  requireManager,
  requireStaff,
  type CurrentStaff,
} from "./service";
export { can, canSee } from "./rules";
