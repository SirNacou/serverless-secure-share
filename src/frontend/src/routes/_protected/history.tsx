import { api } from "#/lib/api";
import type { ShareListResponse } from "#/types/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { BarChart3, RefreshCw, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { columns } from "./-history/columns";
import { DataTable } from "./-history/data-table";

export const Route = createFileRoute("/_protected/history")({
	component: RouteComponent,
});

function RouteComponent() {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [globalFilter, setGlobalFilter] = useState("");
	const [typeFilter, setTypeFilter] = useState("all");
	const [visibilityFilter, setVisibilityFilter] = useState("all");

	const { data, isPending, isError, error, refetch } = useQuery({
		queryKey: ["shares"],
		queryFn: () => api.get("api/shares").json<ShareListResponse>(),
	});

	const filteredData = useMemo(
		() =>
			(data?.shares ?? []).filter((item) => {
				if (typeFilter !== "all" && item.asset_type !== typeFilter)
					return false;
				if (visibilityFilter !== "all" && item.visibility !== visibilityFilter)
					return false;
				return true;
			}),
		[data, typeFilter, visibilityFilter],
	);

	const table = useReactTable({
		data: filteredData,
		columns,
		state: { sorting, globalFilter },
		onSortingChange: setSorting,
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
					<div className="bg-muted/50 p-3 border-b border-border flex gap-4">
						{[...Array(7)].map((_, i) => (
							<div
								key={i}
								className="h-4 w-20 bg-muted-foreground/10 rounded animate-pulse"
							/>
						))}
					</div>
					{[...Array(5)].map((_, i) => (
						<div key={i} className="p-3 border-b border-border flex gap-4">
							{[...Array(7)].map((_, j) => (
								<div
									key={j}
									className="h-4 w-20 bg-muted-foreground/5 rounded animate-pulse"
								/>
							))}
						</div>
					))}
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

	if (!data || data.shares.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
				<BarChart3 className="size-16 text-muted-foreground/40 stroke-[1.2] mb-4" />
				<h2 className="text-xl font-bold tracking-tight">No shares yet</h2>
				<p className="text-sm text-muted-foreground max-w-sm mt-1">
					Create your first secure share to see it here.
				</p>
				<Link
					to="/share"
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
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold tracking-tight">History</h1>
				<p className="text-sm text-muted-foreground">
					{data.count} share{data.count !== 1 ? "s" : ""}
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
