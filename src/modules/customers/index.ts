// Public surface of the customers module. Server-only: never import from a client component.
// Other modules depend on customers; customers depends on no business module.
export { CustomersTable, ForgotPassword, LoginPage, LogoutButton, RegisterPage } from "./ui/pages";
export { getCurrentCustomer, getCustomersByIds, saveLastAddress, type CurrentCustomer } from "./service";
export { addressSchema } from "./rules";
