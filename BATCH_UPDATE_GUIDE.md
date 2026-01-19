# Batch Update Feature Guide

## Overview

The Prepress FMS Tool now supports batch editing with a visual update workflow. Users can edit multiple rows before committing changes to the database.

---

## How It Works

### 1. Edit Cells
- Click on any editable field in the table
- Type/select the new value
- The row and cell will be highlighted in **yellow** to indicate pending changes
- Repeat for as many rows as needed

### 2. Visual Feedback

**Modified Rows:**
- Yellow background with orange left border
- Hover effect changes to lighter yellow

**Modified Cells:**
- Yellow background with orange border
- 2px border width for emphasis

### 3. Update Actions Bar

When you modify any row, an actions bar appears at the bottom of the table:

```
┌────────────────────────────────────────────────────┐
│  📊 3 row(s) have unsaved changes                  │
│                                                    │
│  [Cancel Changes]  [💾 Update Database]           │
└────────────────────────────────────────────────────┘
```

**Features:**
- Shows count of modified rows
- Sticky to bottom (always visible when scrolling)
- Animated slide-up entrance
- Cannot be dismissed until you save or cancel

### 4. Save Changes

Click **"Update Database"** button:
1. Shows loading spinner
2. Sends all changes to backend API
3. Backend processes each row based on its source database:
   - `KOL_SQL` → Kolkata SQL Server
   - `AMD_SQL` → Ahmedabad SQL Server  
   - `MONGO_UNORDERED` → MongoDB collection
4. Applies business rules (auto-stamping dates, etc.)
5. Shows success/failure summary
6. Refreshes table data from server
7. Clears all highlights

### 5. Cancel Changes

Click **"Cancel Changes"** button:
- Confirms with dialog: "Discard changes to X row(s)?"
- If confirmed:
  - Clears all pending updates
  - Removes all highlights
  - Restores original values from server data
  - Hides update actions bar

---

## Editable Fields

### General Fields
- **File** (File Status)
- **File Received Date**

### Approval Fields
- **Soft Approval Reqd** (Yes/No dropdown)
- **Soft Approval Status** (Approved/Pending/Rejected)
- **Link of Soft Approval file**
- **Hard Approval Reqd** (Yes/No dropdown)
- **Hard Approval Status** (Approved/Pending/Rejected)
- **MProof Approval Reqd** (Yes/No dropdown)
- **MProof Approval Status** (Approved/Pending/Rejected)

### Person Assignments
- **Prepress Person**
- **Tooling Person**
- **Plate Person**

### Tooling/Plate Fields
- **Artwork Remark**
- **Tooling Die**
- **Tooling Block**
- **Tooling Remark**
- **Blanket** (REQUIRED/Required/DONE/Done)
- **Plate Output**
- **Plate Remark**

---

## API Integration

### Request Format

When you click "Update Database", the frontend sends one API call per modified row:

```json
{
  "__SourceDB": "KOL_SQL",
  "__Site": "KOLKATA",
  "OrderBookingDetailsID": 12345,
  "update": {
    "FileStatus": "Received",
    "SoftApprovalStatus": "Approved"
  }
}
```

### Parallel Processing

All updates are sent in parallel using `Promise.allSettled()`:
- Fast for multiple rows
- Failures don't block successes
- Individual error reporting per row

### Response Handling

The system shows:
- ✅ **Success count**: Number of rows updated successfully
- ❌ **Failure count**: Number of rows that failed
- **Error details**: SO/PWO number and error message for each failure

---

## Business Rules Applied Automatically

When you save changes, the backend automatically:

1. **FileStatus = "Received"**
   - Auto-stamps `FileReceivedDate` with current date
   - Calculates plan dates (Soft +2 days, Hard +4 days)

2. **Approval Reqd = "No"**
   - Auto-sets status to "Approved"
   - Stamps plan and actual dates

3. **All Approvals = "Approved"**
   - Sets `FinallyApproved` = "Yes"
   - Stamps `FinallyApprovedDate`
   - Sets `ToolingBlanketPlan` = FinallyApprovedDate

4. **Tooling Ready**
   - When Die=Ready, Block=Ready, Blanket=Ready
   - Auto-stamps `ToolingBlanketActual`

5. **Plate Output = "Done"**
   - Auto-stamps `PlateActual` (only once)

---

## State Management

### Frontend State

```javascript
state = {
  entries: [],           // All fetched data
  filteredEntries: [],   // Current view
  filters: {},           // Active filters
  currentView: 'pending',// pending/completed
  pendingUpdates: Map    // Tracked modifications
}
```

### Pending Updates Structure

```javascript
pendingUpdates.set(rowId, {
  entry: { /* full entry object */ },
  modifiedFields: Set(['file', 'softApprovalStatus']),
  updates: {
    file: 'Received',
    softApprovalStatus: 'Approved'
  }
});
```

---

## Error Handling

### Network Errors
- Loading spinner shown during save
- Error message displayed in alert
- No changes cleared (can retry)

### Validation Errors
- Individual row errors reported
- Successful rows are saved
- Failed rows remain highlighted
- Can fix and retry

### Mixed Database Sources
- Can edit KOL_SQL, AMD_SQL, and MONGO rows simultaneously
- Each row routed to correct database
- Independent success/failure per row

---

## Technical Details

### Files Modified

1. **`index.html`**
   - Added update actions bar HTML
   - SVG icons for visual appeal

2. **`styles.css`**
   - Modified row/cell highlighting (`.modified` class)
   - Update actions bar styling
   - Button styles (primary/secondary)
   - Slide-up animation

3. **`script.js`**
   - Added `state.pendingUpdates` Map
   - `trackRowModification()` function
   - `updateButtonState()` function
   - `saveAllPendingUpdates()` function
   - `cancelAllPendingUpdates()` function
   - Modified `handleCellEdit()` to track instead of save
   - Event listeners for Update/Cancel buttons

### Key Functions

- **`trackRowModification(rowId, entry, field, newValue)`**
  - Stores modification in state.pendingUpdates Map
  - Updates button state
  
- **`updateLocalDisplay(rowId, field, newValue)`**
  - Optimistic update of UI
  - Re-renders table with new values
  
- **`updateButtonState()`**
  - Shows/hides update actions bar
  - Enables/disables Update button
  - Updates count display
  
- **`saveAllPendingUpdates()`**
  - Builds payloads for each modified row
  - Maps field names (frontend → backend)
  - Maps person names → user keys
  - Sends parallel API requests
  - Processes results
  - Shows summary
  - Refreshes table
  
- **`cancelAllPendingUpdates()`**
  - Confirms with user
  - Clears all pending updates
  - Removes visual highlights
  - Re-renders from original data

### Field Mapping

Frontend → Backend:

| Frontend Field | Backend Field |
|---|---|
| `file` | `FileStatus` |
| `softApprovalLink` | `LinkofSoftApprovalfile` |
| `prepressPerson` | `EmployeeUserKey` |
| `toolingPerson` | `ToolingUserKey` |
| `platePerson` | `PlateUserKey` |

### Person Field Handling

Person fields (Prepress/Tooling/Plate) require special handling:

- **Display**: Shows display name (e.g., "Biswajit")
- **Backend**: Requires user key (e.g., "biswajit")
- **Mapping**: Uses `entry.__raw.EmployeeUserKey` from original data

---

## Testing Checklist

- [ ] Edit a single row → Update button appears
- [ ] Edit multiple rows → Counter shows correct number
- [ ] Modified rows have yellow highlight
- [ ] Modified cells have yellow background + orange border
- [ ] Click Update → Loading spinner appears
- [ ] Successful save → Table refreshes, highlights clear
- [ ] Click Cancel → Confirms before discarding
- [ ] Cancel → Highlights clear, values restore
- [ ] Edit SQL row → Saves to SQL database
- [ ] Edit Mongo row → Saves to MongoDB
- [ ] Edit mixed rows → All save correctly
- [ ] Network error → Error message shows
- [ ] Partial failure → Shows succeeded and failed counts

---

## Known Limitations

1. **Person field editing**: Currently sends userKey from original data, not the typed name
   - **Workaround**: Future enhancement to add user search/autocomplete

2. **No undo after save**: Once saved, changes are committed to database
   - **Workaround**: Manual correction required

3. **No auto-refresh**: Must manually refresh if another user updates same rows
   - **Future**: WebSocket for real-time updates

4. **Large batch performance**: 50+ rows may be slow
   - **Current**: All updates sent in parallel
   - **Future**: Batching API endpoint

---

## Keyboard Shortcuts (Future Enhancement)

Planned shortcuts:
- `Ctrl+S` - Save all pending updates
- `Ctrl+Z` - Cancel all changes
- `Esc` - Close update actions bar (after confirmation)

---

## Troubleshooting

### Update button doesn't appear
- Check browser console for errors
- Verify cell has `editable` class
- Check `data-id` attribute on row

### Highlights don't clear after save
- Check network tab for API response
- Verify `ok: true` in response
- Check console for JavaScript errors

### Changes don't save to database
- Check backend is running
- Verify API endpoint: `/api/artwork/pending/update`
- Check network tab for 500 errors
- Review backend logs

### Wrong values shown after save
- Check field mapping in `mapFieldToBackend()`
- Verify normalization in backend `applyRules()`
- Check `normalizePendingRow()` function

---

## Future Enhancements

1. **Validation before save**
   - Required field checking
   - Date range validation
   - Status transition rules

2. **User search for person fields**
   - Autocomplete dropdown
   - Search by name or user key
   - Recently used list

3. **Bulk operations**
   - Select multiple rows
   - Apply same change to all
   - Copy/paste values

4. **Change history**
   - View what was changed
   - Who changed it
   - When it was changed

5. **Optimistic locking**
   - Detect concurrent edits
   - Conflict resolution
   - Merge strategies
