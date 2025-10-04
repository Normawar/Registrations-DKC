import { AppLayout } from "@/components/app-layout";
import { OrganizerGuard } from "@/app/auth-guard";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

export default function ForceDeleteUserPage() {
  return (
    <OrganizerGuard>
      <AppLayout>
        <div className="max-w-2xl mx-auto mt-8">
          <Alert>
            <AlertTitle>This tool has been moved</AlertTitle>
            <AlertDescription>
              The user deletion feature is now available on the{" "}
              <Link href="/users" className="font-bold underline">
                User Management
              </Link>{" "}
              page.
            </AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    </OrganizerGuard>
  );
}