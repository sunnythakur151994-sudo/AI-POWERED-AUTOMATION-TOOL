// ============================================
// SHEET COMMANDER PRO - MASTER SCRIPT
// ============================================

// ===================== GLOBAL STATE =====================
const state = {
    data: [],
    filteredData: [],
    headers: [],
    files: new Map(),
    activeFile: null,
    pivotData: null,
    chartInstance: null,
    workflows: [],
    plugins: [],
    comments: [],
    dashboardWidgets: [],
    recordingActions: [],
    isRecording: false,
    versionHistory: [],
    currentVersion: 0
};

// ===================== DOM REFS =====================
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
    dropZone: $('dropZone'),
    fileInput: $('fileInput'),
    dataGrid: $('dataGrid'),
    rowCount: $('rowCount'),
    fileCount: $('fileCount'),
    globalFilter: $('globalFilter'),
    sortColumn: $('sortColumn'),
    pivotResult: $('pivotResult'),
    aiQuery: $('aiQuery'),
    aiSuggestions: $('suggestionChips'),
    dashboardGrid: $('dashboardGrid'),
    chartCanvas: $('chartCanvas'),
    workflowList: $('workflowList'),
    pluginList: $('pluginList'),
    commentList: $('commentList'),
    commentInput: $('commentInput'),
    fileList: $('fileList')
};

// ===================== INITIALIZATION =====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Sheet Commander Pro initialized');
    
    // Load saved state
    await loadState();
    
    // Setup event listeners
    setupEventListeners();
    
    // Render initial UI
    renderDataGrid([]);
    populateFileList();
    updateStats();
    
    // Load plugins
    loadPlugins();
    
    // Load workflows
    loadWorkflows();
    
    // Start auto-save
    setInterval(saveState, 60000);
    
    console.log('✅ All systems ready');
});

// ===================== STATE MANAGEMENT =====================
async function loadState() {
    try {
        const saved = localStorage.getItem('sheet_commander_pro_state');
        if (saved) {
            const parsed = JSON.parse(saved);
            Object.assign(state, parsed);
        }
    } catch (e) { console.error('Error loading state:', e); }
}

function saveState() {
    try {
        const toSave = {
            data: state.data,
            headers: state.headers,
            workflows: state.workflows,
            plugins: state.plugins,
            comments: state.comments,
            dashboardWidgets: state.dashboardWidgets
        };
        localStorage.setItem('sheet_commander_pro_state', JSON.stringify(toSave));
    } catch (e) { console.error('Error saving state:', e); }
}

// ===================== EVENT LISTENERS =====================
function setupEventListeners() {
    // Sidebar navigation
    document.querySelectorAll('.sidebar ul li').forEach(li => {
        li.addEventListener('click', () => {
            document.querySelectorAll('.sidebar ul li').forEach(l => l.classList.remove('active'));
            li.classList.add('active');
            const tabId = li.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            const target = document.getElementById('tab-' + tabId);
            if (target) target.classList.add('active');
        });
    });

    // File upload - drag & drop
    dom.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dom.dropZone.classList.add('dragover');
    });
    dom.dropZone.addEventListener('dragleave', () => {
        dom.dropZone.classList.remove('dragover');
    });
    dom.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dom.dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFileUpload(e.dataTransfer.files);
        }
    });
    dom.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFileUpload(e.target.files);
        }
    });

    // AI Query
    $('aiQueryBtn').addEventListener('click', () => {
        handleAIQuery(dom.aiQuery.value);
    });
    dom.aiQuery.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleAIQuery(dom.aiQuery.value);
        }
    });

    // Voice command (Space key)
    document.addEventListener('keydown', (e) => {
        if (e.key === ' ' && !e.target.matches('input, textarea, select')) {
            e.preventDefault();
            toggleVoiceRecognition();
        }
    });
    $('voiceBtn').addEventListener('click', toggleVoiceRecognition);

    // AI Assistant modal
    $('aiAssistant').addEventListener('click', () => {
        openModal('aiModal');
    });

    // AI suggestion chips
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            dom.aiQuery.value = chip.textContent.trim();
            handleAIQuery(dom.aiQuery.value);
        });
    });

    // Auto-detect
    $('autoDetectBtn').addEventListener('click', autoDetect);

    // Templates
    document.querySelectorAll('.template').forEach(btn => {
        btn.addEventListener('click', () => {
            applyTemplate(btn.dataset.template);
        });
    });

    // Merge and Compare buttons
    $('mergeBtn').addEventListener('click', mergeFiles);
    $('compareBtn').addEventListener('click', compareFiles);

    // Workflow recording
    document.addEventListener('click', (e) => {
        if (state.isRecording) {
            recordAction(e);
        }
    });
}

// ===================== FILE HANDLING =====================
async function handleFileUpload(fileList) {
    const files = Array.from(fileList);
    const fileIds = [];
    
    for (const file of files) {
        try {
            const data = await parseFile(file);
            const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            state.files.set(fileId, {
                id: fileId,
                name: file.name,
                data: data,
                headers: Object.keys(data[0] || {}),
                size: file.size,
                uploaded: new Date(),
                version: 1
            });
            fileIds.push(fileId);
        } catch (error) {
            console.error('Error parsing file:', file.name, error);
            alert(`Error parsing ${file.name}: ${error.message}`);
        }
    }
    
    if (fileIds.length > 0) {
        // Load the first file as active
        const firstFile = state.files.get(fileIds[0]);
        state.data = firstFile.data;
        state.headers = firstFile.headers;
        state.filteredData = [...state.data];
        state.activeFile = fileIds[0];
        
        renderDataGrid(state.filteredData);
        populateSelectors();
        populateChartSelectors();
        updateStats();
        populateFileList();
        saveState();
        
        // Generate AI suggestions
        generateAISuggestions(state.data);
        
        // Show success notification
        showNotification(`✅ Loaded ${files.length} file(s) successfully!`);
    }
}

function parseFile(file) {
    return new Promise((resolve, reject) => {
        const ext = file.name.split('.').pop().toLowerCase();
        const reader = new FileReader();
        
        if (ext === 'csv' || ext === 'txt') {
            reader.onload = (e) => {
                const result = Papa.parse(e.target.result, { 
                    header: true, 
                    skipEmptyLines: true,
                    transformHeader: (h) => h.trim()
                });
                if (result.data && result.data.length) {
                    resolve(result.data);
                } else {
                    reject(new Error('No data found in CSV'));
                }
            };
            reader.readAsText(file);
        } else if (ext === 'xlsx' || ext === 'xls') {
            reader.onload = (e) => {
                const workbook = XLSX.read(e.target.result, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(sheet, { 
                    defval: '',
                    raw: false
                });
                if (json && json.length) {
                    resolve(json);
                } else {
                    reject(new Error('No data found in Excel file'));
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            reject(new Error('Unsupported file format. Use .xlsx, .csv, or .txt'));
        }
    });
}

// ===================== DATA GRID RENDERING =====================
function renderDataGrid(data) {
    if (!data || !data.length) {
        dom.dataGrid.innerHTML = `
            <div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-light);">
                <i class="fas fa-table" style="font-size: 48px; display: block; margin-bottom: 12px;"></i>
                <p>No data loaded. Upload a file to get started.</p>
                <p style="font-size: 13px; margin-top: 4px;">Drop your Excel or CSV file anywhere on the page.</p>
            </div>
        `;
        return;
    }
    
    const headers = Object.keys(data[0]);
    let html = '<table><thead><tr>';
    
    headers.forEach(header => {
        html += `<th>
            ${header}
            <input type="text" class="column-filter" data-column="${header}" placeholder="Filter..." />
        </th>`;
    });
    html += '</tr></thead><tbody>';
    
    // Show first 100 rows for performance
    const maxRows = Math.min(data.length, 100);
    for (let i = 0; i < maxRows; i++) {
        const row = data[i];
        html += '<tr>';
        headers.forEach(header => {
            let value = row[header] !== undefined && row[header] !== null ? row[header] : '';
            if (typeof value === 'string' && value.length > 50) {
                value = value.substring(0, 50) + '...';
            }
            html += `<td>${value}</td>`;
        });
        html += '</tr>';
    }
    
    if (data.length > 100) {
        html += `<tr><td colspan="${headers.length}" style="text-align:center; color: var(--text-light); padding: 12px;">
            Showing 100 of ${data.length} rows
        </td></tr>`;
    }
    
    html += '</tbody></table>';
    dom.dataGrid.innerHTML = html;
    
    // Setup column filters
    document.querySelectorAll('.column-filter').forEach(input => {
        input.addEventListener('input', handleColumnFilter);
    });
}

function handleColumnFilter(e) {
    const column = e.target.dataset.column;
    const value = e.target.value.toLowerCase();
    
    if (!value) {
        state.filteredData = [...state.data];
    } else {
        state.filteredData = state.data.filter(row => {
            const cell = String(row[column] || '').toLowerCase();
            return cell.includes(value);
        });
    }
    
    renderDataGrid(state.filteredData);
}

function applyGlobalFilter() {
    const query = dom.globalFilter.value.toLowerCase().trim();
    
    if (!query) {
        state.filteredData = [...state.data];
    } else {
        state.filteredData = state.data.filter(row => {
            return Object.values(row).some(val => 
                String(val).toLowerCase().includes(query)
            );
        });
    }
    
    renderDataGrid(state.filteredData);
}

// ===================== SORTING =====================
function sortData(type) {
    const col = dom.sortColumn.value;
    if (!col) {
        showNotification('⚠️ Please select a column to sort.', 'warning');
        return;
    }
    
    const sorted = [...state.filteredData];
    sorted.sort((a, b) => {
        let valA = a[col] !== undefined ? String(a[col]) : '';
        let valB = b[col] !== undefined ? String(b[col]) : '';
        
        if (type === 'asc' || type === 'desc') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
            if (type === 'asc') return valA.localeCompare(valB);
            return valB.localeCompare(valA);
        } else {
            const numA = parseFloat(valA) || 0;
            const numB = parseFloat(valB) || 0;
            if (type === 'num-asc') return numA - numB;
            return numB - numA;
        }
    });
    
    state.filteredData = sorted;
    renderDataGrid(sorted);
    showNotification(`✅ Sorted by ${col} (${type})`);
}

// ===================== SELECTORS =====================
function populateSelectors() {
    const selects = [
        'sortColumn', 'pivotRow', 'pivotColumn', 'pivotValue',
        'ifColumn', 'ifResult', 'lookupKeyMain', 'lookupKeySecondary',
        'lookupReturn'
    ];
    
    selects.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const current = sel.value;
        sel.innerHTML = '<option value="">Select...</option>';
        state.headers.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h;
            opt.textContent = h;
            sel.appendChild(opt);
        });
        if (current && state.headers.includes(current)) {
            sel.value = current;
        }
    });
}

function populateChartSelectors() {
    const xSelect = $('chartX');
    const ySelect = $('chartY');
    if (!xSelect) return;
    
    [xSelect, ySelect].forEach(sel => {
        const current = sel.value;
        sel.innerHTML = '<option value="">Select...</option>';
        state.headers.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h;
            opt.textContent = h;
            sel.appendChild(opt);
        });
        if (current && state.headers.includes(current)) {
            sel.value = current;
        }
    });
}

// ===================== STATS =====================
function updateStats() {
    dom.rowCount.textContent = `Rows: ${state.filteredData.length || 0}`;
    dom.fileCount.textContent = `Files: ${state.files.size}`;
}

// ===================== FILE LIST =====================
function populateFileList() {
    if (state.files.size === 0) {
        dom.fileList.innerHTML = '<p style="color: var(--text-light); text-align: center; padding: 20px;">No files uploaded yet</p>';
        return;
    }
    
    let html = '';
    for (const [id, file] of state.files) {
        const isActive = id === state.activeFile;
        html += `
            <div class="file-item ${isActive ? 'active' : ''}" data-fileid="${id}">
                <i class="fas fa-file-${file.name.endsWith('.xlsx') ? 'excel' : 'csv'}"></i>
                <span class="file-name">${file.name}</span>
                <span class="file-rows">${file.data.length} rows</span>
                <span class="file-status ${isActive ? 'active' : ''}">
                    ${isActive ? '● Active' : ''}
                </span>
                <button class="btn-icon small" onclick="removeFile('${id}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }
    dom.fileList.innerHTML = html;
    
    // Click to activate
    document.querySelectorAll('.file-item').forEach(item => {
        item.addEventListener('click', () => {
            const fileId = item.dataset.fileid;
            activateFile(fileId);
        });
    });
}

function activateFile(fileId) {
    const file = state.files.get(fileId);
    if (!file) return;
    
    state.data = file.data;
    state.headers = file.headers;
    state.filteredData = [...state.data];
    state.activeFile = fileId;
    
    renderDataGrid(state.filteredData);
    populateSelectors();
    populateChartSelectors();
    populateFileList();
    updateStats();
    showNotification(`📂 Activated: ${file.name}`);
}

function removeFile(fileId) {
    if (state.files.size <= 1) {
        showNotification('⚠️ Cannot remove the last file.', 'warning');
        return;
    }
    
    state.files.delete(fileId);
    if (state.activeFile === fileId) {
        const remaining = Array.from(state.files.keys());
        if (remaining.length > 0) {
            activateFile(remaining[0]);
        } else {
            state.data = [];
            state.headers = [];
            state.filteredData = [];
            state.activeFile = null;
            renderDataGrid([]);
            populateSelectors();
        }
    }
    populateFileList();
    updateStats();
    saveState();
    showNotification('🗑️ File removed');
}

// ===================== PIVOT TABLE =====================
function buildPivot() {
    const rowCol = $('pivotRow').value;
    const colCol = $('pivotColumn').value;
    const valCol = $('pivotValue').value;
    const aggType = $('pivotAgg').value;
    
    if (!rowCol || !valCol) {
        showNotification('⚠️ Please select Row and Value columns.', 'warning');
        return;
    }
    
    const data = state.filteredData;
    const groups = {};
    
    data.forEach(row => {
        const rowKey = String(row[rowCol] || 'null');
        const colKey = colCol ? String(row[colCol] || 'null') : 'total';
        const val = parseFloat(row[valCol]) || 0;
        
        if (!groups[rowKey]) groups[rowKey] = {};
        if (!groups[rowKey][colKey]) {
            groups[rowKey][colKey] = { sum: 0, count: 0, values: [] };
        }
        groups[rowKey][colKey].sum += val;
        groups[rowKey][colKey].count += 1;
        groups[rowKey][colKey].values.push(val);
    });
    
    // Build table
    const allCols = colCol ? [...new Set(data.map(r => String(r[colCol] || 'null')))] : ['total'];
    let html = `<h4>📊 Pivot: ${rowCol} → ${aggType} of ${valCol}</h4>`;
    html += '<table><thead><tr><th>' + rowCol + '</th>';
    allCols.forEach(c => {
        html += `<th>${c}</th>`;
    });
    if (colCol) html += '<th>Total</th>';
    html += '</tr></thead><tbody>';
    
    let grandTotal = 0;
    for (const [rowKey, rowData] of Object.entries(groups)) {
        html += `<tr><td><strong>${rowKey}</strong></td>`;
        let rowTotal = 0;
        allCols.forEach(colKey => {
            const cell = rowData[colKey] || { sum: 0, count: 0 };
            let result = 0;
            if (aggType === 'sum') result = cell.sum;
            else if (aggType === 'count') result = cell.count;
            else if (aggType === 'avg') result = cell.count ? (cell.sum / cell.count) : 0;
            else if (aggType === 'min') result = cell.values.length ? Math.min(...cell.values) : 0;
            else if (aggType === 'max') result = cell.values.length ? Math.max(...cell.values) : 0;
            rowTotal += (aggType === 'sum' ? cell.sum : (aggType === 'count' ? cell.count : 0));
            html += `<td>${Number(result).toFixed(2)}</td>`;
        });
        if (colCol) {
            html += `<td><strong>${Number(rowTotal).toFixed(2)}</strong></td>`;
            grandTotal += rowTotal;
        }
        html += '</tr>';
    }
    
    if (colCol) {
        html += `<tr><td><strong>Grand Total</strong></td>`;
        allCols.forEach(() => html += `<td></td>`);
        html += `<td><strong>${Number(grandTotal).toFixed(2)}</strong></td></tr>`;
    }
    
    html += '</tbody></table>';
    dom.pivotResult.innerHTML = html;
    state.pivotData = groups;
    showNotification('✅ Pivot table created!');
}

// ===================== VLOOKUP =====================
let lookupData = [];

$('lookupFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        const data = await parseFile(file);
        lookupData = data;
        const lookupHeaders = Object.keys(data[0] || {});
        
        const sel = $('lookupReturn');
        sel.innerHTML = '<option value="">Return Column</option>';
        lookupHeaders.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h;
            opt.textContent = h;
            sel.appendChild(opt);
        });
        
        // Populate secondary key selector
        const secSel = $('lookupKeySecondary');
        secSel.innerHTML = '<option value="">Secondary Key</option>';
        lookupHeaders.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h;
            opt.textContent = h;
            secSel.appendChild(opt);
        });
        
        showNotification(`✅ Loaded secondary file: ${file.name} (${data.length} rows)`);
    } catch (error) {
        showNotification(`❌ Error loading file: ${error.message}`, 'error');
    }
});

function runVlookup() {
    const keyMain = $('lookupKeyMain').value;
    const keySec = $('lookupKeySecondary').value;
    const returnCol = $('lookupReturn').value;
    
    if (!keyMain || !keySec || !returnCol) {
        showNotification('⚠️ Please select all VLOOKUP fields.', 'warning');
        return;
    }
    
    if (!lookupData.length) {
        showNotification('⚠️ Please upload a secondary file first.', 'warning');
        return;
    }
    
    // Build lookup map
    const lookupMap = {};
    lookupData.forEach(row => {
        const key = String(row[keySec] || '');
        lookupMap[key] = row[returnCol];
    });
    
    // Apply to main data
    state.data.forEach(row => {
        const key = String(row[keyMain] || '');
        const result = lookupMap[key];
        row['VLOOKUP_RESULT'] = result !== undefined ? result : 'Not Found';
    });
    
    if (!state.headers.includes('VLOOKUP_RESULT')) {
        state.headers.push('VLOOKUP_RESULT');
    }
    state.filteredData = [...state.data];
    renderDataGrid(state.filteredData);
    populateSelectors();
    saveState();
    showNotification(`✅ VLOOKUP applied! ${state.data.filter(r => r['VLOOKUP_RESULT'] !== 'Not Found').length} matches found.`);
}

// ===================== IF / ELSE =====================
function applyIfElse() {
    const col = $('ifColumn').value;
    const cond = $('ifCondition').value;
    const val = $('ifValue').value;
    const resultCol = $('ifResult').value || 'Result';
    
    if (!col) {
        showNotification('⚠️ Please select a column.', 'warning');
        return;
    }
    
    state.data.forEach(row => {
        const cell = row[col] !== undefined ? String(row[col]) : '';
        let passed = false;
        
        switch(cond) {
            case 'gt': passed = parseFloat(cell) > parseFloat(val); break;
            case 'lt': passed = parseFloat(cell) < parseFloat(val); break;
            case 'eq': passed = cell === val; break;
            case 'contains': passed = cell.toLowerCase().includes(val.toLowerCase()); break;
            case 'starts': passed = cell.toLowerCase().startsWith(val.toLowerCase()); break;
            case 'ends': passed = cell.toLowerCase().endsWith(val.toLowerCase()); break;
        }
        
        row[resultCol] = passed ? '✅ TRUE' : '❌ FALSE';
    });
    
    if (!state.headers.includes(resultCol)) {
        state.headers.push(resultCol);
    }
    state.filteredData = [...state.data];
    renderDataGrid(state.filteredData);
    populateSelectors();
    saveState();
    showNotification(`✅ IF/ELSE rule applied! Results in column: ${resultCol}`);
}

// Shortcut functions
function flagHighValues() {
    const col = state.headers.find(h => /price|sales|amount|revenue|total/i.test(h));
    if (col) {
        $('ifColumn').value = col;
        $('ifCondition').value = 'gt';
        $('ifValue').value = '100';
        $('ifResult').value = 'Flagged';
        applyIfElse();
    } else {
        showNotification('⚠️ No numeric column found for flagging.', 'warning');
    }
}

function passFail() {
    const col = state.headers.find(h => /score|grade|mark|rating/i.test(h));
    if (col) {
        $('ifColumn').value = col;
        $('ifCondition').value = 'gt';
        $('ifValue').value = '70';
        $('ifResult').value = 'Pass/Fail';
        applyIfElse();
    } else {
        showNotification('⚠️ No score column found.', 'warning');
    }
}

function categorizeGoldSilver() {
    const col = state.headers.find(h => /sales|revenue|amount/i.test(h));
    if (col) {
        const resultCol = 'Category';
        state.data.forEach(row => {
            const val = parseFloat(row[col]) || 0;
            row[resultCol] = val > 1000 ? '🏅 Gold' : '🥈 Silver';
        });
        if (!state.headers.includes(resultCol)) {
            state.headers.push(resultCol);
        }
        state.filteredData = [...state.data];
        renderDataGrid(state.filteredData);
        populateSelectors();
        saveState();
        showNotification('✅ Categorized as Gold/Silver!');
    } else {
        showNotification('⚠️ No sales column found.', 'warning');
    }
}

function conditionalFormatting() {
    const col = state.headers.find(h => /price|sales|amount|total/i.test(h));
    if (col) {
        state.data.forEach(row => {
            const val = parseFloat(row[col]) || 0;
            // Add a visual marker in a new column
            row['Highlight'] = val > 100 ? '🔴 High' : val > 50 ? '🟡 Medium' : '🟢 Low';
        });
        if (!state.headers.includes('Highlight')) {
            state.headers.push('Highlight');
        }
        state.filteredData = [...state.data];
        renderDataGrid(state.filteredData);
        populateSelectors();
        saveState();
        showNotification('🎨 Conditional formatting applied!');
    } else {
        showNotification('⚠️ No numeric column found.', 'warning');
    }
}

// ===================== CHARTS =====================
function createChart() {
    const chartType = $('chartType').value;
    const xCol = $('chartX').value;
    const yCol = $('chartY').value;
    
    if (!xCol || !yCol) {
        showNotification('⚠️ Please select both X and Y columns.', 'warning');
        return;
    }
    
    const data = state.filteredData;
    const labels = [];
    const values = [];
    const colorMap = {};
    const colors = ['#4ecdc4', '#ff6b6b', '#f39c12', '#3498db', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c'];
    
    data.forEach(row => {
        const label = String(row[xCol] || '');
        const value = parseFloat(row[yCol]) || 0;
        labels.push(label);
        values.push(value);
    });
    
    // Destroy existing chart
    if (state.chartInstance) {
        state.chartInstance.destroy();
    }
    
    const ctx = document.getElementById('chartCanvas').getContext('2d');
    state.chartInstance = new Chart(ctx, {
        type: chartType,
        data: {
            labels: labels,
            datasets: [{
                label: yCol,
                data: values,
                backgroundColor: chartType === 'pie' || chartType === 'doughnut' 
                    ? colors.slice(0, values.length)
                    : 'rgba(78, 205, 196, 0.6)',
                borderColor: '#4ecdc4',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: `${xCol} vs ${yCol}`
                }
            },
            scales: chartType === 'pie' || chartType === 'doughnut' ? undefined : {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    
    showNotification(`📊 ${chartType.charAt(0).toUpperCase() + chartType.slice(1)} chart created!`);
}

// ===================== AI COPILOT =====================
function generateAISuggestions(data) {
    if (!data || !data.length) return;
    
    const suggestions = [];
    const firstRow = data[0];
    const headers = Object.keys(firstRow);
    
    // Check for numeric columns
    const numericCols = headers.filter(h => {
        return data.some(row => !isNaN(parseFloat(row[h])));
    });
    
    if (numericCols.length > 0) {
        suggestions.push('📊 Create a pivot table to summarize ' + numericCols[0]);
        suggestions.push('📈 Generate a chart for ' + numericCols[0]);
        suggestions.push('🧮 Calculate total for ' + numericCols[0]);
    }
    
    // Check for date columns
    const dateCols = headers.filter(h => {
        return data.some(row => {
            const val = row[h];
            return val && !isNaN(Date.parse(val));
        });
    });
    
    if (dateCols.length > 0) {
        suggestions.push('📅 Analyze trends by ' + dateCols[0]);
    }
    
    // Check for duplicates
    const hasDuplicates = data.length > new Set(data.map(r => JSON.stringify(r))).size;
    if (hasDuplicates) {
        suggestions.push('🔍 Remove duplicate rows');
    }
    
    // Check for missing values
    const hasMissing = data.some(row => {
        return Object.values(row).some(v => v === '' || v === null || v === undefined);
    });
    if (hasMissing) {
        suggestions.push('🔄 Fill missing values');
    }
    
    // Display suggestions
    dom.aiSuggestions.innerHTML = suggestions.map(s => 
        `<span class="chip" onclick="handleChipClick('${s}')">${s}</span>`
    ).join('');
}

function handleChipClick(text) {
    dom.aiQuery.value = text;
    handleAIQuery(text);
}

function handleAIQuery(query) {
    if (!query || !query.trim()) {
        showNotification('⚠️ Please ask something!', 'warning');
        return;
    }
    
    const lower = query.toLowerCase();
    let response = '';
    let action = null;
    
    // Pattern matching for common queries
    if (lower.includes('pivot') || lower.includes('summarize')) {
        const match = lower.match(/by\s+(\w+)/i);
        const col = match ? match[1] : state.headers[0];
        if (state.headers.includes(col)) {
            $('pivotRow').value = col;
            const numCol = state.headers.find(h => /price|sales|amount|total/i.test(h));
            if (numCol) $('pivotValue').value = numCol;
            buildPivot();
            response = `✅ Created a pivot table summarizing by ${col}`;
        } else {
            response = `⚠️ I couldn't find the column "${col}" in your data.`;
        }
    } 
    else if (lower.includes('chart') || lower.includes('graph') || lower.includes('visualize')) {
        const xCol = state.headers[0];
        const yCol = state.headers.find(h => /price|sales|amount|total/i.test(h)) || state.headers[1];
        if (xCol && yCol) {
            $('chartX').value = xCol;
            $('chartY').value = yCol;
            createChart();
            response = `📊 Created a chart with ${xCol} vs ${yCol}`;
        } else {
            response = '⚠️ Not enough data columns to create a chart.';
        }
    }
    else if (lower.includes('total') || lower.includes('sum')) {
        const col = state.headers.find(h => /price|sales|amount|total/i.test(h));
        if (col) {
            const total = state.data.reduce((sum, row) => sum + (parseFloat(row[col]) || 0), 0);
            response = `💰 Total of "${col}": ${total.toFixed(2)}`;
        } else {
            response = '⚠️ No numeric column found to calculate total.';
        }
    }
    else if (lower.includes('filter')) {
        const match = lower.match(/filter\s+(\w+)\s+(equals|contains|greater|less)\s+(.+)/i);
        if (match) {
            const [, col, condition, val] = match;
            if (state.headers.includes(col)) {
                state.filteredData = state.data.filter(row => {
                    const cell = String(row[col] || '').toLowerCase();
                    const search = val.toLowerCase();
                    if (condition.toLowerCase().includes('equal')) return cell === search;
                    if (condition.toLowerCase().includes('contain')) return cell.includes(search);
                    if (condition.toLowerCase().includes('greater')) return parseFloat(cell) > parseFloat(search);
                    if (condition.toLowerCase().includes('less')) return parseFloat(cell) < parseFloat(search);
                    return false;
                });
                renderDataGrid(state.filteredData);
                response = `✅ Filtered data where ${col} ${condition} ${val}`;
            } else {
                response = `⚠️ Column "${col}" not found.`;
            }
        } else {
            response = '⚠️ Please specify filter: "filter column equals value"';
        }
    }
    else if (lower.includes('sort')) {
        const match = lower.match(/sort\s+(\w+)\s+(ascending|descending)/i);
        if (match) {
            const [, col, order] = match;
            if (state.headers.includes(col)) {
                dom.sortColumn.value = col;
                sortData(order === 'ascending' ? 'asc' : 'desc');
                response = `✅ Sorted by ${col} (${order})`;
            } else {
                response = `⚠️ Column "${col}" not found.`;
            }
        } else {
            response = '⚠️ Please specify: "sort column ascending"';
        }
    }
    else if (lower.includes('export') || lower.includes('download')) {
        exportExcel();
        response = '📥 Downloading your data as Excel file...';
    }
    else {
        response = `🤖 I understand you're asking about "${query}". Here's what I can do:\n\n` +
            `• Create pivot tables (say "create pivot by [column]")\n` +
            `• Generate charts (say "create chart for [data]")\n` +
            `• Calculate totals (say "calculate total of [column]")\n` +
            `• Filter data (say "filter [column] equals [value]")\n` +
            `• Sort data (say "sort [column] ascending")\n` +
            `• Export data (say "export data")\n\n` +
            `Try one of these commands!`;
    }
    
    // Show AI response
    showNotification(response);
    dom.aiQuery.value = '';
    
    // Open AI modal if it's a complex query
    if (response.includes('I understand')) {
        const modal = document.getElementById('aiModal');
        if (modal) {
            const chatHistory = document.getElementById('aiChatHistory');
            chatHistory.innerHTML += `
                <div class="ai-message user">${query}</div>
                <div class="ai-message bot">${response.replace(/\n/g, '<br>')}</div>
            `;
            openModal('aiModal');
        }
    }
}

// ===================== VOICE RECOGNITION =====================
let isVoiceListening = false;
let voiceRecognition = null;

function toggleVoiceRecognition() {
    if (isVoiceListening) {
        stopVoiceRecognition();
        return;
    }
    startVoiceRecognition();
}

function startVoiceRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        showNotification('⚠️ Voice recognition is not supported in this browser.', 'warning');
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    voiceRecognition = new SpeechRecognition();
    voiceRecognition.continuous = true;
    voiceRecognition.interimResults = false;
    voiceRecognition.lang = 'en-US';
    
    voiceRecognition.onstart = () => {
        isVoiceListening = true;
        document.querySelector('.voice-dot').style.background = '#ff6b6b';
        showNotification('🎤 Listening... Speak your command');
    };
    
    voiceRecognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        dom.aiQuery.value = transcript;
        handleAIQuery(transcript);
        
        // Speak back
        speakBack('Command received: ' + transcript);
    };
    
    voiceRecognition.onerror = (event) => {
        console.error('Voice error:', event.error);
        if (event.error === 'not-allowed') {
            showNotification('⚠️ Please allow microphone access.', 'warning');
        }
    };
    
    voiceRecognition.onend = () => {
        if (isVoiceListening) {
            // Restart if still listening
            voiceRecognition.start();
        }
    };
    
    voiceRecognition.start();
}

function stopVoiceRecognition() {
    if (voiceRecognition) {
        voiceRecognition.stop();
        voiceRecognition = null;
    }
    isVoiceListening = false;
    document.querySelector('.voice-dot').style.background = '#2ecc71';
    showNotification('🎤 Voice recognition stopped');
}

function speakBack(text) {
    if (!('speechSynthesis' in window)) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
}

// ===================== AUTO-DETECT =====================
function autoDetect() {
    if (!state.data || !state.data.length) {
        showNotification('⚠️ Please upload data first.', 'warning');
        return;
    }
    
    const firstRow = state.data[0];
    const keys = Object.keys(firstRow);
    
    let detectedType = 'general';
    let template = 'general';
    
    // Detect data type
    if (keys.some(k => /price|sales|amount|revenue|invoice|payment/i.test(k))) {
        detectedType = 'finance';
        template = 'finance';
    } else if (keys.some(k => /employee|staff|hire|salary|attendance|leave/i.test(k))) {
        detectedType = 'hr';
        template = 'hr';
    } else if (keys.some(k => /product|item|stock|inventory|supplier|warehouse/i.test(k))) {
        detectedType = 'inventory';
        template = 'inventory';
    } else if (keys.some(k => /project|task|deadline|milestone|assignee|status/i.test(k))) {
        detectedType = 'project';
        template = 'project';
    } else if (keys.some(k => /customer|lead|opportunity|deal|region|territory/i.test(k))) {
        detectedType = 'sales';
        template = 'sales';
    }
    
    // Apply template
    applyTemplate(template);
    
    // Generate suggestions
    generateAISuggestions(state.data);
    
    showNotification(`🔍 Auto-detected: ${detectedType.toUpperCase()} data! Template applied.`);
}

// ===================== TEMPLATES =====================
function applyTemplate(template) {
    if (!state.data || !state.data.length) {
        showNotification('⚠️ Please upload data first.', 'warning');
        return;
    }
    
    const styleMap = {
        'hr': { bg: '#e8f4f8', accent: '#2c3e50', highlight: '#3498db' },
        'finance': { bg: '#f0f8f0', accent: '#1a472a', highlight: '#2ecc71' },
        'sales': { bg: '#fef8e8', accent: '#b8860b', highlight: '#f39c12' },
        'inventory': { bg: '#f8f0e8', accent: '#8b4513', highlight: '#e67e22' },
        'project': { bg: '#f0f0f8', accent: '#4a1a6b', highlight: '#9b59b6' }
    };
    
    const style = styleMap[template] || styleMap['finance'];
    
    // Apply CSS styles dynamically
    const styleTag = document.createElement('style');
    styleTag.id = 'template-style';
    styleTag.textContent = `
        #dataGrid th { 
            background: ${style.accent} !important; 
            color: white !important;
        }
        #dataGrid tr:nth-child(even) td {
            background: ${style.bg} !important;
        }
        #dataGrid tr:hover td {
            background: ${style.highlight}20 !important;
        }
        #dataGrid .total-row td {
            background: ${style.highlight}40 !important;
            font-weight: 700 !important;
        }
    `;
    
    // Remove old template style
    const oldStyle = document.getElementById('template-style');
    if (oldStyle) oldStyle.remove();
    document.head.appendChild(styleTag);
    
    // Re-render to show changes
    renderDataGrid(state.filteredData);
    showNotification(`✅ ${template.charAt(0).toUpperCase() + template.slice(1)} template applied!`);
}

// ===================== MERGE FILES =====================
function mergeFiles() {
    if (state.files.size < 2) {
        showNotification('⚠️ Need at least 2 files to merge.', 'warning');
        return;
    }
    
    const allData = [];
    const allHeaders = new Set();
    
    for (const [id, file] of state.files) {
        allData.push(...file.data);
        file.headers.forEach(h => allHeaders.add(h));
    }
    
    // Create merged data with all headers
    const headers = Array.from(allHeaders);
    const merged = allData.map(row => {
        const newRow = {};
        headers.forEach(h => {
            newRow[h] = row[h] !== undefined ? row[h] : '';
        });
        return newRow;
    });
    
    // Create a new virtual file
    const fileId = 'merged_' + Date.now();
    state.files.set(fileId, {
        id: fileId,
        name: 'Merged_Data.xlsx',
        data: merged,
        headers: headers,
        size: JSON.stringify(merged).length,
        uploaded: new Date(),
        version: 1
    });
    
    state.data = merged;
    state.headers = headers;
    state.filteredData = [...merged];
    state.activeFile = fileId;
    
    renderDataGrid(state.filteredData);
    populateSelectors();
    populateChartSelectors();
    populateFileList();
    updateStats();
    saveState();
    showNotification(`✅ Merged ${state.files.size} files into ${merged.length} rows!`);
}

// ===================== COMPARE FILES =====================
function compareFiles() {
    if (state.files.size < 2) {
        showNotification('⚠️ Need at least 2 files to compare.', 'warning');
        return;
    }
    
    const fileArray = Array.from(state.files.values());
    const file1 = fileArray[0];
    const file2 = fileArray[1];
    
    const data1 = file1.data;
    const data2 = file2.data;
    
    // Find common key (first column)
    const key1 = Object.keys(data1[0] || {})[0];
    const key2 = Object.keys(data2[0] || {})[0];
    
    const map1 = {};
    data1.forEach(row => {
        map1[String(row[key1] || '')] = row;
    });
    
    const map2 = {};
    data2.forEach(row => {
        map2[String(row[key2] || '')] = row;
    });
    
    const differences = {
        onlyInFile1: [],
        onlyInFile2: [],
        common: []
    };
    
    // Find differences
    Object.keys(map1).forEach(key => {
        if (map2[key]) {
            differences.common.push(key);
        } else {
            differences.onlyInFile1.push(key);
        }
    });
    
    Object.keys(map2).forEach(key => {
        if (!map1[key]) {
            differences.onlyInFile2.push(key);
        }
    });
    
    // Show comparison results
    let html = `<h4>📊 File Comparison: ${file1.name} vs ${file2.name}</h4>`;
    html += `<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin: 16px 0;">`;
    html += `<div class="compare-card" style="background: #d1e7dd; padding: 16px; border-radius: 8px;">
        <h5>✅ Common</h5>
        <p style="font-size: 24px; font-weight: 700;">${differences.common.length}</p>
        <p style="font-size: 12px; color: var(--text-light);">${differences.common.slice(0, 5).join(', ')}${differences.common.length > 5 ? '...' : ''}</p>
    </div>`;
    html += `<div class="compare-card" style="background: #f8d7da; padding: 16px; border-radius: 8px;">
        <h5>📄 Only in ${file1.name}</h5>
        <p style="font-size: 24px; font-weight: 700;">${differences.onlyInFile1.length}</p>
        <p style="font-size: 12px; color: var(--text-light);">${differences.onlyInFile1.slice(0, 5).join(', ')}${differences.onlyInFile1.length > 5 ? '...' : ''}</p>
    </div>`;
    html += `<div class="compare-card" style="background: #fff3cd; padding: 16px; border-radius: 8px;">
        <h5>📄 Only in ${file2.name}</h5>
        <p style="font-size: 24px; font-weight: 700;">${differences.onlyInFile2.length}</p>
        <p style="font-size: 12px; color: var(--text-light);">${differences.onlyInFile2.slice(0, 5).join(', ')}${differences.onlyInFile2.length > 5 ? '...' : ''}</p>
    </div>`;
    html += '</div>';
    
    // Show in a modal
    showNotification('📊 Comparison complete! Check the modal.');
    openModalWithContent('Comparison Results', html);
}

// ===================== WORKFLOWS =====================
function loadWorkflows() {
    const saved = localStorage.getItem('sheet_commander_workflows');
    if (saved) {
        state.workflows = JSON.parse(saved);
        renderWorkflows();
    } else {
        // Load default workflows
        state.workflows = [
            {
                id: 'monthly',
                name: 'Monthly Sales Report',
                icon: 'fa-calendar-alt',
                description: 'Clean, pivot, and export monthly data',
                actions: ['filter_date', 'aggregate_sales', 'create_pivot', 'export_excel']
            },
            {
                id: 'cleanup',
                name: 'Data Cleanup',
                icon: 'fa-broom',
                description: 'Remove duplicates, fix formatting',
                actions: ['remove_duplicates', 'fill_missing', 'trim_spaces']
            },
            {
                id: 'compare',
                name: 'Compare Files',
                icon: 'fa-code-branch',
                description: 'Find differences between files',
                actions: ['compare_files', 'highlight_differences']
            }
        ];
        saveWorkflows();
    }
}

function saveWorkflows() {
    localStorage.setItem('sheet_commander_workflows', JSON.stringify(state.workflows));
    renderWorkflows();
}

function renderWorkflows() {
    if (!dom.workflowList) return;
    
    if (!state.workflows.length) {
        dom.workflowList.innerHTML = '<p style="color: var(--text-light); text-align: center; padding: 20px;">No workflows saved</p>';
        return;
    }
    
    let html = '';
    state.workflows.forEach(wf => {
        html += `
            <div class="workflow-card" data-workflow="${wf.id}">
                <i class="fas ${wf.icon || 'fa-robot'}"></i>
                <h4>${wf.name}</h4>
                <p>${wf.description || ''}</p>
                <div style="display: flex; gap: 8px; justify-content: center; margin-top: 8px;">
                    <button class="btn primary small" onclick="runWorkflow('${wf.id}')">▶ Run</button>
                    <button class="btn small" onclick="deleteWorkflow('${wf.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    });
    dom.workflowList.innerHTML = html;
}

function runWorkflow(id) {
    const wf = state.workflows.find(w => w.id === id);
    if (!wf) {
        showNotification('⚠️ Workflow not found.', 'warning');
        return;
    }
    
    showNotification(`▶️ Running workflow: ${wf.name}...`);
    
    // Execute actions
    wf.actions.forEach(action => {
        switch(action) {
            case 'remove_duplicates':
                removeDuplicates();
                break;
            case 'fill_missing':
                fillMissingValues();
                break;
            case 'trim_spaces':
                trimSpaces();
                break;
            case 'filter_date':
                showNotification('📅 Filtering by current month...');
                break;
            case 'aggregate_sales':
                const salesCol = state.headers.find(h => /sales|amount|revenue/i.test(h));
                if (salesCol) {
                    const total = state.data.reduce((sum, row) => sum + (parseFloat(row[salesCol]) || 0), 0);
                    showNotification(`💰 Total ${salesCol}: ${total.toFixed(2)}`);
                }
                break;
            case 'create_pivot':
                const rowCol = state.headers[0];
                const valCol = state.headers.find(h => /sales|amount|total/i.test(h));
                if (rowCol && valCol) {
                    $('pivotRow').value = rowCol;
                    $('pivotValue').value = valCol;
                    buildPivot();
                }
                break;
            case 'export_excel':
                exportExcel();
                break;
            case 'compare_files':
                compareFiles();
                break;
        }
    });
    
    showNotification(`✅ Workflow "${wf.name}" completed!`);
}

function recordWorkflow() {
    state.isRecording = !state.isRecording;
    if (state.isRecording) {
        state.recordingActions = [];
        document.getElementById('workflowRecorder').style.display = 'block';
        showNotification('🔴 Recording workflow... Click on actions to record.');
    } else {
        document.getElementById('workflowRecorder').style.display = 'none';
        showNotification('⏹️ Recording stopped. Actions recorded: ' + state.recordingActions.length);
    }
}

function recordAction(e) {
    if (!state.isRecording) return;
    
    const target = e.target;
    const action = {
        type: target.tagName,
        text: target.textContent || target.value,
        timestamp: new Date().toISOString()
    };
    state.recordingActions.push(action);
    
    const container = document.getElementById('recordedActions');
    container.innerHTML = state.recordingActions.map((a, i) => 
        `<div style="padding: 4px 8px; background: #e8f4f8; margin: 2px 0; border-radius: 4px; font-size: 12px;">
            ${i+1}. ${a.type}: ${a.text}
        </div>`
    ).join('');
}

function stopRecording() {
    state.isRecording = false;
    document.getElementById('workflowRecorder').style.display = 'none';
    
    // Save as workflow
    const name = prompt('Name your workflow:');
    if (name) {
        const wf = {
            id: 'wf_' + Date.now(),
            name: name,
            icon: 'fa-robot',
            description: state.recordingActions.length + ' actions recorded',
            actions: state.recordingActions.map(a => a.text)
        };
        state.workflows.push(wf);
        saveWorkflows();
        showNotification(`✅ Workflow "${name}" saved with ${state.recordingActions.length} actions!`);
    }
}

function deleteWorkflow(id) {
    if (confirm('Delete this workflow?')) {
        state.workflows = state.workflows.filter(w => w.id !== id);
        saveWorkflows();
        showNotification('🗑️ Workflow deleted');
    }
}

// ===================== PLUGINS =====================
function loadPlugins() {
    const saved = localStorage.getItem('sheet_commander_plugins');
    if (saved) {
        state.plugins = JSON.parse(saved);
        renderPlugins();
    } else {
        // Default plugins
        state.plugins = [
            {
                id: 'google-sheets',
                name: 'Google Sheets Sync',
                icon: 'fa-google',
                version: '1.0.0',
                status: 'active',
                description: 'Import/Export from Google Sheets'
            },
            {
                id: 'slack-integration',
                name: 'Slack Reports',
                icon: 'fa-slack',
                version: '0.9.0',
                status: 'inactive',
                description: 'Send reports to Slack'
            }
        ];
        savePlugins();
    }
}

function savePlugins() {
    localStorage.setItem('sheet_commander_plugins', JSON.stringify(state.plugins));
    renderPlugins();
}

function renderPlugins() {
    if (!dom.pluginList) return;
    
    if (!state.plugins.length) {
        dom.pluginList.innerHTML = '<p style="color: var(--text-light); text-align: center; padding: 20px;">No plugins installed</p>';
        return;
    }
    
    let html = '';
    state.plugins.forEach(p => {
        html += `
            <div class="plugin-card">
                <div class="plugin-icon"><i class="fab ${p.icon || 'fa-puzzle-piece'}"></i></div>
                <div class="plugin-name">${p.name}</div>
                <div class="plugin-version">v${p.version}</div>
                <p style="font-size: 12px; color: var(--text-light); margin: 4px 0;">${p.description || ''}</p>
                <span class="plugin-status ${p.status}">${p.status.toUpperCase()}</span>
                <div style="margin-top: 8px;">
                    <button class="btn small" onclick="togglePlugin('${p.id}')">
                        ${p.status === 'active' ? 'Disable' : 'Enable'}
                    </button>
                    <button class="btn small" onclick="uninstallPlugin('${p.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    dom.pluginList.innerHTML = html;
}

function togglePlugin(id) {
    const plugin = state.plugins.find(p => p.id === id);
    if (plugin) {
        plugin.status = plugin.status === 'active' ? 'inactive' : 'active';
        savePlugins();
        showNotification(`🔌 Plugin "${plugin.name}" ${plugin.status}`);
    }
}

function uninstallPlugin(id) {
    if (confirm('Uninstall this plugin?')) {
        state.plugins = state.plugins.filter(p => p.id !== id);
        savePlugins();
        showNotification('🗑️ Plugin uninstalled');
    }
}

function openPluginMarket() {
    showNotification('🌐 Plugin marketplace coming soon!');
}

function installPlugin() {
    const url = prompt('Enter plugin URL or code:');
    if (url) {
        // Simulate installation
        const name = prompt('Plugin name:');
        if (name) {
            state.plugins.push({
                id: 'plugin_' + Date.now(),
                name: name,
                icon: 'fa-puzzle-piece',
                version: '1.0.0',
                status: 'active',
                description: 'Custom plugin'
            });
            savePlugins();
            showNotification(`✅ Plugin "${name}" installed!`);
        }
    }
}

// ===================== COMMENTS =====================
function addComment() {
    const text = dom.commentInput.value.trim();
    if (!text) return;
    
    const comment = {
        id: 'cmt_' + Date.now(),
        text: text,
        user: 'Admin',
        timestamp: new Date().toISOString(),
        cell: 'A1' // For simplicity
    };
    state.comments.push(comment);
    renderComments();
    dom.commentInput.value = '';
    saveState();
}

function renderComments() {
    if (!dom.commentList) return;
    
    if (!state.comments.length) {
        dom.commentList.innerHTML = '<div class="comment-list-empty"><i class="fas fa-comment-dots"></i>No comments yet — leave a note for your team below.</div>';
        return;
    }
    
    let html = '';
    state.comments.slice().reverse().forEach(c => {
        const date = new Date(c.timestamp);
        html += `
            <div class="comment-item">
                <div class="comment-user">${c.user}</div>
                <div class="comment-text">${c.text}</div>
                <div class="comment-time">${date.toLocaleString()}</div>
            </div>
        `;
    });
    dom.commentList.innerHTML = html;
}

// ===================== EXPORT =====================
function exportExcel() {
    const data = state.filteredData.length ? state.filteredData : state.data;
    if (!data || !data.length) {
        showNotification('⚠️ No data to export.', 'warning');
        return;
    }
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, 'SheetCommander_Export.xlsx');
    showNotification('📥 Excel file downloaded!');
}

function exportCSV() {
    const data = state.filteredData.length ? state.filteredData : state.data;
    if (!data || !data.length) {
        showNotification('⚠️ No data to export.', 'warning');
        return;
    }
    
    const headers = Object.keys(data[0]);
    let csv = headers.join(',') + '\n';
    data.forEach(row => {
        const vals = headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`);
        csv += vals.join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SheetCommander_Export.csv';
    a.click();
    showNotification('📥 CSV file downloaded!');
}

function exportPDF() {
    showNotification('📄 PDF export coming soon!');
}

function copyToClipboard() {
    const data = state.filteredData.length ? state.filteredData : state.data;
    if (!data || !data.length) {
        showNotification('⚠️ No data to copy.', 'warning');
        return;
    }
    
    const headers = Object.keys(data[0]);
    let text = headers.join('\t') + '\n';
    data.forEach(row => {
        const vals = headers.map(h => row[h] || '');
        text += vals.join('\t') + '\n';
    });
    
    navigator.clipboard.writeText(text).then(() => {
        showNotification('📋 Copied to clipboard!');
    }).catch(() => {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showNotification('📋 Copied to clipboard!');
    });
}

function shareReport() {
    showNotification('🔗 Share link: https://sheetcommander.app/report_' + Date.now());
}

function scheduleReport() {
    const type = $('scheduleType').value;
    const time = $('scheduleTime').value;
    showNotification(`📅 Report scheduled ${type} at ${time}`);
}

// ===================== DASHBOARD WIDGETS =====================
function openWidgetLibrary() {
    openModal('widgetModal');
}

function addWidget(type) {
    const widget = {
        id: 'w_' + Date.now(),
        type: type,
        title: type.charAt(0).toUpperCase() + type.slice(1),
        data: state.filteredData || state.data
    };
    state.dashboardWidgets.push(widget);
    renderDashboard();
    closeModal('widgetModal');
    showNotification(`✅ Widget "${widget.title}" added!`);
}

function renderDashboard() {
    if (!dom.dashboardGrid) return;
    
    if (!state.dashboardWidgets.length) {
        dom.dashboardGrid.innerHTML = `
            <div class="widget-placeholder">
                <i class="fas fa-plus-circle"></i>
                <p>Add Widgets to Your Dashboard</p>
                <button class="btn primary" onclick="openWidgetLibrary()">➕ Add Widget</button>
            </div>
        `;
        return;
    }
    
    let html = '';
    state.dashboardWidgets.forEach(w => {
        let content = '';
        switch(w.type) {
            case 'chart':
                content = `<div style="height: 150px; background: var(--bg); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--text-light);">
                    📊 Chart Widget
                </div>`;
                break;
            case 'pie':
                content = `<div style="height: 150px; background: var(--bg); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--text-light);">
                    🥧 Pie Chart
                </div>`;
                break;
            case 'grid':
                content = `<div style="height: 150px; background: var(--bg); border-radius: 8px; overflow: auto; font-size: 12px; padding: 8px;">
                    ${w.data && w.data.length ? `${w.data.length} rows` : 'No data'}
                </div>`;
                break;
            case 'kpi':
                const value = w.data && w.data.length ? w.data.length : '0';
                content = `
                    <div style="text-align: center; padding: 20px;">
                        <div style="font-size: 32px; font-weight: 700; color: var(--secondary);">${value}</div>
                        <div style="color: var(--text-light);">Total Records</div>
                    </div>
                `;
                break;
            default:
                content = `<div style="height: 150px; background: var(--bg); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--text-light);">
                    ${w.title}
                </div>`;
        }
        
        html += `
            <div class="widget-card" draggable="true" data-widget="${w.id}">
                <div class="widget-header">
                    <h4>${w.title}</h4>
                    <div class="widget-actions">
                        <button onclick="removeWidget('${w.id}')"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <div class="widget-body">
                    ${content}
                </div>
            </div>
        `;
    });
    dom.dashboardGrid.innerHTML = html;
}

function removeWidget(id) {
    state.dashboardWidgets = state.dashboardWidgets.filter(w => w.id !== id);
    renderDashboard();
    saveState();
}

// ===================== MODALS =====================
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('show');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('show');
}

function openModalWithContent(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px;">
            <div class="modal-header">
                <h3>${title}</h3>
                <button onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">${content}</div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Close modals on backdrop click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('show');
    }
});

// ===================== NOTIFICATIONS =====================
function showNotification(message, type = 'info') {
    const colors = {
        info: 'var(--secondary)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        error: 'var(--accent)'
    };
    
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: var(--primary);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        z-index: 9999;
        max-width: 450px;
        animation: slideUp 0.3s ease;
        border-left: 4px solid ${colors[type] || colors.info};
        font-size: 14px;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// ===================== UTILITY FUNCTIONS =====================
function removeDuplicates() {
    const seen = new Set();
    state.data = state.data.filter(row => {
        const key = JSON.stringify(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    state.filteredData = [...state.data];
    renderDataGrid(state.filteredData);
    updateStats();
    saveState();
    showNotification(`✅ Removed duplicates! ${state.data.length} rows remaining.`);
}

function fillMissingValues() {
    state.data.forEach(row => {
        Object.keys(row).forEach(key => {
            if (row[key] === '' || row[key] === null || row[key] === undefined) {
                row[key] = 'N/A';
            }
        });
    });
    state.filteredData = [...state.data];
    renderDataGrid(state.filteredData);
    saveState();
    showNotification('✅ Missing values filled with "N/A"');
}

function trimSpaces() {
    state.data.forEach(row => {
        Object.keys(row).forEach(key => {
            if (typeof row[key] === 'string') {
                row[key] = row[key].trim();
            }
        });
    });
    state.filteredData = [...state.data];
    renderDataGrid(state.filteredData);
    saveState();
    showNotification('✅ Extra spaces removed from all fields');
}

// ===================== INITIAL RENDER =====================
renderDataGrid([]);
populateSelectors();
updateStats();
console.log('✅ Sheet Commander Pro ready!');