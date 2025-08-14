export const AppState = {
  screen: "home",                // "home" | "play" | "result"
  scenarios: [],                 // loaded from JSON
  selectedScenarioId: null,
  currentStepIndex: 0,
  score: 0,
  timer: null,
  timeLeft: 0,
  session: { steps: [] },        // [{stepId, optionId, delta, timeRemaining}]
};

export function resetSession() {
  AppState.currentStepIndex = 0;
  AppState.score = 0;
  AppState.timeLeft = 0;
  AppState.session = { steps: [] };
}
