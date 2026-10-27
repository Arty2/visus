// @carbon/icons ships its icons as plain objects without type declarations;
// this is their shape (see src/lib/icons.ts).
declare module '@carbon/icons/es/*' {
	const icon: {
		elem: string;
		attrs: Record<string, string | number>;
		content: { elem: string; attrs: Record<string, string | number> }[];
		name: string;
		size: number;
	};
	export default icon;
}
