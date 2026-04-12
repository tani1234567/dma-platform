/**
 * Default topic suggestions per stakeholder type.
 * Used to pre-populate assignedTopics when a stakeholder is first created,
 * and as a quick-assign shortcut on the Topic Assignment page.
 */
export const TOPIC_SUGGESTIONS_BY_TYPE: Record<string, string[]> = {
  Management:    ["E1","E2","E3","E13","S1","S3","S4","S5","G1","G2","G3","G4","G5","G6","G7"],
  Employees:     ["S1","S2","S3","S4","S5","S6","S7","S8","G1","G2","E6","E7","E8"],
  Customers:     ["E11","E12","E14","S11","S12","S13","S15","G1","G3","G6"],
  Suppliers:     ["E1","E6","E7","E10","S7","S8","S14","G2","G3","G8"],
  Community:     ["E4","E5","E8","E9","E15","S9","S10","S15","G3","G6"],
  Investors:     ["E1","E2","E3","E13","G4","G5","G6","G7","G9","G10","S5"],
  "Experts/NGOs":["E1","E4","E5","E9","E15","S7","S8","S9","S14","G2","G6","G8"],
};
