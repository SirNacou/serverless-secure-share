import { api } from "#/lib/api";
import type { ActivityResponse } from "#/types/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
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
import { columns } from "./-history/columns";
import { DataTable } from "./-history/data-table";

const SKELETON_HEADER = [1, 2, 3, 4, 5, 6, 7];
const SKELETON_ROWS = [1, 2, 3, 4, 5];
const SKELETON_CELLS = [1, 2, 3, 4, 5, 6, 7];

export const Route = createFileRoute("/_protected/history")({
	component: RouteComponent,
});

function RouteComponent() {
	const [globalFilter, setGlobalFilter] = useState("");
	const [typeFilter, setTypeFilter] = useState("all");
	const [visibilityFilter, setVisibilityFilter] = useState("all");

	const { data, isPending, isError, error, refetch } = useQuery({
		queryKey: ["shares", "history"],
		queryFn: () => api.get("api/activity").json<ActivityResponse>(),
	});

	const filteredData = useMemo(() => {
		const mapped = (data?.shares ?? []).map((item) => {
			const created_at = item.timestamp ? Math.floor(item.timestamp / 1000) : undefined;
			return {
				link_id: item.link_id,
				share_name: item.share_name || "Untitled Share",
				asset_type: item.asset_type || "TEXT",
				visibility: item.visibility || "private",
				status: item.status || "UNKNOWN",
				download_count: 0,
				max_downloads: null,
				created_at,
				ttl: 0,
				owner_username: item.owner_username,
			};
		});

		return mapped.filter((item) => {
			if (typeFilter !== "all" && item.asset_type !== typeFilter)
				return false;
			if (visibilityFilter !== "all" && item.visibility !== visibilityFilter)
				return false;
			return true;
		});
	}, [data, typeFilter, visibilityFilter]);

	const table = useReactTable({
		data: filteredData,
		columns,
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
					<h1 className="text-2xl font-bold tracking-tight">History</h1>
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
					Failed to load history
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
				<h2 className="text-xl font-bold tracking-tight">No historical activity yet</h2>
				<p className="text-sm text-muted-foreground max-w-sm mt-1">
					Your shared items and activity logs will appear here.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex min-h-11 items-center justify-between">
				<h1 className="text-2xl font-bold tracking-tight">History</h1>
				<p className="text-sm text-muted-foreground">
					{filteredData.length} item{filteredData.length !== 1 ? "s" : ""}
				</p>
			</div>

			<DataTable
				table={table}
				columnCount={columns.length}
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
