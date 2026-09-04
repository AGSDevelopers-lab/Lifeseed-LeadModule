export type TelecallerAvailability = {
  userId: string;
  siteId: string | null;
  openLeadCount: number;
  languages: readonly string[];
  skills: readonly string[];
};

export interface AssignmentDirectory {
  listAvailableTelecallers(siteId?: string | null): Promise<TelecallerAvailability[]>;
}
