import { api } from "#/lib/api";
import type { ShareListResponse } from "#/types/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { BarChart3, RefreshCw, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { activeColumns } from "../-history/columns";
import { DataTable } from "../-history/data-table";

const SKELETON_HEADER = [1, 2, 3, 4, 5, 6, 7];
const SKELETON_ROWS = [1, 2, 3, 4, 5];
const SKELETON_CELLS = [1, 2, 3, 4, 5, 6, 7];

export const Route = createFileRoute("/_protected/share/")({
	component: RouteComponent,
});

function RouteComponent() {
	const [globalFilter, setGlobalFilter] = useState("");
	const [typeFilter, setTypeFilter] = useState("all");
	const [visibilityFilter, setVisibilityFilter] = useState("all");

	const { data, isPending, isError, error, refetch } = useQuery({
		queryKey: ["shares", "active"],
		queryFn: () => api.get("api/shares").json<ShareListResponse>(),
	});

	const filteredData = useMemo(() => {
		const now = Math.floor(Date.now() / 1000);
		return (data?.shares ?? [])
			.filter((item) => {
				const isActive =
					(item.status === "AVAILABLE" || item.status === "PENDING_UPLOAD") &&
					(item.ttl == null || item.ttl > now);
				if (!isActive) return false;

				if (typeFilter !== "all" && item.asset_type !== typeFilter)
					return false;
				if (visibilityFilter !== "all" && item.visibility !== visibilityFilter)
					return false;
				return true;
			});
	}, [data, typeFilter, visibilityFilter]);

		const table = useReactTable({
			data: filteredData,
			columns: activeColumns,
			state: { globalFilter },
			onGlobalFilterChange: setGlobalFilter,
			getCoreRowModel: getCoreRowModel(),
			getSortedRowModel: getSortedRowModel(),
			getFilteredRowModel: getFilteredRowModel(),
		});

	if (isPending) {
		return (
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold tracking-tight">My Shares</h1>
				</div>
				<div className="rounded-xl border border-border overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow>
								{SKELETON_HEADER.map((i) => (
									<TableHead key={i}>
										<div className="h-4 bg-muted-foreground/10 rounded animate-pulse" />
									</TableHead>
								))}
							</TableRow>
						</TableHeader>
						<TableBody>
							{SKELETON_ROWS.map((i) => (
								<TableRow key={i}>
									{SKELETON_CELLS.map((j) => (
										<TableCell key={j}>
											<div className="h-4 bg-muted-foreground/5 rounded animate-pulse" />
										</TableCell>
									))}
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			</div>
		);
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
				<ShieldAlert className="size-16 text-destructive stroke-[1.2] mb-4" />
				<h2 className="text-xl font-bold tracking-tight">
					Failed to load shares
				</h2>
				<p className="text-sm text-muted-foreground max-w-sm mt-1">
					{error instanceof Error ? error.message : "Something went wrong"}
				</p>
				<button
					type="button"
					onClick={() => refetch()}
					className="inline-flex items-center gap-2 mt-4 h-9 px-4 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/80 transition-colors cursor-pointer"
				>
					<RefreshCw className="size-4" />
					Retry
				</button>
			</div>
		);
	}

	if (!data || filteredData.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
				<BarChart3 className="size-16 text-muted-foreground/40 stroke-[1.2] mb-4" />
				<h2 className="text-xl font-bold tracking-tight">No active shares</h2>
				<p className="text-sm text-muted-foreground max-w-sm mt-1">
					Create a new secure share to see it here.
				</p>
				<Link
					to="/share/create"
					className="inline-flex items-center gap-2 mt-4 h-9 px-4 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
				>
					<BarChart3 className="size-4" />
					Create a Share
				</Link>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex min-h-11 items-center justify-between">
				<h1 className="text-2xl font-bold tracking-tight">My Shares</h1>
				<div className="flex items-center gap-4">
					<p className="text-sm text-muted-foreground">
						{filteredData.length} active share{filteredData.length !== 1 ? "s" : ""}
					</p>
					<Link
						to="/share/create"
						className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
					>
						<BarChart3 className="size-4" />
						Create Share
					</Link>
				</div>
			</div>

					<DataTable
						table={table}
						columnCount={activeColumns.length}
						globalFilter={globalFilter}
						onGlobalFilterChange={setGlobalFilter}
						typeFilter={typeFilter}
						onTypeFilterChange={setTypeFilter}
						visibilityFilter={visibilityFilter}
						onVisibilityFilterChange={setVisibilityFilter}
					/>
		</div>
	);
}
