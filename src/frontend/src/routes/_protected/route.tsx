import AppSidebar from "#/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "#/components/ui/sidebar";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected")({
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
