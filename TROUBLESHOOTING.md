# Troubleshooting Guide

## Issue: Edits Not Working

If you edit a field but nothing happens (no yellow highlighting, no update button), follow these steps:

### Step 1: Open Browser Console

1. Open the Prepress FMS Tool in your browser
2. Press **F12** or right-click → "Inspect" → "Console" tab
3. Keep the console open while testing

### Step 2: Edit a Field

1. Click on any editable field (like "File Status" or "Prepress Person")
2. Change the value
3. Tab out or click elsewhere (triggers blur event)

### Step 3: Check Console Logs

You should see these messages in order:

```
✅ [INIT] Edit handlers attached to table body
✅ [INIT] Save button listener attached
✅ [INIT] Cancel button listener attached
✅ [INIT] Initialization complete
```

When you edit a field, you should see:

```
🎯 [EVENT] Cell edit triggered: change | Target: INPUT cell-input editable
✅ [EVENT] Target is editable, processing...
📝 [EDIT] Field: file | Value: Received | Row: 12345
🔄 [BTN] Updating button state. Pending: 1
✅ [BTN] Update bar shown
✅ [EDIT] Tracked. Pending updates: 1
```

### Step 4: Common Issues

#### Issue: "Target is not editable, skipping"
**Cause:** The input/select doesn't have the `editable` class
**Fix:** Check the HTML to ensure cells have:
```html
<input class="cell-input editable" ...>
```

#### Issue: "Table body element not found!"
**Cause:** The table hasn't loaded yet or ID is wrong
**Fix:** 
- Make sure the table has `id="table-body"`
- Check if the script is loaded after the HTML (has `defer` attribute)

#### Issue: "Missing elements" error
**Cause:** Update button elements not found in DOM
**Fix:**
- Verify HTML has `id="update-actions"`, `id="btn-save-updates"`, etc.
- Check for typos in IDs

#### Issue: No console logs at all
**Cause:** JavaScript not loading or error before init
**Fix:**
- Check browser console for red error messages
- Look for syntax errors in script.js
- Verify script tag has correct src path

### Step 5: Verify Update Bar Elements

In the console, type:

```javascript
console.log({
  updateActions: document.getElementById('update-actions'),
  btnSaveUpdates: document.getElementById('btn-save-updates'),
  btnCancelUpdates: document.getElementById('btn-cancel-updates'),
  modifiedCount: document.getElementById('modified-count')
});
```

All should return HTML elements, not `null`.

### Step 6: Manually Trigger Update Bar

In the console, type:

```javascript
document.getElementById('update-actions').style.display = 'flex';
```

If the bar appears, the HTML/CSS is correct but JavaScript tracking isn't working.

### Step 7: Check Event Listeners

In the console, type:

```javascript
const tbody = document.getElementById('table-body');
console.log('Event listeners:', getEventListeners(tbody));
```

You should see `change` and `blur` listeners.

### Step 8: Force a Test Edit

In the console, paste this:

```javascript
// Simulate an edit
const rowId = 'test-123';
const entry = { __raw: { _id: rowId, __SourceDB: 'KOL_SQL' } };
const field = 'file';
const value = 'Received';

// This should trigger the update bar
state.pendingUpdates.set(rowId, {
  entry: entry,
  modifiedFields: new Set([field]),
  updates: { [field]: value }
});

// Manually update button state
const count = state.pendingUpdates.size;
document.getElementById('update-actions').style.display = 'flex';
document.getElementById('btn-save-updates').disabled = false;
document.getElementById('modified-count').textContent = count;

console.log('✅ Manual test: Update bar should now be visible with count:', count);
```

If the bar appears, the issue is with the edit detection, not the button display.

---

## Common Fixes

### Fix 1: Clear Browser Cache
1. Press **Ctrl+Shift+Delete**
2. Check "Cached images and files"
3. Click "Clear data"
4. Refresh page (**Ctrl+F5**)

### Fix 2: Hard Refresh
Press **Ctrl+Shift+R** or **Ctrl+F5**

### Fix 3: Check for JavaScript Errors
1. Open Console (F12)
2. Look for red error messages
3. Fix any syntax errors
4. Reload page

### Fix 4: Verify File Structure
Ensure files exist:
```
Prepress FMS Tool/
├── index.html       ✅
├── styles.css       ✅
└── script.js        ✅
```

### Fix 5: Check HTML IDs
In `index.html`, verify these IDs exist:
- `id="table-body"` on `<tbody>`
- `id="update-actions"` on update bar div
- `id="btn-save-updates"` on Update button
- `id="btn-cancel-updates"` on Cancel button
- `id="modified-count"` on count span

---

## Debug Mode

To enable verbose logging, add this at the top of `script.js`:

```javascript
// Debug mode
const DEBUG = true;
```

Then wrap console.logs with:

```javascript
if (DEBUG) console.log(...);
```

---

## Still Not Working?

1. **Check backend is running:**
   ```bash
   cd backend
   npm start
   ```
   Should see: "Server running on port 3001"

2. **Test API manually:**
   Open: http://localhost:3001/api/artwork/pending
   Should see JSON data, not error

3. **Check browser compatibility:**
   - Chrome 90+ ✅
   - Firefox 88+ ✅
   - Edge 90+ ✅
   - Safari 14+ ✅
   - IE 11 ❌ (Not supported)

4. **Try different browser:**
   Test in Chrome/Firefox to rule out browser-specific issues

5. **Check file paths:**
   - Open DevTools → Network tab
   - Reload page
   - Check if script.js and styles.css load (status 200)
   - If 404, check file paths in HTML

---

## Contact / Report Issue

If issue persists, provide:
1. Browser name and version
2. Full console output (copy/paste)
3. Screenshot of the issue
4. Steps to reproduce
