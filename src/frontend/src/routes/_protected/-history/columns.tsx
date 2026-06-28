import type { ShareListItem } from "#/types/api";
import { createColumnHelper } from "@tanstack/react-table";
import { CalendarDays, Clock } from "lucide-react";
import {
	ActionsCell,
	formatAbsoluteExpiry,
	formatDate,
	formatRelativeTime,
	SortHeader,
	StatusBadge,
	TypeBadge,
	VisibilityBadge,
} from "./cells";

const columnHelper = createColumnHelper<ShareListItem>();

export const activeColumns = [
	columnHelper.accessor("share_name", {
		header: ({ column }) => <SortHeader column={column} label="Name" />,
		cell: ({ row }) => (
			<span className="font-medium text-sm truncate max-w-[200px] block">
				{row.original.share_name}
			</span>
		),
	}),
	columnHelper.accessor("asset_type", {
		header: ({ column }) => <SortHeader column={column} label="Type" />,
		cell: ({ row }) => <TypeBadge type={row.original.asset_type} />,
	}),
	columnHelper.accessor("visibility", {
		header: ({ column }) => <SortHeader column={column} label="Visibility" />,
		cell: ({ row }) => <VisibilityBadge visibility={row.original.visibility} />,
	}),
	columnHelper.accessor("status", {
		header: ({ column }) => <SortHeader column={column} label="Status" />,
		cell: ({ row }) => <StatusBadge status={row.original.status} />,
	}),
	columnHelper.accessor("download_count", {
		header: ({ column }) => <SortHeader column={column} label="Downloads" />,
		cell: ({ row }) => {
			const { download_count, max_downloads } = row.original;
			return (
				<span className="text-sm text-muted-foreground tabular-nums">
					{download_count ?? 0}
					{max_downloads != null ? ` / ${max_downloads}` : ""}
				</span>
			);
		},
	}),
	columnHelper.accessor((row) => row.created_at ?? 0, {
		id: "created_at",
		header: ({ column }) => <SortHeader column={column} label="Created" />,
		cell: ({ row }) => {
			const created = row.original.created_at;
			return (
				<span className="inline-flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
					<CalendarDays className="size-3" />
					{created ? formatDate(created) : "—"}
				</span>
			);
		},
		sortingFn: "basic",
	}),
	columnHelper.accessor("ttl", {
		header: ({ column }) => <SortHeader column={column} label="Expires" />,
		cell: ({ row }) => {
			const ttl = row.original.ttl;
			const now = Math.floor(Date.now() / 1000);
			const expired = ttl != null && ttl <= now;
			return (
				<span
					className={`inline-flex items-center gap-1 text-sm tabular-nums ${expired ? "text-destructive" : "text-muted-foreground"}`}
				>
					<Clock className="size-3" />
					{ttl != null ? formatRelativeTime(ttl) : "—"}
				</span>
			);
		},
	}),
	columnHelper.display({
		id: "actions",
		header: () => <span className="sr-only">Actions</span>,
		cell: ({ row }) => <ActionsCell shareId={row.original.link_id} />,
	}),
];

export const historyColumns = [
	columnHelper.accessor("share_name", {
		header: ({ column }) => <SortHeader column={column} label="Name" />,
		cell: ({ row }) => (
			<span className="font-medium text-sm truncate max-w-[200px] block">
				{row.original.share_name}
			</span>
		),
	}),
	columnHelper.accessor("asset_type", {
		header: ({ column }) => <SortHeader column={column} label="Type" />,
		cell: ({ row }) => <TypeBadge type={row.original.asset_type} />,
	}),
	columnHelper.accessor("visibility", {
		header: ({ column }) => <SortHeader column={column} label="Visibility" />,
		cell: ({ row }) => <VisibilityBadge visibility={row.original.visibility} />,
	}),
	columnHelper.accessor("status", {
		header: ({ column }) => <SortHeader column={column} label="Status" />,
		cell: ({ row }) => <StatusBadge status={row.original.status} />,
	}),
	columnHelper.accessor("action", {
		header: ({ column }) => <SortHeader column={column} label="Action" />,
		cell: ({ row }) => (
			<span className="text-sm text-muted-foreground">
				{row.original.action || "—"}
			</span>
		),
	}),
	columnHelper.accessor((row) => row.created_at ?? 0, {
		id: "created_at",
		header: ({ column }) => <SortHeader column={column} label="Created" />,
		cell: ({ row }) => {
			const created = row.original.created_at;
			return (
				<span className="inline-flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
					<CalendarDays className="size-3" />
					{created ? formatDate(created) : "—"}
				</span>
			);
		},
		sortingFn: "basic",
	}),
	columnHelper.accessor("share_ttl", {
		header: ({ column }) => <SortHeader column={column} label="Expires At" />,
		cell: ({ row }) => {
			const ttl = row.original.share_ttl;
			return (
				<span className="text-sm text-muted-foreground tabular-nums">
					{formatAbsoluteExpiry(ttl)}
				</span>
			);
		},
	}),
];
