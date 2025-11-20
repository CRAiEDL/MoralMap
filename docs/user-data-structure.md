# User Data JSON Structure

Each participant's progress is persisted as a single JSON document stored under the key `user-data:<sessionId>`. The document captures the scenarios that were shown to the participant, their routing decisions, and their responses to the post-experience survey.

## Top-level fields

| Field | Type | Description |
| ----- | ---- | ----------- |
| `sessionId` | `string` | Unique identifier assigned to the participant when the session starts. |
| `createdAt` | ISO timestamp | When the session record was created. |
| `lastUpdatedAt` | ISO timestamp | When any part of the session record was last updated. |
| `totalScenarios` | `number` | How many scenarios were scheduled for the participant. |
| `scenarios` | `ScenarioEntry[]` | Ordered list describing each presented scenario and the participant's choice. Empty slots may be `null` if the user did not reach that scenario. |
| `surveyResponses` | `object` | Normalized answers submitted via the survey form. Only present after completion. |
| `completedAt` | ISO timestamp (optional) | Set once the survey is submitted. |

## Scenario entries

Each element of `scenarios` is an object with the following shape:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `index` | `number` | Zero-based position of the scenario in the flow. |
| `presentedAt` | ISO timestamp | When the scenario was first presented (captured when the choice was logged). |
| `details` | `object` | Snapshot of the scenario content that was rendered for the participant (start/end points, default travel time, alternatives, etc.). |
| `choice` | `object` | Metadata describing the participant's selection for this scenario. |

The `details` object contains the same fields that were delivered to the client (scenario name, `start`, `end`, `defaultTime`, `defaultRouteTitle`, `defaultRouteDescription`, `alternatives`, etc.). Undefined values are omitted.

The `choice` object includes:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `label` | `string` | Identifier for the selected route ("default" or the alternative's label). |
| `routeIndex` | `number` | Index of the selection (0 for default, `n` for the nth alternative). |
| `isDefault` | `boolean` | Convenience flag indicating whether the default route was chosen. |
| `defaultTime` | `number` | Default route travel time in minutes. |
| `tts` | `number` | Delta in minutes relative to the default route for the chosen alternative. Zero for the default route. |
| `totalTimeMinutes` | `number` | Travel time of the selected route (`defaultTime + tts`). |
| `recordedAt` | ISO timestamp | When the choice was submitted. |
| `selectedAlternative` | `object \| null` | Snapshot of the chosen alternative from `details.alternatives`. Only present when an alternative route was selected. |

## Example document

```json
{
  "sessionId": "1f5d8ab3-3b04-4fb0-9a6f-4c6f8f1d9b21",
  "createdAt": "2024-05-20T14:03:11.482Z",
  "lastUpdatedAt": "2024-05-20T14:08:55.901Z",
  "totalScenarios": 2,
  "scenarios": [
    {
      "index": 0,
      "presentedAt": "2024-05-20T14:04:02.113Z",
      "details": {
        "scenarioName": "Morning Commute",
        "defaultRouteTitle": "Time Efficient Route",
        "defaultRouteDescription": "The default route prioritizes safety and takes about 25 minutes.",
        "start": [40.712776, -74.005974],
        "end": [40.758896, -73.98513],
        "defaultTime": 25,
        "alternatives": [
          {
            "middle": [40.741112, -73.989723],
            "tts": 5,
            "totalTimeMinutes": 30,
            "label": "Scenic detour",
            "description": "Adds a stop by the park for a calmer ride.",
            "preselected": false
          },
          {
            "middle": [40.73061, -73.935242],
            "tts": -2,
            "totalTimeMinutes": 23,
            "label": "Express lane",
            "description": "Prioritizes faster travel with heavier traffic.",
            "preselected": true
          }
        ]
      },
      "choice": {
        "label": "Express lane",
        "routeIndex": 2,
        "isDefault": false,
        "defaultTime": 25,
        "tts": -2,
        "totalTimeMinutes": 23,
        "recordedAt": "2024-05-20T14:05:36.722Z",
        "selectedAlternative": {
          "middle": [40.73061, -73.935242],
          "tts": -2,
          "totalTimeMinutes": 23,
          "label": "Express lane",
          "description": "Prioritizes faster travel with heavier traffic.",
          "preselected": true
        }
      }
    },
    {
      "index": 1,
      "presentedAt": "2024-05-20T14:07:14.508Z",
      "details": {
        "scenarioName": "School Drop-off",
        "defaultRouteTitle": "Time Efficient Route",
        "defaultRouteDescription": "The default route prioritizes safety and takes about 18 minutes.",
        "start": [40.678178, -73.944158],
        "end": [40.650002, -73.949997],
        "defaultTime": 18,
        "alternatives": [
          {
            "middle": [40.662942, -73.973016],
            "tts": 4,
            "totalTimeMinutes": 22,
            "label": "Playground stop",
            "description": "Includes a quick break near the playground.",
            "preselected": false
          }
        ]
      },
      "choice": {
        "label": "default",
        "routeIndex": 0,
        "isDefault": true,
        "defaultTime": 18,
        "tts": 0,
        "totalTimeMinutes": 18,
        "recordedAt": "2024-05-20T14:08:55.901Z"
      }
    }
  ],
  "surveyResponses": {
    "age_range": "25-34",
    "commute_frequency": "Daily",
    "feedback": "Loved the alternate route options!",
    "values": ["Safety", "Community"],
    "zipcode": "11215"
  },
  "completedAt": "2024-05-20T14:08:55.901Z"
}
```
