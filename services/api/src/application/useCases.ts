import { readFixture } from "./fixtureData.js";
import type {
  ActivityListResponse,
  Group,
  GroupMembership,
  ImportedActivity,
  RiderAppearance,
  RiderProfile
} from "../domain/models.js";

export interface ApplicationRepository {
  listActivities(): Promise<ActivityListResponse>;
  getActivity(activityId: string): Promise<ImportedActivity | null>;
  getCurrentRider(userId: string): Promise<RiderProfile | null>;
  updateCurrentRiderAppearance(userId: string, appearance: RiderAppearance): Promise<RiderProfile | null>;
  createGroup(input: { name: string; ownerId: string }): Promise<Group>;
  getGroup(groupId: string): Promise<Group | null>;
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

export function createApplicationUseCases(repository: ApplicationRepository, currentUserId: string): ApplicationUseCases {
  return {
    listActivities: () => repository.listActivities(),
    getActivity: (activityId) => repository.getActivity(activityId),
    async getCurrentRider() {
      const rider = await repository.getCurrentRider(currentUserId);
      if (!rider) {
        throw new Error(`Current rider for user '${currentUserId}' was not found.`);
      }
      return rider;
    },
    async updateCurrentRiderAppearance(appearance) {
      const rider = await repository.updateCurrentRiderAppearance(currentUserId, appearance);
      if (!rider) {
        throw new Error(`Current rider for user '${currentUserId}' was not found.`);
      }
      return rider;
    },
    createGroup: (input) => repository.createGroup({ name: input.name ?? "Fixture Club", ownerId: currentUserId }),
    getGroup: (groupId) => repository.getGroup(groupId),
    addGroupMember: (input) => repository.addGroupMember(input),
    getStageRecap: () => readFixture("recap.json"),
    getStageResults: () => readFixture("stage-results.json"),
    getSeasonStandings: () => readFixture("season-standings.json"),
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
