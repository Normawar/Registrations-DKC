
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { SponsorProfile } from "@/hooks/use-sponsor-profile";
import { User, School, Building, Phone, Mail, BookUser, Star } from "lucide-react";

interface SponsorDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sponsor: SponsorProfile | null;
}

export function SponsorDetailsDialog({ isOpen, onClose, sponsor }: SponsorDetailsDialogProps) {
  if (!sponsor) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {sponsor.avatarType === 'upload' ? (
                <AvatarImage src={sponsor.avatarValue} alt={`${sponsor.firstName} ${sponsor.lastName}`} />
              ) : null}
              <AvatarFallback className="text-xl">
                {sponsor.firstName?.charAt(0)}{sponsor.lastName?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-2xl">{sponsor.firstName} {sponsor.lastName}</DialogTitle>
              <DialogDescription>{sponsor.role === 'district_coordinator' ? 'District Coordinator' : 'Sponsor'}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
                <School className="h-5 w-5 text-muted-foreground" />
                <div>
                    <p className="text-sm text-muted-foreground">School</p>
                    <p className="font-medium">{sponsor.school}</p>
                </div>
            </div>
             <div className="flex items-center gap-3">
                <Building className="h-5 w-5 text-muted-foreground" />
                <div>
                    <p className="text-sm text-muted-foreground">District</p>
                    <p className="font-medium">{sponsor.district}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <a href={`mailto:${sponsor.email}`} className="font-medium text-primary hover:underline">{sponsor.email}</a>
                </div>
            </div>
             <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{sponsor.phone || 'Not Provided'}</p>
                </div>
            </div>
            {sponsor.bookkeeperEmail && (
                <div className="flex items-center gap-3">
                    <BookUser className="h-5 w-5 text-muted-foreground" />
                    <div>
                        <p className="text-sm text-muted-foreground">Bookkeeper Email</p>
                         <a href={`mailto:${sponsor.bookkeeperEmail}`} className="font-medium text-primary hover:underline">{sponsor.bookkeeperEmail}</a>
                    </div>
                </div>
            )}
             {sponsor.gtCoordinatorEmail && (
                <div className="flex items-center gap-3">
                    <Star className="h-5 w-5 text-muted-foreground" />
                    <div>
                        <p className="text-sm text-muted-foreground">GT Coordinator Email</p>
                         <a href={`mailto:${sponsor.gtCoordinatorEmail}`} className="font-medium text-primary hover:underline">{sponsor.gtCoordinatorEmail}</a>
                    </div>
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
