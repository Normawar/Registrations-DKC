import { AppLayout } from "@/components/app-layout";
import { MembershipAssistant } from "@/components/membership-assistant";

export default function MembershipPage() {
  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">USCF Membership</h1>
          <p className="text-muted-foreground">
            Manage USCF memberships and get AI-powered suggestions.
          </p>
        </div>
        
        <MembershipAssistant />

      </div>
    </AppLayout>
  );
}
