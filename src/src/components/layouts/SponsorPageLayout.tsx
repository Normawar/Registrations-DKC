'use client';

import { Sidebar, SidebarBody, SidebarHeader } from '@/components/sidebar';
import { MainContent } from '@/components/main-content';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { SiteHeader } from '@/components/site-header';
import { ScrollArea } from '@/components/ui/scroll-area';
import { navLinks } from '@/config/nav-links';
import { SponsorNav } from '@/components/sponsor-nav';

export function SponsorPageLayout({ children, title }: { children: React.ReactNode, title: string }) {
  const { profile } = useSponsorProfile();

  if (!profile) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar>
        <SidebarHeader />
        <ScrollArea className="flex-1">
          <SidebarBody>
            <SponsorNav links={navLinks} />
          </SidebarBody>
        </ScrollArea>
      </Sidebar>

      <MainContent>
        <SiteHeader profile={profile} />
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-6">{title}</h1>
          {children}
        </div>
      </MainContent>
    </div>
  );
}
