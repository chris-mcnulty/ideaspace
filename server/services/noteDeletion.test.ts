import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { notes, surveyResponses } from "../../shared/schema";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  delete: vi.fn(),
  where: vi.fn(),
}));
vi.mock("../db", () => ({ db: { transaction: mocks.transaction }, pool: {} }));
const { DbStorage } = await import("../storage");
const storage = new DbStorage();
const NOTE_ID = "33333333-3333-3333-3333-333333333333";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async callback => callback({ delete: mocks.delete }));
  mocks.delete.mockReturnValue({ where: mocks.where });
  mocks.where.mockResolvedValue({ rowCount: 1 });
});

describe("atomic note deletion", () => {
  it("cleans up only the target note's survey responses before deleting the note", async () => {
    expect(await storage.deleteNote(NOTE_ID)).toBe(true);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.delete.mock.calls.map(call => call[0])).toEqual([surveyResponses, notes]);
    const dialect = new PgDialect();
    const filters = mocks.where.mock.calls.map(call => dialect.sqlToQuery(call[0]));
    expect(filters.map(filter => filter.params)).toEqual([[NOTE_ID], [NOTE_ID]]);
    expect(filters[0].sql).toContain('"survey_responses"."note_id"');
    expect(filters[1].sql).toContain('"notes"."id"');
  });

  it("returns false when no note is deleted", async () => {
    mocks.where.mockResolvedValueOnce({ rowCount: 0 }).mockResolvedValueOnce({ rowCount: 0 });
    expect(await storage.deleteNote(NOTE_ID)).toBe(false);
  });

  it("does not delete the note when dependent cleanup fails", async () => {
    mocks.where.mockRejectedValueOnce(new Error("cleanup failed"));
    await expect(storage.deleteNote(NOTE_ID)).rejects.toThrow("cleanup failed");
    expect(mocks.delete).toHaveBeenCalledTimes(1);
  });

  it("propagates note deletion failure so the transaction rolls back", async () => {
    mocks.where.mockResolvedValueOnce({ rowCount: 1 }).mockRejectedValueOnce(new Error("delete failed"));
    await expect(storage.deleteNote(NOTE_ID)).rejects.toThrow("delete failed");
  });
});