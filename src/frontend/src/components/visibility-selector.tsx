import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type VisibilityType = "private" | "public";

interface VisibilitySelectorProps {
	value: VisibilityType;
	onChange: (value: VisibilityType) => void;
}

export function VisibilitySelector({
	value,
	onChange,
}: VisibilitySelectorProps) {
	return (
		<div className="bg-card text-card-foreground p-5 rounded-xl border border-border flex flex-col">
			<Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
				Visibility
			</Label>

			<RadioGroup
				value={value}
				onValueChange={(val) => onChange(val as VisibilityType)}
				className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 w-full"
			>
				{/* PRIVATE OPTION CARD */}
				<div className="flex">
					<RadioGroupItem
						value="private"
						id="visibility-private"
						className="peer sr-only"
					/>
					<Label
						htmlFor="visibility-private"
						className="flex flex-col justify-center items-center w-full bg-transparent border border-border rounded-xl p-4 cursor-pointer hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-accent transition-all text-center"
					>
						<span className="text-sm font-semibold">Private</span>
					</Label>
				</div>

				{/* PUBLIC OPTION CARD */}
				<div className="flex">
					<RadioGroupItem
						value="public"
						id="visibility-public"
						className="peer sr-only"
					/>
					<Label
						htmlFor="visibility-public"
						className="flex flex-col justify-center items-center w-full bg-transparent border border-border rounded-xl p-4 cursor-pointer hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-accent transition-all text-center"
					>
						<span className="text-sm font-semibold">Public</span>
					</Label>
				</div>
			</RadioGroup>
		</div>
	);
}
