export const BRAND_OPTIONS = [
  { key: "fastamps", title: "FastAmps" },
  { key: "b2bsalesleads", title: "B2B Sales Leads" },
  { key: "acidjames", title: "Acid James" },
  { key: "other", title: "Other" },
];

export function brandChoices(customWorkspaces = []) {
  const custom = (customWorkspaces || [])
    .filter((workspace) => !workspace.is_archived)
    .map((workspace) => ({ key: workspace.brand_key, title: workspace.name }));
  return [...BRAND_OPTIONS, ...custom];
}