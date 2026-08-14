import { useAuth } from "#/lib/auth-context";
import { Link, useRouter } from "@tanstack/react-router";
import { CompassIcon, HistoryIcon, LogOutIcon, ShareIcon, UserIcon } from "lucide-react";
import { ModeToggle } from "./mode-toggle";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "./ui/sidebar";

type Props = {};

const AppSidebar = (_props: Props) => {
	const router = useRouter();
	const { signOut } = useAuth();

	return (
		<Sidebar>
			<SidebarHeader>
				<h1 className="text-2xl font-bold text-center">Secure Share</h1>
			</SidebarHeader>
			<SidebarContent>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild>
							<Link
								activeProps={{
									className:
										"bg-sidebar-accent text-sidebar-accent-foreground font-medium",
								}}
								to="/share"
							>
								<ShareIcon />
								<span>My Shares</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>

					<SidebarMenuItem>
						<SidebarMenuButton asChild>
							<Link
								activeProps={{
									className:
										"bg-sidebar-accent text-sidebar-accent-foreground font-medium",
								}}
								to="/history"
							>
								<HistoryIcon />
								<span>History</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>

					<SidebarMenuItem>
						<SidebarMenuButton asChild>
							<Link
								activeProps={{
									className:
										"bg-sidebar-accent text-sidebar-accent-foreground font-medium",
								}}
								to="/explore"
							>
								<CompassIcon />
								<span>Explore</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarContent>
			<SidebarFooter>
				<div className="flex items-center gap-1">
					<ModeToggle />
					<Link
						to="/profile"
						className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
					>
						<UserIcon className="size-3.5" />
						Profile
					</Link>
					<button
						type="button"
						onClick={async () => {
							await signOut();
							router.navigate({
								to: "/login",
								replace: true,
								search: { redirectTo: undefined },
							});
						}}
						className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors cursor-pointer"
					>
						<LogOutIcon className="size-3.5" />
						Sign Out
					</button>
				</div>
			</SidebarFooter>
		</Sidebar>
	);
};

export default AppSidebar;
