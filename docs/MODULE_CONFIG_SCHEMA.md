# Module Configuration Schema

This document defines the expected structure of the `config` JSONB field in the `workspace_modules` table for each module type.

## Module Types

### 1. ideation
No specific config required. Uses default workspace settings.

```json
{}
```

### 2. pairwise (Pairwise Voting)
```json
{
  "scope": "all" | "within_categories",
  "description": "Whether to compare all ideas or only within same category"
}
```

### 3. ranking (Stack Ranking)
No specific config required.

```json
{}
```

### 4. marketplace (Marketplace Allocation)
```json
{
  "coinBudget": number,
  "description": "Number of coins each participant gets to allocate"
}
```

### 5. survey (Survey Rating)
Questions are stored in `survey_questions` table. No config needed.

```json
{}
```

### 6. priority_matrix (2x2 Grid)
```json
{
  "xAxisLabel": string,
  "yAxisLabel": string,
  "xMin": string,
  "xMax": string,
  "yMin": string,
  "yMax": string,
  "snapToGrid": boolean,
  "gridSize": number
}
```

**Example:**
```json
{
  "xAxisLabel": "Impact",
  "yAxisLabel": "Effort",
  "xMin": "Low",
  "xMax": "High",
  "yMin": "Low",
  "yMax": "High",
  "snapToGrid": false,
  "gridSize": 4
}
```

## Migration Notes

### Backfill Status
- ✅ Created new tables: `ideas`, `idea_contributions`, `workspace_modules`, `workspace_module_runs`, `priority_matrices`, `priority_matrix_positions`
- ✅ Backfilled 113 notes → ideas table
- ✅ Created 113 idea_contributions records

### Next Steps for Module Integration
1. Update existing module tables (`votes`, `rankings`, `marketplaceAllocations`, `surveyResponses`) to add `ideaId` column
2. Create backward compatibility layer that maps `noteId` → `ideaId` in API responses
3. Update frontend components to use `ideaId` instead of `noteId`
4. Create default `workspace_modules` records for existing workspaces based on their phase timestamps
