"use client";

import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface LifespanSelectProps {
	value: string;
	onChange: (value: string) => void;
}

export const lifespanOptions = [
	{ value: "1", label: "1 Hour" },
	{ value: "24", label: "24 Hours" },
	{ value: "168", label: "7 Days" },
	{ value: "720", label: "30 Days" },
];

export function LifespanSelect({ value, onChange }: LifespanSelectProps) {
	return (
		<div className="bg-card text-card-foreground p-5 rounded-xl border border-border flex flex-col">
			<Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
				Link Expiration Lifespan
			</Label>

			<Select
				value={value}
				onValueChange={(v) => onChange(v || "24")}
				items={lifespanOptions}
				defaultValue={lifespanOptions[1].value}
			>
				<SelectTrigger
					size="default"
					className="w-full bg-transparent border border-input rounded-xl focus:ring-1 focus:ring-ring text-sm px-3.5"
				>
					<SelectValue placeholder="Select retention window..." />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={true}>
					{lifespanOptions.map((option) => (
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
