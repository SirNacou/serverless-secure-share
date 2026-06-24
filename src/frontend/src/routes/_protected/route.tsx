import AppSidebar from "#/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "#/components/ui/sidebar";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { fetchAuthSession } from "aws-amplify/auth";

export const Route = createFileRoute("/_protected")({
	beforeLoad: async () => {
		const session = await fetchAuthSession();
		if (!session.tokens?.accessToken) {
			throw redirect({ to: "/login" });
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<SidebarProvider>
			<AppSidebar />
			<main className="flex h-screen w-screen flex-1 flex-col">
				<SidebarTrigger className="h-10 w-10 [&_svg]:size-5!" />
				<div className="flex-1 p-4">
					<Outlet />
				</div>
			</main>
		</SidebarProvider>
	);
}
