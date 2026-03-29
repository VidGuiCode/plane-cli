# Plane API Reference

Source: https://developers.plane.so/api-reference/introduction
Captured: 2026-03-27

---

## Authentication

**API Key (personal access token):**
```
X-API-Key: <your-token>
```
Generate at: Profile Settings → Personal Access Tokens

**OAuth Bearer token:**
```
Authorization: Bearer <token>
```

---

## Base URL

| Instance | Base URL |
|---|---|
| Cloud | `https://api.plane.so` |
| Self-hosted | `https://<your-domain>` |

All paths below are relative to the base URL.

---

## Rate Limits

- 60 requests per minute per API key
- `X-RateLimit-Remaining` — requests left in window
- `X-RateLimit-Reset` — Unix timestamp for window reset

---

## Pagination

Cursor-based pagination. Format: `value:offset:is_prev`

| Parameter | Description |
|---|---|
| `per_page` | Results per page (default 100, max 100) |
| `cursor` | Cursor for next/prev page |

Response fields: `total_results`, `results`, `next_cursor`, `prev_cursor`, `next_page_results`, `prev_page_results`

---

## Workspaces

Not in the public docs but confirmed in Plane source (`apiserver/plane/app/urls/workspace.py`):

```
GET    /api/v1/workspaces/              List all workspaces for the token
GET    /api/v1/workspaces/{slug}/       Get workspace detail
PATCH  /api/v1/workspaces/{slug}/       Update workspace
DELETE /api/v1/workspaces/{slug}/       Delete workspace
```

### Key response fields
| Field | Description |
|---|---|
| `id` | UUID |
| `name` | Display name |
| `slug` | Used in all API paths (e.g. `cylro`) |
| `logo` | Workspace logo URL |
| `created_at` / `updated_at` | Timestamps |

### CLI automation flow
`plane login` does:
1. Ask for base URL + token only (or `--url`/`--token` flags for non-interactive use)
2. Call `GET /api/v1/workspaces/` to discover workspaces automatically
3. If one result → set it automatically
4. If multiple → prompt user to pick one
5. Store slug in account — no manual slug entry needed

---

## Members

```
GET    /api/v1/workspaces/{slug}/members/               List workspace members
GET    /api/v1/workspaces/{slug}/projects/{project_id}/members/   List project members
```

---

## Projects

```
POST   /api/v1/workspaces/{slug}/projects/              Create project
GET    /api/v1/workspaces/{slug}/projects/              List projects
GET    /api/v1/workspaces/{slug}/projects/{project_id}/ Get project
PATCH  /api/v1/workspaces/{slug}/projects/{project_id}/ Update project
DELETE /api/v1/workspaces/{slug}/projects/{project_id}/ Delete project
POST   /api/v1/workspaces/{slug}/projects/{project_id}/archive/    Archive project
POST   /api/v1/workspaces/{slug}/projects/{project_id}/unarchive/  Unarchive project
```

---

## States

```
POST   /api/v1/workspaces/{slug}/projects/{project_id}/states/              Create state
GET    /api/v1/workspaces/{slug}/projects/{project_id}/states/              List states
GET    /api/v1/workspaces/{slug}/projects/{project_id}/states/{state_id}/   Get state
PATCH  /api/v1/workspaces/{slug}/projects/{project_id}/states/{state_id}/   Update state
DELETE /api/v1/workspaces/{slug}/projects/{project_id}/states/{state_id}/   Delete state
```

---

## Work Items (Issues)

```
POST   /api/v1/workspaces/{slug}/projects/{project_id}/work-items/                          Create work item
GET    /api/v1/workspaces/{slug}/projects/{project_id}/work-items/                          List work items
GET    /api/v1/workspaces/{slug}/projects/{project_id}/work-items/{work_item_id}/           Get work item
PATCH  /api/v1/workspaces/{slug}/projects/{project_id}/work-items/{work_item_id}/           Update work item
DELETE /api/v1/workspaces/{slug}/projects/{project_id}/work-items/{work_item_id}/           Delete work item
GET    /api/v1/workspaces/{slug}/projects/{project_id}/work-items/search/                   Search work items
POST   /api/v1/workspaces/{slug}/projects/{project_id}/work-items/advanced-search/          Advanced search
GET    /api/v1/workspaces/{slug}/projects/{project_id}/work-items/identifier/{sequence_id}/ Get by sequence ID
```

### Work Item query params
| Param | Description |
|---|---|
| `order_by` | Field to sort by |
| `per_page` | Results per page |
| `cursor` | Pagination cursor |
| `expand` | Expand related fields |
| `fields` | Limit returned fields |

---

## Comments

```
POST   /api/v1/workspaces/{slug}/projects/{project_id}/work-items/{issue_id}/comments/                   Add comment
GET    /api/v1/workspaces/{slug}/projects/{project_id}/work-items/{issue_id}/comments/                   List comments
GET    /api/v1/workspaces/{slug}/projects/{project_id}/work-items/{issue_id}/comments/{comment_id}/      Get comment
PATCH  /api/v1/workspaces/{slug}/projects/{project_id}/work-items/{issue_id}/comments/{comment_id}/      Update comment
DELETE /api/v1/workspaces/{slug}/projects/{project_id}/work-items/{issue_id}/comments/{comment_id}/      Delete comment
```

### Comment body fields
| Field | Description |
|---|---|
| `comment_html` | HTML content |
| `comment_json` | JSON content |
| `access` | Visibility (`INTERNAL` / `EXTERNAL`) |
| `parent` | Parent comment ID (for threads) |

---

## Labels

```
POST   /api/v1/workspaces/{slug}/projects/{project_id}/labels/              Create label
GET    /api/v1/workspaces/{slug}/projects/{project_id}/labels/              List labels
GET    /api/v1/workspaces/{slug}/projects/{project_id}/labels/{label_id}/   Get label
PATCH  /api/v1/workspaces/{slug}/projects/{project_id}/labels/{label_id}/   Update label
DELETE /api/v1/workspaces/{slug}/projects/{project_id}/labels/{label_id}/   Delete label
```

### Label fields
`id`, `name`, `color`, `description`

---

## Modules

```
POST   /api/v1/workspaces/{slug}/projects/{project_id}/modules/                         Create module
GET    /api/v1/workspaces/{slug}/projects/{project_id}/modules/                         List modules
GET    /api/v1/workspaces/{slug}/projects/{project_id}/modules/{module_id}/             Get module
PATCH  /api/v1/workspaces/{slug}/projects/{project_id}/modules/{module_id}/             Update module
DELETE /api/v1/workspaces/{slug}/projects/{project_id}/modules/{module_id}/             Delete module
POST   /api/v1/workspaces/{slug}/projects/{project_id}/modules/{module_id}/archive/     Archive module
POST   /api/v1/workspaces/{slug}/projects/{project_id}/modules/{module_id}/unarchive/   Unarchive module
GET    /api/v1/workspaces/{slug}/projects/{project_id}/modules/archived/                List archived modules
```

### Module Work Items

```
POST   /api/v1/workspaces/{slug}/projects/{project_id}/modules/{module_id}/module-issues/                    Add work items to module
GET    /api/v1/workspaces/{slug}/projects/{project_id}/modules/{module_id}/module-issues/                    List module work items
DELETE /api/v1/workspaces/{slug}/projects/{project_id}/modules/{module_id}/module-issues/{issue_id}/         Remove work item from module
```

---

## Cycles

```
POST   /api/v1/workspaces/{slug}/projects/{project_id}/cycles/                          Create cycle
GET    /api/v1/workspaces/{slug}/projects/{project_id}/cycles/                          List cycles
GET    /api/v1/workspaces/{slug}/projects/{project_id}/cycles/{cycle_id}/               Get cycle
PATCH  /api/v1/workspaces/{slug}/projects/{project_id}/cycles/{cycle_id}/               Update cycle
DELETE /api/v1/workspaces/{slug}/projects/{project_id}/cycles/{cycle_id}/               Delete cycle
POST   /api/v1/workspaces/{slug}/projects/{project_id}/cycles/{cycle_id}/archive/       Archive cycle
POST   /api/v1/workspaces/{slug}/projects/{project_id}/cycles/{cycle_id}/unarchive/     Unarchive cycle
GET    /api/v1/workspaces/{slug}/projects/{project_id}/cycles/archived/                 List archived cycles
```

### Cycle Work Items

```
POST   /api/v1/workspaces/{slug}/projects/{project_id}/cycles/{cycle_id}/issues/                    Add work items to cycle
GET    /api/v1/workspaces/{slug}/projects/{project_id}/cycles/{cycle_id}/issues/                    List cycle work items
DELETE /api/v1/workspaces/{slug}/projects/{project_id}/cycles/{cycle_id}/issues/{issue_id}/         Remove work item from cycle
POST   /api/v1/workspaces/{slug}/projects/{project_id}/cycles/{cycle_id}/transfer/                  Transfer work items to another cycle
```

---

## Attachments

```
POST   /api/v1/workspaces/{slug}/projects/{project_id}/work-items/{issue_id}/attachments/              Upload attachment
GET    /api/v1/workspaces/{slug}/projects/{project_id}/work-items/{issue_id}/attachments/              List attachments
DELETE /api/v1/workspaces/{slug}/projects/{project_id}/work-items/{issue_id}/attachments/{asset_id}/   Delete attachment
```

---

## Links

```
POST   /api/v1/workspaces/{slug}/projects/{project_id}/work-items/{issue_id}/links/              Add link
GET    /api/v1/workspaces/{slug}/projects/{project_id}/work-items/{issue_id}/links/              List links
PATCH  /api/v1/workspaces/{slug}/projects/{project_id}/work-items/{issue_id}/links/{link_id}/   Update link
DELETE /api/v1/workspaces/{slug}/projects/{project_id}/work-items/{issue_id}/links/{link_id}/   Delete link
```

---

## Activity

```
GET    /api/v1/workspaces/{slug}/projects/{project_id}/work-items/{issue_id}/activities/   List work item activity
```

---

## User

```
GET    /api/v1/users/me/   Get current user profile
```

---

## Intake (Triage)

```
POST   /api/v1/workspaces/{slug}/projects/{project_id}/intake-issues/               Create intake issue
GET    /api/v1/workspaces/{slug}/projects/{project_id}/intake-issues/               List intake issues
GET    /api/v1/workspaces/{slug}/projects/{project_id}/intake-issues/{issue_id}/    Get intake issue
PATCH  /api/v1/workspaces/{slug}/projects/{project_id}/intake-issues/{issue_id}/    Update intake issue
DELETE /api/v1/workspaces/{slug}/projects/{project_id}/intake-issues/{issue_id}/    Delete intake issue
```

---

## Pages

```
POST   /api/v1/workspaces/{slug}/projects/{project_id}/pages/              Create page
GET    /api/v1/workspaces/{slug}/projects/{project_id}/pages/              List pages
GET    /api/v1/workspaces/{slug}/projects/{project_id}/pages/{page_id}/    Get page
PATCH  /api/v1/workspaces/{slug}/projects/{project_id}/pages/{page_id}/    Update page
DELETE /api/v1/workspaces/{slug}/projects/{project_id}/pages/{page_id}/    Delete page
```

---

## Notes

- `{slug}` = workspace slug (found in your Plane URL, e.g. `my-team` from `app.plane.so/my-team/`)
- `{project_id}` = project UUID
- Self-hosted instances use the same API paths, just with your own base URL
- All responses are JSON
- Standard HTTP status codes: 200/201 success, 400 bad request, 401 unauthorized, 404 not found, 429 rate limited

---

## API Style Differences: Self-Hosted vs Cloud

The path segment for issues differs between editions:

| Edition | Path segment |
|---|---|
| Self-hosted community (e.g. `notes.cylro.com`) | `/issues/` |
| Plane cloud (newer API) | `/work-items/` |

Example:
```
# Self-hosted
GET https://notes.cylro.com/api/v1/workspaces/{slug}/projects/{id}/issues/

# Cloud
GET https://api.plane.so/api/v1/workspaces/{slug}/projects/{id}/work-items/
```

### Auto-detection strategy

During `plane login`, after verifying the token, both paths are probed and the result stored in the account as `apiStyle: "issues" | "work-items"`. The API client resolves the correct path internally via `issuesSegment()` — commands never reference `issues` or `work-items` directly.

```json
{
  "name": "cylro",
  "baseUrl": "https://notes.cylro.com",
  "token": "...",
  "apiStyle": "issues"
}
```
