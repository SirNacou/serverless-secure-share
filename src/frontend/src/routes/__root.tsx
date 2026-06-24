import { AuthProvider, useAuth } from "#/lib/auth-context";
import { ThemeProvider } from "#/components/theme-provider";
import { Toaster } from "#/components/ui/sonner";
import { TooltipProvider } from "#/components/ui/tooltip";
import { awsConfig } from "#/config/aws-config";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { useQueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
	useRouter,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Amplify } from "aws-amplify";
import { useEffect, useRef } from "react";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";

Amplify.configure(awsConfig);

interface MyRouterContext {
	queryClient: import("@tanstack/react-query").QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Secure Share",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	pendingMs: 0,
	pendingComponent: () => (
		<div className="min-h-screen flex items-center justify-center bg-background">
			<div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
		</div>
	),
	shellComponent: RootDocument,
});

function AuthGate() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { isAuthenticated } = useAuth();
	const wasAuthed = useRef(isAuthenticated);

	useEffect(() => {
		if (isAuthenticated && !wasAuthed.current) {
			router.invalidate().catch(console.error);
			queryClient.invalidateQueries().catch(console.error);
		}
		wasAuthed.current = isAuthenticated;
	}, [isAuthenticated, router, queryClient]);

	return null;
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body>
				<ThemeProvider defaultTheme="system" storageKey="theme">
					<AuthProvider>
						<AuthGate />
						<TooltipProvider>{children}</TooltipProvider>
					</AuthProvider>
				</ThemeProvider>
				<Toaster />
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
						TanStackQueryDevtools,
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
