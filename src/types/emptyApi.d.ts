/**
 * Type declarations for @/lib/emptyApi (excluded from tsconfig).
 * base44.entities is a Proxy; declare entity names used in the app.
 */
declare module '@/lib/emptyApi' {
  interface EntityMethods {
    list: (...args: unknown[]) => Promise<unknown[]>;
    filter: (query?: unknown, order?: string, limit?: number) => Promise<unknown[]>;
    create: (data: unknown) => Promise<unknown>;
    update: (id: string, data: unknown) => Promise<unknown>;
    delete: (id: string) => Promise<void>;
    get: (id: string) => Promise<unknown | null>;
  }

  interface Base44Entities {
    User: EntityMethods;
    TrainerProfile: EntityMethods;
    ClientProfile: EntityMethods;
    Workout: EntityMethods;
    AdminAuditLog: EntityMethods;
    BillingSettings: EntityMethods;
    AppContent: EntityMethods;
    FeatureFlags: EntityMethods;
    MarketplaceSettings: EntityMethods;
    ThemeSettings: EntityMethods;
    Conversation: EntityMethods;
    Message: EntityMethods;
    CheckIn: EntityMethods;
    ClientPerformanceSnapshot: EntityMethods;
    ExercisePerformanceTrend: EntityMethods;
    [key: string]: EntityMethods | undefined;
  }

  interface Base44Auth {
    me: () => Promise<unknown | null>;
    isAuthenticated: () => Promise<boolean>;
    redirectToLogin: (url?: string) => void;
    logout: () => void;
    updateMe: () => Promise<unknown>;
  }

  interface Base44Integrations {
    Core: { UploadFile: (opts: { file: unknown }) => Promise<{ file_url: string }> };
  }

  export const base44: {
    auth: Base44Auth;
    entities: Base44Entities;
    functions: { invoke: () => Promise<{ data: unknown }> };
    integrations: Base44Integrations;
    users: { inviteUser: () => Promise<unknown> };
    asServiceRole?: { entities: Base44Entities };
  };
}
