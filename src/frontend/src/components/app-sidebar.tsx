import { Link } from "@tanstack/react-router";
import { CompassIcon, HistoryIcon, ShareIcon } from "lucide-react";
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

const AppSidebar = (props: Props) => {
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
								<span>Share</span>
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
				<ModeToggle />
			</SidebarFooter>
		</Sidebar>
	);
};

export default AppSidebar;
