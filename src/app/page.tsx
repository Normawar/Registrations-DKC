import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DarkKnightIcon } from "@/components/icons/chess-icons";
import Link from "next/link";
import { Chrome } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-1 text-center flex flex-col items-center">
          <div className="inline-block rounded-lg bg-card p-3 mb-4">
              <DarkKnightIcon className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold font-headline">Dark Knights</CardTitle>
          <CardDescription>
            Enter your credentials to access the guild.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="name@example.com" />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center">
              <Label htmlFor="password">Password</Label>
              <Link
                href="#"
                className="ml-auto inline-block text-sm text-primary underline-offset-4 hover:underline"
                prefetch={false}
              >
                Forgot password?
              </Link>
            </div>
            <Input id="password" type="password" />
          </div>
           <Button type="submit" className="w-full" asChild>
             <Link href="/dashboard">Sign In</Link>
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or sign in with
              </span>
            </div>
          </div>
           <Button variant="outline" className="w-full">
            <Chrome className="mr-2 h-4 w-4" />
            Google
          </Button>
        </CardContent>
        <CardFooter className="justify-center text-sm">
          <p className="text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="#"
              className="font-medium text-primary underline-offset-4 hover:underline"
              prefetch={false}
            >
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
