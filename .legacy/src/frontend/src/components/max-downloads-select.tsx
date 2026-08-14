"use client";

import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface MaxDownloadsSelectProps {
	value: string;
	onChange: (value: string) => void;
}

export const maxDownloadsOptions = [
	{ value: "0", label: "No Limit" },
	{ value: "1", label: "1 Download (Burn after reading)" },
	{ value: "5", label: "5 Downloads" },
	{ value: "10", label: "10 Downloads" },
	{ value: "25", label: "25 Downloads" },
	{ value: "100", label: "100 Downloads" },
];

export function MaxDownloadsSelect({
	value,
	onChange,
}: MaxDownloadsSelectProps) {
	return (
		<div className="bg-card text-card-foreground p-5 rounded-xl border border-border flex flex-col">
			<Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
				Max Downloads
			</Label>

			<Select
				value={value}
				onValueChange={(v) => onChange(v ?? "")}
				items={maxDownloadsOptions}
				defaultValue={maxDownloadsOptions[0].value}
			>
				<SelectTrigger
					size="default"
					className="w-full bg-transparent border border-input rounded-xl focus:ring-1 focus:ring-ring text-sm px-3.5"
				>
					<SelectValue placeholder="Select download limit..." />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={true}>
					{maxDownloadsOptions.map((option) => (
						<SelectItem
							key={option.value}
							className={"text-base"}
							value={option.value}
						>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
