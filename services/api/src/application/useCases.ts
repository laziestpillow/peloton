import type { ApiFixtureData } from "./fixtureData.js";
import type {
  ActivityListResponse,
  Group,
  GroupMembership,
  ImportedActivity,
  RiderAppearance,
  RiderProfile
} from "../domain/models.js";

export interface ApplicationRepository {
  listActivities(userId: string): Promise<ActivityListResponse>;
  getActivity(input: { activityId: string; userId: string }): Promise<ImportedActivity | null>;
  getCurrentRider(userId: string): Promise<RiderProfile | null>;
  updateCurrentRiderAppearance(userId: string, appearance: RiderAppearance): Promise<RiderProfile | null>;
  createGroup(input: { name: string; ownerId: string }): Promise<Group>;
  getGroup(groupId: string): Promise<Group | null>;
  getGroupMembershipForUser(input: { groupId: string; userId: string }): Promise<GroupMembership | null>;
  addGroupMember(input: { groupId: string; riderId: string }): Promise<GroupMembership>;
}

export interface ApplicationUseCases {
  listActivities(): Promise<ActivityListResponse>;
  getActivity(activityId: string): Promise<ImportedActivity | null>;
  getCurrentRider(): Promise<RiderProfile>;
  updateCurrentRiderAppearance(appearance: RiderAppearance): Promise<RiderProfile>;
  createGroup(input: { name?: string }): Promise<Group>;
  getGroup(groupId: string): Promise<Group | null>;
  addGroupMember(input: { groupId: string; riderId: string }): Promise<GroupMembership>;
  getStageRecap(): Promise<unknown>;
  getStageResults(): Promise<unknown>;
  getSeasonStandings(): Promise<unknown>;
  getSeasonArchetypes(): Promise<unknown>;
}

export class ApplicationError extends Error {
  constructor(
    readonly statusCode: 401 | 403 | 404,
    readonly code: "unauthorized" | "forbidden" | "not_found",
    message: string
  ) {
    super(message);
  }
}

export function createApplicationUseCases(
  repository: ApplicationRepository,
  currentUserId: string,
  fixtureData: ApiFixtureData
): ApplicationUseCases {
  async function getCurrentRiderOrThrow(): Promise<RiderProfile> {
    const rider = await repository.getCurrentRider(currentUserId);
    if (!rider) {
      throw new ApplicationError(404, "not_found", "Current rider was not found.");
    }
    return rider;
  }

  async function requireGroupAccess(groupId: string): Promise<Group> {
    const group = await repository.getGroup(groupId);
    if (!group) {
      throw new ApplicationError(404, "not_found", "Group not found.");
    }
    if (group.ownerId === currentUserId) {
      return group;
    }
    const membership = await repository.getGroupMembershipForUser({ groupId, userId: currentUserId });
    if (!membership || membership.status !== "active") {
      throw new ApplicationError(403, "forbidden", "You do not have access to this group.");
    }
    return group;
  }

  return {
    listActivities: () => repository.listActivities(currentUserId),
    getActivity: (activityId) => repository.getActivity({ activityId, userId: currentUserId }),
    getCurrentRider: getCurrentRiderOrThrow,
    async updateCurrentRiderAppearance(appearance) {
      const rider = await repository.updateCurrentRiderAppearance(currentUserId, appearance);
      if (!rider) {
        throw new ApplicationError(404, "not_found", "Current rider was not found.");
      }
      return rider;
    },
    createGroup: (input) => repository.createGroup({ name: input.name ?? "Fixture Club", ownerId: currentUserId }),
    getGroup: requireGroupAccess,
    async addGroupMember(input) {
      const group = await repository.getGroup(input.groupId);
      if (!group) {
        throw new ApplicationError(404, "not_found", "Group not found.");
      }
      if (group.ownerId !== currentUserId) {
        throw new ApplicationError(403, "forbidden", "Only the group owner can add members.");
      }
      return repository.addGroupMember(input);
    },
    getStageRecap: async () => fixtureData.recap,
    getStageResults: async () => fixtureData.stageResults,
    getSeasonStandings: async () => fixtureData.seasonStandings,
    async getSeasonArchetypes() {
      return {
        data: [
          {
            seasonId: "season-001",
            riderId: "rider-001",
            archetype: "sprinter",
            confidence: 0.76,
            sampleSize: 5,
            sprintRelativeScore: 0.82,
            climbRelativeScore: 0.61,
            shortEffortScore: 0.7,
            sustainedEffortScore: 0.58,
            effectiveAt: "2026-07-20T10:00:00Z",
            reasons: ["Sprint score is the strongest relative signal."]
          }
        ]
      };
    }
  };
}
