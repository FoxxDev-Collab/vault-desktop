import { useState, useMemo, useCallback } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { Plus, X, MoreHorizontal, GripVertical, Tag, Calendar, User } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

interface Card {
  id: string;
  title: string;
  description?: string;
  labels?: string[];
  dueDate?: string;
  assignee?: string;
}

interface Column {
  id: string;
  title: string;
  cards: Card[];
  color?: string;
}

interface KanbanConfig {
  title: string;
  columns: Column[];
}

interface KanbanBoardProps {
  content: string;
  onChange?: (content: string) => void;
  readOnly?: boolean;
}

// Label colors
const LABEL_COLORS: Record<string, string> = {
  bug: "bg-red-500/20 text-red-400 border-red-500/30",
  feature: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  urgent: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  documentation: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  enhancement: "bg-green-500/20 text-green-400 border-green-500/30",
  default: "bg-muted text-muted border-app",
};

// Column header colors
const COLUMN_COLORS = [
  "border-t-blue-500",
  "border-t-yellow-500",
  "border-t-green-500",
  "border-t-purple-500",
  "border-t-pink-500",
  "border-t-cyan-500",
];

// Parse kanban config from markdown/JSON
function parseKanbanConfig(content: string): KanbanConfig | null {
  try {
    // Try parsing as JSON first
    if (content.trim().startsWith("{")) {
      return JSON.parse(content);
    }

    // Try extracting JSON from markdown code block
    const jsonMatch = content.match(/```(?:json|kanban)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // Parse Obsidian-style kanban format
    // ## Column Name
    // - [ ] Task
    // - [x] Completed task
    const lines = content.split("\n");
    const columns: Column[] = [];
    let currentColumn: Column | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Column header
      if (trimmed.startsWith("## ")) {
        if (currentColumn) columns.push(currentColumn);
        currentColumn = {
          id: uuidv4(),
          title: trimmed.slice(3).trim(),
          cards: [],
        };
        continue;
      }

      // Task item
      if (currentColumn && (trimmed.startsWith("- [ ]") || trimmed.startsWith("- [x]"))) {
        const isCompleted = trimmed.startsWith("- [x]");
        const taskText = trimmed.slice(6).trim();

        // Parse labels from #tags
        const labelMatches = taskText.match(/#(\w+)/g);
        const labels = labelMatches
          ? labelMatches.map((l) => l.slice(1))
          : undefined;

        // Parse due date from @date
        const dateMatch = taskText.match(/@(\d{4}-\d{2}-\d{2})/);
        const dueDate = dateMatch ? dateMatch[1] : undefined;

        // Clean title
        let title = taskText
          .replace(/#\w+/g, "")
          .replace(/@\d{4}-\d{2}-\d{2}/g, "")
          .trim();

        currentColumn.cards.push({
          id: uuidv4(),
          title,
          labels,
          dueDate,
        });
      }
    }

    if (currentColumn) columns.push(currentColumn);

    if (columns.length > 0) {
      return {
        title: "Kanban Board",
        columns,
      };
    }

    return null;
  } catch (e) {
    console.error("Failed to parse kanban config:", e);
    return null;
  }
}

// Serialize kanban config back to JSON
function serializeKanbanConfig(config: KanbanConfig): string {
  return JSON.stringify(config, null, 2);
}

// Sample kanban for new files
const SAMPLE_KANBAN: KanbanConfig = {
  title: "Project Board",
  columns: [
    {
      id: "backlog",
      title: "Backlog",
      cards: [
        {
          id: "1",
          title: "Research competitor features",
          description: "Analyze top 5 competitors",
          labels: ["research"],
        },
        {
          id: "2",
          title: "Write API documentation",
          labels: ["documentation"],
          dueDate: "2024-02-15",
        },
      ],
    },
    {
      id: "todo",
      title: "To Do",
      cards: [
        {
          id: "3",
          title: "Implement user authentication",
          description: "Add OAuth2 support",
          labels: ["feature"],
          dueDate: "2024-02-10",
        },
        {
          id: "4",
          title: "Fix login page styling",
          labels: ["bug"],
        },
      ],
    },
    {
      id: "in-progress",
      title: "In Progress",
      cards: [
        {
          id: "5",
          title: "Design dashboard UI",
          description: "Create mockups in Figma",
          labels: ["feature", "urgent"],
          assignee: "John",
        },
      ],
    },
    {
      id: "done",
      title: "Done",
      cards: [
        {
          id: "6",
          title: "Setup project repository",
          labels: ["enhancement"],
        },
        {
          id: "7",
          title: "Configure CI/CD pipeline",
        },
      ],
    },
  ],
};

function CardComponent({
  card,
  index,
  onEdit,
  onDelete,
  readOnly,
}: {
  card: Card;
  index: number;
  onEdit: (card: Card) => void;
  onDelete: (cardId: string) => void;
  readOnly: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <Draggable draggableId={card.id} index={index} isDragDisabled={readOnly}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`bg-card border border-app rounded-lg p-3 mb-2 group transition-shadow ${
            snapshot.isDragging ? "shadow-lg ring-2 ring-primary" : ""
          }`}
        >
          <div className="flex items-start gap-2">
            {!readOnly && (
              <div
                {...provided.dragHandleProps}
                className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab"
              >
                <GripVertical className="w-4 h-4 text-muted" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-medium text-app leading-snug">
                  {card.title}
                </h4>
                {!readOnly && (
                  <div className="relative">
                    <button
                      onClick={() => setShowMenu(!showMenu)}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:bg-accent rounded transition-all"
                    >
                      <MoreHorizontal className="w-4 h-4 text-muted" />
                    </button>
                    {showMenu && (
                      <div className="absolute right-0 top-full mt-1 bg-popover border border-app rounded-lg shadow-xl py-1 z-10 min-w-[120px]">
                        <button
                          onClick={() => {
                            onEdit(card);
                            setShowMenu(false);
                          }}
                          className="w-full px-3 py-1.5 text-left text-sm text-app hover:bg-accent"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            onDelete(card.id);
                            setShowMenu(false);
                          }}
                          className="w-full px-3 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {card.description && (
                <p className="text-xs text-muted mt-1 line-clamp-2">
                  {card.description}
                </p>
              )}

              {/* Labels */}
              {card.labels && card.labels.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {card.labels.map((label) => (
                    <span
                      key={label}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded border ${
                        LABEL_COLORS[label] || LABEL_COLORS.default
                      }`}
                    >
                      <Tag className="w-3 h-3" />
                      {label}
                    </span>
                  ))}
                </div>
              )}

              {/* Footer with due date and assignee */}
              {(card.dueDate || card.assignee) && (
                <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                  {card.dueDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {card.dueDate}
                    </span>
                  )}
                  {card.assignee && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {card.assignee}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

function ColumnComponent({
  column,
  index,
  onAddCard,
  onEditCard,
  onDeleteCard,
  onEditColumn,
  onDeleteColumn,
  readOnly,
}: {
  column: Column;
  index: number;
  onAddCard: (columnId: string) => void;
  onEditCard: (card: Card) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
  onEditColumn: (column: Column) => void;
  onDeleteColumn: (columnId: string) => void;
  readOnly: boolean;
}) {
  return (
    <div
      className={`flex-shrink-0 w-72 bg-sidebar rounded-xl border border-sidebar overflow-hidden border-t-4 ${
        COLUMN_COLORS[index % COLUMN_COLORS.length]
      }`}
    >
      {/* Column Header */}
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-app">{column.title}</h3>
          <span className="text-xs text-muted bg-muted px-2 py-0.5 rounded-full">
            {column.cards.length}
          </span>
        </div>
        {!readOnly && (
          <button
            onClick={() => onAddCard(column.id)}
            className="p-1 hover:bg-accent rounded transition-colors"
            title="Add card"
          >
            <Plus className="w-4 h-4 text-muted" />
          </button>
        )}
      </div>

      {/* Cards */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`p-2 min-h-[200px] transition-colors ${
              snapshot.isDraggingOver ? "bg-accent/30" : ""
            }`}
          >
            {column.cards.map((card, cardIndex) => (
              <CardComponent
                key={card.id}
                card={card}
                index={cardIndex}
                onEdit={onEditCard}
                onDelete={(cardId) => onDeleteCard(column.id, cardId)}
                readOnly={readOnly}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export function KanbanBoard({ content, onChange, readOnly = false }: KanbanBoardProps) {
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");

  const [config, setConfig] = useState<KanbanConfig>(() => {
    const parsed = parseKanbanConfig(content);
    if (!parsed && !content.trim()) {
      return SAMPLE_KANBAN;
    }
    return parsed || SAMPLE_KANBAN;
  });

  const updateConfig = useCallback(
    (newConfig: KanbanConfig) => {
      setConfig(newConfig);
      if (onChange) {
        onChange(serializeKanbanConfig(newConfig));
      }
    },
    [onChange]
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination } = result;

      if (!destination) return;
      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      ) {
        return;
      }

      const newColumns = [...config.columns];
      const sourceColumn = newColumns.find((c) => c.id === source.droppableId);
      const destColumn = newColumns.find((c) => c.id === destination.droppableId);

      if (!sourceColumn || !destColumn) return;

      const [movedCard] = sourceColumn.cards.splice(source.index, 1);
      destColumn.cards.splice(destination.index, 0, movedCard);

      updateConfig({ ...config, columns: newColumns });
    },
    [config, updateConfig]
  );

  const handleAddCard = useCallback(
    (columnId: string) => {
      if (!newCardTitle.trim()) {
        setAddingToColumn(columnId);
        return;
      }

      const newCard: Card = {
        id: uuidv4(),
        title: newCardTitle.trim(),
      };

      const newColumns = config.columns.map((col) =>
        col.id === columnId ? { ...col, cards: [...col.cards, newCard] } : col
      );

      updateConfig({ ...config, columns: newColumns });
      setNewCardTitle("");
      setAddingToColumn(null);
    },
    [config, newCardTitle, updateConfig]
  );

  const handleDeleteCard = useCallback(
    (columnId: string, cardId: string) => {
      const newColumns = config.columns.map((col) =>
        col.id === columnId
          ? { ...col, cards: col.cards.filter((c) => c.id !== cardId) }
          : col
      );

      updateConfig({ ...config, columns: newColumns });
    },
    [config, updateConfig]
  );

  const handleAddColumn = useCallback(() => {
    const newColumn: Column = {
      id: uuidv4(),
      title: "New Column",
      cards: [],
    };

    updateConfig({ ...config, columns: [...config.columns, newColumn] });
  }, [config, updateConfig]);

  return (
    <div className="h-full flex flex-col bg-app">
      {/* Header */}
      <div className="p-4 border-b border-app flex items-center justify-between">
        <h1 className="text-xl font-bold text-app">{config.title}</h1>
        {!readOnly && (
          <button
            onClick={handleAddColumn}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Column
          </button>
        )}
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-full pb-4">
            {config.columns.map((column, index) => (
              <ColumnComponent
                key={column.id}
                column={column}
                index={index}
                onAddCard={handleAddCard}
                onEditCard={setEditingCard}
                onDeleteCard={handleDeleteCard}
                onEditColumn={() => {}}
                onDeleteColumn={() => {}}
                readOnly={readOnly}
              />
            ))}
          </div>
        </DragDropContext>
      </div>

      {/* Add Card Modal */}
      {addingToColumn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-app rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-app mb-4">Add New Card</h3>
            <input
              type="text"
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              placeholder="Card title..."
              className="w-full px-4 py-2 bg-app border border-input rounded-lg text-app placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddCard(addingToColumn);
                if (e.key === "Escape") {
                  setAddingToColumn(null);
                  setNewCardTitle("");
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setAddingToColumn(null);
                  setNewCardTitle("");
                }}
                className="px-4 py-2 text-sm text-muted hover:text-app transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddCard(addingToColumn)}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors"
              >
                Add Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default KanbanBoard;
