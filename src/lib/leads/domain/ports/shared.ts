export type ActorContext = {
  userId: string;
  roles: readonly string[];
  siteId?: string | null;
};

export type Clock = {
  now(): Date;
};

export type IdGenerator = {
  next(): string;
};
