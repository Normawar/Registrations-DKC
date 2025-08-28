

'use client';

import UsersPage from './users/page';

// This component now directly renders the User Management page to ensure
// the user lands on the correct page, bypassing previous redirection issues.
export default function Page() {
  return <UsersPage />;
}
