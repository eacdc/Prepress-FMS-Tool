(function() {
  'use strict';

  // API Configuration
  // Backend for pending artwork API: GET /api/artwork/pending
  // - When running locally (localhost), use local backend
  // - Otherwise, use the deployed backend URL
  const API_BASE_URL =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3001/api/artwork'
      : 'https://cdcapi.onrender.com/api/artwork';

  // Set current year in footer
  const yearElement = document.getElementById('year');
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  // State management
  const state = {
    entries: [],
    filteredEntries: [],
    filters: {},
    currentView: 'pending', // 'pending' or 'completed'
    pendingUpdates: new Map(), // Map<rowId, { entry, modifiedFields, updates }>
    users: [], // All users from MongoDB
    usersBySite: { KOLKATA: [], AHMEDABAD: [] }, // Users grouped by site
    sourceFilters: ['KOLKATA', 'AHMEDABAD', 'UNORDERED'], // Default: show all sources
    quickFilterPreset: '', // Additional quick filter for main pending grid
    sortPreset: '', // Sorting preset for main pending grid
    pagination: {
      currentPage: 1,
      pageSize: 300,
      totalPages: 1
    }
  };


  // DOM Elements
  const elements = {
    tableBody: document.getElementById('table-body'),
    emptyState: document.getElementById('empty-state'),
    loadingOverlay: document.getElementById('loading-overlay'),
    btnAddEntry: document.getElementById('btn-add-entry'),
    tableSection: document.getElementById('table-section'),
    tableWrapper: document.querySelector('.table-wrapper'),
    btnViewPending: document.getElementById('btn-view-pending'),
    btnViewCompleted: document.getElementById('btn-view-completed'),
    updateActions: document.getElementById('update-actions'),
    btnSaveUpdates: document.getElementById('btn-save-updates'),
    btnCancelUpdates: document.getElementById('btn-cancel-updates'),
    modifiedCount: document.getElementById('modified-count'),
    addEntryModal: document.getElementById('add-entry-modal'),
    modalOverlay: document.getElementById('modal-overlay'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    formCancelBtn: document.getElementById('form-cancel-btn'),
    addEntryForm: document.getElementById('add-entry-form'),
    pendingCountDisplay: document.getElementById('pending-count-display'),
    formTokenPreview: document.getElementById('form-token-preview'),
    formTokenValue: document.getElementById('form-token-value'),
    btnUserWisePending: document.getElementById('btn-user-wise-pending'),
    userWisePendingModal: document.getElementById('user-wise-pending-modal'),
    userWiseModalOverlay: document.getElementById('user-wise-modal-overlay'),
    userWiseModalCloseBtn: document.getElementById('user-wise-modal-close-btn'),
    userWiseCancelBtn: document.getElementById('user-wise-cancel-btn'),
    userWiseGetBtn: document.getElementById('user-wise-get-btn'),
    userWiseSelect: document.getElementById('user-wise-select'),
    userWiseResultsModal: document.getElementById('user-wise-results-modal'),
    userWiseResultsModalOverlay: document.getElementById('user-wise-results-modal-overlay'),
    userWiseResultsModalCloseBtn: document.getElementById('user-wise-results-modal-close-btn'),
    userWiseResultsTitle: document.getElementById('user-wise-results-title'),
    userWiseResultsUsername: document.getElementById('user-wise-results-username'),
    userWiseResultsLoading: document.getElementById('user-wise-results-loading'),
    userWiseResultsEmpty: document.getElementById('user-wise-results-empty'),
    userWiseResultsTableContainer: document.getElementById('user-wise-results-table-container'),
    userWiseResultsTableBody: document.getElementById('user-wise-results-table-body'),
    userWiseResultsActions: document.getElementById('user-wise-results-actions'),
    userWiseSelectedCount: document.getElementById('user-wise-selected-count'),
    userWiseUpdateBtn: document.getElementById('user-wise-update-btn'),
    userWiseSelectAll: document.getElementById('user-wise-select-all'),
    userWiseUnselectAllBtn: document.getElementById('user-wise-unselect-all-btn'),
    userWiseSourceFilterSection: document.getElementById('user-wise-source-filter-section'),
    userWiseResultsFiltering: document.getElementById('user-wise-results-filtering'),
    userWiseSortPreset: document.getElementById('user-wise-sort-preset'),
    paginationContainer: document.getElementById('pagination-container'),
    paginationInfo: document.getElementById('pagination-info'),
    paginationPrev: document.getElementById('pagination-prev'),
    paginationNext: document.getElementById('pagination-next'),
    paginationPageInput: document.getElementById('pagination-page-input'),
    quickFilterPreset: document.getElementById('quick-filter-preset'),
    sortPreset: document.getElementById('sort-preset'),
    // COMMENTED OUT: Modal elements no longer used (inline editing instead)
    // userWiseUpdateModal: document.getElementById('user-wise-update-modal'),
    // userWiseUpdateModalOverlay: document.getElementById('user-wise-update-modal-overlay'),
    // userWiseUpdateModalCloseBtn: document.getElementById('user-wise-update-modal-close-btn'),
    // userWiseUpdateCancelBtn: document.getElementById('user-wise-update-cancel-btn'),
    // userWiseUpdateForm: document.getElementById('user-wise-update-form'),
    // userWiseUpdateTitle: document.getElementById('user-wise-update-title'),
    // userWiseUpdateCount: document.getElementById('user-wise-update-count'),
    // userWiseUpdateRemark: document.getElementById('update-remark'),
    // userWiseUpdateLink: document.getElementById('update-link'),
    // userWiseUpdateSubmitBtn: document.getElementById('user-wise-update-submit-btn'),
  };

  // Helper Functions
  function showLoading() {
    if (elements.loadingOverlay) {
      elements.loadingOverlay.classList.remove('hidden');
    }
  }

  function hideLoading() {
    if (elements.loadingOverlay) {
      elements.loadingOverlay.classList.add('hidden');
    }
  }

  function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  function formatDateDDMMYYYY(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  function formatBoolean(value) {
    // Return empty string for null/undefined to show as blank
    if (value === null || value === undefined || value === '') return '';
    if (value === true || value === 'true' || String(value).toLowerCase() === 'yes') return 'Yes';
    if (value === false || value === 'false' || String(value).toLowerCase() === 'no') return 'No';
    return '';
  }

  function formatDateForInput(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Debounce helper function for optimizing filter performance
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Update button state based on pending modifications
  function updateButtonState() {
    const count = state.pendingUpdates.size;
    
    // console.log('🔄 [BTN] Updating button state. Pending:', count);
    
    if (elements.updateActions && elements.btnSaveUpdates && elements.modifiedCount) {
      if (count > 0) {
        elements.updateActions.style.display = 'flex';
        elements.btnSaveUpdates.disabled = false;
        elements.modifiedCount.textContent = count;
        // console.log('✅ [BTN] Update bar shown');
      } else {
        elements.updateActions.style.display = 'none';
        elements.btnSaveUpdates.disabled = true;
        elements.modifiedCount.textContent = '0';
        // console.log('⚪ [BTN] Update bar hidden');
      }
    } else {
      // console.error('❌ [BTN] Missing elements:', {
      //   updateActions: !!elements.updateActions,
      //   btnSaveUpdates: !!elements.btnSaveUpdates,
      //   modifiedCount: !!elements.modifiedCount
      // });
    }
  }

  // Track modification for a specific row
  // Get original value for a field from entry
  function getOriginalValue(entry, field) {
    // The entry object already has the original values from when data was fetched
    // entry[field] contains the original value for that field
    // For person fields, entry[field] contains the display name (e.g., "Biswajit")
    // For other fields, entry[field] contains the original value
    
    if (entry[field] !== undefined && entry[field] !== null) {
      return entry[field];
    }
    
    return '';
  }

  // Normalize values for comparison (handle dates, strings, etc.)
  function normalizeForComparison(value) {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    
    // Handle Date objects
    if (value instanceof Date) {
      // For dates, compare as ISO string (date only, no time)
      if (isNaN(value.getTime())) return '';
      return value.toISOString().split('T')[0];
    }
    
    // Try to parse as date string (could be ISO string, YYYY-MM-DD, or other formats)
    const dateStr = String(value).trim();
    
    // Check if it's a date string in YYYY-MM-DD format (from date inputs)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Try to parse as date and convert to YYYY-MM-DD for comparison
    const parsedDate = new Date(dateStr);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split('T')[0];
    }
    
    // Convert to string and trim for comparison (case-insensitive for strings)
    return String(value).trim().toLowerCase();
  }

  // Check if two values are equal (normalized comparison)
  function valuesEqual(val1, val2) {
    const norm1 = normalizeForComparison(val1);
    const norm2 = normalizeForComparison(val2);
    return norm1 === norm2;
  }

  function trackRowModification(rowId, entry, field, newValue) {
    // console.log('📝 [TRACK] Starting trackRowModification. RowId:', rowId, '| Field:', field, '| Value:', newValue);
    
    // Get original entry (preserve the first one we saw, before any modifications)
    let originalEntry = entry;
    const pending = state.pendingUpdates.get(rowId);
    if (pending && pending.entry) {
      // Use the original entry that was stored when first modification was tracked
      originalEntry = pending.entry;
    }
    
    // Get original value for comparison
    const originalValue = getOriginalValue(originalEntry, field);
    const isBackToOriginal = valuesEqual(newValue, originalValue);
    
    // If row is not in pendingUpdates yet
    if (!state.pendingUpdates.has(rowId)) {
      // If value is back to original, don't track it
      if (isBackToOriginal) {
        // console.log('📝 [TRACK] Value is original, not tracking');
        return;
      }
      
      // console.log('📝 [TRACK] Creating new pending update entry');
      // IMPORTANT: store a snapshot copy so subsequent mutations
      // of `entry` do not change the original values used for comparison.
      // Also keep a reference to the live row object so we can restore it on cancel.
      const originalSnapshot = { ...entry };
      state.pendingUpdates.set(rowId, {
        entry: originalSnapshot,  // immutable snapshot of original values
        rowRef: entry,            // live reference used in the table/state
        modifiedFields: new Set(),
        updates: {}
      });
    }
    
    const currentPending = state.pendingUpdates.get(rowId);
    if (!currentPending) {
      // Safety check: if entry doesn't exist, return early
      return;
    }
    
    if (isBackToOriginal) {
      // Value is back to original - remove from tracking
      currentPending.modifiedFields.delete(field);
      delete currentPending.updates[field];
      
      // If no more modified fields, remove entire row from tracking
      if (currentPending.modifiedFields.size === 0) {
        state.pendingUpdates.delete(rowId);
      }
    } else {
      // Value is different - track it
      currentPending.modifiedFields.add(field);
      currentPending.updates[field] = newValue;
    }
    
    // console.log('📝 [TRACK] Pending update stored. Total pending:', state.pendingUpdates.size);
    // console.log('📝 [TRACK] Pending details:', {
    //   rowId,
    //   fields: Array.from(currentPending.modifiedFields),
    //   updates: currentPending.updates,
    //   isBackToOriginal,
    //   originalValue,
    //   newValue
    // });
    
    updateButtonState();
  }

  // Update local display for modified cell
  function updateLocalDisplay(rowId, field, newValue) {
    state.entries = state.entries.map(entry => {
      const entryId = entry.__raw?._id || entry._id || '';
      if (String(entryId) !== String(rowId)) return entry;
      
      const updated = { ...entry };
      updated[field] = newValue;
      updated.__modified = true;
      
      return updated;
    });
    
    applyFilters();
  }

  // Field mapping: frontend field → backend field
  function mapFieldToBackend(field) {
    const fieldMap = {
      file: 'FileStatus',
      fileReceivedDate: 'FileReceivedDate',
      softApprovalReqd: 'SoftApprovalReqd',
      softApprovalStatus: 'SoftApprovalStatus',
      softApprovalLink: 'LinkofSoftApprovalfile',
      hardApprovalReqd: 'HardApprovalReqd',
      hardApprovalStatus: 'HardApprovalStatus',
      mProofApprovalReqd: 'MProofApprovalReqd',
      mProofApprovalStatus: 'MProofApprovalStatus',
      artworkRemark: 'ArtworkRemark',
      toolingDie: 'ToolingDie',
      toolingBlock: 'ToolingBlock',
      toolingRemark: 'ToolingRemark',
      blanket: 'Blanket',
      plateOutput: 'PlateOutput',
      plateRemark: 'PlateRemark',
    };
    
    return fieldMap[field] || field;
  }

  // Map value to backend format (handle person fields)
  function mapValueToBackend(field, newValue, entry, targetElement = null) {
    // For person fields, we need userKeys not display names
    const personFieldMap = {
      prepressPerson: 'EmployeeUserKey',
      toolingPerson: 'ToolingUserKey',
      platePerson: 'PlateUserKey',
    };
    
    if (personFieldMap[field]) {
      // If it's a person field, convert displayName to userKey
      
      // First, try to get userKey from the selected option's data-user-key attribute
      // This is the most reliable method when coming from dropdown
      if (targetElement && targetElement.tagName === 'SELECT') {
        const selectedOption = targetElement.options[targetElement.selectedIndex];
        if (selectedOption && selectedOption.dataset.userKey) {
          return selectedOption.dataset.userKey;
        }
      }
      
      // If no value selected (empty), return null
      if (!newValue || newValue.trim() === '') {
        return null;
      }
      
      // Try to find by displayName in users list
      if (state.users.length > 0) {
        // Get site from entry to filter users
        const site = entry.division?.toUpperCase() === 'AHMEDABAD' ? 'AHMEDABAD' : 'KOLKATA';
        const usersForSite = state.usersBySite[site] || state.users;
        
        // Find user by displayName
        const user = usersForSite.find(u => u.displayName === newValue);
        if (user) {
          return user.userKey;
        }
      }
      
      // Fallback: assume newValue is already a userKey (lowercase it)
      return String(newValue).toLowerCase();
    }
    
    return newValue;
  }

  // Save all pending updates to backend
  async function saveAllPendingUpdates() {
    // console.log('🚀 [SAVE] Starting saveAllPendingUpdates. Pending:', state.pendingUpdates.size);

    if (state.pendingUpdates.size === 0) {
      // console.warn('⚠️  [SAVE] No pending updates, exiting');
      return;
    }

    // Frontend validation: in main pending view, certain columns must not be blank
    if (state.currentView === 'pending') {
      const requiredFieldDefs = [
        { key: 'file', label: 'File' },
        { key: 'softApprovalReqd', label: 'Soft Approval Reqd' },
        { key: 'hardApprovalReqd', label: 'Hard Approval Reqd' },
        { key: 'mProofApprovalReqd', label: 'MProof Approval Reqd' },
        { key: 'toolingDie', label: 'Tooling Die' },
        { key: 'toolingBlock', label: 'Tooling Block' },
        { key: 'toolingPerson', label: 'Tooling Person' },
        { key: 'blanket', label: 'Blanket' },
        { key: 'platePerson', label: 'Plate Person' },
        { key: 'plateOutput', label: 'Plate Output' },
      ];

      const validationErrors = [];

      // state.pendingUpdates: Map<rowId, { entry, updates }>
      // Use both the original entry and the pending updates for validation
      Array.from(state.pendingUpdates.values()).forEach(({ entry, updates }) => {
        if (!entry) return;

        const missingLabels = [];
        requiredFieldDefs.forEach(({ key, label }) => {
          // Prefer the pending updated value if present; otherwise fall back to the entry's current value
          const hasUpdate = updates && Object.prototype.hasOwnProperty.call(updates, key);
          const rawVal = hasUpdate ? updates[key] : entry[key];
          const val =
            rawVal === null || rawVal === undefined
              ? ''
              : String(rawVal).trim();
          if (!val) {
            missingLabels.push(label);
          }
        });

        if (missingLabels.length > 0) {
          const rowLabel =
            entry.soNo ||
            entry.pwoNo ||
            entry.jobName ||
            entry.clientName ||
            'Unknown row';
          validationErrors.push(
            `${rowLabel}: ${missingLabels.join(', ')}`
          );
        }
      });

      if (validationErrors.length > 0) {
        alert(
          'Please fill the following fields before updating:\n\n' +
            validationErrors.join('\n')
        );
        return;
      }
    }

    // console.log('📦 [SAVE] Updates to save:', Array.from(state.pendingUpdates.entries()));

    showLoading();

    try {
      const updates = Array.from(state.pendingUpdates.values());
      // console.log('📤 [SAVE] Preparing', updates.length, 'updates');
      const payloads = [];

      // Build payload for each modified row
      updates.forEach(({ entry, updates }, index) => {
        const sourceDb = entry.__raw?.__SourceDB || entry.__SourceDB;
        const site = entry.__raw?.__Site || entry.__Site;

        if (!sourceDb) {
          // console.error(`❌ [SAVE] Payload ${index + 1}: Missing __SourceDB in entry`);
          throw new Error(`Row ${index + 1}: Missing source database information`);
        }

        const payload = {
          __SourceDB: sourceDb,
          __Site: site,
          update: {},
        };

        // Add appropriate ID and preserve required fields for SQL
        if (sourceDb === 'KOL_SQL' || sourceDb === 'AMD_SQL') {
          const orderBookingDetailsID =
            entry.__raw?.OrderBookingDetailsID || entry.OrderBookingDetailsID;
          
          if (!orderBookingDetailsID) {
            // console.error(`❌ [SAVE] Payload ${index + 1}: Missing OrderBookingDetailsID for SQL row`);
            // console.log('🔍 [SAVE] Entry structure:', {
            //   __raw: entry.__raw,
            //   OrderBookingDetailsID: entry.OrderBookingDetailsID,
            //   soNo: entry.soNo,
            //   pwoNo: entry.pwoNo,
            // });
            throw new Error(`Row ${index + 1} (${entry.soNo || entry.pwoNo || 'Unknown'}): Missing OrderBookingDetailsID`);
          }
          
          payload.OrderBookingDetailsID = orderBookingDetailsID;
          
          // Extract and preserve CategoryID, OrderBookingID, JobBookingID from raw data
          // These fields are needed to prevent NULL values in the stored procedure
          if (entry.__raw?.CategoryID !== undefined && entry.__raw?.CategoryID !== null) {
            payload.CategoryID = Number(entry.__raw.CategoryID);
          }
          if (entry.__raw?.OrderBookingID !== undefined && entry.__raw?.OrderBookingID !== null) {
            payload.OrderBookingID = Number(entry.__raw.OrderBookingID);
          }
          if (entry.__raw?.JobBookingID !== undefined && entry.__raw?.JobBookingID !== null) {
            payload.JobBookingID = Number(entry.__raw.JobBookingID);
          }
          
          // Extract EmployeeID from raw data (Ledger ID)
          if (entry.__raw?.EmployeeID !== undefined && entry.__raw?.EmployeeID !== null) {
            payload.EmployeeID = Number(entry.__raw.EmployeeID);
          }
          
          // Log extracted fields for debugging
          console.log(`📋 [FRONTEND] Extracted fields for OrderBookingDetailsID ${orderBookingDetailsID}:`, {
            CategoryID: payload.CategoryID ?? 'NOT FOUND',
            OrderBookingID: payload.OrderBookingID ?? 'NOT FOUND',
            JobBookingID: payload.JobBookingID ?? 'NOT FOUND',
            EmployeeID: payload.EmployeeID ?? 'NOT FOUND',
            source: 'from entry.__raw'
          });
          
          // console.log(`📋 [SAVE] Payload ${index + 1} (SQL):`, {
          //   __SourceDB: sourceDb,
          //   __Site: site,
          //   OrderBookingDetailsID: payload.OrderBookingDetailsID,
          //   CategoryID: payload.CategoryID,
          //   OrderBookingID: payload.OrderBookingID,
          //   JobBookingID: payload.JobBookingID,
          //   EmployeeID: payload.EmployeeID,
          //   updateFields: Object.keys(updates),
          //   updateValues: payload.update,
          // });
        } else if (sourceDb === 'MONGO_UNORDERED') {
          const mongoId = entry.__raw?._id || entry.__MongoId;
          
          if (!mongoId) {
            // console.error(`❌ [SAVE] Payload ${index + 1}: Missing __MongoId for Mongo row`);
            throw new Error(`Row ${index + 1} (${entry.soNo || entry.pwoNo || 'Unknown'}): Missing __MongoId`);
          }
          
          console.log('payload####################################################', JSON.stringify(payload, null, 2));
          payload.__MongoId = mongoId;
          // console.log(`📋 [SAVE] Payload ${index + 1} (Mongo):`, {
          //   __SourceDB: sourceDb,
          //   __Site: site,
          //   __MongoId: payload.__MongoId,
          //   updateFields: Object.keys(updates),
          //   updateValues: payload.update,
          // });
        } else {
          // console.error(`❌ [SAVE] Payload ${index + 1}: Unknown source database:`, sourceDb);
          throw new Error(`Row ${index + 1}: Unknown source database: ${sourceDb}`);
        }

        // Map fields to backend format
        Object.keys(updates).forEach((field) => {
          const backendField = mapFieldToBackend(field);
          const personFields = ['prepressPerson', 'toolingPerson', 'platePerson'];
          
          // For person fields:
          // - MongoDB: Send as EmployeeUserKey/ToolingUserKey/PlateUserKey (backend will convert displayName to userKey)
          // - SQL: Send as PrepressPerson/ToolingPerson/PlatePerson (backend will convert displayName to ledgerId)
          if (personFields.includes(field)) {
            const displayName = updates[field];
            
            if (sourceDb === 'MONGO_UNORDERED') {
              // MongoDB: Send displayName as-is, backend will convert to userKey
              // The backend expects EmployeeUserKey/ToolingUserKey/PlateUserKey
              const userKeyFieldMap = {
                prepressPerson: 'EmployeeUserKey',
                toolingPerson: 'ToolingUserKey',
                platePerson: 'PlateUserKey',
              };
              const userKeyField = userKeyFieldMap[field];
              payload.update[userKeyField] = displayName || null; // Send displayName, backend will convert
            } else {
              // SQL: Send as PrepressPerson/ToolingPerson/PlatePerson (NOT EmployeeUserKey)
              // The backend expects these exact field names and will convert displayName to ledgerId
              // These will map to SQL procedure parameters: @EmployeeID, @ToolingPersonID, @PlatePersonID
              const sqlPersonFieldMap = {
                prepressPerson: 'PrepressPerson',
                toolingPerson: 'ToolingPerson',
                platePerson: 'PlatePerson',
              };
              const sqlField = sqlPersonFieldMap[field];
              payload.update[sqlField] = displayName || null; // Send displayName, backend will convert
            }
          } else {
            // Non-person fields: use normal mapping
          const backendValue = mapValueToBackend(field, updates[field], entry);
          payload.update[backendField] = backendValue;
          }
        });

        payloads.push({ payload, entry });
      });

      // Send all updates
      // console.log('📤 [SAVE] Sending', payloads.length, 'API requests to:', `${API_BASE_URL}/pending/update`);

      const results = await Promise.allSettled(
        payloads.map(({ payload }, index) => {
          // console.log(`🌐 [SAVE] Sending request ${index + 1}/${payloads.length}`);
          return fetch(`${API_BASE_URL}/pending/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
            .then(async (r) => {
              // console.log(`📥 [SAVE] Response ${index + 1} status:`, r.status, r.statusText);
              const data = await r.json();
              // console.log(`📥 [SAVE] Response ${index + 1} data:`, data);
              if (!r.ok) {
                throw new Error(data.error || `HTTP ${r.status}`);
              }
              return data;
            })
            .catch((err) => {
              // console.error(`❌ [SAVE] Request ${index + 1} failed:`, err);
              throw err;
            });
        })
      );

      // console.log('📊 [SAVE] All requests completed. Processing results...');

      // Process results
      let succeeded = 0;
      let failed = 0;
      const failures = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value?.ok) {
          succeeded++;
          // console.log(`✅ [SAVE] Update ${index + 1} succeeded`);
        } else {
          failed++;
          const entry = payloads[index].entry;
          const error =
            result.reason?.message || result.value?.error || 'Unknown error';
          failures.push({
            soNo: entry.soNo || entry.pwoNo || 'Unknown',
            error: error,
          });
          // console.error(`❌ [SAVE] Update ${index + 1} failed:`, error);
        }
      });

      // console.log('📊 [SAVE] Results: succeeded:', succeeded, '| failed:', failed);

      // ✅ ONLY clear if all succeeded
      if (failed === 0 && succeeded > 0) {
        // console.log('✅ [SAVE] All updates succeeded, clearing pending updates');

        // Track which rows were updated for verification after refresh
        const updatedRowIds = payloads.map(({ payload, entry }, index) => {
          const pendingUpdate = updates[index];
          return {
            orderBookingDetailsID: payload.OrderBookingDetailsID,
            __MongoId: payload.__MongoId,
            __SourceDB: payload.__SourceDB,
            updatedFields: Object.keys(pendingUpdate?.updates || {}),
            updates: pendingUpdate?.updates || {},
            entry: entry,
          };
        });
        console.log('🔍 [SAVE] Tracking updated rows for verification:', updatedRowIds);

        // Clear pending updates
        state.pendingUpdates.clear();
        updateButtonState();

        // Remove modified highlights
        document.querySelectorAll('.data-row.modified').forEach((row) => {
          row.classList.remove('modified');
        });
        document.querySelectorAll('.cell-input.modified, .cell-select.modified').forEach(
          (cell) => {
            cell.classList.remove('modified');
          }
        );

        // Show success
        alert(`✅ Successfully updated ${succeeded} row(s)!`);

        // Refresh table data
        await fetchEntries();

        // Verify updated rows after refresh
        console.log('🔍 [VERIFY] Checking if updated values appear in refreshed data...');
        updatedRowIds.forEach(({ orderBookingDetailsID, __MongoId, __SourceDB, updatedFields, updates, entry }) => {
          const idToFind = orderBookingDetailsID || __MongoId;
          if (!idToFind) {
            console.warn('⚠️  [VERIFY] No ID to find for updated row');
            return;
          }

          const foundEntry = state.entries.find((e) => {
            if (__SourceDB === 'KOL_SQL' || __SourceDB === 'AMD_SQL') {
              return (
                String(e.OrderBookingDetailsID) === String(orderBookingDetailsID) ||
                String(e.__raw?.OrderBookingDetailsID) === String(orderBookingDetailsID)
              );
            } else if (__SourceDB === 'MONGO_UNORDERED') {
              return (
                String(e.__MongoId) === String(__MongoId) ||
                String(e.__raw?._id) === String(__MongoId) ||
                String(e.__raw?.__MongoId) === String(__MongoId)
              );
            }
            return false;
          });

          if (foundEntry) {
            console.log(`✅ [VERIFY] Found updated row:`, {
              id: idToFind,
              __SourceDB: __SourceDB,
            });
            updatedFields.forEach((field) => {
              const expectedValue = updates[field];
              const actualValue = foundEntry[field];
              const rawValue = foundEntry.__raw?.[mapFieldToBackend(field)];
              const backendField = mapFieldToBackend(field);
              
              console.log(`🔍 [VERIFY] Checking field ${field} (backend: ${backendField}):`, {
                expected: expectedValue,
                actual: actualValue,
                raw: rawValue,
                normalized: foundEntry[field],
              });
              
              // Normalize values for comparison (handle case differences, whitespace, etc.)
              const normalizeForCompare = (val) => {
                if (val === null || val === undefined) return '';
                const str = String(val).trim();
                // Handle Yes/No fields case-insensitively
                if (str.toLowerCase() === 'yes' || str.toLowerCase() === 'no') {
                  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
                }
                return str;
              };
              
              const normalizedExpected = normalizeForCompare(expectedValue);
              const normalizedActual = normalizeForCompare(actualValue);
              
              if (normalizedActual !== normalizedExpected) {
                // Check if the row might have been filtered out because it's no longer "pending"
                const finallyApproved = foundEntry.__raw?.FinallyApproved || foundEntry.finallyApproved;
                if (finallyApproved === 'Yes' || finallyApproved === true) {
                  console.warn(`⚠️  [VERIFY] Row may have been filtered from pending list (FinallyApproved = Yes). Field ${field} was updated but row is no longer in pending results.`);
                } else {
                  console.warn(`⚠️  [VERIFY] Field mismatch for ${field}:`, {
                    expected: expectedValue,
                    normalizedExpected: normalizedExpected,
                    actual: actualValue,
                    normalizedActual: normalizedActual,
                    raw: rawValue,
                    normalized: foundEntry[field],
                  });
                }
              } else {
                console.log(`✅ [VERIFY] Field ${field} matches:`, expectedValue);
              }
            });
          } else {
            // Row not found - it might have been filtered out because it's no longer "pending"
            console.warn(`⚠️  [VERIFY] Updated row not found after refresh. This may be because:`, {
              orderBookingDetailsID,
              __MongoId,
              __SourceDB,
              reason: 'Row may have been filtered out by GetArtworkApprovalPendingDetails stored procedure (e.g., FinallyApproved = Yes)',
              note: 'The update was successful, but the row is no longer in the "pending" list',
            });
          }
        });
      } else if (failed > 0) {
        // console.warn('⚠️  [SAVE] Some updates failed, keeping pending updates for retry');

        // Some failed - DON'T clear, show error
        const errorMsg = failures.map((f) => `SO/PWO: ${f.soNo} - ${f.error}`).join('\n');
        alert(
          `Updated ${succeeded} row(s).\n\n❌ Failed ${failed} row(s):\n${errorMsg}`
        );

        // Keep pending updates so user can retry
        // Don't call updateButtonState() - keep the bar visible
        // Don't remove highlights - keep them so user knows what failed
      } else {
        // console.error('❌ [SAVE] All updates failed');
        alert('❌ All updates failed. Please check your connection and try again.');
        // Keep pending updates for retry
      }
    } catch (error) {
      // console.error('❌ [SAVE] Error saving updates:', error);
      alert('Error saving updates: ' + error.message);
      // Keep pending updates on error so user can retry
    } finally {
      hideLoading();
    }
  }

  // Cancel all pending updates
  function cancelAllPendingUpdates() {
    if (state.pendingUpdates.size === 0) return;
    
    if (!confirm(`Discard changes to ${state.pendingUpdates.size} row(s)?`)) {
      return;
    }

    // Restore original values for all rows from their snapshots
    state.pendingUpdates.forEach(({ entry: originalSnapshot, rowRef }) => {
      if (!rowRef || !originalSnapshot) return;
      // Copy all properties from the original snapshot back to the live row object
      Object.keys(originalSnapshot).forEach((key) => {
        rowRef[key] = originalSnapshot[key];
      });
    });

    // Clear pending updates and update UI state
    state.pendingUpdates.clear();
    updateButtonState();
    
    // Remove modified highlights
    document.querySelectorAll('.data-row.modified').forEach(row => {
      row.classList.remove('modified');
    });
    document.querySelectorAll('.cell-input.modified, .cell-select.modified').forEach(cell => {
      cell.classList.remove('modified');
    });
    
    // Re-render table from restored data
    applyFilters();
  }

  // Normalize raw API row from /api/artwork/pending into our table shape
  function normalizePendingRow(row) {
    const toDate = (val) => (val === undefined ? null : val);

    const toBool = (val) => {
      const v = String(val).toLowerCase();
      return v === 'yes' || v === 'true' || v === '1';
    };

    // For MongoDB unordered entries, use specific field mappings
    const isMongoUnordered = row.__SourceDB === 'MONGO_UNORDERED';
    
    return {
      // Basic job/order info
      // For MongoDB: SO Date -> createdAt, PWO No -> tokenNumber, Ref P.C.C -> reference
      soDate: isMongoUnordered 
        ? (row.SODate || null)  // MongoDB: use SODate which comes from createdAt
        : (row.SODate || row.SoDate || row.soDate || null),
      poDate: row.PODate || row.PoDate || row.poDate || null,
      soNo: isMongoUnordered
        ? ''  // MongoDB: SO No is empty (tokenNumber goes to PWO No instead)
        : (row.SONO || row.SONo || row.SoNo || row.soNo || ''),
      pwoNo: isMongoUnordered
        ? (row.PWONO || '')  // MongoDB: use PWONO which comes from tokenNumber (UN-XXXXX)
        : (row.PWONO || row.PWONo || row.PwoNo || row.pwoNo || ''),
      pwoDate: row.PWODate || row.PwoDate || row.pwoDate || null,
      jobName: row.JobName || row.jobName || '',
      executive: isMongoUnordered
        ? (row.Executive || row.executive || '')  // MongoDB: use executive field
        : (row.ledgername || row.LedgerName || row.ledgerName || row.Executive || row.executive || ''),  // SQL: use ledgername from stored procedure (column is lowercase)
      refPCC: isMongoUnordered
        ? (row.RefPCC || '')  // MongoDB: use RefPCC which comes from reference
        : (row.RefProductMasterCode || row.RefPCC || row.RefNo || row.RefPCCNo || ''),
      clientName: row.ClientName || row.clientName || '',

      // Division / site
      division: row.Division || row.division || row.__Site || '',

      // People
      prepressPerson: row.PrepressPerson || row.PrepressPersonName || '',

      // File / artwork
      file: row.FileStatus || row.FileName || '',
      fileReceivedDate: toDate(row.FileReceivedDate || row.FileRcvdDate),

      // Soft approval - keep null as null, don't convert to empty string
      softApprovalReqd: row.SoftApprovalReqd !== null && row.SoftApprovalReqd !== undefined
        ? row.SoftApprovalReqd
        : (row.SoftApprovalRequired !== null && row.SoftApprovalRequired !== undefined ? row.SoftApprovalRequired : null),
      softApprovalStatus: row.SoftApprovalStatus !== null && row.SoftApprovalStatus !== undefined ? row.SoftApprovalStatus : null,
      softApprovalSentPlanDate: toDate(row.SoftApprovalSentPlanDate || row.SoftApprovalPlanDate),
      softApprovalSentActDate: toDate(row.SoftApprovalSentActdate || row.SoftApprovalSentActDate),
      softApprovalLink: row.LinkofSoftApprovalfile || row.SoftApprovalLink || row.SoftApprovalFileLink || '',

      // Hard approval - keep null as null, don't convert to empty string
      hardApprovalReqd: row.HardApprovalReqd !== null && row.HardApprovalReqd !== undefined
        ? row.HardApprovalReqd
        : (row.HardApprovalRequired !== null && row.HardApprovalRequired !== undefined ? row.HardApprovalRequired : null),
      hardApprovalStatus: row.HardApprovalStatus !== null && row.HardApprovalStatus !== undefined ? row.HardApprovalStatus : null,
      hardApprovalSentPlanDate: toDate(row.HardApprovalSentPlanDate || row.HardApprovalPlanDate),
      hardApprovalSentActDate: toDate(row.HardApprovalSentActdate || row.HardApprovalSentActDate),

      // Machine proof - keep null as null, don't convert to empty string
      mProofApprovalReqd: row.MProofApprovalReqd !== null && row.MProofApprovalReqd !== undefined
        ? row.MProofApprovalReqd
        : (row.MachineProofReqd !== null && row.MachineProofReqd !== undefined ? row.MachineProofReqd : null),
      mProofApprovalStatus: row.MProofApprovalStatus !== null && row.MProofApprovalStatus !== undefined ? row.MProofApprovalStatus : null,
      mProofApprovalSentPlanDate: toDate(row.MProofApprovalSentPlanDate || row.MProofPlanDate),
      mProofApprovalSentActDate: toDate(row.MProofApprovalSentActdate || row.MProofSentActDate),

      // Final approval
      finallyApproved: toBool(row.FinallyApproved),
      finallyApprovedDate: toDate(row.FinallyApprovedDate || row.FinalApprovalDate),

      // Tooling / plate / remarks
      artworkRemark: row.ArtworkRemark || row.ArtworkRemarkText || '',
      toolingPerson: row.ToolingPerson || '',
      toolingDie: row.ToolingDie || '',
      toolingBlock: row.ToolingBlock || '',
      toolingRemark: row.ToolingRemark || '',
      blanket: row.Blanket || '',
      toolingBlanketPlan: toDate(row.ToolingBlanketPlan || row.ToolingBlanketPlanDate),
      toolingBlanketActual: toDate(row.ToolingBlanketActual || row.ToolingBlanketActualDate),
      platePerson: row.PlatePerson || '',
      plateOutput: row.PlateOutput || '',
      platePlan: toDate(row.PlatePlan || row.PlatePlanDate),
      plateActual: toDate(row.PlateActual || row.PlateActualDate),
      plateRemark: row.PlateRemark || '',

      // Preserve IDs and source info for update operations
      OrderBookingDetailsID: row.OrderBookingDetailsID || null,
      __MongoId: row.__MongoId || row._id || null,
      __SourceDB: row.__SourceDB || null,
      __Site: row.__Site || row.Division || row.division || null,

      __raw: row,
    };
  }

  // Fetch users from API
  async function fetchUsers() {
    try {
      // Build users API URL - API_BASE_URL is /api/artwork, append /users
      const usersApiUrl = `${API_BASE_URL}/users`;
      const response = await fetch(usersApiUrl);
      const result = await response.json();
      
      if (result.ok) {
        state.users = result.data;
        
        // Group users by site
        state.usersBySite.KOLKATA = result.data.filter(u => u.sites.includes('KOLKATA'));
        state.usersBySite.AHMEDABAD = result.data.filter(u => u.sites.includes('AHMEDABAD'));
        
        // Clear dropdown cache when users are reloaded
        if (typeof userDropdownCache !== 'undefined') {
          userDropdownCache.KOLKATA = null;
          userDropdownCache.AHMEDABAD = null;
        }
        
        console.log(`✅ Loaded ${result.data.length} users (KOL: ${state.usersBySite.KOLKATA.length}, AHM: ${state.usersBySite.AHMEDABAD.length})`);
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to fetch users');
      }
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      return [];
    }
  }

  // Fetch entries from API
  async function fetchEntries() {
    try {
      showLoading();
      // Add cache-busting parameter to ensure fresh data
      const cacheBuster = `?t=${Date.now()}`;
      // Call different endpoint based on current view
      const endpoint = state.currentView === 'completed' ? '/completed' : '/pending';
      const response = await fetch(`${API_BASE_URL}${endpoint}${cacheBuster}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch entries');
      }

      const raw = Array.isArray(result?.data) ? result.data : [];
      // console.log('📊 [API] Received', raw.length, 'pending entries');
      
      // Log first entry structure to debug ID issues
      // if (raw.length > 0) {
      //   console.log('🔍 [API] First entry structure:', {
      //     _id: raw[0]._id,
      //     __MongoId: raw[0].__MongoId,
      //     OrderBookingDetailsID: raw[0].OrderBookingDetailsID,
      //     __SourceDB: raw[0].__SourceDB,
      //     keys: Object.keys(raw[0])
      //   });
      //   
      //   // Log specific fields that might have been updated
      //   const sampleRow = raw[0];
      //   console.log('🔍 [API] Sample row updated fields check:', {
      //     OrderBookingDetailsID: sampleRow.OrderBookingDetailsID,
      //     MProofApprovalReqd: sampleRow.MProofApprovalReqd,
      //     SoftApprovalReqd: sampleRow.SoftApprovalReqd,
      //     HardApprovalReqd: sampleRow.HardApprovalReqd,
      //     ToolingPerson: sampleRow.ToolingPerson,
      //     PlatePerson: sampleRow.PlatePerson,
      //     ArtworkRemark: sampleRow.ArtworkRemark,
      //     ToolingRemark: sampleRow.ToolingRemark,
      //     PlateRemark: sampleRow.PlateRemark,
      //   });
      // }
      
      state.entries = raw.map(normalizePendingRow);
      // console.log('✅ [UI] Normalized', state.entries.length, 'entries');
      
      // Log normalized first entry
      // if (state.entries.length > 0) {
      //   const first = state.entries[0];
      //   console.log('🔍 [UI] First normalized entry IDs:', {
      //     __raw_id: first.__raw?._id,
      //     __raw_mongoId: first.__raw?.__MongoId,
      //     __raw_orderBookingDetailsID: first.__raw?.OrderBookingDetailsID,
      //     _id: first._id,
      //     __MongoId: first.__MongoId,
      //     OrderBookingDetailsID: first.OrderBookingDetailsID
      //   });
      //   
      //   // Log normalized updated fields
      //   console.log('🔍 [UI] First normalized entry updated fields:', {
      //     mProofApprovalReqd: first.mProofApprovalReqd,
      //     softApprovalReqd: first.softApprovalReqd,
      //     hardApprovalReqd: first.hardApprovalReqd,
      //     toolingPerson: first.toolingPerson,
      //     platePerson: first.platePerson,
      //     artworkRemark: first.artworkRemark,
      //     toolingRemark: first.toolingRemark,
      //     plateRemark: first.plateRemark,
      //   });
      // }
      applyFilters();
    } catch (error) {
      // console.error('Error fetching entries:', error);
      state.entries = [];
      applyFilters();
    } finally {
      hideLoading();
    }
  }

  // Apply filters with optional loading state
  function applyFilters(showLoadingState = false) {
    // Show loading state if requested
    if (showLoadingState && elements.tableWrapper) {
      // Show loading by dimming the table and adding a loading indicator
      elements.tableWrapper.style.opacity = '0.6';
      elements.tableWrapper.style.pointerEvents = 'none';
      elements.tableWrapper.style.position = 'relative';
      
      // Add loading overlay if it doesn't exist
      let loadingOverlay = elements.tableWrapper.querySelector('.table-filtering-overlay');
      if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'table-filtering-overlay';
        loadingOverlay.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 20;
          color: var(--text-primary);
          font-size: 0.9rem;
        `;
        loadingOverlay.innerHTML = '<div style="display: flex; align-items: center; gap: 0.5rem;"><div class="spinner" style="width: 20px; height: 20px; border: 2px solid var(--border-color); border-top-color: var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite;"></div>Filtering...</div>';
        elements.tableWrapper.appendChild(loadingOverlay);
      } else {
        loadingOverlay.style.display = 'flex';
      }
    }
    const filtered = state.entries.filter(entry => {
      // First apply source filter (Kolkata, Ahmedabad, Unordered)
      const sourceDb = entry.__raw?.__SourceDB || entry.__SourceDB || '';
      const site = entry.__raw?.__Site || entry.__Site || entry.division || '';
      
      let matchesSource = false;
      
      // Check if entry matches any selected source filter
      for (const sourceFilter of state.sourceFilters) {
        if (sourceFilter === 'KOLKATA') {
          // Kolkata entries: __SourceDB === 'KOL_SQL' OR site === 'KOLKATA'
          if (sourceDb === 'KOL_SQL') {
            matchesSource = true;
            break;
          }
        } else if (sourceFilter === 'AHMEDABAD') {
          // Ahmedabad entries: __SourceDB === 'AMD_SQL' OR site === 'AHMEDABAD'
          if (sourceDb === 'AMD_SQL') {
            matchesSource = true;
            break;
          }
        } else if (sourceFilter === 'UNORDERED') {
          // Unordered entries: __SourceDB === 'MONGO_UNORDERED'
          if (sourceDb === 'MONGO_UNORDERED') {
            matchesSource = true;
            break;
          }
        }
      }
      
      if (!matchesSource) {
        return false;
      }

      // Apply quick preset filters (on top of source filter)
      if (state.quickFilterPreset) {
        const preset = state.quickFilterPreset;
        const prepress = (entry.prepressPerson || '').toString().trim();
        const fileStatus = (entry.file || '').toString().trim().toLowerCase();
        const softReq = (entry.softApprovalReqd || '').toString().trim().toLowerCase();
        const softStatus = (entry.softApprovalStatus || '').toString().trim().toLowerCase();
        const hardReq = (entry.hardApprovalReqd || '').toString().trim().toLowerCase();
        const hardStatus = (entry.hardApprovalStatus || '').toString().trim().toLowerCase();
        const plateOutput = (entry.plateOutput || '').toString().trim().toLowerCase();

        if (preset === 'no-prepress') {
          // 1. Prepress person not assigned -> null / '' / blank
          if (prepress !== '') {
            return false;
          }
        } else if (preset === 'pending-file') {
          // 2. Pending File -> file column is 'Pending' OR blank (null/empty treated as pending)
          if (fileStatus && fileStatus !== 'pending') {
            return false;
          }
        } else if (preset === 'pending-soft-send') {
          // 3. Pending Softcopy Send -> soft required yes and status pending
          if (!(softReq === 'yes' && softStatus === 'pending')) {
            return false;
          }
        } else if (preset === 'pending-soft-approval') {
          // 4. Pending Softcopy Approval -> soft required yes and status sent
          if (!(softReq === 'yes' && softStatus === 'sent')) {
            return false;
          }
        } else if (preset === 'pending-hard-approval') {
          // 5. Pending Hardcopy Approval -> hard required yes and status sent
          if (!(hardReq === 'yes' && hardStatus === 'sent')) {
            return false;
          }
        } else if (preset === 'pending-hard-send') {
          // 6. Pending Hardcopy Send -> hard required yes and status pending
          if (!(hardReq === 'yes' && hardStatus === 'pending')) {
            return false;
          }
        } else if (preset === 'pending-plates') {
          // 7. Pending Plates -> plate output is 'Pending' OR blank (null/empty treated as pending)
          if (plateOutput && plateOutput !== 'pending') {
            return false;
          }
        }
      }

      // Apply column filters
      for (const [key, value] of Object.entries(state.filters)) {
        if (!value || value === '') continue;

        const entryValue = getEntryValue(entry, key);
        const filterValue = value.toString().toLowerCase();

        if (key.includes('Date')) {
          // Date filtering
          const entryDate = entryValue ? formatDateDDMMYYYY(entryValue) : '';
          if (!entryDate.toLowerCase().includes(filterValue)) {
            return false;
          }
        } else if (typeof entryValue === 'boolean') {
          // Boolean filtering
          const formatted = formatBoolean(entryValue);
          if (formatted.toLowerCase() !== filterValue) {
            return false;
          }
        } else {
          // Text filtering
          const entryStr = entryValue ? entryValue.toString().toLowerCase() : '';
          if (!entryStr.includes(filterValue)) {
            return false;
          }
        }
      }
      return true;
    });

    // Apply sort preset to filtered entries
    state.filteredEntries = applyMainSortPreset(filtered);

    // Reset to page 1 when filters change
    state.pagination.currentPage = 1;
    
    renderTable();
    
    // Hide loading state if it was shown
    if (showLoadingState && elements.tableWrapper) {
      elements.tableWrapper.style.opacity = '1';
      elements.tableWrapper.style.pointerEvents = 'auto';
      
      // Remove loading overlay
      const loadingOverlay = elements.tableWrapper.querySelector('.table-filtering-overlay');
      if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
      }
    }
  }

  // Apply sorting preset for main pending grid
  function applyMainSortPreset(list) {
    const preset = state.sortPreset || '';
    if (!preset) return list.slice();

    const sorted = list.slice();

    const getTime = (value) => {
      if (!value) return 0;
      const t = new Date(value).getTime();
      return Number.isNaN(t) ? 0 : t;
    };

    if (preset === 'soDate-asc' || preset === 'soDate-desc') {
      sorted.sort((a, b) => getTime(a.soDate) - getTime(b.soDate));
      if (preset === 'soDate-desc') sorted.reverse();
    } else if (preset === 'pwoNo-asc' || preset === 'pwoNo-desc') {
      sorted.sort((a, b) => (a.pwoNo || '').localeCompare(b.pwoNo || ''));
      if (preset === 'pwoNo-desc') sorted.reverse();
    } else if (preset === 'jobName-asc' || preset === 'jobName-desc') {
      sorted.sort((a, b) => (a.jobName || '').localeCompare(b.jobName || ''));
      if (preset === 'jobName-desc') sorted.reverse();
    }

    return sorted;
  }

  // Column mapping: index -> field name (for editable fields)
  // Note: Executive column added at index 6, so all indices after it shifted by +1
  const COLUMN_FIELD_MAP = {
    10: 'prepressPerson',      // Prepress Person (was 9)
    11: 'file',               // File (was 10)
    12: 'fileReceivedDate',   // File Received Date (was 11)
    13: 'softApprovalReqd',   // Soft Approval Reqd (was 12)
    14: 'softApprovalStatus', // Soft Approval Status (was 13)
    17: 'softApprovalLink',   // Link of Soft Approval file (was 16)
    18: 'hardApprovalReqd',   // Hard Approval Reqd (was 17)
    19: 'hardApprovalStatus', // Hard Approval Status (was 18)
    22: 'mProofApprovalReqd', // MProof Approval Reqd (was 21)
    23: 'mProofApprovalStatus', // MProof Approval Status (was 22)
    28: 'artworkRemark',      // Artwork Remark (was 27)
    29: 'toolingPerson',      // Tooling Person (was 28)
    30: 'toolingDie',         // Tooling Die (was 29)
    31: 'toolingBlock',       // Tooling Block (was 30)
    32: 'toolingRemark',     // Tooling Remark (was 31)
    33: 'blanket',            // Blanket (was 32)
    35: 'platePerson',        // Plate Person (was 34)
    36: 'plateOutput',        // Plate Output (was 35)
  };

  // Get entry value by column key
  function getEntryValue(entry, columnKey) {
    // Map filter column names to entry field names
    const fieldMap = {
      artworkRemark: 'artworkRemark',
      toolingPerson: 'toolingPerson',
      toolingDie: 'toolingDie',
      toolingBlock: 'toolingBlock',
      toolingRemark: 'toolingRemark',
      blanket: 'blanket',
      toolingBlanketPlan: 'toolingBlanketPlan',
      toolingBlanketActual: 'toolingBlanketActual',
      platePerson: 'platePerson',
      plateOutput: 'plateOutput',
      platePlan: 'platePlan',
      plateActual: 'plateActual',
      plateRemark: 'plateRemark',
    };
    
    const fieldName = fieldMap[columnKey] || columnKey;
    return entry[fieldName];
  }

  // Get field name by column index
  function getFieldNameByIndex(index) {
    return COLUMN_FIELD_MAP[index];
  }

  // Check if a field is modified for a specific row
  function isFieldModified(entryId, field) {
    const pending = state.pendingUpdates.get(entryId);
    return pending && pending.modifiedFields.has(field);
  }

  // Get class for editable cell
  function getEditableClass(baseClass, entryId, field) {
    const modified = isFieldModified(entryId, field) ? ' modified' : '';
    return `${baseClass} editable${modified}`;
  }

  // Helper: Generate user dropdown HTML once per site (optimized for performance)
  function generateUserDropdownOptionsHTML(site) {
    const usersForSite = state.usersBySite[site] || state.users || [];
    if (usersForSite.length === 0) {
      return '<option value="">Select Person</option>';
    }
    
    // Pre-generate the base HTML (without selected attribute)
    const baseOptions = usersForSite.map(user => {
      const displayName = (user.displayName || '').replace(/"/g, '&quot;');
      const userKey = (user.userKey || '').replace(/"/g, '&quot;');
      return `<option value="${displayName}" data-user-key="${userKey}">${displayName}</option>`;
    }).join('');
    
    return '<option value="">Select Person</option>' + baseOptions;
  }

  // Cache for dropdown HTML by site (cleared when users change)
  let userDropdownCache = {
    KOLKATA: null,
    AHMEDABAD: null,
  };

  // Helper: Get display text for dropdown fields
  function getDropdownDisplayText(field, entry) {
    const value = entry[field];
    // Return empty string for null, undefined, or empty string (will show "Click to select")
    if (value === null || value === undefined || value === '') {
      return '';
    }
    
    // For person fields, show display name (already display name)
    if (field === 'prepressPerson' || field === 'toolingPerson' || field === 'platePerson') {
      return value;
    }
    
    // For boolean approval fields, format as Yes/No
    if (field === 'softApprovalReqd' || field === 'hardApprovalReqd' || field === 'mProofApprovalReqd') {
      return formatBoolean(value);
    }
    
    return String(value);
  }

  // Helper: Generate dropdown HTML for different field types
  function generateDropdownHTML(field, entry, currentValue) {
    switch(field) {
      case 'prepressPerson':
      case 'toolingPerson':
      case 'platePerson':
        const site = entry.division?.toUpperCase() === 'AHMEDABAD' ? 'AHMEDABAD' : 'KOLKATA';
        const baseHTML = userDropdownCache[site] || generateUserDropdownOptionsHTML(site);
        if (!currentValue) return baseHTML;
        const currentLower = String(currentValue).toLowerCase().trim();
        return baseHTML.replace(
          /<option value="([^"]+)" data-user-key="([^"]+)">([^<]+)<\/option>/g,
          (match, displayName, userKey, label) => {
            const displayLower = (displayName || '').toLowerCase();
            const keyLower = (userKey || '').toLowerCase();
            const isSelected = currentLower === displayLower || currentLower === keyLower;
            return isSelected 
              ? `<option value="${displayName}" data-user-key="${userKey}" selected>${label}</option>`
              : match;
          }
        );

      case 'file':
        return `
          <option value=""></option>
          <option value="Pending" ${(currentValue || '').toString().trim().toLowerCase() === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="Old" ${(currentValue || '').toString().trim().toLowerCase() === 'old' ? 'selected' : ''}>Old</option>
          <option value="Received" ${(currentValue || '').toString().trim().toLowerCase() === 'received' ? 'selected' : ''}>Received</option>
        `;

      case 'softApprovalReqd':
      case 'hardApprovalReqd':
      case 'mProofApprovalReqd':
        const reqdValue = formatBoolean(currentValue);
        return `
          <option value="" ${reqdValue === '' ? 'selected' : ''}></option>
          <option value="Yes" ${reqdValue === 'Yes' ? 'selected' : ''}>Yes</option>
          <option value="No" ${reqdValue === 'No' ? 'selected' : ''}>No</option>
        `;

      case 'softApprovalStatus':
      case 'hardApprovalStatus':
      case 'mProofApprovalStatus':
        const statusValue = currentValue === null || currentValue === undefined || currentValue === '' ? '' : String(currentValue);
        return `
          <option value="" ${statusValue === '' ? 'selected' : ''}></option>
          <option value="Approved" ${statusValue === 'Approved' ? 'selected' : ''}>Approved</option>
          <option value="Pending" ${statusValue === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="Sent" ${statusValue === 'Sent' ? 'selected' : ''}>Sent</option>
          <option value="Redo" ${statusValue === 'Redo' ? 'selected' : ''}>Redo</option>
        `;

      case 'toolingDie':
      case 'toolingBlock':
      case 'blanket':
        // Normalized current value for comparison
        const normVal = (currentValue || '').toString().trim();
        return `
          <option value=""></option>
          <option value="NA" ${normVal === 'NA' ? 'selected' : ''}>NA</option>
          <option value="Old" ${normVal === 'Old' ? 'selected' : ''}>Old</option>
          <option value="Ordered" ${normVal === 'Ordered' ? 'selected' : ''}>Ordered</option>
          <option value="Required" ${normVal === 'Required' ? 'selected' : ''}>Required</option>
          <option value="Received" ${normVal === 'Received' ? 'selected' : ''}>Received</option>
        `;

      case 'plateOutput':
        return `
          <option value=""></option>
          <option value="Pending" ${(currentValue || '').toString().trim().toLowerCase() === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="Done" ${(currentValue || '').toString().trim().toLowerCase() === 'done' ? 'selected' : ''}>Done</option>
        `;

      default:
        return '<option value="">Select</option>';
    }
  }

  // Lazily populate options for a select dropdown when user first interacts
  function ensureDropdownOptions(select) {
    if (!select) return;

    const field = select.dataset.field;
    if (!field) return;

    // Prefer the current select value (if user already changed it),
    // otherwise fall back to the initial value from backend.
    const currentValue = select.value || select.dataset.initialValue || '';
    const division = select.dataset.division || '';

    // Minimal entry-like object for generateDropdownHTML
    const entryLike = { division };
    entryLike[field] = currentValue;

    select.innerHTML = generateDropdownHTML(field, entryLike, currentValue);
    // Ensure the previously selected value stays selected
    select.value = currentValue;
  }

  // Render table
  function renderTable() {
    if (!elements.tableBody) return;

    // console.log('🎨 [UI] Rendering table with', state.filteredEntries.length, 'filtered entries');
    
    // Pre-generate user dropdown HTML once per site (only if cache is empty)
    if (!userDropdownCache.KOLKATA) {
      userDropdownCache.KOLKATA = generateUserDropdownOptionsHTML('KOLKATA');
    }
    if (!userDropdownCache.AHMEDABAD) {
      userDropdownCache.AHMEDABAD = generateUserDropdownOptionsHTML('AHMEDABAD');
    }

    const totalEntries = state.filteredEntries.length;
    const pageSize = state.pagination.pageSize;
    
    // Calculate pagination
    state.pagination.totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
    
    // Ensure current page is valid
    if (state.pagination.currentPage > state.pagination.totalPages) {
      state.pagination.currentPage = state.pagination.totalPages;
    }
    if (state.pagination.currentPage < 1) {
      state.pagination.currentPage = 1;
    }

    // Update count display (pending or completed based on current view)
    if (elements.pendingCountDisplay) {
      const viewLabel = state.currentView === 'completed' ? 'completed' : 'pending';
      elements.pendingCountDisplay.innerHTML = `<strong>${totalEntries}</strong> ${viewLabel} ${totalEntries === 1 ? 'entry' : 'entries'}`;
    }

    if (totalEntries === 0) {
      elements.tableBody.innerHTML = '';
      if (elements.emptyState) {
        elements.emptyState.classList.remove('hidden');
      }
      if (elements.paginationContainer) {
        elements.paginationContainer.style.display = 'none';
      }
      return;
    }

    if (elements.emptyState) {
      elements.emptyState.classList.add('hidden');
    }

    // PAGINATION: Get entries for current page only
    const startIndex = (state.pagination.currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalEntries);
    const currentPageEntries = state.filteredEntries.slice(startIndex, endIndex);

    // Show/hide pagination controls
    if (elements.paginationContainer) {
      if (totalEntries > pageSize) {
        elements.paginationContainer.style.display = 'block';
        updatePaginationControls();
      } else {
        elements.paginationContainer.style.display = 'none';
      }
    }

    // Build HTML string directly (don't create DOM elements)
    // OPTIMIZATION: Pre-compute formatted dates to avoid multiple function calls per row
    // Only render current page entries
    const rowsHtml = currentPageEntries.map((entry, pageIndex) => {
      // Calculate actual index in filteredEntries for proper ID generation
      const actualIndex = startIndex + pageIndex;
      // Try multiple ID sources
      const entryId = entry.__raw?._id || 
                      entry.__raw?.__MongoId || 
                      entry._id || 
                      entry.__MongoId ||
                      entry.OrderBookingDetailsID?.toString() ||
                      `row-${actualIndex}`; // Fallback to actual index in filteredEntries if no ID
      
      const isModified = state.pendingUpdates.has(entryId);
      const modifiedClass = isModified ? ' modified' : '';
      
      // Pre-compute all formatted dates once per row (optimization to reduce function calls)
      const soDateFmt = formatDate(entry.soDate) || '';
      const poDateFmt = formatDate(entry.poDate) || '';
      const pwoDateFmt = formatDate(entry.pwoDate) || '';
      const fileReceivedDateFmt = formatDateForInput(entry.fileReceivedDate) || '';
      const softApprovalSentPlanDateFmt = formatDateDDMMYYYY(entry.softApprovalSentPlanDate) || '';
      const softApprovalSentActDateFmt = formatDateDDMMYYYY(entry.softApprovalSentActDate) || '';
      const hardApprovalSentPlanDateFmt = formatDateDDMMYYYY(entry.hardApprovalSentPlanDate) || '';
      const hardApprovalSentActDateFmt = formatDateDDMMYYYY(entry.hardApprovalSentActDate) || '';
      const mProofApprovalSentPlanDateFmt = formatDateDDMMYYYY(entry.mProofApprovalSentPlanDate) || '';
      const mProofApprovalSentActDateFmt = formatDateDDMMYYYY(entry.mProofApprovalSentActDate) || '';
      const finallyApprovedDateFmt = formatDateDDMMYYYY(entry.finallyApprovedDate) || '';
      const toolingBlanketPlanFmt = formatDateDDMMYYYY(entry.toolingBlanketPlan) || '';
      const toolingBlanketActualFmt = formatDateDDMMYYYY(entry.toolingBlanketActual) || '';
      const platePlanFmt = formatDateDDMMYYYY(entry.platePlan) || '';
      const plateActualFmt = formatDateDDMMYYYY(entry.plateActual) || '';
      const finallyApprovedFmt = formatBoolean(entry.finallyApproved);
      
      return `<tr class="data-row${modifiedClass}" data-id="${entryId}">
        <td>${soDateFmt}</td>
        <td>${poDateFmt}</td>
        <td>${entry.soNo || ''}</td>
        <td>${entry.pwoNo || ''}</td>
        <td>${pwoDateFmt}</td>
        <td>${entry.jobName || ''}</td>
        <td>${entry.executive || ''}</td>
        <td>${entry.refPCC || ''}</td>
        <td>${entry.clientName || ''}</td>
        <td>${entry.division || ''}</td>
        <td>
          <select
            class="cell-select editable"
            data-field="prepressPerson"
            data-col-index="10"
            data-initial-value="${(entry.prepressPerson || '').replace(/"/g, '&quot;')}"
            data-division="${(entry.division || '').replace(/"/g, '&quot;')}"
          >
            <option value="${(entry.prepressPerson || '').replace(/"/g, '&quot;')}">
              ${getDropdownDisplayText('prepressPerson', entry) || 'Click to select'}
            </option>
          </select>
        </td>
        <td>
          <select
            class="cell-select editable"
            data-field="file"
            data-col-index="11"
            data-initial-value="${(entry.file || '').replace(/"/g, '&quot;')}"
            data-division="${(entry.division || '').replace(/"/g, '&quot;')}"
          >
            <option value="${(entry.file || '').replace(/"/g, '&quot;')}">
              ${getDropdownDisplayText('file', entry) || 'Click to select'}
            </option>
          </select>
        </td>
        <td>${fileReceivedDateFmt}</td>
        <td>
          <select
            class="cell-select editable"
            data-field="softApprovalReqd"
            data-col-index="13"
            data-initial-value="${(entry.softApprovalReqd || '').toString().replace(/"/g, '&quot;')}"
            data-division="${(entry.division || '').replace(/"/g, '&quot;')}"
          >
            <option value="${(entry.softApprovalReqd || '').toString().replace(/"/g, '&quot;')}">
              ${getDropdownDisplayText('softApprovalReqd', entry) || 'Click to select'}
            </option>
          </select>
        </td>
        <td>
          <select
            class="cell-select editable"
            data-field="softApprovalStatus"
            data-col-index="14"
            data-initial-value="${(entry.softApprovalStatus || '').replace(/"/g, '&quot;')}"
            data-division="${(entry.division || '').replace(/"/g, '&quot;')}"
          >
            <option value="${(entry.softApprovalStatus || '').replace(/"/g, '&quot;')}">
              ${getDropdownDisplayText('softApprovalStatus', entry) || 'Click to select'}
            </option>
          </select>
        </td>
        <td>${softApprovalSentPlanDateFmt}</td>
        <td>${softApprovalSentActDateFmt}</td>
        <td>${(entry.softApprovalLink || '').replace(/"/g, '&quot;')}</td>
        <td>
          <select
            class="cell-select editable"
            data-field="hardApprovalReqd"
            data-col-index="18"
            data-initial-value="${(entry.hardApprovalReqd || '').toString().replace(/"/g, '&quot;')}"
            data-division="${(entry.division || '').replace(/"/g, '&quot;')}"
          >
            <option value="${(entry.hardApprovalReqd || '').toString().replace(/"/g, '&quot;')}">
              ${getDropdownDisplayText('hardApprovalReqd', entry) || 'Click to select'}
            </option>
          </select>
        </td>
        <td>
          <select
            class="cell-select editable"
            data-field="hardApprovalStatus"
            data-col-index="19"
            data-initial-value="${(entry.hardApprovalStatus || '').replace(/"/g, '&quot;')}"
            data-division="${(entry.division || '').replace(/"/g, '&quot;')}"
          >
            <option value="${(entry.hardApprovalStatus || '').replace(/"/g, '&quot;')}">
              ${getDropdownDisplayText('hardApprovalStatus', entry) || 'Click to select'}
            </option>
          </select>
        </td>
        <td>${hardApprovalSentPlanDateFmt}</td>
        <td>${hardApprovalSentActDateFmt}</td>
        <td>
          <select
            class="cell-select editable"
            data-field="mProofApprovalReqd"
            data-col-index="22"
            data-initial-value="${(entry.mProofApprovalReqd || '').toString().replace(/"/g, '&quot;')}"
            data-division="${(entry.division || '').replace(/"/g, '&quot;')}"
          >
            <option value="${(entry.mProofApprovalReqd || '').toString().replace(/"/g, '&quot;')}">
              ${getDropdownDisplayText('mProofApprovalReqd', entry) || 'Click to select'}
            </option>
          </select>
        </td>
        <td>
          <select
            class="cell-select editable"
            data-field="mProofApprovalStatus"
            data-col-index="23"
            data-initial-value="${(entry.mProofApprovalStatus || '').replace(/"/g, '&quot;')}"
            data-division="${(entry.division || '').replace(/"/g, '&quot;')}"
          >
            <option value="${(entry.mProofApprovalStatus || '').replace(/"/g, '&quot;')}">
              ${getDropdownDisplayText('mProofApprovalStatus', entry) || 'Click to select'}
            </option>
          </select>
        </td>
        <td>${mProofApprovalSentPlanDateFmt}</td>
        <td>${mProofApprovalSentActDateFmt}</td>
        <td>${finallyApprovedFmt}</td>
        <td>${finallyApprovedDateFmt}</td>
        <td>
          <input
            type="text"
            class="cell-input editable"
            data-field="artworkRemark"
            data-col-index="28"
            value="${(entry.artworkRemark || '').replace(/"/g, '&quot;')}"
          />
        </td>
        <td>
          <select
            class="cell-select editable"
            data-field="toolingPerson"
            data-col-index="29"
            data-initial-value="${(entry.toolingPerson || '').replace(/"/g, '&quot;')}"
            data-division="${(entry.division || '').replace(/"/g, '&quot;')}"
          >
            <option value="${(entry.toolingPerson || '').replace(/"/g, '&quot;')}">
              ${getDropdownDisplayText('toolingPerson', entry) || 'Click to select'}
            </option>
          </select>
        </td>
        <td>
          <select
            class="cell-select editable"
            data-field="toolingDie"
            data-col-index="30"
            data-initial-value="${(entry.toolingDie || '').replace(/"/g, '&quot;')}"
            data-division="${(entry.division || '').replace(/"/g, '&quot;')}"
          >
            <option value="${(entry.toolingDie || '').replace(/"/g, '&quot;')}">
              ${getDropdownDisplayText('toolingDie', entry) || 'Click to select'}
            </option>
          </select>
        </td>
        <td>
          <select
            class="cell-select editable"
            data-field="toolingBlock"
            data-col-index="31"
            data-initial-value="${(entry.toolingBlock || '').replace(/"/g, '&quot;')}"
            data-division="${(entry.division || '').replace(/"/g, '&quot;')}"
          >
            <option value="${(entry.toolingBlock || '').replace(/"/g, '&quot;')}">
              ${getDropdownDisplayText('toolingBlock', entry) || 'Click to select'}
            </option>
          </select>
        </td>
        <td>${(entry.toolingRemark || '').replace(/"/g, '&quot;')}</td>
        <td>
          <select
            class="cell-select editable"
            data-field="blanket"
            data-col-index="33"
            data-initial-value="${(entry.blanket || '').replace(/"/g, '&quot;')}"
            data-division="${(entry.division || '').replace(/"/g, '&quot;')}"
          >
            <option value="${(entry.blanket || '').replace(/"/g, '&quot;')}">
              ${getDropdownDisplayText('blanket', entry) || 'Click to select'}
            </option>
          </select>
        </td>
        <td>${toolingBlanketPlanFmt}</td>
        <td>${toolingBlanketActualFmt}</td>
        <td>
          <select
            class="cell-select editable"
            data-field="platePerson"
            data-col-index="35"
            data-initial-value="${(entry.platePerson || '').replace(/"/g, '&quot;')}"
            data-division="${(entry.division || '').replace(/"/g, '&quot;')}"
          >
            <option value="${(entry.platePerson || '').replace(/"/g, '&quot;')}">
              ${getDropdownDisplayText('platePerson', entry) || 'Click to select'}
            </option>
          </select>
        </td>
        <td>
          <select
            class="cell-select editable"
            data-field="plateOutput"
            data-col-index="36"
            data-initial-value="${(entry.plateOutput || '').replace(/"/g, '&quot;')}"
            data-division="${(entry.division || '').replace(/"/g, '&quot;')}"
          >
            <option value="${(entry.plateOutput || '').replace(/"/g, '&quot;')}">
              ${getDropdownDisplayText('plateOutput', entry) || 'Click to select'}
            </option>
          </select>
        </td>
        <td>${platePlanFmt}</td>
        <td>${plateActualFmt}</td>
        <td>${entry.plateRemark || ''}</td>
      </tr>`;
    }).join('');

    elements.tableBody.innerHTML = rowsHtml;
  }

  // Update pagination controls
  function updatePaginationControls() {
    if (!elements.paginationContainer) return;

    const { currentPage, totalPages, pageSize } = state.pagination;
    const totalEntries = state.filteredEntries.length;
    const startIndex = (currentPage - 1) * pageSize + 1;
    const endIndex = Math.min(currentPage * pageSize, totalEntries);

    // Update pagination info
    if (elements.paginationInfo) {
      elements.paginationInfo.innerHTML = `Showing <strong>${startIndex}</strong> to <strong>${endIndex}</strong> of <strong>${totalEntries}</strong> entries`;
    }

    // Update total pages display
    const totalPagesEl = document.getElementById('pagination-total-pages');
    if (totalPagesEl) {
      totalPagesEl.textContent = totalPages;
    }

    // Update page input
    if (elements.paginationPageInput) {
      elements.paginationPageInput.value = currentPage;
      elements.paginationPageInput.max = totalPages;
    }

    // Update Previous button
    if (elements.paginationPrev) {
      elements.paginationPrev.disabled = currentPage === 1;
      elements.paginationPrev.style.opacity = currentPage === 1 ? '0.5' : '1';
      elements.paginationPrev.style.cursor = currentPage === 1 ? 'not-allowed' : 'pointer';
    }

    // Update Next button
    if (elements.paginationNext) {
      elements.paginationNext.disabled = currentPage === totalPages;
      elements.paginationNext.style.opacity = currentPage === totalPages ? '0.5' : '1';
      elements.paginationNext.style.cursor = currentPage === totalPages ? 'not-allowed' : 'pointer';
    }
  }

  // Go to specific page
  function goToPage(page) {
    const pageNum = parseInt(page, 10);
    if (pageNum >= 1 && pageNum <= state.pagination.totalPages) {
      state.pagination.currentPage = pageNum;
      renderTable();
      // Scroll to top of table
      if (elements.tableSection) {
        elements.tableSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  // Setup filter listeners
  function setupFilters() {
    const filterInputs = document.querySelectorAll('.filter-input, .filter-select, .filter-date');
    
    // Create debounced version of applyFilters for text inputs (300ms delay for better UX)
    const debouncedApplyFilters = debounce(() => applyFilters(), 300);
    
    filterInputs.forEach(input => {
      const column = input.dataset.column;
      if (!column) return;

      if (input.type === 'date') {
        input.addEventListener('change', (e) => {
          if (e.target.value) {
            state.filters[column] = e.target.value;
          } else {
            delete state.filters[column];
          }
          applyFilters();
        });
      } else if (input.tagName === 'SELECT') {
        input.addEventListener('change', (e) => {
          if (e.target.value) {
            state.filters[column] = e.target.value;
          } else {
            delete state.filters[column];
          }
          applyFilters();
        });
      } else {
        // Use debounced applyFilters for text inputs to avoid excessive filtering while typing
        input.addEventListener('input', (e) => {
          if (e.target.value.trim()) {
            state.filters[column] = e.target.value.trim();
          } else {
            delete state.filters[column];
          }
          debouncedApplyFilters();
        });
      }
    });

    // Quick preset filter for common pending conditions
    if (elements.quickFilterPreset) {
      elements.quickFilterPreset.addEventListener('change', (e) => {
        const value = e.target.value || '';
        state.quickFilterPreset = value;
        applyFilters(true);
      });
    }

    // Sort preset for main pending grid
    if (elements.sortPreset) {
      elements.sortPreset.addEventListener('change', (e) => {
        const value = e.target.value || '';
        state.sortPreset = value;
        applyFilters(true);
      });
    }
  }

  // Initialize
  // Update person dropdowns in form based on division selection
  function updatePersonDropdowns(division) {
    const site = division?.toUpperCase() === 'AHMEDABAD' ? 'AHMEDABAD' : 'KOLKATA';
    const usersForSite = state.usersBySite[site] || [];
    
    // Helper function to update a dropdown
    function updateDropdown(selectId) {
      const select = document.getElementById(selectId);
      if (!select) return;
      
      // Clear existing options (except first empty option)
      select.innerHTML = '<option value="">Select Person</option>';
      
      // Add options for users in this site
      usersForSite.forEach(user => {
        const option = document.createElement('option');
        option.value = user.displayName;
        option.setAttribute('data-user-key', user.userKey);
        option.textContent = user.displayName;
        select.appendChild(option);
      });
    }
    
    // Update all person dropdowns
    updateDropdown('form-prepressPerson');
    updateDropdown('form-toolingPerson');
    updateDropdown('form-platePerson');
    
    console.log(`✅ Updated person dropdowns with ${usersForSite.length} users for ${site}`);
  }

  function init() {
    setupFilters();
    
    // Set initial Add Entry button visibility based on current view
    if (elements.btnAddEntry) {
      elements.btnAddEntry.style.display = state.currentView === 'pending' ? 'flex' : 'none';
    }
    
    // Setup source filter checkboxes
    const sourceFilterCheckboxes = document.querySelectorAll('[data-source]');
    sourceFilterCheckboxes.forEach(checkbox => {
      // Set initial checked state based on state.sourceFilters
      const source = checkbox.dataset.source;
      checkbox.checked = state.sourceFilters.includes(source);
      
      checkbox.addEventListener('change', (e) => {
        // Update checkbox state immediately (optimistic update)
        const source = e.target.dataset.source;
        if (e.target.checked) {
          if (!state.sourceFilters.includes(source)) {
            state.sourceFilters.push(source);
          }
        } else {
          state.sourceFilters = state.sourceFilters.filter(s => s !== source);
        }
        
        // Use requestAnimationFrame to allow checkbox to render first, then show loading and filter
        requestAnimationFrame(() => {
          // Show loading state and apply filters
          applyFilters(true);
        });
      });
    });
    
    // Fetch users first, then entries
    fetchUsers().then(() => {
    fetchEntries();
    });

    // Inline edit handlers (frontend only for now)
    if (elements.tableBody) {
      // Lazily populate dropdown options when selects receive focus
      elements.tableBody.addEventListener('focusin', (e) => {
        const select = e.target.closest('.cell-select.editable');
        if (!select) return;
        ensureDropdownOptions(select);
      });

      // Handle both change and input events for better UX
      elements.tableBody.addEventListener('change', handleCellEdit);
      elements.tableBody.addEventListener('blur', handleCellEdit, true); // Use capture for inputs

      // console.log('✅ [INIT] Edit handlers attached to table body');
    } else {
      // console.error('❌ [INIT] Table body element not found!');
    }

    function handleCellEdit(e) {
      // Make the whole cell clickable/focusable: find the nearest editable element
      const target = e.target.closest('.cell-text-editable.editable, .cell-select.editable, .cell-input.editable');
      // console.log('🎯 [EVENT] Cell edit triggered:', e.type, '| Raw target:', e.target.tagName, e.target.className, '| Resolved target:', target && target.tagName, target && target.className);
      
      if (!target || !target.classList.contains('editable')) {
        // console.log('⏭️  [EVENT] No editable target found, skipping');
        return;
      }
      
      // console.log('✅ [EVENT] Target is editable, processing...');

      // Get field name from data-field attribute OR from column index
      let field = target.dataset.field;
      const colIndex = target.dataset.colIndex;
      // console.log('🔍 [EDIT] Field detection - data-field:', field, '| colIndex:', colIndex);

      // If no data-field but we have colIndex, use the mapping
      if (!field && colIndex !== undefined) {
        field = getFieldNameByIndex(parseInt(colIndex, 10));
        // console.log('🔍 [EDIT] Field from colIndex:', field);
      }

      // Fallback: get column index from DOM position
      if (!field) {
        const td = target.closest('td');
        const tr = target.closest('tr');
        if (td && tr) {
          const cells = Array.from(tr.querySelectorAll('td'));
          const index = cells.indexOf(td);
          field = getFieldNameByIndex(index);
          // console.log('🔍 [EDIT] Field from DOM position (index:', index, '):', field);
        }
      }

      if (!field) {
        // console.error('❌ [EDIT] Could not determine field name for editable cell', target);
        return;
      }

      // console.log('✅ [EDIT] Field determined:', field);
      
      const tr = target.closest('tr');
      if (!tr) {
        // console.error('❌ [EDIT] Could not find parent <tr> element');
        return;
      }
      // console.log('✅ [EDIT] Found <tr> element');

      let rowId = tr.getAttribute('data-id');
      
      // If no data-id, try to get it from the row index or other attributes
      if (!rowId || rowId === '') {
        // Try to find the row index
        const allRows = Array.from(tr.parentElement.querySelectorAll('tr.data-row'));
        const rowIndex = allRows.indexOf(tr);
        
        if (rowIndex !== -1) {
          // Calculate actual index accounting for current page
          const pageSize = state.pagination.pageSize;
          const currentPage = state.pagination.currentPage;
          const actualIndex = (currentPage - 1) * pageSize + rowIndex;
          if (actualIndex >= 0 && actualIndex < state.filteredEntries.length) {
            const entry = state.filteredEntries[actualIndex];
            rowId = entry.__raw?._id || 
                    entry.__raw?._id || 
                    entry.__raw?.__MongoId || 
                    entry._id || 
                    entry.__MongoId ||
                    entry.OrderBookingDetailsID?.toString() ||
                    `row-${rowIndex}`;
            // console.log('⚠️  [EDIT] No data-id, using fallback ID:', rowId, 'from row index:', rowIndex);
          } else {
            // console.error('❌ [EDIT] Row has no data-id attribute and cannot determine ID. TR:', tr);
            // console.log('🔍 [EDIT] Row HTML:', tr.outerHTML.substring(0, 200));
            return;
          }
        }
      }
      
      // console.log('✅ [EDIT] Row ID:', rowId);

      // Get new value based on input type
      let newValue = target.value;
      if (target.type === 'checkbox') {
        newValue = target.checked;
      } else if (target.type === 'date') {
        // Keep as YYYY-MM-DD string
        newValue = target.value || null;
      } else if (target.tagName === 'SELECT') {
        newValue = target.value || '';
      }

      // Find the entry for this row
      // Find the entry for this row
// console.log('🔍 [EDIT] Searching for entry. Total entries:', state.entries.length, '| Filtered:', state.filteredEntries.length);
// console.log('🔍 [EDIT] Looking for rowId:', rowId, '| Type:', typeof rowId);

let entry = null;

// If rowId is a fallback ID (row-X), use index directly from filteredEntries
if (rowId.startsWith('row-')) {
  const index = parseInt(rowId.replace('row-', ''), 10);
  // console.log('🔍 [EDIT] Using fallback ID, getting entry from filteredEntries index:', index);
  entry = state.filteredEntries[index];
  
  if (entry) {
    // console.log('✅ [EDIT] Found entry using index:', index);
  } else {
    // console.error('❌ [EDIT] Entry not found at filteredEntries index:', index);
  }
} else {
  // Try multiple ID formats for matching (same logic as renderTable)
  // Search in both filteredEntries (for current view) and entries (for all data)
  const searchArrays = [state.filteredEntries, state.entries];
  
  for (const searchArray of searchArrays) {
    entry = searchArray.find(e => {
      const possibleIds = [
        e.__raw?._id,
        e.__raw?.__MongoId,
        e._id,
        e.__MongoId,
        e.OrderBookingDetailsID?.toString(),
      ].filter(Boolean).map(id => String(id));
      
      const rowIdStr = String(rowId);
      const match = possibleIds.some(id => id === rowIdStr || String(id) === String(rowId));
      
      if (match) {
        // console.log('✅ [EDIT] Found matching entry!', {
        //   possibleIds,
        //   rowId,
        //   match: true,
        //   source: searchArray === state.filteredEntries ? 'filteredEntries' : 'entries'
        // });
      }
      return match;
    });
    
    if (entry) break; // Found it, stop searching
  }
}

if (!entry) {
  // console.error('❌ [EDIT] Entry not found for rowId:', rowId);
  // console.log('🔍 [EDIT] Sample entry IDs from filteredEntries:', state.filteredEntries.slice(0, 3).map((e, i) => ({
  //   index: i,
  //   __raw_id: e.__raw?._id,
  //   __raw_mongoId: e.__raw?.__MongoId,
  //   __raw_orderBookingDetailsID: e.__raw?.OrderBookingDetailsID,
  //   _id: e._id,
  //   __MongoId: e.__MongoId,
  //   OrderBookingDetailsID: e.OrderBookingDetailsID
  // })));
  return;
}
      
      // console.log('✅ [EDIT] Entry found:', entry.__raw?._id || entry._id);

      // console.log('📝 [EDIT] Field:', field, '| Value:', newValue, '| Row:', rowId);

      // Capture old value before change (for derived logic)
      const oldValue = entry[field];

      // Track the modification (this will check if value is back to original)
      trackRowModification(rowId, entry, field, newValue);

      // Now mutate the entry with the new value so the UI model is up to date
      entry[field] = newValue;

      // For SQL data: When person dropdown changes, immediately update the corresponding ID field
      const personFields = ['prepressPerson', 'toolingPerson', 'platePerson'];
      const sourceDb = entry.__raw?.__SourceDB || entry.__SourceDB;

      if (personFields.includes(field) && (sourceDb === 'KOL_SQL' || sourceDb === 'AMD_SQL')) {
        // For SQL data, convert displayName to ledgerId and update the ID field
        const site = sourceDb === 'KOL_SQL' ? 'KOLKATA' : 'AHMEDABAD';
        const displayName = newValue; // This is the displayName from dropdown
        
        if (displayName && displayName.trim() !== '') {
          // Find the user in our loaded user data
          const user = state.users.find(u => 
            u.displayName.toLowerCase().trim() === displayName.toLowerCase().trim()
          );
          
          if (user && user.erp && user.erp[site] && user.erp[site].ledgerId) {
            const ledgerId = Number(user.erp[site].ledgerId);
            
            // Map field names to ID field names
            const idFieldMap = {
              prepressPerson: 'EmployeeID',
              toolingPerson: 'ToolingPersonID',
              platePerson: 'PlatePersonID'
            };
            
            const idField = idFieldMap[field];
            
            // Update the entry's raw data with the new ledgerId
            if (entry.__raw) {
              entry.__raw[idField] = ledgerId;
              console.log(`✅ [SQL] Updated ${idField} to ${ledgerId} for ${field}: "${displayName}"`);
            }
            
            // Also update the entry in state to reflect this change
            const entryIndexInState = state.entries.findIndex(e => {
              const entryId = e.__raw?._id || e._id || '';
              return String(entryId) === String(rowId);
            });
            
            if (entryIndexInState !== -1 && state.entries[entryIndexInState].__raw) {
              state.entries[entryIndexInState].__raw[idField] = ledgerId;
            }
          } else {
            console.warn(`⚠️ [SQL] Could not find ledgerId for ${field}: "${displayName}" in site: ${site}`);
            // Clear the ID field if user not found
            const idFieldMap = {
              prepressPerson: 'EmployeeID',
              toolingPerson: 'ToolingPersonID',
              platePerson: 'PlatePersonID'
            };
            const idField = idFieldMap[field];
            if (entry.__raw) {
              entry.__raw[idField] = null;
            }
            // Also update state
            const entryIndexInState = state.entries.findIndex(e => {
              const entryId = e.__raw?._id || e._id || '';
              return String(entryId) === String(rowId);
            });
            if (entryIndexInState !== -1 && state.entries[entryIndexInState].__raw) {
              state.entries[entryIndexInState].__raw[idField] = null;
            }
          }
        } else {
          // If displayName is empty, clear the ID field
          const idFieldMap = {
            prepressPerson: 'EmployeeID',
            toolingPerson: 'ToolingPersonID',
            platePerson: 'PlatePersonID'
          };
          const idField = idFieldMap[field];
          if (entry.__raw) {
            entry.__raw[idField] = null;
            console.log(`✅ [SQL] Cleared ${idField} for ${field}`);
          }
          // Also update state
          const entryIndexInState = state.entries.findIndex(e => {
            const entryId = e.__raw?._id || e._id || '';
            return String(entryId) === String(rowId);
          });
          if (entryIndexInState !== -1 && state.entries[entryIndexInState].__raw) {
            state.entries[entryIndexInState].__raw[idField] = null;
          }
        }
      }

      // Auto-update approval statuses when required Yes/No *actually changes*
      if (field === 'softApprovalReqd' || field === 'hardApprovalReqd' || field === 'mProofApprovalReqd') {
        // Compare old vs new required value; if same, do nothing.
        const oldRequired = (oldValue || '').toString().trim().toLowerCase();
        const newRequired = (newValue || '').toString().trim().toLowerCase();
        if (oldRequired === newRequired) {
          // User just focused/re-selected the same value; don't touch status.
          // (trackRowModification above will also treat this as "no change")
          // Early return from this block only.
        } else {
          const normalized = newRequired;
          const statusFieldMap = {
            softApprovalReqd: 'softApprovalStatus',
            hardApprovalReqd: 'hardApprovalStatus',
            mProofApprovalReqd: 'mProofApprovalStatus',
          };
          const statusField = statusFieldMap[field];

          if (statusField) {
            let newStatus = '';
            if (normalized === 'yes') {
              newStatus = 'Pending';
            } else if (normalized === 'no') {
              newStatus = 'Approved';
            } else {
              newStatus = '';
            }

            // Only apply if status actually changes
            if ((entry[statusField] || '') !== newStatus) {
              entry[statusField] = newStatus;
              trackRowModification(rowId, entry, statusField, newStatus);

              // Update the corresponding status dropdown in this row so the user sees it immediately
              const statusSelect = tr.querySelector(
                `select.cell-select.editable[data-field="${statusField}"]`
              );
              if (statusSelect) {
                // Keep initial value in sync for lazy option generation
                statusSelect.dataset.initialValue = newStatus;

                const label = newStatus || 'Click to select';
                if (statusSelect.options.length === 0) {
                  statusSelect.add(new Option(label, newStatus));
                } else {
                  const opt = statusSelect.options[0];
                  opt.value = newStatus;
                  opt.textContent = label;
                }
                statusSelect.value = newStatus;
              }
            }
          }
        }
      }

      // Auto-update Plate Output when Plate Person changes from blank to a value
      if (field === 'platePerson') {
        const oldPlatePerson = (oldValue || '').toString().trim();
        const newPlatePerson = (newValue || '').toString().trim();
        if (!oldPlatePerson && newPlatePerson) {
          // Only when going from blank -> some person
          const newPlateOutput = 'Pending';
          if ((entry.plateOutput || '') !== newPlateOutput) {
            entry.plateOutput = newPlateOutput;
            trackRowModification(rowId, entry, 'plateOutput', newPlateOutput);

            // Update Plate Output dropdown in this row so the user sees "Pending" immediately
            const plateOutputSelect = tr.querySelector(
              'select.cell-select.editable[data-field="plateOutput"]'
            );
            if (plateOutputSelect) {
              plateOutputSelect.dataset.initialValue = newPlateOutput;
              const label = newPlateOutput || 'Click to select';
              if (plateOutputSelect.options.length === 0) {
                plateOutputSelect.add(new Option(label, newPlateOutput));
              } else {
                const opt = plateOutputSelect.options[0];
                opt.value = newPlateOutput;
                opt.textContent = label;
              }
              plateOutputSelect.value = newPlateOutput;
            }
          }
        }
      }
      
      // Update the entry in state (without re-rendering)
      const entryIndex = state.entries.findIndex(e => {
        const entryId = e.__raw?._id || e._id || '';
        return String(entryId) === String(rowId);
      });
      
      if (entryIndex !== -1) {
        // Create updated entry object
        const updatedEntry = {
          ...state.entries[entryIndex],
          [field]: newValue
        };
        
        // Update in state.entries
        state.entries[entryIndex] = updatedEntry;
        
        // Also update in state.filteredEntries if it exists there
        const filteredIndex = state.filteredEntries.findIndex(e => {
          const entryId = e.__raw?._id || e._id || '';
          return String(entryId) === String(rowId);
        });
        if (filteredIndex !== -1) {
          state.filteredEntries[filteredIndex] = updatedEntry;
        }
      }
      
      // Update visual feedback based on current tracking state
      const pending = state.pendingUpdates.get(rowId);
      const isFieldModified = pending && pending.modifiedFields.has(field);
      const hasAnyModifications = pending && pending.modifiedFields.size > 0;
      
      // Update cell highlighting
      if (isFieldModified) {
      target.classList.add('modified');
        console.log('🎨 [VISUAL] Cell marked as modified:', field);
      } else {
        target.classList.remove('modified');
        console.log('🎨 [VISUAL] Cell reverted to original, removed highlight:', field);
      }
      
      // Update row highlighting
      if (hasAnyModifications) {
        tr.classList.add('modified');
        console.log('🎨 [VISUAL] Row marked as modified');
      } else {
        tr.classList.remove('modified');
        console.log('🎨 [VISUAL] Row reverted to original, removed highlight');
      }

      console.log('✅ [EDIT] Complete! Pending updates:', state.pendingUpdates.size);
      
      // If it's a dropdown that was edited, convert back to text after blur
      if (target.tagName === 'SELECT' && target.classList.contains('editing')) {
        setTimeout(() => {
          if (!target.parentElement) return; // Already replaced
          
          // Use the dropdown's current value directly - it's the source of truth
          const value = target.value;
          const field = target.dataset.field;
          
          // For display, use the value from the dropdown directly
          // This ensures we show what the user selected, not what might be stale in state
          let displayText = value || '';
          
          // For boolean approval fields that are stored as Yes/No, ensure proper formatting
          // But since dropdown value is already "Yes"/"No", we can use it directly
          
          const textCell = document.createElement('span');
          textCell.className = 'cell-text-editable editable';
          // Preserve modified class if field was modified
          if (target.classList.contains('modified')) {
            textCell.classList.add('modified');
          }
          textCell.setAttribute('data-field', field);
          if (target.dataset.colIndex) textCell.setAttribute('data-col-index', target.dataset.colIndex);
          textCell.style.cssText = 'cursor: pointer; padding: 0.375rem 0.5rem; display: block; min-height: 1.5rem;';
          
          if (displayText) {
            textCell.textContent = displayText;
          } else {
            textCell.innerHTML = '<span style="color: #9ca3af;">Click to select</span>';
          }
          
          if (target.parentElement) {
            target.replaceWith(textCell);
          }
        }, 300);
      }
    }

    // Setup view toggle buttons
    if (elements.btnViewPending && elements.btnViewCompleted) {
      elements.btnViewPending.addEventListener('click', () => {
        state.currentView = 'pending';
        elements.btnViewPending.classList.add('active');
        elements.btnViewCompleted.classList.remove('active');
        // Show Add Entry button for pending view only
        if (elements.btnAddEntry) {
          elements.btnAddEntry.style.display = 'flex';
        }
        // Fetch entries from pending endpoint
        fetchEntries();
      });

      elements.btnViewCompleted.addEventListener('click', () => {
        state.currentView = 'completed';
        elements.btnViewCompleted.classList.add('active');
        elements.btnViewPending.classList.remove('active');
        // Hide Add Entry button for completed view
        if (elements.btnAddEntry) {
          elements.btnAddEntry.style.display = 'none';
        }
        // Reset to page 1 when switching views
        state.pagination.currentPage = 1;
        // Fetch entries from completed endpoint
        fetchEntries();
      });
    }

    // Setup pagination controls
    if (elements.paginationPrev) {
      elements.paginationPrev.addEventListener('click', () => {
        if (state.pagination.currentPage > 1) {
          goToPage(state.pagination.currentPage - 1);
        }
      });
    }

    if (elements.paginationNext) {
      elements.paginationNext.addEventListener('click', () => {
        if (state.pagination.currentPage < state.pagination.totalPages) {
          goToPage(state.pagination.currentPage + 1);
        }
      });
    }

    if (elements.paginationPageInput) {
      elements.paginationPageInput.addEventListener('change', (e) => {
        const page = parseInt(e.target.value, 10);
        if (page >= 1 && page <= state.pagination.totalPages) {
          goToPage(page);
        } else {
          // Reset to current page if invalid
          e.target.value = state.pagination.currentPage;
        }
      });

      elements.paginationPageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const page = parseInt(e.target.value, 10);
          if (page >= 1 && page <= state.pagination.totalPages) {
            goToPage(page);
          } else {
            e.target.value = state.pagination.currentPage;
          }
        }
      });
    }

    // Setup Update and Cancel buttons
    if (elements.btnSaveUpdates) {
      elements.btnSaveUpdates.addEventListener('click', async () => {
        console.log('💾 [BTN] Update Database clicked');
        await saveAllPendingUpdates();
      });
      console.log('✅ [INIT] Save button listener attached');
    } else {
      console.error('❌ [INIT] Save button not found');
    }

    if (elements.btnCancelUpdates) {
      elements.btnCancelUpdates.addEventListener('click', () => {
        console.log('❌ [BTN] Cancel Changes clicked');
        cancelAllPendingUpdates();
      });
      console.log('✅ [INIT] Cancel button listener attached');
    } else {
      console.error('❌ [INIT] Cancel button not found');
    }

    console.log('✅ [INIT] Initialization complete');
  }

  // Modal Functions
  function openAddEntryModal() {
    if (elements.addEntryModal) {
      elements.addEntryModal.style.display = 'flex';
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
      
      // Initialize person dropdowns based on default division (if any)
      const divisionSelect = document.getElementById('form-division');
      if (divisionSelect && divisionSelect.value) {
        updatePersonDropdowns(divisionSelect.value);
      }

      // Fetch next token number preview
      if (elements.formTokenValue) {
        elements.formTokenValue.textContent = 'Loading...';
      }
      const apiBase = 'https://cdcapi.onrender.com';

      fetch(`${apiBase}/api/artwork/unordered/next-token`)
        .then(res => res.json())
        .then(data => {
          if (data && data.ok && data.tokenNumber && elements.formTokenValue) {
            elements.formTokenValue.textContent = data.tokenNumber;
          } else if (elements.formTokenValue) {
            elements.formTokenValue.textContent = 'Unavailable';
          }
        })
        .catch(err => {
          console.error('❌ Error fetching next token number preview:', err);
          if (elements.formTokenValue) {
            elements.formTokenValue.textContent = 'Unavailable';
          }
        });
    }
  }

  function closeAddEntryModal() {
    if (elements.addEntryModal) {
      elements.addEntryModal.style.display = 'none';
      document.body.style.overflow = ''; // Restore scrolling
      // Reset form
      if (elements.addEntryForm) {
        elements.addEntryForm.reset();
      }
    }
  }

  // Handle form submission
  async function handleAddEntrySubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const formValues = {};
    
    // Convert FormData to object
    for (const [key, value] of formData.entries()) {
      if (value.trim() !== '') {
        formValues[key] = value.trim();
      }
    }

    // Validate required fields
    if (!formValues.division || !formValues.segment || !formValues.category || !formValues.clientName || !formValues.jobName || !formValues.reference || !formValues.executive) {
      alert('Please fill in all required fields: Division, Segment, Category, Client Name, Job Name, Reference, and Executive');
      return;
    }

    try {
      showLoading();

      // Prepare payload for unordered entry (MongoDB)
      const payload = {
        site: formValues.division, // AHMEDABAD or KOLKATA
        createdBy: 'Coordinator', // Default or could be from user session
        clientName: formValues.clientName,
        jobName: formValues.jobName,
        category: formValues.category, // Category (e.g., Mono Carton, Label, etc.)
        segment: formValues.segment, // Segment (Commercial or Packaging)
        reference: formValues.reference, // Reference field (mandatory)
        executive: formValues.executive, // Executive field (mandatory)
        tokenNumber: (() => {
          const tokenText = elements.formTokenValue?.textContent?.trim() || '';
          const match = /^UN-\d{6}$/.test(tokenText);
          return match ? tokenText : undefined;
        })(),
        userKey: (() => {
          // Convert displayName to userKey for prepressPerson
          if (!formValues.prepressPerson) return null;
          
          // Find user by displayName
          const site = formValues.division?.toUpperCase() === 'AHMEDABAD' ? 'AHMEDABAD' : 'KOLKATA';
          const usersForSite = state.usersBySite[site] || state.users;
          const user = usersForSite.find(u => u.displayName === formValues.prepressPerson);
          
          return user ? user.userKey : formValues.prepressPerson.toLowerCase();
        })(),
        toolingUserKey: (() => {
          // Convert displayName to userKey for toolingPerson
          if (!formValues.toolingPerson) return null;
          
          const site = formValues.division?.toUpperCase() === 'AHMEDABAD' ? 'AHMEDABAD' : 'KOLKATA';
          const usersForSite = state.usersBySite[site] || state.users;
          const user = usersForSite.find(u => u.displayName === formValues.toolingPerson);
          
          return user ? user.userKey : formValues.toolingPerson.toLowerCase();
        })(),
        plateUserKey: (() => {
          // Convert displayName to userKey for platePerson
          if (!formValues.platePerson) return null;
          
          const site = formValues.division?.toUpperCase() === 'AHMEDABAD' ? 'AHMEDABAD' : 'KOLKATA';
          const usersForSite = state.usersBySite[site] || state.users;
          const user = usersForSite.find(u => u.displayName === formValues.platePerson);
          
          return user ? user.userKey : formValues.platePerson.toLowerCase();
        })(),
        // Send null if blank, true if 'Yes', false if 'No'
        softRequired: formValues.softApprovalReqd === '' || formValues.softApprovalReqd === null || formValues.softApprovalReqd === undefined
          ? null
          : formValues.softApprovalReqd === 'Yes',
        hardRequired: formValues.hardApprovalReqd === '' || formValues.hardApprovalReqd === null || formValues.hardApprovalReqd === undefined
          ? null
          : formValues.hardApprovalReqd === 'Yes',
        machineProofRequired: formValues.mProofApprovalReqd === '' || formValues.mProofApprovalReqd === null || formValues.mProofApprovalReqd === undefined
          ? null
          : formValues.mProofApprovalReqd === 'Yes',
        artworkRemark: formValues.artworkRemark || null,
        toolingRemark: formValues.toolingRemark || null,
        plateRemark: formValues.plateRemark || null,
        // Additional fields can be added here if needed
      };

      // Call the unordered insert API
      const response = await fetch(`${API_BASE_URL}/unordered/insert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add entry');
      }

      // Success! Show popup with token number
      const tokenNumber = result.tokenNumber || 'UN-XXXXX';
      alert(`✅ Approval record has been created, reference number ${tokenNumber}`);
      closeAddEntryModal();
      
      // Refresh the table to show the new entry
      await fetchEntries();
      
    } catch (error) {
      console.error('❌ [ADD ENTRY] Error:', error);
      alert(`❌ Failed to add entry: ${error.message}`);
    } finally {
      hideLoading();
    }
  }

  // User Wise Pending Modal Functions
  async function openUserWisePendingModal() {
    if (!elements.userWisePendingModal || !elements.userWiseSelect) return;
    
    // Show modal
    elements.userWisePendingModal.style.display = 'flex';
    
    // Fetch all users (irrespective of site)
    try {
      elements.userWiseSelect.innerHTML = '<option value="">Loading users...</option>';
      elements.userWiseSelect.disabled = true;
      elements.userWiseGetBtn.disabled = true;
      
      const usersApiUrl = `${API_BASE_URL}/users`; // No site filter - gets all users
      const response = await fetch(usersApiUrl);
      const result = await response.json();
      
      if (result.ok && result.data) {
        // Populate dropdown with all users, sorted by displayName
        elements.userWiseSelect.innerHTML = '<option value="">Select User</option>';
        const sortedUsers = [...result.data].sort((a, b) => 
          (a.displayName || '').localeCompare(b.displayName || '')
        );
        
        sortedUsers.forEach(user => {
          const option = document.createElement('option');
          option.value = user.userKey || user._id;
          option.textContent = user.displayName || user.userKey;
          option.setAttribute('data-display-name', user.displayName || '');
          elements.userWiseSelect.appendChild(option);
        });
        
        elements.userWiseSelect.disabled = false;
        console.log(`✅ Loaded ${sortedUsers.length} users for User Wise Pending`);
      } else {
        throw new Error(result.error || 'Failed to fetch users');
      }
    } catch (error) {
      console.error('❌ Error fetching users for User Wise Pending:', error);
      elements.userWiseSelect.innerHTML = '<option value="">Error loading users</option>';
      alert(`Failed to load users: ${error.message}`);
    }
  }

  function closeUserWisePendingModal() {
    if (!elements.userWisePendingModal) return;
    elements.userWisePendingModal.style.display = 'none';
    
    // Reset form
    if (elements.userWiseSelect) {
      elements.userWiseSelect.value = '';
      elements.userWiseGetBtn.disabled = true;
    }
  }

  function handleUserWiseSelectChange() {
    if (elements.userWiseSelect && elements.userWiseGetBtn) {
      elements.userWiseGetBtn.disabled = !elements.userWiseSelect.value;
    }
  }

  // Format date for display (DD-MMM-YYYY format like SQL)
  function formatDateDDMMMYYYY(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Return original if invalid date
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  // Apply source filters to user-wise results
  function applyUserWiseFilters() {
    if (!window.userWiseAllData || window.userWiseAllData.length === 0) {
      renderUserWiseResultsTable([]);
      return;
    }
    
    // Show filtering state immediately
    if (elements.userWiseResultsFiltering) {
      elements.userWiseResultsFiltering.style.display = 'block';
    }
    if (elements.userWiseResultsTableContainer) {
      elements.userWiseResultsTableContainer.style.display = 'none';
    }
    
    // Get selected source filters from checkboxes
    const selectedSources = [];
    const checkboxes = document.querySelectorAll('#user-wise-source-filter-section [data-source]');
    checkboxes.forEach(cb => {
      if (cb.checked) {
        selectedSources.push(cb.dataset.source);
      }
    });
    
    // Use requestAnimationFrame to allow checkbox to render first, then filter
    requestAnimationFrame(() => {
      // Filter data based on selected sources
      const filteredData = window.userWiseAllData.filter(item => {
        const sourceDb = item.__SourceDB || '';
        const site = item.Division || '';
        
        for (const sourceFilter of selectedSources) {
          if (sourceFilter === 'KOLKATA') {
            if (sourceDb === 'KOL_SQL' || site.toUpperCase() === 'KOLKATA') {
              return true;
            }
          } else if (sourceFilter === 'AHMEDABAD') {
            if (sourceDb === 'AMD_SQL' || site.toUpperCase() === 'AHMEDABAD') {
              return true;
            }
          } else if (sourceFilter === 'UNORDERED') {
            if (sourceDb === 'MONGO_UNORDERED') {
              return true;
            }
          }
        }
        return false;
      });

      // Apply user-wise sort preset
      const sortedData = applyUserWiseSortPreset(filteredData);
      
      // Hide filtering state and render filtered data
      if (elements.userWiseResultsFiltering) {
        elements.userWiseResultsFiltering.style.display = 'none';
      }
      renderUserWiseResultsTable(sortedData);
    });
  }

  // Apply sorting preset for user-wise pending results
  function applyUserWiseSortPreset(list) {
    if (!Array.isArray(list)) return [];

    const preset = elements.userWiseSortPreset ? (elements.userWiseSortPreset.value || '') : '';
    if (!preset) return list.slice();

    const sorted = list.slice();

    const getTime = (value) => {
      if (!value) return 0;
      const t = new Date(value).getTime();
      return Number.isNaN(t) ? 0 : t;
    };

    if (preset === 'poDate-asc' || preset === 'poDate-desc') {
      sorted.sort((a, b) => getTime(a.PODate) - getTime(b.PODate));
      if (preset === 'poDate-desc') sorted.reverse();
    } else if (preset === 'jobcard-asc' || preset === 'jobcard-desc') {
      sorted.sort((a, b) => (a.Jobcardnumber || '').localeCompare(b.Jobcardnumber || ''));
      if (preset === 'jobcard-desc') sorted.reverse();
    }

    return sorted;
  }

  // Render user-wise results table
  function renderUserWiseResultsTable(data) {
    if (!elements.userWiseResultsTableBody) return;
    
    if (!data || data.length === 0) {
      elements.userWiseResultsTableBody.innerHTML = '';
      if (elements.userWiseResultsEmpty) {
        elements.userWiseResultsEmpty.style.display = 'block';
      }
      if (elements.userWiseResultsTableContainer) {
        elements.userWiseResultsTableContainer.style.display = 'none';
      }
      return;
    }
    
    if (elements.userWiseResultsEmpty) {
      elements.userWiseResultsEmpty.style.display = 'none';
    }
    if (elements.userWiseResultsTableContainer) {
      elements.userWiseResultsTableContainer.style.display = 'block';
    }
    // Show source filter section when we have loaded data (even if filtered result is empty)
    if (elements.userWiseSourceFilterSection && window.userWiseAllData && window.userWiseAllData.length > 0) {
      elements.userWiseSourceFilterSection.style.display = 'block';
    }
    
    // Build table rows with checkbox instead of Status column
    const rowsHtml = data.map((item, index) => {
      const rowId = `user-wise-row-${index}`;
      console.log('********************item', item);
      return `<tr data-row-id="${rowId}">
        <td style="text-align: center;">
          <input type="checkbox" class="user-wise-row-checkbox" data-index="${index}" data-row-id="${rowId}">
        </td>
        <td>${(item.PONumber || '').replace(/"/g, '&quot;')}</td>
        <td>${formatDateDDMMMYYYY(item.PODate)}</td>
        <td>${(item.Jobcardnumber || '').replace(/"/g, '&quot;')}</td>
        <td>${(item.Executive || '').replace(/"/g, '&quot;')}</td>
        <td>${(item.ClientName || '').replace(/"/g, '&quot;')}</td>
        <td>${(item.RefMISCode || '').replace(/"/g, '&quot;')}</td>
        <td>${(item.JobName || '').replace(/"/g, '&quot;')}</td>
        <td>${(item.Division || '').replace(/"/g, '&quot;')}</td>
        <td>${formatDateDDMMMYYYY(item.FileReceivedDate)}</td>
        <td>${(item.Operation || '').replace(/"/g, '&quot;')}</td>
        <td>
          <textarea
            class="user-wise-remark-input"
            data-index="${index}"
            data-original-value="${(item.Remarks || '').replace(/"/g, '&quot;')}"
            placeholder="Enter remark..."
            style="width: 100%; padding: 0.25rem 0.5rem; background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 4px; font-size: 0.7rem; min-height: 2.2rem; resize: vertical;"
          >${(item.Remarks || '').replace(/"/g, '&quot;')}</textarea>
        </td>
        <td>
          <input 
            type="url" 
            class="user-wise-link-input" 
            data-index="${index}"
            data-original-value="${(item.Link || '').replace(/"/g, '&quot;')}"
            value="${(item.Link || '').replace(/"/g, '&quot;')}" 
            placeholder="Enter link..."
            style="width: 100%; padding: 0.25rem 0.5rem; background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 4px; font-size: 0.75rem;"
          >
        </td>
        <td>${formatDateDDMMMYYYY(item.PlanDate)}</td>
      </tr>`;
    }).join('');
    
    elements.userWiseResultsTableBody.innerHTML = rowsHtml;
    
    // Store data for later use with checkboxes and change tracking
    window.userWiseResultsData = data;
    
    // Log stored data to verify metadata fields are present
    console.log('[USER WISE] Data stored in window.userWiseResultsData:', {
      totalItems: data?.length,
      sampleItem: data?.[0],
      sampleItemMetadata: data?.[0] ? {
        __SourceDB: data[0].__SourceDB,
        __MongoId: data[0].__MongoId,
        ID: data[0].ID,
        ledgerid: data[0].ledgerid,
        Operation: data[0].Operation
      } : null
    });
    
    // Setup checkbox event listeners
    setupUserWiseCheckboxes(data);
  }
  
  // Setup checkbox functionality
  function setupUserWiseCheckboxes(data) {
    // Remove existing listeners by cloning
    const checkboxes = elements.userWiseResultsTableBody.querySelectorAll('.user-wise-row-checkbox');
    const selectAllCheckbox = elements.userWiseSelectAll;
    
    // Handle individual row checkbox changes
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        updateSelectedCount();
        updateSelectAllState();
      });
    });

    // Auto-toggle checkboxes when remark/link is edited or reverted
    const remarkInputs = elements.userWiseResultsTableBody.querySelectorAll('.user-wise-remark-input');
    const linkInputs = elements.userWiseResultsTableBody.querySelectorAll('.user-wise-link-input');

    function syncCheckboxForIndex(index) {
      const checkbox = elements.userWiseResultsTableBody.querySelector(`.user-wise-row-checkbox[data-index="${index}"]`);
      if (!checkbox) return;

      const remark = elements.userWiseResultsTableBody.querySelector(`.user-wise-remark-input[data-index="${index}"]`);
      const link = elements.userWiseResultsTableBody.querySelector(`.user-wise-link-input[data-index="${index}"]`);

      const originalRemark = (remark?.dataset.originalValue || '').trim();
      const originalLink = (link?.dataset.originalValue || '').trim();

      const currentRemark = (remark?.value || remark?.textContent || '').trim();
      const currentLink = (link?.value || '').trim();

      const changed =
        currentRemark !== originalRemark ||
        currentLink !== originalLink;

      checkbox.checked = changed;
      updateSelectedCount();
      updateSelectAllState();
    }

    remarkInputs.forEach((input) => {
      const index = input.dataset.index;
      ['input', 'change', 'blur'].forEach(evt => {
        input.addEventListener(evt, () => syncCheckboxForIndex(index));
      });
    });

    linkInputs.forEach((input) => {
      const index = input.dataset.index;
      ['input', 'change', 'blur'].forEach(evt => {
        input.addEventListener(evt, () => syncCheckboxForIndex(index));
      });
    });
    
    // Handle select all checkbox
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        checkboxes.forEach((cb) => {
          cb.checked = isChecked;
        });
        updateSelectedCount();
      });
    }
  }
  
  // Update selected count and show/hide update button
  function updateSelectedCount() {
    const checkboxes = elements.userWiseResultsTableBody.querySelectorAll('.user-wise-row-checkbox');
    const checkedBoxes = elements.userWiseResultsTableBody.querySelectorAll('.user-wise-row-checkbox:checked');
    const count = checkedBoxes.length;
    
    if (elements.userWiseSelectedCount) {
      elements.userWiseSelectedCount.innerHTML = `<strong>${count}</strong> item(s) selected`;
    }
    
    // Show/hide unselect all button (only when multiple rows are checked)
    if (elements.userWiseUnselectAllBtn) {
      if (count > 0) {
        elements.userWiseUnselectAllBtn.style.display = 'inline-block';
      } else {
        elements.userWiseUnselectAllBtn.style.display = 'none';
      }
    }
    
    // Show/hide update button and actions bar
    if (elements.userWiseResultsActions) {
      if (count > 0) {
        elements.userWiseResultsActions.style.display = 'block';
      } else {
        elements.userWiseResultsActions.style.display = 'none';
      }
    }
  }
  
  // Update select all checkbox state
  function updateSelectAllState() {
    const checkboxes = elements.userWiseResultsTableBody.querySelectorAll('.user-wise-row-checkbox');
    const checkedBoxes = elements.userWiseResultsTableBody.querySelectorAll('.user-wise-row-checkbox:checked');
    
    if (elements.userWiseSelectAll) {
      if (checkboxes.length === 0) {
        elements.userWiseSelectAll.checked = false;
        elements.userWiseSelectAll.indeterminate = false;
      } else if (checkedBoxes.length === checkboxes.length) {
        elements.userWiseSelectAll.checked = true;
        elements.userWiseSelectAll.indeterminate = false;
      } else if (checkedBoxes.length > 0) {
        elements.userWiseSelectAll.checked = false;
        elements.userWiseSelectAll.indeterminate = true;
      } else {
        elements.userWiseSelectAll.checked = false;
        elements.userWiseSelectAll.indeterminate = false;
      }
    }
  }
  
  // Get selected rows data
  function getSelectedUserWiseRows() {
    const checkboxes = elements.userWiseResultsTableBody.querySelectorAll('.user-wise-row-checkbox:checked');
    const selectedData = [];
    
    checkboxes.forEach((checkbox) => {
      const index = parseInt(checkbox.dataset.index);
      if (window.userWiseResultsData && window.userWiseResultsData[index]) {
        selectedData.push(window.userWiseResultsData[index]);
      }
    });
    
    return selectedData;
  }
  
  // Handle update button click - directly update with values from table cells
  async function handleUserWiseUpdate() {
    const selectedRows = getSelectedUserWiseRows();
    
    if (selectedRows.length === 0) {
      alert('Please select at least one item to update.');
      return;
    }
    
    console.log('[USER WISE] Update button clicked. Selected rows:', selectedRows);
    
    // Get remarks and links from editable table cells
    const checkboxes = elements.userWiseResultsTableBody.querySelectorAll('.user-wise-row-checkbox:checked');
    
    
    // Prepare API payload - handle both SQL and MongoDB items
    // Get remark and link from each row's input fields
    const items = Array.from(checkboxes).map((checkbox) => {
      const index = parseInt(checkbox.dataset.index);
      const rowData = window.userWiseResultsData[index];
      
      console.log(`[USER WISE UPDATE] Processing row ${index}:`, {
        rowData,
        hasRowData: !!rowData,
        __SourceDB: rowData?.__SourceDB,
        __MongoId: rowData?.__MongoId,
        ID: rowData?.ID,
        Operation: rowData?.Operation
      });
      
      if (!rowData) {
        console.warn(`[USER WISE UPDATE] Row ${index} has no rowData!`);
        return null;
      }
      
      // Find the corresponding row in the table
      const row = checkbox.closest('tr');
      const remarkInput = row?.querySelector('.user-wise-remark-input');
      const linkInput = row?.querySelector('.user-wise-link-input');
      
      // Get values from inputs
      const remark = remarkInput?.value?.trim() || null;
      const link = linkInput?.value?.trim() || null;
      
      const baseItem = {
        __SourceDB: rowData.__SourceDB,
        Operation: rowData.Operation,
        Remark: remark,
        Link: link
      };
      
      // For SQL items, include ID and ledgerid
      if (rowData.__SourceDB === 'KOL_SQL' || rowData.__SourceDB === 'AMD_SQL') {
        const sqlItem = {
          ...baseItem,
          ID: rowData.ID,
          ledgerid: rowData.ledgerid
        };
        console.log(`[USER WISE UPDATE] SQL item prepared:`, sqlItem);
        return sqlItem;
      }
      
      // For MongoDB items, include __MongoId (fallback to ID if __MongoId not present)
      if (rowData.__SourceDB === 'MONGO_UNORDERED') {
        const mongoId = rowData.__MongoId || rowData.ID || null;
        const mongoItem = {
          ...baseItem,
          __MongoId: mongoId
        };
        console.log(`[USER WISE UPDATE] MongoDB item prepared:`, {
          ...mongoItem,
          mongoIdFromRowData: rowData.__MongoId,
          idFromRowData: rowData.ID,
          finalMongoId: mongoId
        });
        return mongoItem;
      }
      
      // Unknown source type
      console.warn(`[USER WISE UPDATE] Unknown __SourceDB: ${rowData.__SourceDB}`);
      return null;
    }).filter(item => item !== null);
    
    console.log(`[USER WISE UPDATE] All prepared items (${items.length}):`, items);
    
    // Check if we have valid items
    const validItems = items.filter(item => {
      if (item.__SourceDB === 'MONGO_UNORDERED') {
        const isValid = !!item.__MongoId;
        console.log(`[USER WISE UPDATE] MongoDB item validation:`, {
          __SourceDB: item.__SourceDB,
          __MongoId: item.__MongoId,
          isValid: isValid
        });
        return isValid;
      } else if (item.__SourceDB === 'KOL_SQL' || item.__SourceDB === 'AMD_SQL') {
        const isValid = !!item.ID && !!item.ledgerid;
        console.log(`[USER WISE UPDATE] SQL item validation:`, {
          __SourceDB: item.__SourceDB,
          ID: item.ID,
          ledgerid: item.ledgerid,
          isValid: isValid
        });
        return isValid;
      }
      console.warn(`[USER WISE UPDATE] Unknown __SourceDB in validation: ${item.__SourceDB}`);
      return false;
    });
    
    console.log(`[USER WISE UPDATE] Validation results: ${validItems.length} valid out of ${items.length} total items`);
    
    if (validItems.length === 0) {
      console.error(`[USER WISE UPDATE] No valid items found! Items:`, items);
      console.error(`[USER WISE UPDATE] window.userWiseResultsData sample:`, window.userWiseResultsData?.slice(0, 2));
      alert('No valid items to update. Please ensure selected items have required fields.\n\nCheck browser console for details.');
      return;
    }
    
    // Use only valid items
    const itemsToUpdate = validItems;
    
    console.log('[USER WISE UPDATE] Final items being sent to API:', itemsToUpdate);
    console.log('[USER WISE UPDATE] MongoDB items in payload:', 
      itemsToUpdate.filter(item => item.__SourceDB === 'MONGO_UNORDERED').map(item => ({
        __SourceDB: item.__SourceDB,
        __MongoId: item.__MongoId,
        Operation: item.Operation,
        Remark: item.Remark,
        Link: item.Link
      }))
    );
    
    // Disable update button and show loading state
    if (elements.userWiseUpdateBtn) {
      elements.userWiseUpdateBtn.disabled = true;
      const originalHTML = elements.userWiseUpdateBtn.innerHTML;
      elements.userWiseUpdateBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 6v6l4 2"></path>
        </svg>
        Updating...
      `;
      
      // Store original HTML for restoration
      elements.userWiseUpdateBtn.dataset.originalHTML = originalHTML;
    }
    
    try {
      // Construct API URL
      const apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3001/api/prepress'
        : 'https://cdcapi.onrender.com/api/prepress';
      
      const apiUrl = `${apiBaseUrl}/pending/update`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ items: itemsToUpdate })
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Update failed');
      }
      
      console.log('[USER WISE] Update successful:', result);
      
      // Show success message
      const successCount = result.success || 0;
      const errorCount = result.errors || 0;
      const skippedCount = result.skipped || 0;
      
      let message = `Successfully updated ${successCount} item(s).`;
      if (errorCount > 0) {
        message += `\n${errorCount} item(s) had errors.`;
      }
      
      if (skippedCount > 0) {
        message += `\n${skippedCount} item(s) were skipped.`;
      }
      
      alert(message);
      
      // Refresh the user-wise pending list after successful update
      // Use the stored username from when Get was clicked
      if (window.userWiseCurrentUsername) {
        // Store current selected checkboxes state might be lost, but that's okay since we're refreshing
        // Close the modal and re-fetch data
        const displayName = window.userWiseCurrentUsername;
        
        // Show loading overlay
        showLoading();
        
        // Construct API URL
        const prepressApiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? 'http://localhost:3001/api/prepress'
          : 'https://cdcapi.onrender.com/api/prepress';
        
        const apiUrl = `${prepressApiBaseUrl}/pending?username=${encodeURIComponent(displayName)}`;
        
        try {
          const refreshResponse = await fetch(apiUrl);
          const refreshResult = await refreshResponse.json();
          
          if (refreshResponse.ok && refreshResult.ok) {
            // Store all data for filtering
            window.userWiseAllData = refreshResult.data || [];
            
            // Apply filters and display results
            applyUserWiseFilters();
            
            // Hide actions bar and clear selections after successful update
            if (elements.userWiseResultsActions) {
              elements.userWiseResultsActions.style.display = 'none';
            }
            if (elements.userWiseSelectedCount) {
              elements.userWiseSelectedCount.innerHTML = '<strong>0</strong> item(s) selected';
            }
            if (elements.userWiseSelectAll) {
              elements.userWiseSelectAll.checked = false;
              elements.userWiseSelectAll.indeterminate = false;
            }
            
            console.log('[USER WISE] Data refreshed after update');
          }
        } catch (refreshError) {
          console.error('[USER WISE] Error refreshing data after update:', refreshError);
          // Don't show error to user since update was successful
        } finally {
          hideLoading();
        }
      }
      
    } catch (error) {
      console.error('[USER WISE] Update error:', error);
      alert(`Error updating items: ${error.message}`);
    } finally {
      // Re-enable update button
      if (elements.userWiseUpdateBtn) {
        elements.userWiseUpdateBtn.disabled = false;
        const originalHTML = elements.userWiseUpdateBtn.dataset.originalHTML || `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          Update
        `;
        elements.userWiseUpdateBtn.innerHTML = originalHTML;
      }
    }
  }

  // Open user-wise results modal
  function openUserWiseResultsModal(username, data) {
    if (!elements.userWiseResultsModal) return;
    
    // Add dark mode class to body
    document.body.classList.add('user-wise-modal-open');
    console.log('[UI] Dark mode enabled - user-wise-modal-open class added to body');
    
    // Update title with username
    if (elements.userWiseResultsUsername) {
      elements.userWiseResultsUsername.textContent = username;
    }
    
    // Show loading initially
    if (elements.userWiseResultsLoading) {
      elements.userWiseResultsLoading.style.display = 'block';
    }
    if (elements.userWiseResultsFiltering) {
      elements.userWiseResultsFiltering.style.display = 'none';
    }
    if (elements.userWiseResultsEmpty) {
      elements.userWiseResultsEmpty.style.display = 'none';
    }
    if (elements.userWiseResultsTableContainer) {
      elements.userWiseResultsTableContainer.style.display = 'none';
    }
    if (elements.userWiseSourceFilterSection) {
      elements.userWiseSourceFilterSection.style.display = 'none';
    }
    
    // Show modal
    elements.userWiseResultsModal.style.display = 'flex';
    
    // Hide loading and render table
    setTimeout(() => {
      if (elements.userWiseResultsLoading) {
        elements.userWiseResultsLoading.style.display = 'none';
      }
      renderUserWiseResultsTable(data);
    }, 100);
  }

  // Close user-wise results modal
  function closeUserWiseResultsModal() {
    if (!elements.userWiseResultsModal) return;
    elements.userWiseResultsModal.style.display = 'none';
    
    // Remove dark mode class from body
    document.body.classList.remove('user-wise-modal-open');
    
    // Reset checkboxes and hide actions
    const checkboxes = elements.userWiseResultsTableBody.querySelectorAll('.user-wise-row-checkbox');
    checkboxes.forEach((cb) => {
      cb.checked = false;
    });
    if (elements.userWiseSelectAll) {
      elements.userWiseSelectAll.checked = false;
      elements.userWiseSelectAll.indeterminate = false;
    }
    if (elements.userWiseResultsActions) {
      elements.userWiseResultsActions.style.display = 'none';
    }
    if (elements.userWiseSelectedCount) {
      elements.userWiseSelectedCount.innerHTML = '<strong>0</strong> item(s) selected';
    }
    
    // Clear stored data
    window.userWiseResultsData = null;
    window.userWiseAllData = null;
    
    // Hide source filter section
    if (elements.userWiseSourceFilterSection) {
      elements.userWiseSourceFilterSection.style.display = 'none';
    }
  }

  async function handleUserWiseGet() {
    if (!elements.userWiseSelect || !elements.userWiseSelect.value) {
      alert('Please select a user first');
      return;
    }
    
    const selectedOption = elements.userWiseSelect.options[elements.userWiseSelect.selectedIndex];
    const userKey = elements.userWiseSelect.value;
    const displayName = selectedOption.getAttribute('data-display-name') || selectedOption.textContent;
    
    console.log('🔍 [USER WISE] Get clicked for user:', { userKey, displayName });
    
    // Store username for later refresh
    window.userWiseCurrentUsername = displayName;
    
    try {
      // Close the selection modal first
      closeUserWisePendingModal();
      
      // Show full-screen loading overlay
      showLoading();
      
      // Show results modal with loading state
      openUserWiseResultsModal(displayName, []);
      
      // Construct API URL - use prepress endpoint (different from artwork endpoint)
      const prepressApiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3001/api/prepress'
        : 'https://cdcapi.onrender.com/api/prepress';
      
      const apiUrl = `${prepressApiBaseUrl}/pending?username=${encodeURIComponent(displayName)}`;
      console.log('📡 [USER WISE] Fetching from:', apiUrl);
      
      const response = await fetch(apiUrl);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }
      
      if (!result.ok) {
        throw new Error(result.error || 'Failed to fetch user-wise pending data');
      }
      
      console.log('✅ [USER WISE] Received data:', result.count, 'entries');
      console.log('✅ [USER WISE] Sample data item:', result.data?.[0]);
      console.log('✅ [USER WISE] Checking metadata fields in response:', {
        firstItem: result.data?.[0],
        hasSourceDB: !!result.data?.[0]?.__SourceDB,
        hasMongoId: !!result.data?.[0]?.__MongoId,
        hasID: !!result.data?.[0]?.ID,
        hasLedgerId: !!result.data?.[0]?.ledgerid,
        sourceDB: result.data?.[0]?.__SourceDB,
        mongoId: result.data?.[0]?.__MongoId
      });
      
      // Store all data for filtering
      window.userWiseAllData = result.data || [];
      
      // Initialize source filters (show all by default)
      if (elements.userWiseSourceFilterSection) {
        elements.userWiseSourceFilterSection.style.display = 'block';
        const filterCheckboxes = elements.userWiseSourceFilterSection.querySelectorAll('[data-source]');
        filterCheckboxes.forEach(cb => {
          cb.checked = true; // All checked by default
        });
      }
      
      // Apply filters and display results
      applyUserWiseFilters();
      
      // Hide loading
      if (elements.userWiseResultsLoading) {
        elements.userWiseResultsLoading.style.display = 'none';
      }
      
    } catch (error) {
      console.error('❌ [USER WISE] Error fetching user-wise pending data:', error);
      
      // Hide loading and show error in empty state
      if (elements.userWiseResultsLoading) {
        elements.userWiseResultsLoading.style.display = 'none';
      }
      if (elements.userWiseResultsEmpty) {
        elements.userWiseResultsEmpty.style.display = 'block';
        elements.userWiseResultsEmpty.innerHTML = `<p>Error: ${error.message}</p>`;
      }
      if (elements.userWiseResultsTableContainer) {
        elements.userWiseResultsTableContainer.style.display = 'none';
      }
    } finally {
      // Hide full-screen loading overlay
      hideLoading();
    }
  }

  // Event Listeners
  if (elements.btnAddEntry) {
    elements.btnAddEntry.addEventListener('click', openAddEntryModal);
  }

  // User Wise Pending Modal Event Listeners
  if (elements.btnUserWisePending) {
    elements.btnUserWisePending.addEventListener('click', openUserWisePendingModal);
  }

  if (elements.userWiseModalCloseBtn) {
    elements.userWiseModalCloseBtn.addEventListener('click', closeUserWisePendingModal);
  }

  if (elements.userWiseModalOverlay) {
    elements.userWiseModalOverlay.addEventListener('click', closeUserWisePendingModal);
  }

  if (elements.userWiseCancelBtn) {
    elements.userWiseCancelBtn.addEventListener('click', closeUserWisePendingModal);
  }

  if (elements.userWiseGetBtn) {
    elements.userWiseGetBtn.addEventListener('click', handleUserWiseGet);
  }

  if (elements.userWiseSelect) {
    elements.userWiseSelect.addEventListener('change', handleUserWiseSelectChange);
  }

  // User Wise Results Modal Event Listeners
  if (elements.userWiseResultsModalCloseBtn) {
    elements.userWiseResultsModalCloseBtn.addEventListener('click', closeUserWiseResultsModal);
  }

  if (elements.userWiseResultsModalOverlay) {
    elements.userWiseResultsModalOverlay.addEventListener('click', closeUserWiseResultsModal);
  }

  // User Wise Update Button
  if (elements.userWiseUpdateBtn) {
    elements.userWiseUpdateBtn.addEventListener('click', handleUserWiseUpdate);
  }
  
  // User Wise Unselect All Button
  if (elements.userWiseUnselectAllBtn) {
    elements.userWiseUnselectAllBtn.addEventListener('click', () => {
      const checkboxes = elements.userWiseResultsTableBody.querySelectorAll('.user-wise-row-checkbox:checked');
      checkboxes.forEach(cb => cb.checked = false);
      updateSelectedCount();
      updateSelectAllState();
    });
  }
  
  // User Wise Source Filter Checkboxes
  if (elements.userWiseSourceFilterSection) {
    const filterCheckboxes = elements.userWiseSourceFilterSection.querySelectorAll('[data-source]');
    filterCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        // Checkbox state changes immediately, then show loading and filter
        // Use requestAnimationFrame to allow checkbox to render first
        requestAnimationFrame(() => {
          applyUserWiseFilters();
        });
      });
    });

    // User Wise Sort dropdown
    if (elements.userWiseSortPreset) {
      elements.userWiseSortPreset.addEventListener('change', () => {
        // Re-apply filters and sorting when sort preset changes
        requestAnimationFrame(() => {
          applyUserWiseFilters();
        });
      });
    }
  }

  // COMMENTED OUT: User Wise Update Modal Event Listeners (no longer using modal)
  // if (elements.userWiseUpdateModalOverlay) {
  //   elements.userWiseUpdateModalOverlay.addEventListener('click', closeUserWiseUpdateModal);
  // }
  // 
  // if (elements.userWiseUpdateModalCloseBtn) {
  //   elements.userWiseUpdateModalCloseBtn.addEventListener('click', closeUserWiseUpdateModal);
  // }
  // 
  // if (elements.userWiseUpdateCancelBtn) {
  //   elements.userWiseUpdateCancelBtn.addEventListener('click', closeUserWiseUpdateModal);
  // }
  // 
  // if (elements.userWiseUpdateForm) {
  //   elements.userWiseUpdateForm.addEventListener('submit', handleUserWiseUpdateSubmit);
  // }

  if (elements.modalCloseBtn) {
    elements.modalCloseBtn.addEventListener('click', closeAddEntryModal);
  }

  if (elements.formCancelBtn) {
    elements.formCancelBtn.addEventListener('click', closeAddEntryModal);
  }

  if (elements.modalOverlay) {
    elements.modalOverlay.addEventListener('click', closeAddEntryModal);
  }

  if (elements.addEntryForm) {
    elements.addEntryForm.addEventListener('submit', handleAddEntrySubmit);
    
    // Update person dropdowns when division changes
    const divisionSelect = document.getElementById('form-division');
    if (divisionSelect) {
      divisionSelect.addEventListener('change', (e) => {
        updatePersonDropdowns(e.target.value);
      });
    }
  }

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.addEntryModal && elements.addEntryModal.style.display !== 'none') {
      closeAddEntryModal();
    }
  });

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
