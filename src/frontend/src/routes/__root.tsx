import { ThemeProvider } from "#/components/theme-provider";
import { Toaster } from "#/components/ui/sonner";
import { TooltipProvider } from "#/components/ui/tooltip";
import { AuthProvider } from "#/lib/auth-context";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { FormDevtoolsPanel } from "@tanstack/react-form-devtools";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
export const Route = createRootRoute({
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