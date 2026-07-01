export const PARISHES = [
  { value: "christ_church", label: "Christ Church" },
  { value: "saint_andrew", label: "St. Andrew" },
  { value: "saint_george", label: "St. George" },
  { value: "saint_james", label: "St. James" },
  { value: "saint_john", label: "St. John" },
  { value: "saint_joseph", label: "St. Joseph" },
  { value: "saint_lucy", label: "St. Lucy" },
  { value: "saint_michael", label: "St. Michael" },
  { value: "saint_peter", label: "St. Peter" },
  { value: "saint_philip", label: "St. Philip" },
  { value: "saint_thomas", label: "St. Thomas" },
] as const;

export type Parish = (typeof PARISHES)[number]["value"];

export const parishLabel = (v?: string | null): string =>
  PARISHES.find((p) => p.value === v)?.label ?? "Barbados";

export const CONDITIONS = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like new" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "for_parts", label: "For parts" },
] as const;

export const conditionLabel = (v?: string | null): string =>
  CONDITIONS.find((c) => c.value === v)?.label ?? "Used";
