import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { useAuth } from "#/lib/auth-context";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import MdiGithub from "~icons/mdi/github";

export const Route = createFileRoute("/login")({
	validateSearch: (search: Record<string, string | undefined>) => ({
		redirectTo: search.redirectTo ?? undefined,
	}),
	component: RouteComponent,
});

type View = "signIn" | "signUp" | "confirmSignUp";

function RouteComponent() {
	const router = useRouter();
	const {
		isAuthenticated,
		isLoading,
		signIn,
		signInWithGitHub,
		signUp,
		confirmSignUp,
		error,
		clearError,
	} = useAuth();

	const [view, setView] = useState<View>("signIn");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [code, setCode] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const { redirectTo } = Route.useSearch();

	useEffect(() => {
		if (isAuthenticated) {
			router.navigate({ to: redirectTo || "/share", replace: true });
		}
	}, [isAuthenticated, redirectTo, router]);

	useEffect(() => {
		return () => clearError();
	}, [clearError]);

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
			</div>
		);
	}

	async function handleSignIn(e: React.SubmitEvent<HTMLFormElement>) {
		e.preventDefault();
		setSubmitting(true);
		try {
			await signIn(email, password);
		} catch {
			// error is set by context
		} finally {
			setSubmitting(false);
		}
	}

	async function handleSignUp(e: React.SubmitEvent<HTMLFormElement>) {
		e.preventDefault();
		if (password !== confirmPassword) {
			toast.error("Passwords do not match");
			return;
		}
		setSubmitting(true);
		try {
			await signUp(email, password);
			setView("confirmSignUp");
			toast.success("Verification code sent to your email");
		} catch {
			// error is set by context
		} finally {
			setSubmitting(false);
		}
	}

	async function handleConfirmSignUp(e: React.SubmitEvent<HTMLFormElement>) {
		e.preventDefault();
		setSubmitting(true);
		try {
			await confirmSignUp(email, code);
			toast.success("Email verified! You can now sign in.");
			setView("signIn");
			setCode("");
		} catch {
			// error is set by context
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-background p-4">
			<div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
				<div className="text-center space-y-1">
					<h1 className="text-xl font-bold tracking-tight">Secure Share</h1>
					<p className="text-xs text-muted-foreground">
						{view === "signIn" && "Sign in to your account"}
						{view === "signUp" && "Create a new account"}
						{view === "confirmSignUp" && "Verify your email"}
					</p>
				</div>

				{error && (
					<div className="text-xs text-destructive font-medium bg-destructive/5 border border-destructive/10 rounded-lg px-3 py-2">
						{error}
					</div>
				)}

				{view === "signIn" && (
					<form onSubmit={handleSignIn} className="space-y-3">
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Email
							</Label>
							<Input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="you@example.com"
								required
								autoFocus
							/>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Password
							</Label>
							<Input
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="Enter your password"
								required
							/>
						</div>
						<Button type="submit" className="w-full h-10" disabled={submitting}>
							{submitting ? "Signing in..." : "Sign In"}
						</Button>
						<div className="relative">
							<div className="absolute inset-0 flex items-center">
								<span className="w-full border-t border-border" />
							</div>
							<div className="relative flex justify-center text-xs uppercase">
								<span className="bg-card px-2 text-muted-foreground">
									or continue with
								</span>
							</div>
						</div>
						<Button
							type="button"
							variant="outline"
							className="w-full h-10 gap-2"
							onClick={signInWithGitHub}
						>
							<MdiGithub />
							GitHub
						</Button>
						<p className="text-xs text-center text-muted-foreground">
							Don't have an account?{" "}
							<button
								type="button"
								onClick={() => {
									setView("signUp");
									setPassword("");
									setConfirmPassword("");
									clearError();
								}}
								className="text-primary underline underline-offset-2 hover:no-underline"
							>
								Sign Up
							</button>
						</p>
					</form>
				)}

				{view === "signUp" && (
					<form onSubmit={handleSignUp} className="space-y-3">
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Email
							</Label>
							<Input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="you@example.com"
								required
								autoFocus
							/>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Password
							</Label>
							<Input
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="At least 8 characters"
								required
								minLength={8}
							/>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Confirm Password
							</Label>
							<Input
								type="password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								placeholder="Re-enter your password"
								required
								minLength={8}
							/>
						</div>
						<Button type="submit" className="w-full h-10" disabled={submitting}>
							{submitting ? "Creating account..." : "Create Account"}
						</Button>
						<p className="text-xs text-center text-muted-foreground">
							Already have an account?{" "}
							<button
								type="button"
								onClick={() => {
									setView("signIn");
									setPassword("");
									setConfirmPassword("");
									clearError();
								}}
								className="text-primary underline underline-offset-2 hover:no-underline"
							>
								Sign In
							</button>
						</p>
					</form>
				)}

				{view === "confirmSignUp" && (
					<form onSubmit={handleConfirmSignUp} className="space-y-3">
						<p className="text-xs text-muted-foreground">
							Enter the verification code sent to <strong>{email}</strong>
						</p>
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Verification Code
							</Label>
							<Input
								type="text"
								value={code}
								onChange={(e) => setCode(e.target.value)}
								placeholder="000000"
								required
								autoFocus
							/>
						</div>
						<Button type="submit" className="w-full h-10" disabled={submitting}>
							{submitting ? "Verifying..." : "Verify Email"}
						</Button>
						<p className="text-xs text-center text-muted-foreground">
							<button
								type="button"
								onClick={() => {
									setView("signIn");
									clearError();
								}}
								className="text-primary underline underline-offset-2 hover:no-underline"
							>
								Back to Sign In
							</button>
						</p>
					</form>
				)}
			</div>
		</div>
	);
}
