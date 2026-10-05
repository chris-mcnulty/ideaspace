import { beforeEach, describe, expect, it, vi } from "vitest";
import { signalActivities } from "../../shared/schema";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(), select: vi.fn(), from: vi.fn(), whereSelect: vi.fn(),
  orderBy: vi.fn(), lock: vi.fn(), update: vi.fn(), set: vi.fn(),
  whereUpdate: vi.fn(), returning: vi.fn(),
}));
vi.mock("../db", () => ({ db: { transaction: mocks.transaction }, pool: {} }));
const { DbStorage } = await import("../storage");
const storage = new DbStorage();
const current = ["a", "b", "c"].map((id, orderIndex) => ({
  id, deckId: "deck", orderIndex, prompt: `Question ${id}`,
  status: id === "b" ? "live" : "draft", config: { min: 0, max: 10 },
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async callback => callback({
    select: mocks.select, update: mocks.update,
  }));
  mocks.select.mockReturnValue({ from: mocks.from });
  mocks.from.mockReturnValue({ where: mocks.whereSelect });
  mocks.whereSelect.mockReturnValue({ orderBy: mocks.orderBy });
  mocks.orderBy.mockReturnValue({ for: mocks.lock });
  mocks.lock.mockResolvedValue(current);
  mocks.update.mockReturnValue({ set: mocks.set });
  mocks.set.mockReturnValue({ where: mocks.whereUpdate });
  mocks.whereUpdate.mockReturnValue({ returning: mocks.returning });
  mocks.returning.mockResolvedValue([current[0]]);
});

describe("atomic Signal reordering", () => {
  it("locks the deck activities and updates only their order and timestamp", async () => {
    mocks.returning.mockResolvedValueOnce([{ ...current[2], orderIndex: 0 }])
      .mockResolvedValueOnce([{ ...current[0], orderIndex: 1 }])
      .mockResolvedValueOnce([{ ...current[1], orderIndex: 2 }]);
    const result = await storage.reorderSignalActivities("deck", ["c", "a", "b"]);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.lock).toHaveBeenCalledWith("update");
    expect(mocks.update.mock.calls.map(call => call[0])).toEqual([
      signalActivities, signalActivities, signalActivities,
    ]);
    expect(mocks.set.mock.calls.map(call => call[0])).toEqual(
      [0, 1, 2].map(orderIndex => ({ orderIndex, updatedAt: expect.any(Date) })),
    );
    expect(result?.map(activity => activity.id)).toEqual(["c", "a", "b"]);
    expect(result?.[2]).toMatchObject({ id: "b", status: "live", config: current[1].config });
  });

  it.each([{ ids: ["a", "a", "b"] }, { ids: ["a", "b"] }, { ids: ["a", "b", "foreign"] }])(
    "does not change anything for an incomplete, duplicate, or foreign list %j",
    async ({ ids }) => {
      expect(await storage.reorderSignalActivities("deck", ids)).toBeUndefined();
      expect(mocks.update).not.toHaveBeenCalled();
    },
  );

  it("propagates a failed update so the transaction rolls back", async () => {
    mocks.returning.mockResolvedValueOnce([current[0]]).mockRejectedValueOnce(new Error("update failed"));
    await expect(storage.reorderSignalActivities("deck", ["c", "a", "b"])).rejects.toThrow("update failed");
    expect(mocks.update).toHaveBeenCalledTimes(2);
  });
});
