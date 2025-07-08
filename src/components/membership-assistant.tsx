
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, isValid, parse } from "date-fns";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  suggestMembershipType,
  type SuggestMembershipTypeOutput,
} from "@/ai/flows/suggest-membership-type";
import { BishopIcon } from "./icons/chess-icons";
import { Loader2, Sparkles, CalendarIcon } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import Link from 'next/link';

const formSchema = z.object({
  dob: z.date({ required_error: "Date of birth is required." }),
  hasPlayedBefore: z.enum(['yes', 'no'], { required_error: "Please select an option." }),
});

export function MembershipAssistant() {
  const { toast } = useToast();
  const [suggestion, setSuggestion] =
    useState<SuggestMembershipTypeOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      dob: undefined,
      hasPlayedBefore: undefined,
    },
  });

  const hasPlayed = form.watch("hasPlayedBefore");

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setSuggestion(null);
    try {
      const result = await suggestMembershipType({
        dob: values.dob.toISOString(),
        hasPlayedBefore: values.hasPlayedBefore === 'yes',
      });
      setSuggestion(result);
    } catch (error) {
      console.error("Error getting membership suggestion:", error);
      const description =
        error instanceof Error
          ? error.message
          : "Could not get a suggestion. Please try again.";
      toast({
        variant: "destructive",
        title: "Invalid Information",
        description: description,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2 text-2xl">
            <BishopIcon className="h-6 w-6" /> AI Membership Assistant
          </CardTitle>
          <CardDescription>
            Not sure which USCF membership to get? Fill out the form below and
            our AI assistant will suggest the best option for you.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
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
                    <FormItem>
                      <FormLabel>Your Date of Birth</FormLabel>
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
                name="hasPlayedBefore"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Have you played in a USCF-rated tournament before?</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="yes" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">
                            Yes
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="no" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">
                            No
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {hasPlayed === 'yes' && (
                  <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg border">
                      <p>
                          Welcome back! You will likely need to renew your membership. You can search for your details in the Master Player Database if you have been previously added by an organizer.
                      </p>
                  </div>
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Get Suggestion
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      <div className="flex items-center justify-center">
        {isLoading && (
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="font-semibold">Finding the best fit for you...</p>
          </div>
        )}
        {suggestion && (
          <Card className="w-full bg-primary/5 border-primary/20 shadow-xl">
            <CardHeader>
              <CardTitle className="font-headline text-2xl text-primary">
                Our Recommendation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground">
                  SUGGESTED MEMBERSHIP
                </h3>
                <p className="text-lg font-bold text-accent-foreground font-headline bg-accent/20 p-2 rounded-md inline-block">
                  {suggestion.membershipType}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground">
                  JUSTIFICATION
                </h3>
                <p className="text-foreground/90">{suggestion.justification}</p>
              </div>
            </CardContent>
             <CardFooter>
                <Button asChild variant="default">
                  <Link href={{
                      pathname: '/uscf-purchase',
                      query: { 
                          type: suggestion.membershipType,
                          justification: suggestion.justification,
                          price: '24'
                      }
                  }}>
                    Purchase This Membership &rarr;
                  </Link>
                </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
