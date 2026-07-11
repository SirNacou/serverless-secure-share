"use client";

import {
	confirmSignUp as amplifyConfirmSignUp,
	signIn as amplifySignIn,
	signInWithRedirect,
	signOut as amplifySignOut,
	signUp as amplifySignUp,
	fetchAuthSession,
	getCurrentUser,
} from "aws-amplify/auth";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";

interface AuthContextValue {
	user: unknown | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	error: string | null;
	signIn: (email: string, password: string) => Promise<void>;
	signInWithGitHub: () => Promise<void>;
	signUp: (
		email: string,
		password: string,
	) => Promise<{ isSignUpComplete: boolean; nextStep?: unknown }>;
	confirmSignUp: (email: string, code: string) => Promise<void>;
	signOut: () => Promise<void>;
	clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<AuthContextValue["user"]>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function checkAuth() {
			try {
				const session = await fetchAuthSession();
				if (session.tokens?.accessToken) {
					const currentUser = await getCurrentUser();
					setUser(currentUser as AuthContextValue["user"]);
				}
			} catch {
				setUser(null);
			} finally {
				setIsLoading(false);
			}
		}

		checkAuth();
	}, []);

	async function signInWithGitHub() {
		await signInWithRedirect({ provider: { custom: "GitHub" } });
	}

	async function signIn(email: string, password: string) {
		setError(null);
		try {
			const result = await amplifySignIn({ username: email, password });
			if (result.isSignedIn) {
				const currentUser = await getCurrentUser();
				setUser(currentUser as AuthContextValue["user"]);
			}
		} catch (err: unknown) {
			const message =
				err instanceof Error
					? err.message
					: typeof err === "string"
						? err
						: "Sign in failed";
			setError(message);
			throw err;
		}
	}

	async function signUp(email: string, password: string) {
		setError(null);
		try {
			const result = await amplifySignUp({
				username: email,
				password,
				options: { userAttributes: { email } },
			});
			return {
				isSignUpComplete: result.isSignUpComplete,
				nextStep: result.nextStep,
			};
		} catch (err: unknown) {
			const message =
				err instanceof Error
					? err.message
					: typeof err === "string"
						? err
						: "Sign up failed";
			setError(message);
			throw err;
		}
	}

	async function confirmSignUp(email: string, code: string) {
		setError(null);
		try {
			await amplifyConfirmSignUp({ username: email, confirmationCode: code });
		} catch (err: unknown) {
			const message =
				err instanceof Error
					? err.message
					: typeof err === "string"
						? err
						: "Confirmation failed";
			setError(message);
			throw err;
		}
	}

	async function signOut() {
		setError(null);
		try {
			await amplifySignOut();
			setUser(null);
		} catch (err: unknown) {
			const message =
				err instanceof Error
					? err.message
					: typeof err === "string"
						? err
						: "Sign out failed";
			setError(message);
			throw err;
		}
	}

	function clearError() {
		setError(null);
	}

	return (
		<AuthContext.Provider
			value={{
				user,
				isAuthenticated: !!user,
				isLoading,
				error,
				signIn,
				signInWithGitHub,
				signUp,
				confirmSignUp,
				signOut,
				clearError,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return ctx;
}
