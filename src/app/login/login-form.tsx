"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";

const passwordSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const magicSchema = z.object({
  email: z.string().email("Valid email required"),
});

type PasswordForm = z.infer<typeof passwordSchema>;
type MagicForm = z.infer<typeof magicSchema>;

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { email: "", password: "" },
  });

  const magicForm = useForm<MagicForm>({
    resolver: zodResolver(magicSchema),
    defaultValues: { email: "" },
  });

  async function onPassword(values: PasswordForm) {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Signed in");
      router.push("/portal");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function onMagic(values: MagicForm) {
    setLoading(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOtp({
        email: values.email,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Check your email for the magic link");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "OTP failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-800 text-lg font-bold text-white">
          LS
        </div>
        <CardTitle>LifeSeed ART Bank</CardTitle>
        <CardDescription>Sign in to continue to your portal</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="password">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="magic">Magic Link</TabsTrigger>
          </TabsList>

          <TabsContent value="password">
            <form
              className="space-y-4"
              onSubmit={passwordForm.handleSubmit(onPassword)}
            >
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...passwordForm.register("email")}
                />
                {passwordForm.formState.errors.email && (
                  <p className="text-xs text-red-600">
                    {passwordForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...passwordForm.register("password")}
                />
                {passwordForm.formState.errors.password && (
                  <p className="text-xs text-red-600">
                    {passwordForm.formState.errors.password.message}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="magic">
            <form
              className="space-y-4"
              onSubmit={magicForm.handleSubmit(onMagic)}
            >
              <div className="space-y-2">
                <Label htmlFor="magic-email">Email</Label>
                <Input
                  id="magic-email"
                  type="email"
                  autoComplete="email"
                  {...magicForm.register("email")}
                />
                {magicForm.formState.errors.email && (
                  <p className="text-xs text-red-600">
                    {magicForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send magic link"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
