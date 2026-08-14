import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { flexRender, type Table as TableType } from "@tanstack/react-table";
import { Search } from "lucide-react";
import type { ShareListItem } from "#/types/api";

interface DataTableProps {
	table: TableType<ShareListItem>;
	columnCount: number;
	globalFilter: string;
	onGlobalFilterChange: (value: string) => void;
	typeFilter: string;
	onTypeFilterChange: (value: string) => void;
	visibilityFilter: string;
	onVisibilityFilterChange: (value: string) => void;
}

export function DataTable({
	table,
	columnCount,
	globalFilter,
	onGlobalFilterChange,
	typeFilter,
	onTypeFilterChange,
	visibilityFilter,
	onVisibilityFilterChange,
}: DataTableProps) {
	return (
		<>
			<div className="flex flex-wrap items-center gap-3">
				<div className="relative flex-1 min-w-[200px] max-w-sm">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
					<input
						type="text"
						value={globalFilter}
						onChange={(e) => onGlobalFilterChange(e.target.value)}
						placeholder="Search by name..."
						className="w-full h-9 pl-9 pr-3 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50"
					/>
				</div>

				<select
					value={typeFilter}
					onChange={(e) => onTypeFilterChange(e.target.value)}
					className="h-9 px-3 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors"
				>
					<option value="all">All Types</option>
					<option value="FILE">File</option>
					<option value="TEXT">Text</option>
				</select>

				<select
					value={visibilityFilter}
					onChange={(e) => onVisibilityFilterChange(e.target.value)}
					className="h-9 px-3 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors"
				>
					<option value="all">All Visibility</option>
					<option value="public">Public</option>
					<option value="private">Private</option>
				</select>
			</div>

			<div className="rounded-xl border border-border overflow-hidden">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id}>
										{header.isPlaceholder
											? null
											: flexRender(header.column.columnDef.header, header.getContext())}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows.length > 0 ? (
							table.getRowModel().rows.map((row) => (
								<TableRow key={row.id}>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columnCount}
									className="text-center py-12 text-sm text-muted-foreground"
								>
									No shares match your filters.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
		</>
	);
}
