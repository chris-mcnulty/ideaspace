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