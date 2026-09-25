import { signOut } from "next-auth/react";

// Log out and land on this site's login page. signOut's own redirect uses
// NEXTAUTH_URL (next-auth 4.24.15), which can be the other live host.
export async function signOutToLogin() {
  await signOut({ redirect: false });
  window.location.assign("/login");
}
