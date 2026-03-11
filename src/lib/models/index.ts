/** Single source of truth: canonical types + Zod schemas for DB/mock boundaries. */

export { clientSchema, clientPhaseEnum } from './client';
export type { Client, ClientPhase } from './client';
export { checkinSchema } from './checkin';
export type { CheckIn } from './checkin';
export { paymentInvoiceSchema, invoiceStatusEnum } from './invoice';
export type { PaymentInvoice, InvoiceStatus } from './invoice';
export { leadSchema, leadStatusEnum } from './lead';
export type { Lead, LeadStatus } from './lead';
export { programSchema } from './program';
export type { Program } from './program';
export { programAssignmentSchema } from './programAssignment';
export type { ProgramAssignment } from './programAssignment';
export { milestoneSchema } from './milestone';
export type { Milestone } from './milestone';
export { closeoutLogSchema } from './closeoutLog';
export type { CloseoutLog } from './closeoutLog';
export { messageThreadSchema } from './messageThread';
export type { MessageThread } from './messageThread';
export { trainerSchema } from './trainer';
export type { Trainer } from './trainer';
export { portfolioCategoryEnum, portfolioItemSchema } from './portfolioItem';
export type { PortfolioItem, PortfolioCategory } from './portfolioItem';
export { serviceOfferingSchema, serviceSnapshotSchema } from './serviceOffering';
export type { ServiceOffering, ServiceSnapshot } from './serviceOffering';
export { trainerProfileSchema } from './trainerProfile';
export type { TrainerProfile } from './trainerProfile';
export { assistantRoleEnum, coachTeamMemberPermissionsSchema, coachTeamMemberSchema } from './coachTeamMember';
export type { CoachTeamMember, CoachTeamMemberPermissions, AssistantRole } from './coachTeamMember';
export { auditEventSchema } from './auditEvent';
export type { AuditEvent } from './auditEvent';
export { liftSchema } from './lift';
export type { Lift } from './lift';
export {
  federationEnum,
  sexEnum as compPrepSexEnum,
  divisionMaleEnum,
  divisionFemaleEnum,
  divisionEnum,
  prepPhaseEnum,
  clientCompProfileSchema,
  mediaTypeEnum,
  mediaCategoryEnum,
  compMediaLogSchema,
  photoGuideUnderstoodSchema,
} from './compPrep';
export type {
  Federation,
  Sex as CompPrepSex,
  Division as CompPrepDivision,
  PrepPhase,
  ClientCompProfile,
  CompMediaLog,
  PhotoGuideUnderstood,
  MediaType,
  MediaCategory,
} from './compPrep';
export {
  poseIdSchema,
  sexEnum as poseSexEnum,
  divisionEnum as poseDivisionEnum,
  hotspotShapeEnum,
  hotspotSchema,
  judgeNotesEntrySchema,
  poseSchema,
} from './poseLibrary';
export type {
  PoseId,
  Pose,
  Hotspot,
  JudgeNotesEntry,
  Division as PoseDivision,
  Sex as PoseSex,
} from './poseLibrary';
