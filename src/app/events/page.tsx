
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';

import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
    PlusCircle, 
    MoreHorizontal, 
    FileText, 
    ImageIcon,
    CalendarIcon,
    Trash2,
    Edit
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';


type Event = {
    id: string;
    name: string;
    date: Date;
    location: string;
    registered: string;
    status: "Open" | "Upcoming" | "Closed" | "Completed";
    image?: File | null;
    pdf?: File | null;
};

const initialEvents: Event[] = [
  {
    id: '1',
    name: "Spring Open 2024",
    date: new Date("2024-06-15"),
    location: "City Convention Center",
    registered: "128/150",
    status: "Open",
  },
  {
    id: '2',
    name: "Summer Championship",
    date: new Date("2024-07-20"),
    location: "Grand Hotel Ballroom",
    registered: "95/100",
    status: "Open",
  },
  {
    id: '3',
    name: "Autumn Classic",
    date: new Date("2024-09-10"),
    location: "Community Chess Club",
    registered: "40/50",
    status: "Completed",
  },
  {
    id: '4',
    name: "Winter Scholastic",
    date: new Date("2024-12-05"),
    location: "North High School",
    registered: "0/80",
    status: "Upcoming",
  },
  {
    id: '5',
    name: "New Year Blitz",
    date: new Date("2025-01-01"),
    location: "Online",
    registered: "0/200",
    status: "Upcoming",
  },
];

const eventFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, { message: "Event name must be at least 3 characters." }),
  date: z.date({ required_error: "A date is required." }),
  location: z.string().min(3, { message: "Location is required." }),
  image: z.any().optional(),
  pdf: z.any().optional(),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

export default function EventsPage() {
    const { toast } = useToast();
    const [events, setEvents] = useState<Event[]>(initialEvents);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [eventToDelete, setEventToDelete] = useState<Event | null>(null);

    const form = useForm<EventFormValues>({
        resolver: zodResolver(eventFormSchema),
        defaultValues: {
            name: '',
            location: '',
        }
    });

    const handleAddEvent = () => {
        setEditingEvent(null);
        form.reset({ name: '', location: '', date: undefined, image: null, pdf: null });
        setIsDialogOpen(true);
    };

    const handleEditEvent = (event: Event) => {
        setEditingEvent(event);
        form.reset({
            id: event.id,
            name: event.name,
            date: event.date,
            location: event.location,
            image: event.image,
            pdf: event.pdf,
        });
        setIsDialogOpen(true);
    };

    const handleDeleteEvent = (event: Event) => {
        setEventToDelete(event);
        setIsAlertOpen(true);
    };
    
    const confirmDelete = () => {
        if (eventToDelete) {
            setEvents(events.filter(e => e.id !== eventToDelete.id));
            toast({ title: "Event Deleted", description: `"${eventToDelete.name}" has been removed.` });
        }
        setIsAlertOpen(false);
        setEventToDelete(null);
    };

    function onSubmit(values: EventFormValues) {
        const imageFile = values.image instanceof FileList ? values.image[0] : null;
        const pdfFile = values.pdf instanceof FileList ? values.pdf[0] : null;

        if (editingEvent) {
            setEvents(events.map(e => e.id === editingEvent.id ? { 
                ...e, 
                ...values,
                image: imageFile || e.image,
                pdf: pdfFile || e.pdf,
             } : e));
            toast({ title: "Event Updated", description: `"${values.name}" has been successfully updated.` });
        } else {
            const newEvent: Event = { 
                id: Date.now().toString(),
                ...values,
                registered: "0/100", // Default value
                status: new Date() > values.date ? "Completed" : "Upcoming",
                image: imageFile,
                pdf: pdfFile,
            };
            setEvents([newEvent, ...events]);
            toast({ title: "Event Added", description: `"${values.name}" has been successfully created.` });
        }
        setIsDialogOpen(false);
        setEditingEvent(null);
    }
    
    const getStatusBadge = (status: Event['status']) => {
      switch (status) {
        case 'Open': return 'bg-green-600';
        case 'Upcoming': return 'bg-blue-500';
        case 'Closed': return 'bg-yellow-500';
        case 'Completed': return 'bg-gray-500';
        default: return 'bg-muted-foreground';
      }
    };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline">Event Management</h1>
            <p className="text-muted-foreground">
              Add, edit, or delete your chess tournaments.
            </p>
          </div>
          <Button onClick={handleAddEvent}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Event
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Attachments</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.name}</TableCell>
                    <TableCell>{format(event.date, 'PPP')}</TableCell>
                    <TableCell>{event.location}</TableCell>
                    <TableCell>{event.registered}</TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                            {event.image && (
                                <a href={URL.createObjectURL(event.image)} target="_blank" rel="noopener noreferrer" title={event.image.name}><ImageIcon className="h-4 w-4 text-muted-foreground hover:text-primary" /></a>
                            )}
                            {event.pdf && (
                                <a href={URL.createObjectURL(event.pdf)} target="_blank" rel="noopener noreferrer" title={event.pdf.name}><FileText className="h-4 w-4 text-muted-foreground hover:text-primary" /></a>
                            )}
                            {(!event.image && !event.pdf) && <span className="text-xs text-muted-foreground">None</span>}
                        </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={"default"}
                        className={cn("text-white", getStatusBadge(event.status))}
                      >
                        {event.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => handleEditEvent(event)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Event
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href="/roster" className="flex items-center w-full">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Manage Roster
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => handleDeleteEvent(event)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Event
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit Event' : 'Add New Event'}</DialogTitle>
            <DialogDescription>
              {editingEvent ? 'Update the details for your event.' : 'Fill in the form to create a new event.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Name</FormLabel>
                  <FormControl><Input placeholder="e.g., Summer Championship" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Event Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date("1900-01-01")}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="location" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl><Input placeholder="e.g., Convention Center" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
              </div>
               <FormField control={form.control} name="image" render={({ field: { onChange, value, ...rest } }) => (
                <FormItem>
                  <FormLabel>Event Image (Optional)</FormLabel>
                  <FormControl>
                      <Input type="file" accept="image/*" onChange={(e) => onChange(e.target.files)} {...rest} />
                  </FormControl>
                  <FormDescription>Upload a flyer or promotional image for the event.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
               <FormField control={form.control} name="pdf" render={({ field: { onChange, value, ...rest } }) => (
                <FormItem>
                  <FormLabel>Event PDF (Optional)</FormLabel>
                  <FormControl>
                    <Input type="file" accept=".pdf" onChange={(e) => onChange(e.target.files)} {...rest} />
                  </FormControl>
                  <FormDescription>Upload a PDF with more details, rules, or pairings.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter className="pt-4">
                <DialogClose asChild>
                  <Button type="button" variant="ghost">Cancel</Button>
                </DialogClose>
                <Button type="submit">
                  {editingEvent ? 'Save Changes' : 'Create Event'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the event &quot;{eventToDelete?.name}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </AppLayout>
  );
}
