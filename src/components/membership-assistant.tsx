"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  suggestMembershipType,
  type SuggestMembershipTypeOutput,
} from "@/ai/flows/suggest-membership-type";
import { BishopIcon } from "./icons/chess-icons";
import { Loader2, Sparkles } from "lucide-react";

const formSchema = z.object({
  age: z.coerce.number().min(1, { message: "Age is required." }),
  tournamentExperience: z
    .string()
    .min(10, { message: "Please provide some details about your experience." }),
});

export function MembershipAssistant() {
  const { toast } = useToast();
  const [suggestion, setSuggestion] =
    useState<SuggestMembershipTypeOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      age: undefined,
      tournamentExperience: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setSuggestion(null);
    try {
      const result = await suggestMembershipType(values);
      setSuggestion(result);
    } catch (error) {
      console.error("Error getting membership suggestion:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not get a suggestion. Please try again.",
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
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Age</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 25" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tournamentExperience"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tournament Experience</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., 'I am a new player and have never played in a USCF tournament.' or 'I play 3-4 tournaments a year, my current rating is 1650.'"
                        {...field}
                        rows={4}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
              <Button variant="link" className="p-0 h-auto">
                Learn more or purchase this membership &rarr;
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
