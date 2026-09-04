export class ArchiveMeta {
  constructor(
    readonly archivedAt: Date,
    readonly archivedByUserId: string | null,
    readonly reason: string | null,
  ) {}
}
