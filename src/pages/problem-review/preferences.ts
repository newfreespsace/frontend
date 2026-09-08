export const defaultProblemReviewSchedule: ApiTypes.UserPreferenceProblemReviewScheduleItemDto[] = [
  { availableAfterDays: 1, overdueAfterDays: 2 },
  { availableAfterDays: 3, overdueAfterDays: 5 },
  { availableAfterDays: 7, overdueAfterDays: 10 },
  { availableAfterDays: 14, overdueAfterDays: 21 }
];

export function isValidProblemReviewSchedule(schedule: ApiTypes.UserPreferenceProblemReviewScheduleItemDto[]): boolean {
  return (
    schedule.length >= 1 &&
    schedule.length <= 10 &&
    schedule.every(
      item =>
        Number.isInteger(item.availableAfterDays) &&
        Number.isInteger(item.overdueAfterDays) &&
        item.availableAfterDays >= 1 &&
        item.overdueAfterDays <= 365 &&
        item.overdueAfterDays > item.availableAfterDays
    )
  );
}
