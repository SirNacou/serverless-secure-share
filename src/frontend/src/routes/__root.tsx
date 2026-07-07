import { ThemeProvider } from "#/components/theme-provider";
import { Toaster } from "#/components/ui/sonner";
import { TooltipProvider } from "#/components/ui/tooltip";
import { AuthProvider } from "#/lib/auth-context";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { FormDevtoolsPanel } from "@tanstack/react-form-devtools";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

function NotFound() {
	return (
		<div className="flex flex-col items-center justify-center min-h-screen text-center p-6">
			<h1 className="text-4xl font-bold tracking-tight">404</h1>
			<p className="text-sm text-muted-foreground mt-2">Page not found</p>
			<Link
				to="/"
				className="inline-flex items-center gap-2 mt-6 h-9 px-4 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
			>
				Go home
			</Link>
		</div>
	);
}

export const Route = createRootRoute({
	notFoundComponent: NotFound,
	component: RootComponent,
});

function RootComponent() {
	return (
		<ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
			<TooltipProvider>
				<AuthProvider>
					<Outlet />
					<Toaster />
					<TanStackDevtools
						config={{ position: "bottom-right" }}
						plugins={[
							{
								name: "TanStack Router",
								render: <TanStackRouterDevtoolsPanel />,
							},
							{
								name: "TanStack Form",
								render: <FormDevtoolsPanel />,
							},
						]}
					/>
					</AuthProvider>
				</TooltipProvider>
			</ThemeProvider>
	);
}