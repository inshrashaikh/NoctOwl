"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useRequestOtp, useVerifyAdminOtp } from "@/hooks/use-auth";
import { getStoredToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function AdminLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [otpSent, setOtpSent] = React.useState(false);
  const [devOtpHint, setDevOtpHint] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const requestOtp = useRequestOtp();
  const verifyAdminOtp = useVerifyAdminOtp();

  React.useEffect(() => {
    if (getStoredToken()) {
      router.replace("/dashboard");
    }
  }, [router]);

  const handleRequestOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    if (!phone.trim()) {
      setErrorMessage("Enter a valid phone number in E.164 format (e.g. +15550001111).");
      return;
    }

    try {
      const result = await requestOtp.mutateAsync(phone.trim());
      setOtpSent(true);
      setDevOtpHint(result.otp ?? null);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Unable to request OTP.",
      );
    }
  };

  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    if (!otp.trim()) {
      setErrorMessage("Enter the 6-digit verification code.");
      return;
    }

    try {
      await verifyAdminOtp.mutateAsync({
        phone: phone.trim(),
        otp: otp.trim(),
      });
      router.replace("/dashboard");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Invalid verification code.",
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900 text-slate-100">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">
            NoctOwl Admin
          </CardTitle>
          <CardDescription className="text-slate-400">
            Sign in with your administrator phone number and OTP.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-red-800/60 bg-red-950/60 p-3 text-sm text-red-200"
            >
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!otpSent ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-phone"
                  className="text-sm font-medium text-slate-200"
                >
                  Phone Number
                </label>
                <Input
                  id="admin-phone"
                  type="tel"
                  placeholder="+15550001111"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="border-slate-700 bg-slate-950 text-white placeholder:text-slate-500"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-amber-500 text-slate-950 hover:bg-amber-400"
                disabled={requestOtp.isPending}
              >
                {requestOtp.isPending ? "Sending OTP..." : "Send Verification Code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
                OTP requested for <span className="font-mono font-semibold">{phone}</span>.
                {devOtpHint ? (
                  <span className="mt-1 block text-amber-300">
                    Dev code: <span className="font-mono font-bold">{devOtpHint}</span>
                  </span>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="admin-otp"
                  className="text-sm font-medium text-slate-200"
                >
                  Verification Code
                </label>
                <Input
                  id="admin-otp"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="border-slate-700 bg-slate-950 font-mono text-white placeholder:text-slate-500"
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
                  onClick={() => {
                    setOtpSent(false);
                    setOtp("");
                    setErrorMessage(null);
                  }}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-amber-500 text-slate-950 hover:bg-amber-400"
                  disabled={verifyAdminOtp.isPending}
                >
                  {verifyAdminOtp.isPending ? "Verifying..." : "Sign In"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
