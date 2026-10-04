import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isWorkspaceOpenForParticipation } from "../utils/workspaceParticipation";

test("Signal submissions accept Open and the active Signal phase", () => {
  for (const status of ["open", "signal", "signal-live", " SIGNAL ", " Open "]) {
    assert.equal(isWorkspaceOpenForParticipation(status), true, status);
  }
});

test("Signal submissions still reject inactive lifecycle states", () => {
  for (const status of ["closed", "draft", "processing", "archived", "", "unknown"]) {
    assert.equal(isWorkspaceOpenForParticipation(status), false, status);
  }
});

test("shared middleware participation policy retains its existing phase vocabulary", () => {
  for (const status of [
    "ideation", "ideate-live", "voting", "vote-round1", "ranking", "rank",
    "marketplace", "market", "survey", "priority-matrix", "priority",
    "staircase", "starship", "results",
  ]) {
    assert.equal(isWorkspaceOpenForParticipation(status), true, status);
  }
});

test("Priority Matrix and Staircase stay available through live status transitions", () => {
  for (const phase of ["priority-matrix", "staircase"]) {
    const transitions = [
      ["draft", false],
      ["open", true],
      [phase, true],
      [` ${phase.toUpperCase()}-live `, true],
      ["closed", false],
      ["archived", false],
      ["processing", false],
      ["unknown", false],
      ["", false],
    ] as const;
    for (const [status, expected] of transitions) {
      assert.equal(isWorkspaceOpenForParticipation(status), expected, `${phase}: ${status}`);
    }
  }
});