import { useMemo } from "react";

export interface BoardSnapshotNote {
  id: string;
  text: string;
  xCoord: number;
  yCoord: number;
  zone?: string;
  color: string;
}

export interface StarshipLabels {
  thrust: string;
  destination: string;
  drag: string;
}

export interface MatrixLabels {
  xAxis: string;
  yAxis: string;
}

export interface BoardSnapshotProps {
  type: "starship" | "matrix";
  notes: BoardSnapshotNote[];
  starshipLabels?: StarshipLabels;
  matrixLabels?: MatrixLabels;
  title?: string;
}

const ZONE_COLORS = {
  thrust: "rgba(59,130,246,0.10)",
  destination: "rgba(16,185,129,0.10)",
  drag: "rgba(239,68,68,0.10)",
};
const ZONE_BORDER = {
  thrust: "rgba(59,130,246,0.30)",
  destination: "rgba(16,185,129,0.30)",
  drag: "rgba(239,68,68,0.30)",
};
const ZONE_LABEL_COLOR = {
  thrust: "text-blue-500",
  destination: "text-emerald-500",
  drag: "text-red-500",
};

export default function BoardSnapshot({
  type,
  notes,
  starshipLabels,
  matrixLabels,
  title,
}: BoardSnapshotProps) {
  const boardTitle =
    title ?? (type === "starship" ? "Starship Board" : "Priority Matrix");

  const normalizedNotes = useMemo(
    () =>
      notes.map((n) => ({
        ...n,
        xCoord: n.xCoord <= 1 ? n.xCoord * 100 : n.xCoord,
        yCoord: n.yCoord <= 1 ? n.yCoord * 100 : n.yCoord,
      })),
    [notes]
  );

  const labels: StarshipLabels = starshipLabels ?? {
    thrust: "Propulsion",
    destination: "Destinations",
    drag: "Black Holes",
  };
  const mLabels: MatrixLabels = matrixLabels ?? {
    xAxis: "Impact",
    yAxis: "Effort",
  };

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-muted-foreground">{boardTitle}</h4>
      {type === "starship" ? (
        <StarshipSnapshot notes={normalizedNotes} labels={labels} />
      ) : (
        <MatrixSnapshot notes={normalizedNotes} labels={mLabels} />
      )}
      <p className="text-xs text-muted-foreground">{normalizedNotes.length} note{normalizedNotes.length !== 1 ? "s" : ""} placed</p>
    </div>
  );
}

function StarshipSnapshot({
  notes,
  labels,
}: {
  notes: BoardSnapshotNote[];
  labels: StarshipLabels;
}) {
  return (
    <div
      className="relative w-full rounded-md overflow-hidden border bg-background"
      style={{ paddingTop: "56.25%" }}
      aria-label="Starship board snapshot"
    >
      <div className="absolute inset-0">
        {/* Thrust zone: upper-left (x < 60, y < 60) */}
        <div
          className="absolute"
          style={{
            left: 0,
            top: 0,
            width: "60%",
            height: "60%",
            background: ZONE_COLORS.thrust,
            borderRight: `1px dashed ${ZONE_BORDER.thrust}`,
            borderBottom: `1px dashed ${ZONE_BORDER.thrust}`,
          }}
        >
          <span className={`absolute top-1 left-2 text-xs font-medium ${ZONE_LABEL_COLOR.thrust} opacity-80 pointer-events-none select-none`}>
            {labels.thrust}
          </span>
        </div>

        {/* Destination zone: right (x >= 60) */}
        <div
          className="absolute"
          style={{
            left: "60%",
            top: 0,
            width: "40%",
            height: "100%",
            background: ZONE_COLORS.destination,
            borderLeft: `1px dashed ${ZONE_BORDER.destination}`,
          }}
        >
          <span className={`absolute top-1 right-2 text-xs font-medium ${ZONE_LABEL_COLOR.destination} opacity-80 pointer-events-none select-none`}>
            {labels.destination}
          </span>
        </div>

        {/* Drag zone: lower-left (x < 60, y >= 60) */}
        <div
          className="absolute"
          style={{
            left: 0,
            top: "60%",
            width: "60%",
            height: "40%",
            background: ZONE_COLORS.drag,
            borderRight: `1px dashed ${ZONE_BORDER.drag}`,
            borderTop: `1px dashed ${ZONE_BORDER.drag}`,
          }}
        >
          <span className={`absolute bottom-1 left-2 text-xs font-medium ${ZONE_LABEL_COLOR.drag} opacity-80 pointer-events-none select-none`}>
            {labels.drag}
          </span>
        </div>

        {/* Notes */}
        {notes.map((note) => (
          <NoteChip
            key={note.id}
            note={note}
            left={note.xCoord}
            top={note.yCoord}
          />
        ))}
      </div>
    </div>
  );
}

function MatrixSnapshot({
  notes,
  labels,
}: {
  notes: BoardSnapshotNote[];
  labels: MatrixLabels;
}) {
  return (
    <div
      className="relative w-full rounded-md overflow-hidden border bg-background"
      style={{ paddingTop: "56.25%" }}
      aria-label="Priority matrix snapshot"
    >
      <div className="absolute inset-0">
        {/* Quadrant lines */}
        <div
          className="absolute top-0 bottom-0 bg-border"
          style={{ left: "50%", width: "1px" }}
        />
        <div
          className="absolute left-0 right-0 bg-border"
          style={{ top: "50%", height: "1px" }}
        />

        {/* Quadrant labels */}
        <span className="absolute top-1 left-2 text-xs text-muted-foreground pointer-events-none select-none">
          Low {labels.xAxis} / High {labels.yAxis}
        </span>
        <span className="absolute top-1 right-2 text-xs text-muted-foreground pointer-events-none select-none text-right">
          High {labels.xAxis} / High {labels.yAxis}
        </span>
        <span className="absolute bottom-1 left-2 text-xs text-muted-foreground pointer-events-none select-none">
          Low {labels.xAxis} / Low {labels.yAxis}
        </span>
        <span className="absolute bottom-1 right-2 text-xs text-muted-foreground pointer-events-none select-none text-right">
          High {labels.xAxis} / Low {labels.yAxis}
        </span>

        {/* Notes — matrix yCoord: 0=bottom, 100=top → screen top = 100-y */}
        {notes.map((note) => (
          <NoteChip
            key={note.id}
            note={note}
            left={note.xCoord}
            top={100 - note.yCoord}
          />
        ))}
      </div>
    </div>
  );
}

function NoteChip({
  note,
  left,
  top,
}: {
  note: BoardSnapshotNote;
  left: number;
  top: number;
}) {
  const shortText =
    note.text.length > 30 ? note.text.slice(0, 30) + "…" : note.text;

  return (
    <div
      className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
      style={{ left: `${left}%`, top: `${top}%` }}
      title={note.text}
    >
      <div
        className="rounded px-1.5 py-0.5 text-white text-[10px] leading-tight max-w-[80px] truncate shadow-sm"
        style={{ backgroundColor: note.color, fontSize: "9px" }}
      >
        {shortText}
      </div>
    </div>
  );
}
