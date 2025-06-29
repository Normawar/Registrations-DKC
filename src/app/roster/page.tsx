
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, isValid, parse } from 'date-fns';

import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { 
  PlusCircle, 
  MoreHorizontal,
  CalendarIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
} from "@/components/ui/alert-dialog"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Player = {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  uscfId: string;
  uscfExpiration?: Date;
  rating?: number;
  grade: string;
  section: string;
  email: string;
  phone?: string;
  dob: Date;
  zipCode: string;
};

const initialPlayers: Player[] = [
  { id: "1", firstName: "Alex", middleName: "Michael", lastName: "Ray", uscfId: "12345678", rating: 1850, uscfExpiration: new Date(), grade: "10th Grade", section: 'High School K-12', email: 'alex.ray@example.com', dob: new Date('2008-05-10'), zipCode: '78501'},
  { id: "2", firstName: "Jordan", lastName: "Lee", uscfId: "87654321", rating: 2100, uscfExpiration: new Date(), grade: "11th Grade", section: 'Championship', email: 'jordan.lee@example.com', dob: new Date('2007-09-15'), zipCode: '78504'},
];

const grades = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'];
const sections = ['Kinder-1st', 'Primary K-3', 'Elementary K-5', 'Middle School K-8', 'High School K-12', 'Championship'];

const playerFormSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1, { message: "First Name is required." }),
  middleName: z.string().optional(),
  lastName: z.string().min(1, { message: "Last Name is required." }),
  uscfId: z.string().min(1, { message: "USCF ID is required." }),
  uscfExpiration: z.date().optional(),
  rating: z.coerce.number().optional(),
  grade: z.string().min(1, { message: "Please select a grade." }),
  section: z.string().min(1, { message: "Please select a section." }),
  email: z.string().email({ message: "Please enter a valid email." }),
  phone: z.string().optional(),
  dob: z.date({ required_error: "Date of birth is required."}),
  zipCode: z.string().min(5, { message: "Please enter a valid 5-digit zip code." }),
})
.refine(data => {
  if (data.uscfId.toUpperCase() !== 'NEW') {
    return data.uscfExpiration !== undefined;
  }
  return true;
}, {
  message: "USCF Expiration is required unless ID is NEW.",
  path: ["uscfExpiration"],
})
.refine(data => {
  if (data.uscfId.toUpperCase() !== 'NEW') {
    return data.rating !== undefined && data.rating !== null && !isNaN(data.rating);
  }
  return true;
}, {
  message: "Rating is required unless USCF ID is NEW.",
  path: ["rating"],
});

type PlayerFormValues = z.infer<typeof playerFormSchema>;

export default function RosterPage() {
  const { toast } = useToast();
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<Player | null>(null);

  const form = useForm<PlayerFormValues>({
    resolver: zodResolver(playerFormSchema),
    defaultValues: {
      firstName: '',
      middleName: '',
      lastName: '',
      uscfId: '',
      rating: undefined,
      grade: '',
      section: '',
      email: '',
      phone: '',
      zipCode: '',
    }
  });

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const lastNameComparison = a.lastName.localeCompare(b.lastName);
      if (lastNameComparison !== 0) {
        return lastNameComparison;
      }
      return a.firstName.localeCompare(b.firstName);
    });
  }, [players]);

  const watchUscfId = form.watch('uscfId');
  const isUscfNew = watchUscfId.toUpperCase() === 'NEW';

  useEffect(() => {
    if (isDialogOpen) {
      if (editingPlayer) {
        form.reset(editingPlayer);
      } else {
        form.reset({
          firstName: '',
          middleName: '',
          lastName: '',
          uscfId: '',
          rating: undefined,
          uscfExpiration: undefined,
          dob: undefined,
          grade: '',
          section: '',
          email: '',
          phone: '',
          zipCode: '',
        });
      }
    }
  }, [isDialogOpen, editingPlayer, form]);

  const handleAddPlayer = () => {
    setEditingPlayer(null);
    setIsDialogOpen(true);
  };

  const handleEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setIsDialogOpen(true);
  };
  
  const handleDeletePlayer = (player: Player) => {
    setPlayerToDelete(player);
    setIsAlertOpen(true);
  };
  
  const confirmDelete = () => {
    if (playerToDelete) {
      setPlayers(players.filter(p => p.id !== playerToDelete.id));
      toast({ title: "Player removed", description: `${playerToDelete.firstName} ${playerToDelete.lastName} has been removed from the roster.` });
    }
    setIsAlertOpen(false);
    setPlayerToDelete(null);
  };

  function onSubmit(values: PlayerFormValues) {
    // Check for duplicate USCF ID
    if (values.uscfId.toUpperCase() !== 'NEW') {
      const existingPlayerWithUscfId = players.find(p => 
        p.uscfId.toLowerCase() === values.uscfId.toLowerCase() && p.id !== values.id
      );

      if (existingPlayerWithUscfId) {
        form.setError("uscfId", { 
          type: "manual", 
          message: `USCF ID already assigned to ${existingPlayerWithUscfId.firstName} ${existingPlayerWithUscfId.lastName}.` 
        });
        return;
      }
    }

    // Check for duplicate player by name and DOB
    const isDuplicatePlayer = players.some(p => 
      p.id !== values.id &&
      p.firstName.trim().toLowerCase() === values.firstName.trim().toLowerCase() &&
      p.lastName.trim().toLowerCase() === values.lastName.trim().toLowerCase() &&
      p.dob.getTime() === values.dob.getTime()
    );

    if (isDuplicatePlayer) {
      form.setError("firstName", { type: "manual", message: "A player with this name and date of birth already exists." });
      return;
    }
    
    const isEmailUnique = !players.some(p => p.email.toLowerCase() === values.email.toLowerCase() && p.id !== values.id);

    if (!isEmailUnique) {
      const existingPlayer = players.find(p => p.email.toLowerCase() === values.email.toLowerCase());
      form.setError("email", { type: "manual", message: `Email already used by ${existingPlayer?.firstName} ${existingPlayer?.lastName}.` });
      return;
    }

    if (editingPlayer) {
      // Update existing player
      setPlayers(players.map(p => p.id === editingPlayer.id ? { ...p, ...values } : p));
      toast({ title: "Player Updated", description: `${values.firstName} ${values.lastName}'s information has been updated.`});
    } else {
      // Add new player
      const newPlayer: Player = { ...values, id: Date.now().toString() };
      setPlayers([...players, newPlayer]);
      toast({ title: "Player Added", description: `${values.firstName} ${values.lastName} has been added to the roster.`});
    }
    setIsDialogOpen(false);
    setEditingPlayer(null);
  }


  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline">Roster</h1>
            <p className="text-muted-foreground">
              Manage your sponsored player roster.
            </p>
          </div>
          <Button onClick={handleAddPlayer}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Player to Roster
          </Button>
        </div>

        <Card className="bg-secondary/50 border-dashed">
            <CardHeader>
                <CardTitle className="text-lg">Sponsor Information</CardTitle>
                <CardDescription>This district and school will be associated with all players added to this roster.</CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
                <div>
                    <p className="text-sm font-medium text-muted-foreground">District</p>
                    <p className="font-semibold">SHARYLAND ISD</p>
                </div>
                 <div>
                    <p className="text-sm font-medium text-muted-foreground">School</p>
                    <p className="font-semibold">SHARYLAND PIONEER H S</p>
                </div>
            </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>USCF ID</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Section</TableHead>
                   <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPlayers.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={`https://placehold.co/40x40.png`} alt={`${player.firstName} ${player.lastName}`} />
                          <AvatarFallback>{player.firstName.charAt(0)}{player.lastName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          {`${player.lastName}, ${player.firstName} ${player.middleName || ''}`.trim()}
                           <div className="text-sm text-muted-foreground">{player.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{player.uscfId}</TableCell>
                    <TableCell>{player.rating || 'N/A'}</TableCell>
                    <TableCell>{player.grade}</TableCell>
                    <TableCell>{player.section}</TableCell>
                     <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEditPlayer(player)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeletePlayer(player)} className="text-destructive">
                            Delete
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
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlayer ? 'Edit Player' : 'Add New Player'}</DialogTitle>
            <DialogDescription>
              {editingPlayer ? 'Update the player details below.' : 'Fill in the form to add a new player to your roster.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl><Input placeholder="John" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                 <FormField control={form.control} name="middleName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Middle Name (Optional)</FormLabel>
                    <FormControl><Input placeholder="Michael" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl><Input placeholder="Doe" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="uscfId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>USCF ID</FormLabel>
                    <FormControl><Input placeholder="12345678 or NEW" {...field} /></FormControl>
                    <FormDescription>
                      Students without a USCF ID can be added with &quot;NEW&quot;. 
                      <Link href="https://new.uschess.org/civicrm/player-search" target="_blank" className="ml-1 text-primary underline">
                        Find USCF Number
                      </Link>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="rating" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rating</FormLabel>
                    <FormControl><Input type="number" placeholder="1500" {...field} value={field.value ?? ''} disabled={isUscfNew} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField
                  control={form.control}
                  name="dob"
                  render={({ field }) => {
                    const [inputValue, setInputValue] = useState<string>(
                      field.value ? format(field.value, "MM/dd/yyyy") : ""
                    );
                    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

                    useEffect(() => {
                      if (field.value) {
                        setInputValue(format(field.value, "MM/dd/yyyy"));
                      } else {
                        setInputValue("");
                      }
                    }, [field.value]);

                    const handleBlur = () => {
                      const parsedDate = parse(inputValue, "MM/dd/yyyy", new Date());
                      if (isValid(parsedDate)) {
                        if (parsedDate <= new Date() && parsedDate >= new Date("1900-01-01")) {
                          field.onChange(parsedDate);
                        } else {
                          setInputValue(field.value ? format(field.value, "MM/dd/yyyy") : "");
                        }
                      } else {
                        if (inputValue === "") {
                          field.onChange(undefined);
                        } else {
                          setInputValue(field.value ? format(field.value, "MM/dd/yyyy") : "");
                        }
                      }
                    };

                    return (
                      <FormItem className="flex flex-col">
                        <FormLabel>Date of Birth</FormLabel>
                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                          <div className="relative">
                            <FormControl>
                              <Input
                                placeholder="MM/DD/YYYY"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onBlur={handleBlur}
                              />
                            </FormControl>
                            <PopoverTrigger asChild>
                              <Button
                                variant={"ghost"}
                                className="absolute right-0 top-0 h-full w-10 p-0 font-normal"
                                aria-label="Open calendar"
                              >
                                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </PopoverTrigger>
                          </div>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => {
                                field.onChange(date);
                                setIsCalendarOpen(false);
                              }}
                              disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                 <FormField
                  control={form.control}
                  name="uscfExpiration"
                  render={({ field }) => {
                    const [inputValue, setInputValue] = useState<string>(
                      field.value ? format(field.value, "MM/dd/yyyy") : ""
                    );
                    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

                    useEffect(() => {
                      if (field.value) {
                        setInputValue(format(field.value, "MM/dd/yyyy"));
                      } else {
                        setInputValue("");
                      }
                    }, [field.value]);

                    const handleBlur = () => {
                      const parsedDate = parse(inputValue, "MM/dd/yyyy", new Date());
                      if (isValid(parsedDate)) {
                        field.onChange(parsedDate);
                      } else {
                        if (inputValue === "") {
                          field.onChange(undefined);
                        } else {
                           setInputValue(field.value ? format(field.value, "MM/dd/yyyy") : "");
                        }
                      }
                    };

                    return (
                      <FormItem className="flex flex-col">
                        <FormLabel>USCF Expiration</FormLabel>
                         <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                           <div className="relative">
                            <FormControl>
                              <Input
                                placeholder="MM/DD/YYYY"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onBlur={handleBlur}
                                disabled={isUscfNew}
                              />
                            </FormControl>
                             <PopoverTrigger asChild>
                              <Button
                                variant={"ghost"}
                                className="absolute right-0 top-0 h-full w-10 p-0 font-normal"
                                aria-label="Open calendar"
                                disabled={isUscfNew}
                              >
                                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </PopoverTrigger>
                          </div>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => {
                                field.onChange(date);
                                setIsCalendarOpen(false);
                              }}
                              initialFocus
                              disabled={isUscfNew}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                 <FormField control={form.control} name="grade" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grade</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select a grade" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                 <FormField control={form.control} name="section" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Section</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select a section" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                 <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Player Email</FormLabel>
                      <FormControl><Input type="email" placeholder="player@example.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                 <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Player Phone Number (Optional)</FormLabel>
                      <FormControl><Input type="tel" placeholder="(555) 555-5555" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                 <FormField control={form.control} name="zipCode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Player Zip Code</FormLabel>
                      <FormControl><Input placeholder="78501" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">Cancel</Button>
                </DialogClose>
                <Button type="submit">
                  {editingPlayer ? 'Save Changes' : 'Add Player'}
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
              This action cannot be undone. This will permanently remove {playerToDelete?.firstName} {playerToDelete?.lastName} from your roster.
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
