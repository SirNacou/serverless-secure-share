"use client";

import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	ComboboxValue,
	useComboboxAnchor,
} from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import * as React from "react";

interface UserMultiSelectProps {
	selected: string[];
	onChange: (selected: string[]) => void;
	availableUsers: string[];
}

export function UserMultiSelect({
	selected,
	onChange,
	availableUsers,
}: UserMultiSelectProps) {
	const anchor = useComboboxAnchor();

	return (
		<div className="bg-card text-card-foreground p-5 rounded-xl border border-border flex flex-col">
			<Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
				Restrict Access to Users
			</Label>

			<Combobox
				multiple
				autoHighlight
				items={availableUsers}
				value={selected}
				onValueChange={onChange}
			>
				<ComboboxChips
					ref={anchor}
					className="w-full bg-transparent border border-input rounded-xl p-2 min-h-[44px]"
				>
					<ComboboxValue>
						{(values: string[]) => (
							<React.Fragment>
								{values.map((value: string) => (
									<ComboboxChip key={value}>{value}</ComboboxChip>
								))}
								<ComboboxChipsInput
									placeholder={
										selected.length === 0 ? "Select target users..." : ""
									}
								/>
							</React.Fragment>
						)}
					</ComboboxValue>
				</ComboboxChips>
				<ComboboxContent
					anchor={anchor}
					className="w-(--radix-popover-trigger-width)"
				>
					<ComboboxEmpty>No users found.</ComboboxEmpty>
					<ComboboxList>
						{(item: string) => (
							<ComboboxItem key={item} value={item}>
								{item}
							</ComboboxItem>
						)}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</div>
	);
}
