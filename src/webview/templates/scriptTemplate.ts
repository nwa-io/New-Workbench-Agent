import { tools } from '../data/tools';
import { models } from '../data/models';
import { departmentIcons } from '../data/departments';
import { agentDescriptions } from '../data/agentDescriptions';

export function getScriptContent(): string {
  return `
    <script type="module">
      // Import Simple Icons
      import * as simpleIcons from 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/+esm';

      const vscode = acquireVsCodeApi();

      const tools = ${JSON.stringify(tools, null, 2)};
      const models = ${JSON.stringify(models, null, 2)};
      const departmentIcons = ${JSON.stringify(departmentIcons, null, 2)};
      const agentDescriptions = ${JSON.stringify(agentDescriptions, null, 2)};

      let selectedTool = 'cursor';
      let selectedDepartments = new Set();
      let selectedModel = 'sonnet';
      let selectedAgents = [];
      let departments = {};
      let favoriteAgents = [];
      let searchQuery = '';

      // Helper to get Simple Icon SVG
      function getSimpleIconSvg(iconName) {
        try {
          const iconKey = 'si' + iconName.charAt(0).toUpperCase() + iconName.slice(1);
          const icon = simpleIcons[iconKey];
          if (icon) {
            return \`<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor">\${icon.svg.replace('<svg', '').replace('</svg>', '').replace(/^[^>]*>/, '')}</svg>\`;
          }
        } catch (e) {
          console.warn('Icon not found:', iconName);
        }
        return '<div style="width: 20px; height: 20px;"></div>';
      }

      // Request departments and favorites data
      vscode.postMessage({ command: 'getDepartments' });
      vscode.postMessage({ command: 'getFavorites' });

      // Search functionality
      const searchInput = document.getElementById('searchInput');
      const clearSearchBtn = document.getElementById('clearSearchBtn');

      searchInput.oninput = (e) => {
        searchQuery = e.target.value.toLowerCase();
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
        filterDisplay();
      };

      clearSearchBtn.onclick = () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        filterDisplay();
      };

      function filterDisplay() {
        if (!searchQuery) {
          // Show all departments
          document.querySelectorAll('.department-card').forEach(card => {
            card.style.display = 'block';
          });
        } else {
          // Filter departments based on search
          document.querySelectorAll('.department-card').forEach(card => {
            const deptId = card.querySelector('.department-header').dataset.deptId;
            const dept = departments[deptId];
            if (!dept) return;

            // Check department name
            const deptMatch = dept.name.toLowerCase().includes(searchQuery);

            // Check agents in department
            const agentMatch = dept.agents.some(agent =>
              agent.toLowerCase().includes(searchQuery) ||
              (agentDescriptions[agent] || '').toLowerCase().includes(searchQuery)
            );

            card.style.display = (deptMatch || agentMatch) ? 'block' : 'none';
          });
        }

        // Re-render agents list to apply filter
        renderAgentsList();
      }

      // Render tools
      const toolGrid = document.getElementById('toolGrid');
      tools.forEach(tool => {
        const card = document.createElement('div');
        card.className = 'tool-card' + (tool.id === selectedTool ? ' selected' : '');
        card.innerHTML = \`
          <div class="selected-badge">Selected</div>
          <div class="tool-header">
            \${getSimpleIconSvg(tool.icon)}
            <span class="tool-name">\${tool.name}</span>
          </div>
          <div class="tool-desc">\${tool.desc}</div>
        \`;
        card.onclick = () => selectTool(tool.id);
        toolGrid.appendChild(card);
      });

      function selectTool(toolId) {
        selectedTool = toolId;
        document.querySelectorAll('.tool-card').forEach((card, i) => {
          card.classList.toggle('selected', tools[i].id === toolId);
        });

        // Show/hide model step based on tool selection
        const modelStep = document.getElementById('modelStep');
        if (toolId === 'claude-code') {
          modelStep.style.display = 'block';
          if (!document.getElementById('modelGrid').hasChildNodes()) {
            renderModels();
          }
        } else {
          modelStep.style.display = 'none';
        }

        updateSummary();
      }

      function renderModels() {
        const modelGrid = document.getElementById('modelGrid');
        modelGrid.innerHTML = '';

        models.forEach(model => {
          const card = document.createElement('div');
          card.className = 'model-card' + (model.id === selectedModel ? ' selected' : '');
          card.innerHTML = \`
            <div class="selected-badge">Selected</div>
            <div class="model-name">\${model.name}</div>
            <div class="model-desc">\${model.desc}</div>
          \`;
          card.onclick = () => selectModel(model.id);
          modelGrid.appendChild(card);
        });
      }

      function selectModel(modelId) {
        selectedModel = modelId;
        document.querySelectorAll('.model-card').forEach((card, i) => {
          card.classList.toggle('selected', models[i].id === modelId);
        });
        updateSummary();
      }

      // Listen for messages from extension
      window.addEventListener('message', event => {
        const message = event.data;
        if (message.command === 'departmentsData') {
          departments = message.data;
          renderDepartments();
        } else if (message.command === 'favoritesData') {
          favoriteAgents = message.data || [];
          renderFavorites();
          if (selectedDepartments.size > 0) {
            renderAgentsList();
          }
        } else if (message.command === 'installComplete') {
          // Handle install complete
        }
      });

      function renderFavorites() {
        const favoritesSection = document.getElementById('favoritesSection');
        const favoritesGrid = document.getElementById('favoritesGrid');

        if (favoriteAgents.length === 0) {
          favoritesSection.style.display = 'none';
          return;
        }

        favoritesSection.style.display = 'block';
        favoritesGrid.innerHTML = '';

        favoriteAgents.forEach(agentId => {
          // Find department for this agent
          let agentDept = null;
          let agentDeptName = null;

          for (const [deptId, dept] of Object.entries(departments)) {
            if (dept.agents && dept.agents.includes(agentId)) {
              agentDept = deptId;
              agentDeptName = dept.name;
              break;
            }
          }

          const isSelected = selectedAgents.includes(agentId);

          const chip = document.createElement('div');
          chip.className = 'favorite-chip' + (isSelected ? ' selected' : '');
          chip.dataset.agentId = agentId;
          chip.dataset.deptId = agentDept || '';
          chip.innerHTML = \`
            <span class="favorite-chip-star">&#9733;</span>
            <span class="favorite-chip-name">\${agentId}</span>
            \${isSelected ? '<span class="favorite-chip-check">&#10003;</span>' : ''}
            <span class="favorite-chip-remove" title="Remove from favorites">&times;</span>
          \`;

          // Click on chip to toggle selection
          chip.onclick = (e) => {
            if (e.target.classList.contains('favorite-chip-remove')) return;

            const chipAgentId = chip.dataset.agentId;
            const chipDeptId = chip.dataset.deptId;

            // Toggle selection
            if (selectedAgents.includes(chipAgentId)) {
              selectedAgents = selectedAgents.filter(id => id !== chipAgentId);
            } else {
              selectedAgents.push(chipAgentId);
              // Also select the department if not selected
              if (chipDeptId && !selectedDepartments.has(chipDeptId)) {
                selectedDepartments.add(chipDeptId);
                // Update department card
                const deptCard = document.querySelector(\`[data-dept-id="\${chipDeptId}"]\`)?.closest('.department-card');
                if (deptCard) deptCard.classList.add('selected');
              }
            }
            renderFavorites();
            renderAgentsList();
            updateSummary();
          };

          // Remove from favorites
          const removeBtn = chip.querySelector('.favorite-chip-remove');
          if (removeBtn) {
            removeBtn.onclick = (e) => {
              e.stopPropagation();
              vscode.postMessage({
                command: 'toggleFavorite',
                data: { agentId: agentId }
              });
            };
          }

          favoritesGrid.appendChild(chip);
        });
      }

      function renderDepartments() {
        const deptGrid = document.getElementById('departmentGrid');
        deptGrid.innerHTML = '';

        Object.entries(departments).forEach(([deptId, dept]) => {
          const card = document.createElement('div');
          card.className = 'department-card';
          const icon = departmentIcons[deptId] || '📁';

          card.innerHTML = \`
            <div class="selected-badge">Selected</div>
            <div class="department-header" data-dept-id="\${deptId}">
              <div class="department-info">
                <div class="department-name-row">
                  <span class="department-icon">\${icon}</span>
                  <div class="department-name">
                    \${dept.name}
                    <span class="agent-count">\${dept.agents.length}</span>
                  </div>
                </div>
                <div class="department-desc">\${dept.description}</div>
              </div>
            </div>
          \`;

          card.onclick = () => toggleDepartment(deptId, card);

          deptGrid.appendChild(card);
        });

        // Re-render favorites after departments are loaded
        renderFavorites();
      }

      function toggleDepartment(deptId, card) {
        // Toggle selection
        if (selectedDepartments.has(deptId)) {
          selectedDepartments.delete(deptId);
          card.classList.remove('selected');
        } else {
          selectedDepartments.add(deptId);
          card.classList.add('selected');
        }

        renderAgentsList();
        updateSummary();
      }

      function renderAgentsList() {
        const agentsStep = document.getElementById('agentsStep');
        const agentsList = document.getElementById('agentsList');

        if (selectedDepartments.size === 0) {
          agentsStep.style.display = 'none';
          return;
        }

        agentsStep.style.display = 'block';
        agentsList.innerHTML = '';

        selectedDepartments.forEach(deptId => {
          const dept = departments[deptId];
          if (!dept) return;

          // Filter agents if search is active
          let agents = dept.agents;
          if (searchQuery) {
            agents = agents.filter(agent =>
              agent.toLowerCase().includes(searchQuery) ||
              (agentDescriptions[agent] || '').toLowerCase().includes(searchQuery)
            );
          }

          if (agents.length === 0) return;

          const deptSection = document.createElement('div');
          deptSection.className = 'agents-list';

          const deptHeader = document.createElement('div');
          deptHeader.className = 'select-all-container';
          deptHeader.innerHTML = \`
            <div class="select-all-item">
              <input type="checkbox" class="select-all-checkbox" id="select-all-\${deptId}" data-dept="\${deptId}">
              <span>\${dept.name} (Select All\${searchQuery ? ' Filtered' : ''})</span>
            </div>
          \`;
          deptSection.appendChild(deptHeader);

          agents.forEach(agent => {
            const isFavorite = favoriteAgents.includes(agent);
            const isSelected = selectedAgents.includes(agent);

            const agentItem = document.createElement('div');
            agentItem.className = 'agent-item';
            agentItem.innerHTML = \`
              <input type="checkbox" class="agent-checkbox" data-dept="\${deptId}" data-agent="\${agent}" \${isSelected ? 'checked' : ''}>
              <div class="agent-details">
                <div class="agent-name">\${agent}</div>
                <div class="agent-description">\${agentDescriptions[agent] || ''}</div>
              </div>
              <span class="agent-favorite-btn \${isFavorite ? 'is-favorite' : ''}" data-agent="\${agent}" title="\${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                \${isFavorite ? '&#9733;' : '&#9734;'}
              </span>
            \`;
            deptSection.appendChild(agentItem);
          });

          agentsList.appendChild(deptSection);
        });

        // Add event listeners for checkboxes
        document.querySelectorAll('.agent-checkbox').forEach(checkbox => {
          checkbox.onchange = () => {
            const agentId = checkbox.dataset.agent;
            if (checkbox.checked) {
              if (!selectedAgents.includes(agentId)) {
                selectedAgents.push(agentId);
              }
            } else {
              selectedAgents = selectedAgents.filter(id => id !== agentId);
            }
            updateSelectAllCheckbox(checkbox.dataset.dept);
            renderFavorites();
            updateSummary();
          };
        });

        // Add click handlers for agent details to toggle checkbox
        document.querySelectorAll('.agent-details').forEach(details => {
          details.onclick = () => {
            const checkbox = details.parentElement.querySelector('.agent-checkbox');
            if (checkbox) {
              checkbox.checked = !checkbox.checked;
              checkbox.onchange();
            }
          };
        });

        // Add click handlers for favorite buttons
        document.querySelectorAll('.agent-favorite-btn').forEach(btn => {
          btn.onclick = (e) => {
            e.stopPropagation();
            const agentId = btn.dataset.agent;
            vscode.postMessage({
              command: 'toggleFavorite',
              data: { agentId: agentId }
            });
          };
        });

        // Select all checkbox handlers
        document.querySelectorAll('.select-all-checkbox').forEach(checkbox => {
          checkbox.onchange = function() {
            const deptId = this.dataset.dept;
            const checked = this.checked;
            document.querySelectorAll(\`.agent-checkbox[data-dept="\${deptId}"]\`).forEach(cb => {
              cb.checked = checked;
              const agentId = cb.dataset.agent;
              if (checked) {
                if (!selectedAgents.includes(agentId)) {
                  selectedAgents.push(agentId);
                }
              } else {
                selectedAgents = selectedAgents.filter(id => id !== agentId);
              }
            });
            renderFavorites();
            updateSummary();
          };

          // Update initial state
          updateSelectAllCheckbox(checkbox.dataset.dept);
        });

        // Make select-all labels clickable
        document.querySelectorAll('.select-all-item').forEach(item => {
          const label = item.querySelector('span');
          if (label) {
            label.onclick = () => {
              const checkbox = item.querySelector('.select-all-checkbox');
              if (checkbox) {
                checkbox.checked = !checkbox.checked;
                // Dispatch a proper change event to trigger the handler with correct context
                checkbox.dispatchEvent(new Event('change'));
              }
            };
          }
        });

        updateSummary();
      }

      function updateSelectAllCheckbox(deptId) {
        const allCheckboxes = document.querySelectorAll(\`.agent-checkbox[data-dept="\${deptId}"]\`);
        const checkedCount = Array.from(allCheckboxes).filter(cb => cb.checked).length;
        const selectAllCheckbox = document.getElementById(\`select-all-\${deptId}\`);

        if (selectAllCheckbox) {
          selectAllCheckbox.checked = checkedCount === allCheckboxes.length && allCheckboxes.length > 0;
          selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < allCheckboxes.length;
        }
      }

      function updateSummary() {
        const folder = document.getElementById('folderInput').value ||
                      tools.find(t => t.id === selectedTool).folder;

        const totalAgents = selectedAgents.length;

        const deptNames = Array.from(selectedDepartments)
          .map(id => departments[id]?.name)
          .filter(Boolean);

        document.getElementById('summaryTool').textContent =
          tools.find(t => t.id === selectedTool).name;
        document.getElementById('summaryFolder').textContent = folder;

        // Show model only for Claude Code
        const summaryModelItem = document.getElementById('summaryModelItem');
        if (selectedTool === 'claude-code') {
          summaryModelItem.style.display = 'flex';
          document.getElementById('summaryModel').textContent =
            models.find(m => m.id === selectedModel)?.name || 'Sonnet';
        } else {
          summaryModelItem.style.display = 'none';
        }

        document.getElementById('summaryDepts').textContent =
          deptNames.join(', ') || 'None';
        document.getElementById('summaryAgents').textContent =
          \`\${totalAgents} selected\`;

        document.getElementById('summary').style.display =
          totalAgents > 0 ? 'block' : 'none';

        // Enable/disable install button
        const installBtn = document.getElementById('installBtn');
        installBtn.disabled = totalAgents === 0;
      }

      document.getElementById('folderInput').oninput = updateSummary;

      document.getElementById('installBtn').onclick = () => {
        const folder = document.getElementById('folderInput').value ||
                      tools.find(t => t.id === selectedTool).folder;

        // Build agent paths from selectedAgents
        const agentPaths = selectedAgents.map(agentId => {
          // Find the department for this agent
          for (const [deptId, dept] of Object.entries(departments)) {
            if (dept.agents && dept.agents.includes(agentId)) {
              return \`\${deptId}/\${agentId}\`;
            }
          }
          return null;
        }).filter(Boolean);

        const selectedDepts = [...new Set(agentPaths.map(path => path.split('/')[0]))];

        if (agentPaths.length === 0) {
          return;
        }

        vscode.postMessage({
          command: 'install',
          data: {
            tool: selectedTool,
            folder: folder,
            departments: selectedDepts,
            agents: agentPaths,
            model: selectedTool === 'claude-code' ? selectedModel : undefined
          }
        });
      };

      document.getElementById('cancelBtn').onclick = () => {
        vscode.postMessage({ command: 'cancel' });
      };

      setTimeout(updateSummary, 100);
    </script>
  `;
}
