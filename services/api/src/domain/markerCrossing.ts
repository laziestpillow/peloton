export interface PositionSample {
  riderId: string;
  timeSeconds: number;
  positionMeters: number;
}

export interface DetectedCrossing {
  riderId: string;
  crossedAtSeconds: number;
}

export interface MarkerCrossingDetectionConfig {
  timeRounding?: "floor" | "nearest" | "ceil";
}

function roundTime(timeSeconds: number, mode: MarkerCrossingDetectionConfig["timeRounding"] = "nearest"): number {
  if (mode === "floor") {
    return Math.floor(timeSeconds);
  }
  if (mode === "ceil") {
    return Math.ceil(timeSeconds);
  }
  return Math.round(timeSeconds);
}

export function detectMarkerCrossings(
  markerPositionMeters: number,
  samples: readonly PositionSample[],
  config: MarkerCrossingDetectionConfig = {}
): readonly DetectedCrossing[] {
  const byRider = Map.groupBy(samples, (sample) => sample.riderId);
  const crossings: DetectedCrossing[] = [];

  for (const [riderId, riderSamples] of byRider) {
    const ordered = riderSamples.toSorted((left, right) => {
      const timeDifference = left.timeSeconds - right.timeSeconds;
      return timeDifference === 0 ? left.positionMeters - right.positionMeters : timeDifference;
    });
    const firstSample = ordered[0];
    if (firstSample && firstSample.positionMeters >= markerPositionMeters) {
      crossings.push({ riderId, crossedAtSeconds: roundTime(firstSample.timeSeconds, config.timeRounding) });
      continue;
    }

    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      if (!previous || !current) {
        continue;
      }
      if (previous.positionMeters < markerPositionMeters && current.positionMeters >= markerPositionMeters) {
        const distanceDelta = current.positionMeters - previous.positionMeters;
        const ratio = distanceDelta === 0 ? 0 : (markerPositionMeters - previous.positionMeters) / distanceDelta;
        const time = previous.timeSeconds + ratio * (current.timeSeconds - previous.timeSeconds);
        crossings.push({ riderId, crossedAtSeconds: roundTime(time, config.timeRounding) });
        break;
      }
    }
  }

  return crossings.toSorted((left, right) => {
    const timeDifference = left.crossedAtSeconds - right.crossedAtSeconds;
    return timeDifference === 0 ? left.riderId.localeCompare(right.riderId) : timeDifference;
  });
}
