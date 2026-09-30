/**
 * Gates of Babylon - Minimal Drag & Drop Logic Circuit Simulator
 * Talks to C++ backend via FastAPI
 */

(function () {
  'use strict';

  const state = {
    nodes: [],
    wires: [],
    selectedNodeId: null,
    selectedWireId: null,
    scale: 1.0,
    panX: 60,
    panY: 60,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    connecting: null, // { nodeId, port, isOutput, mousePos }
  };

  const GATE_TYPES = {
    1: { name: 'NOT', inputs: 1, svg: renderNotSvg },
    2: { name: 'AND', inputs: 2, svg: renderAndSvg },
    3: { name: 'OR', inputs: 2, svg: renderOrSvg },
    4: { name: 'NAND', inputs: 2, svg: renderNandSvg },
    5: { name: 'NOR', inputs: 2, svg: renderNorSvg },
    6: { name: 'XOR', inputs: 2, svg: renderXorSvg },
  };

  // DOM Elements
  const canvasWrapper = document.getElementById('canvasWrapper');
  const circuitCanvas = document.getElementById('circuitCanvas');
  const wireLayer = document.getElementById('wireLayer');
  const nodesContainer = document.getElementById('nodesContainer');
  const btnTruthTable = document.getElementById('btnTruthTable');
  const btnClear = document.getElementById('btnClear');
  const btnZoomIn = document.getElementById('btnZoomIn');
  const btnZoomOut = document.getElementById('btnZoomOut');
  const btnFitView = document.getElementById('btnFitView');
  const btnDeleteSelected = document.getElementById('btnDeleteSelected');
  const zoomLevelDisplay = document.getElementById('zoomLevel');
  const truthTableModal = document.getElementById('truthTableModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnCopyTable = document.getElementById('btnCopyTable');
  const truthTableContainer = document.getElementById('truthTableContainer');
  const truthTableSummary = document.getElementById('truthTableSummary');

  // Logic Gate SVG Glyphs (Clean Stroke, Off-White / Blue Accent)
  function renderNotSvg() {
    return `<svg width="52" height="30" viewBox="0 0 54 32">
      <polygon points="8,4 38,16 8,28" fill="#18181b" stroke="#e4e4e7" stroke-width="2"/>
      <circle cx="43" cy="16" r="3.5" fill="#18181b" stroke="#e4e4e7" stroke-width="2"/>
    </svg>`;
  }

  function renderAndSvg() {
    return `<svg width="52" height="30" viewBox="0 0 54 32">
      <path d="M8,4 L26,4 C36,4 44,9.5 44,16 C44,22.5 36,28 26,28 L8,28 Z" fill="#18181b" stroke="#e4e4e7" stroke-width="2"/>
    </svg>`;
  }

  function renderOrSvg() {
    return `<svg width="52" height="30" viewBox="0 0 54 32">
      <path d="M8,4 Q20,16 8,28 Q30,28 44,16 Q30,4 8,4 Z" fill="#18181b" stroke="#e4e4e7" stroke-width="2"/>
    </svg>`;
  }

  function renderNandSvg() {
    return `<svg width="56" height="30" viewBox="0 0 58 32">
      <path d="M8,4 L24,4 C34,4 40,9.5 40,16 C40,22.5 34,28 24,28 L8,28 Z" fill="#18181b" stroke="#e4e4e7" stroke-width="2"/>
      <circle cx="45" cy="16" r="3.5" fill="#18181b" stroke="#e4e4e7" stroke-width="2"/>
    </svg>`;
  }

  function renderNorSvg() {
    return `<svg width="56" height="30" viewBox="0 0 58 32">
      <path d="M8,4 Q18,16 8,28 Q28,28 40,16 Q28,4 8,4 Z" fill="#18181b" stroke="#e4e4e7" stroke-width="2"/>
      <circle cx="45" cy="16" r="3.5" fill="#18181b" stroke="#e4e4e7" stroke-width="2"/>
    </svg>`;
  }

  function renderXorSvg() {
    return `<svg width="56" height="30" viewBox="0 0 58 32">
      <path d="M5,4 Q17,16 5,28" fill="none" stroke="#e4e4e7" stroke-width="2"/>
      <path d="M11,4 Q21,16 11,28 Q32,28 45,16 Q32,4 11,4 Z" fill="#18181b" stroke="#e4e4e7" stroke-width="2"/>
    </svg>`;
  }

  function init() {
    setupEventListeners();
    updateCanvasTransform();
    // Starts with a clean, blank canvas as requested
    renderNodes();
  }

  // Exact Pixel-Perfect Canvas Coordinate Transformation
  function getCanvasCoords(clientX, clientY) {
    const rect = canvasWrapper.getBoundingClientRect();
    return {
      x: (clientX - rect.left - state.panX) / state.scale,
      y: (clientY - rect.top - state.panY) / state.scale,
    };
  }

  // Update canvas position, scale, and infinite background grid dots
  function updateCanvasTransform() {
    circuitCanvas.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;
    zoomLevelDisplay.textContent = `${Math.round(state.scale * 100)}%`;

    // Seamless infinite grid dots tracking pan and zoom across 100% of viewport
    const dotSpacing = 24 * state.scale;
    canvasWrapper.style.backgroundSize = `${dotSpacing}px ${dotSpacing}px`;
    canvasWrapper.style.backgroundPosition = `${state.panX}px ${state.panY}px`;
  }

  let nextNodeId = 1;

  function createInputNode(x, y) {
    const id = `in-${nextNodeId++}`;
    return {
      id,
      type: 'input',
      x: Math.round(x / 10) * 10,
      y: Math.round(y / 10) * 10,
      state: 0,
      label: 'In',
      index: -1,
    };
  }

  function createGateNode(x, y, gateType) {
    const id = `gate-${nextNodeId++}`;
    const def = GATE_TYPES[gateType];
    return {
      id,
      type: 'gate',
      gateType: parseInt(gateType, 10),
      typeName: def.name,
      x: Math.round(x / 10) * 10,
      y: Math.round(y / 10) * 10,
      state: 0,
      label: def.name,
      index: -1,
    };
  }

  function createOutputNode(x, y) {
    const id = `out-${nextNodeId++}`;
    return {
      id,
      type: 'output',
      x: Math.round(x / 10) * 10,
      y: Math.round(y / 10) * 10,
      state: 0,
      label: 'Out',
    };
  }

  function renderNodes() {
    nodesContainer.innerHTML = '';
    state.nodes.forEach((node) => {
      const el = document.createElement('div');
      el.id = `el-${node.id}`;
      el.style.left = `${node.x}px`;
      el.style.top = `${node.y}px`;

      if (node.type === 'input') {
        el.className = `circuit-node node-input ${node.state ? 'active' : ''} ${state.selectedNodeId === node.id ? 'selected' : ''}`;
        el.innerHTML = `
          <div class="pin-inner" data-toggle="${node.id}">
            <span class="pin-label">${node.index >= 0 ? `In ${node.index}` : 'In'}</span>
            <span class="pin-val">${node.state ? '1' : '0'}</span>
          </div>
          <div class="port port-out" data-node="${node.id}" data-port="out"></div>
          <button class="node-delete-btn" data-delete="${node.id}">&times;</button>
        `;
      } else if (node.type === 'gate') {
        const def = GATE_TYPES[node.gateType];
        const isSingleInput = def.inputs === 1;

        el.className = `circuit-node node-gate ${state.selectedNodeId === node.id ? 'selected' : ''}`;
        el.innerHTML = `
          <div class="gate-header">
            <span class="gate-badge">${node.typeName}</span>
          </div>
          <div class="gate-main-view">
            <div class="gate-svg-wrap">${def.svg()}</div>
            <div class="gate-output-led">
              <span class="led-indicator ${node.state ? 'active' : ''}"></span>
              <span class="led-val ${node.state ? 'active' : ''}">${node.state ? '1' : '0'}</span>
            </div>
          </div>
          ${
            isSingleInput
              ? `<div class="port port-in-single" data-node="${node.id}" data-port="in1"></div>`
              : `<div class="port port-in-top" data-node="${node.id}" data-port="in1"></div>
                 <div class="port port-in-bottom" data-node="${node.id}" data-port="in2"></div>`
          }
          <div class="port port-out" data-node="${node.id}" data-port="out"></div>
          <button class="node-delete-btn" data-delete="${node.id}">&times;</button>
        `;
      } else if (node.type === 'output') {
        el.className = `circuit-node node-output ${node.state ? 'active' : ''} ${state.selectedNodeId === node.id ? 'selected' : ''}`;
        el.innerHTML = `
          <div class="pin-inner">
            <span class="pin-label">Out</span>
            <span class="pin-val">${node.state ? '1' : '0'}</span>
          </div>
          <div class="port port-in-single" data-node="${node.id}" data-port="in"></div>
          <button class="node-delete-btn" data-delete="${node.id}">&times;</button>
        `;
      }

      nodesContainer.appendChild(el);
      setupNodeDrag(el, node);
    });

    updatePortConnections();
    renderWires();
  }

  function updatePortConnections() {
    document.querySelectorAll('.port').forEach((p) => {
      p.classList.remove('port-connected', 'port-active');
      const nid = p.dataset.node;
      const port = p.dataset.port;
      const node = state.nodes.find((n) => n.id === nid);
      if (!node) return;

      const hasWire = state.wires.some(
        (w) => (w.fromNode === nid && port === 'out') || (w.toNode === nid && w.toPort === port)
      );
      if (hasWire) {
        p.classList.add('port-connected');
        if (node.state) p.classList.add('port-active');
      }
    });
  }

  function setupNodeDrag(el, node) {
    let isDragging = false;
    let startX, startY;
    let initialNodeX, initialNodeY;

    el.addEventListener('mousedown', (e) => {
      if (e.target.closest('.port') || e.target.closest('.node-delete-btn')) {
        return;
      }

      // Clicking input pin toggles its 0 / 1 state
      if (node.type === 'input' && e.target.closest('.pin-inner')) {
        node.state = node.state ? 0 : 1;
        renderNodes();
        triggerSimulation();
        return;
      }

      e.stopPropagation();

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialNodeX = node.x;
      initialNodeY = node.y;

      selectNode(node.id);

      const onMouseMove = (ev) => {
        if (!isDragging) return;
        const dx = (ev.clientX - startX) / state.scale;
        const dy = (ev.clientY - startY) / state.scale;
        node.x = Math.round((initialNodeX + dx) / 10) * 10;
        node.y = Math.round((initialNodeY + dy) / 10) * 10;
        el.style.left = `${node.x}px`;
        el.style.top = `${node.y}px`;
        renderWires();
      };

      const onMouseUp = () => {
        isDragging = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        renderWires();
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    const delBtn = el.querySelector('.node-delete-btn');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNode(node.id);
      });
    }
  }

  function selectNode(nodeId) {
    state.selectedNodeId = nodeId;
    state.selectedWireId = null;
    document.querySelectorAll('.circuit-node').forEach((el) => {
      el.classList.toggle('selected', el.id === `el-${nodeId}`);
    });
    document.querySelectorAll('.wire').forEach((w) => w.classList.remove('selected'));
  }

  function selectWire(wireId) {
    state.selectedWireId = wireId;
    state.selectedNodeId = null;
    document.querySelectorAll('.circuit-node').forEach((el) => el.classList.remove('selected'));
    document.querySelectorAll('.wire').forEach((w) => {
      w.classList.toggle('selected', w.dataset.wireId === wireId);
    });
  }

  function deleteNode(nodeId) {
    state.nodes = state.nodes.filter((n) => n.id !== nodeId);
    state.wires = state.wires.filter((w) => w.fromNode !== nodeId && w.toNode !== nodeId);
    if (state.selectedNodeId === nodeId) state.selectedNodeId = null;
    renderNodes();
    triggerSimulation();
  }

  function deleteSelected() {
    if (state.selectedNodeId) {
      deleteNode(state.selectedNodeId);
    } else if (state.selectedWireId) {
      state.wires = state.wires.filter((w) => w.id !== state.selectedWireId);
      state.selectedWireId = null;
      renderWires();
      triggerSimulation();
    }
  }

  function getPortPosition(nodeId, portName) {
    const nodeEl = document.getElementById(`el-${nodeId}`);
    if (!nodeEl) return null;
    const portEl = nodeEl.querySelector(`.port[data-port="${portName}"]`);
    if (!portEl) return null;

    const rect = portEl.getBoundingClientRect();
    return getCanvasCoords(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function renderWires() {
    wireLayer.innerHTML = '';

    // Draw active connecting wire (temporary)
    if (state.connecting && state.connecting.mousePos) {
      const p1 = getPortPosition(state.connecting.nodeId, state.connecting.port);
      if (p1) {
        const p2 = state.connecting.mousePos;
        const d = createBezierPath(p1.x, p1.y, p2.x, p2.y);
        const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempPath.setAttribute('d', d);
        tempPath.setAttribute('class', 'wire-temp');
        wireLayer.appendChild(tempPath);
      }
    }

    // Draw confirmed wires
    state.wires.forEach((wire) => {
      const p1 = getPortPosition(wire.fromNode, wire.fromPort);
      const p2 = getPortPosition(wire.toNode, wire.toPort);
      if (!p1 || !p2) return;

      const fromNode = state.nodes.find((n) => n.id === wire.fromNode);
      const signalHigh = fromNode && fromNode.state === 1;

      const d = createBezierPath(p1.x, p1.y, p2.x, p2.y);

      // Invisible fat wire for easy clicking
      const bgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      bgPath.setAttribute('d', d);
      bgPath.setAttribute('class', 'wire-bg');
      bgPath.dataset.wireId = wire.id;
      bgPath.addEventListener('click', (e) => {
        e.stopPropagation();
        selectWire(wire.id);
      });
      wireLayer.appendChild(bgPath);

      // Visible wire
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute(
        'class',
        `wire ${signalHigh ? 'high' : 'low'} ${state.selectedWireId === wire.id ? 'selected' : ''}`
      );
      path.dataset.wireId = wire.id;
      path.addEventListener('click', (e) => {
        e.stopPropagation();
        selectWire(wire.id);
      });
      wireLayer.appendChild(path);
    });
  }

  function createBezierPath(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    // Normal forward routing
    if (dx > 25) {
      const cx = dx * 0.5;
      return `M ${x1} ${y1} C ${x1 + cx} ${y1}, ${x2 - cx} ${y2}, ${x2} ${y2}`;
    } else {
      // Loop or backwards routing
      const dist = Math.max(Math.abs(dy) * 0.5, 45);
      return `M ${x1} ${y1} C ${x1 + dist} ${y1}, ${x2 - dist} ${y2}, ${x2} ${y2}`;
    }
  }

  function setupWiringInteractions() {
    canvasWrapper.addEventListener('mousedown', (e) => {
      const portEl = e.target.closest('.port');
      if (portEl) {
        e.stopPropagation();
        const nodeId = portEl.dataset.node;
        const port = portEl.dataset.port;
        const isOutput = port === 'out';

        // Disconnect existing wire on input port to allow rewiring
        if (!isOutput) {
          const existingWireIdx = state.wires.findIndex((w) => w.toNode === nodeId && w.toPort === port);
          if (existingWireIdx !== -1) {
            const oldWire = state.wires.splice(existingWireIdx, 1)[0];
            state.connecting = {
              nodeId: oldWire.fromNode,
              port: oldWire.fromPort,
              isOutput: true,
              mousePos: getCanvasCoords(e.clientX, e.clientY),
            };
            renderWires();
            triggerSimulation();
            return;
          }
        }

        // Start wire from output port
        if (isOutput) {
          state.connecting = {
            nodeId,
            port,
            isOutput: true,
            mousePos: getCanvasCoords(e.clientX, e.clientY),
          };
          renderWires();
        }
        return;
      }

      // Background click: pan or deselect
      if (!e.target.closest('.circuit-node') && !e.target.closest('.canvas-controls')) {
        state.selectedNodeId = null;
        state.selectedWireId = null;
        renderNodes();

        state.isPanning = true;
        state.panStartX = e.clientX - state.panX;
        state.panStartY = e.clientY - state.panY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (state.connecting) {
        // Snap to port if hovering over an input port
        const hoverPort = document.elementFromPoint(e.clientX, e.clientY)?.closest('.port');
        if (hoverPort && hoverPort.dataset.port !== 'out' && hoverPort.dataset.node !== state.connecting.nodeId) {
          const rect = hoverPort.getBoundingClientRect();
          state.connecting.mousePos = getCanvasCoords(rect.left + rect.width / 2, rect.top + rect.height / 2);
        } else {
          state.connecting.mousePos = getCanvasCoords(e.clientX, e.clientY);
        }
        renderWires();
      } else if (state.isPanning) {
        state.panX = e.clientX - state.panStartX;
        state.panY = e.clientY - state.panStartY;
        updateCanvasTransform();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (state.connecting) {
        const portEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('.port');
        if (portEl) {
          const targetNodeId = portEl.dataset.node;
          const targetPort = portEl.dataset.port;
          const isTargetOutput = targetPort === 'out';

          if (state.connecting.isOutput && !isTargetOutput && state.connecting.nodeId !== targetNodeId) {
            connectPorts(state.connecting.nodeId, state.connecting.port, targetNodeId, targetPort);
          }
        }
        state.connecting = null;
        renderWires();
      }

      if (state.isPanning) {
        state.isPanning = false;
      }
    });
  }

  function connectPorts(fromNodeId, fromPort, toNodeId, toPort) {
    state.wires = state.wires.filter((w) => !(w.toNode === toNodeId && w.toPort === toPort));
    const wireId = `wire-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    state.wires.push({
      id: wireId,
      fromNode: fromNodeId,
      fromPort,
      toNode: toNodeId,
      toPort,
    });
    renderNodes();
    triggerSimulation();
  }

  function setupPaletteDrag() {
    const paletteCards = document.querySelectorAll('.palette-card');

    paletteCards.forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        const type = card.dataset.type;
        const gateType = card.dataset.gateType || '';
        e.dataTransfer.setData('text/plain', JSON.stringify({ type, gateType }));
      });
    });

    canvasWrapper.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    canvasWrapper.addEventListener('drop', (e) => {
      e.preventDefault();
      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        const coords = getCanvasCoords(e.clientX, e.clientY);

        let newNode = null;
        if (data.type === 'input') {
          newNode = createInputNode(coords.x - 29, coords.y - 25);
        } else if (data.type === 'gate') {
          newNode = createGateNode(coords.x - 66, coords.y - 30, data.gateType);
        } else if (data.type === 'output') {
          newNode = createOutputNode(coords.x - 29, coords.y - 25);
        }

        if (newNode) {
          state.nodes.push(newNode);
          selectNode(newNode.id);
          renderNodes();
          triggerSimulation();
        }
      } catch (err) {
        console.error('Drop error', err);
      }
    });
  }

  let simTimeout = null;

  function triggerSimulation() {
    clearTimeout(simTimeout);
    simTimeout = setTimeout(runSimulation, 40);
  }

  function prepareCircuitPayload() {
    const inputNodes = state.nodes
      .filter((n) => n.type === 'input')
      .sort((a, b) => a.y - b.y);

    const numInputs = inputNodes.length;
    const nodeIndexMap = new Map();

    inputNodes.forEach((n, idx) => {
      n.index = idx;
      nodeIndexMap.set(n.id, idx);
    });

    const gateNodes = state.nodes.filter((n) => n.type === 'gate');
    const outputNode = state.nodes.find((n) => n.type === 'output');

    const inDegree = new Map();
    const dependents = new Map();
    gateNodes.forEach((g) => {
      inDegree.set(g.id, 0);
      dependents.set(g.id, []);
    });

    gateNodes.forEach((g) => {
      const incomingWires = state.wires.filter((w) => w.toNode === g.id);
      incomingWires.forEach((w) => {
        if (dependents.has(w.fromNode)) {
          dependents.get(w.fromNode).push(g.id);
          inDegree.set(g.id, inDegree.get(g.id) + 1);
        }
      });
    });

    const queue = [];
    gateNodes.forEach((g) => {
      if (inDegree.get(g.id) === 0) queue.push(g);
    });

    const sortedGates = [];
    while (queue.length > 0) {
      const current = queue.shift();
      sortedGates.push(current);

      const deps = dependents.get(current.id) || [];
      deps.forEach((depId) => {
        inDegree.set(depId, inDegree.get(depId) - 1);
        if (inDegree.get(depId) === 0) {
          const depGate = gateNodes.find((g) => g.id === depId);
          if (depGate) queue.push(depGate);
        }
      });
    }

    gateNodes.forEach((g) => {
      if (!sortedGates.includes(g)) sortedGates.push(g);
    });

    if (outputNode) {
      const wireToOutput = state.wires.find((w) => w.toNode === outputNode.id);
      if (wireToOutput) {
        const lastGateIdx = sortedGates.findIndex((g) => g.id === wireToOutput.fromNode);
        if (lastGateIdx !== -1 && lastGateIdx !== sortedGates.length - 1) {
          const [lastGate] = sortedGates.splice(lastGateIdx, 1);
          sortedGates.push(lastGate);
        }
      }
    }

    let nextIndex = numInputs;
    sortedGates.forEach((g) => {
      g.index = nextIndex++;
      nodeIndexMap.set(g.id, g.index);
    });

    const gatesPayload = [];
    sortedGates.forEach((g) => {
      const in1Wire = state.wires.find((w) => w.toNode === g.id && w.toPort === 'in1');
      const in2Wire = state.wires.find((w) => w.toNode === g.id && w.toPort === 'in2');

      const input1Idx = in1Wire && nodeIndexMap.has(in1Wire.fromNode) ? nodeIndexMap.get(in1Wire.fromNode) : -1;
      const input2Idx = in2Wire && nodeIndexMap.has(in2Wire.fromNode) ? nodeIndexMap.get(in2Wire.fromNode) : -1;

      gatesPayload.push({
        type: g.gateType,
        input1: input1Idx,
        input2: g.gateType === 1 ? -1 : input2Idx,
      });
    });

    const inputsVector = inputNodes.map((n) => (n.state ? 1 : 0));

    return {
      numInputs: Math.max(numInputs, 1),
      inputs: inputsVector,
      gates: gatesPayload,
      sortedGates,
      inputNodes,
      outputNode,
    };
  }

  // =========================================
  // CLIENT-SIDE ENGINE (circuit.h & table.h)
  // Enables 100% standalone GitHub Pages hosting
  // =========================================
  function simulateCircuitClientSide(prep) {
    const numInputs = prep.numInputs;
    const inputBits = prep.inputs || [];

    const gates = [];
    for (let i = 0; i < numInputs; i++) {
      gates.push({
        type: 0,
        idx: i,
        isConnected: false,
        inputs: [],
      });
    }

    prep.sortedGates.forEach((g, idx) => {
      const gPayload = prep.gates[idx];
      gates.push({
        type: gPayload.type,
        inputs: gPayload.type === 1 ? [gPayload.input1] : [gPayload.input1, gPayload.input2],
        idx: -1,
        isConnected: false,
      });
    });

    for (let i = numInputs; i < gates.length; i++) {
      const g = gates[i];
      if (g.inputs.length > 0 && g.inputs[0] >= 0 && g.inputs[0] < gates.length) {
        gates[g.inputs[0]].isConnected = true;
      }
      if (g.inputs.length > 1 && g.inputs[1] >= 0 && g.inputs[1] < gates.length) {
        gates[g.inputs[1]].isConnected = true;
      }
    }

    const memo = new Map();
    const visiting = new Set();

    function evaluateGate(idx, inBits) {
      if (idx < 0 || idx >= gates.length) return false;
      if (memo.has(idx)) return memo.get(idx);
      if (visiting.has(idx)) return false;

      visiting.add(idx);
      const g = gates[idx];
      let val = false;

      switch (g.type) {
        case 0:
          val = Boolean(inBits[g.idx]);
          break;
        case 1:
          val = !evaluateGate(g.inputs[0], inBits);
          break;
        case 2:
          val = evaluateGate(g.inputs[0], inBits) && evaluateGate(g.inputs[1], inBits);
          break;
        case 3:
          val = evaluateGate(g.inputs[0], inBits) || evaluateGate(g.inputs[1], inBits);
          break;
        case 4:
          val = !(evaluateGate(g.inputs[0], inBits) && evaluateGate(g.inputs[1], inBits));
          break;
        case 5:
          val = !(evaluateGate(g.inputs[0], inBits) || evaluateGate(g.inputs[1], inBits));
          break;
        case 6:
          val = evaluateGate(g.inputs[0], inBits) !== evaluateGate(g.inputs[1], inBits);
          break;
        default:
          val = false;
      }

      visiting.delete(idx);
      memo.set(idx, val);
      return val;
    }

    const gateValues = gates.map((_, i) => (evaluateGate(i, inputBits) ? 1 : 0));

    let overallOutput = 0;
    if (prep.outputNode) {
      const wireToOutput = state.wires.find((w) => w.toNode === prep.outputNode.id);
      if (wireToOutput) {
        const sourceNode = state.nodes.find((n) => n.id === wireToOutput.fromNode);
        if (sourceNode) {
          if (sourceNode.type === 'input') {
            overallOutput = sourceNode.state ? 1 : 0;
          } else {
            const sortedIdx = prep.sortedGates.findIndex((sg) => sg.id === sourceNode.id);
            if (sortedIdx !== -1) {
              overallOutput = gateValues[numInputs + sortedIdx];
            }
          }
        }
      }
    }

    return {
      success: true,
      valid: true,
      numInputs,
      totalGates: gates.length,
      output: overallOutput,
      gateValues,
    };
  }

  function generateTruthTableClientSide(prep) {
    const numInputs = prep.numInputs;
    const totalRows = Math.pow(2, numInputs);
    const headers = [];
    for (let i = 0; i < numInputs; i++) {
      headers.push(`In ${i}`);
    }
    headers.push('Out');

    const rows = [];
    for (let r = 0; r < totalRows; r++) {
      const rowBits = totalRows - 1 - r;
      const inBits = [];
      for (let bit = 0; bit < numInputs; bit++) {
        inBits.push((rowBits >> (numInputs - 1 - bit)) & 1);
      }

      const rowPrep = {
        ...prep,
        inputs: inBits,
      };
      const res = simulateCircuitClientSide(rowPrep);
      rows.push({
        index: rowBits,
        inputs: inBits,
        output: res.output,
      });
    }

    return {
      success: true,
      valid: true,
      numInputs,
      truthTable: {
        headers,
        rows,
      },
    };
  }

  async function runSimulation() {
    const prep = prepareCircuitPayload();
    if (prep.inputNodes.length === 0) return;

    let result = null;

    // Fast-try server API if available (local dev)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 400);
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numInputs: prep.numInputs,
          inputs: prep.inputs,
          gates: prep.gates,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        result = await res.json();
      }
    } catch (_) {
      // Server not present (e.g. GitHub Pages static hosting)
    }

    // Seamless fallback to client-side engine
    if (!result) {
      result = simulateCircuitClientSide(prep);
    }

    if (result.valid && result.gateValues) {
      prep.sortedGates.forEach((g, idx) => {
        const backendGateIdx = prep.numInputs + idx;
        if (backendGateIdx < result.gateValues.length) {
          g.state = result.gateValues[backendGateIdx];
        }
      });

      if (prep.outputNode) {
        prep.outputNode.state = result.output;
      }
    } else {
      if (prep.outputNode) {
        prep.outputNode.state = 0;
      }
    }

    renderNodes();
  }

  async function showTruthTableModal() {
    const prep = prepareCircuitPayload();
    if (prep.inputNodes.length === 0) {
      alert('Add at least 1 input pin.');
      return;
    }

    truthTableContainer.innerHTML = '<div style="padding: 16px; color: #a1a1aa;">Computing truth table...</div>';
    truthTableModal.classList.remove('hidden');

    let data = null;

    // Fast-try server API if available
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 800);
      const res = await fetch('/api/truth-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numInputs: prep.numInputs,
          gates: prep.gates,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        data = await res.json();
      }
    } catch (_) {
      // Server not present (e.g. GitHub Pages)
    }

    // Seamless fallback to client-side engine
    if (!data) {
      data = generateTruthTableClientSide(prep);
    }

    if (!data || !data.valid) {
      truthTableSummary.innerHTML = `
        <div style="color: #f87171;">Circuit is not complete. Connect all inputs to gates and the last gate to output.</div>
      `;
      truthTableContainer.innerHTML = '';
      return;
    }

    const tt = data.truthTable;
    truthTableSummary.innerHTML = `<span><strong>${tt.rows.length} rows</strong> (2<sup>${prep.numInputs}</sup> combinations)</span>`;

    let currentInputMask = 0;
    prep.inputNodes.forEach((n, idx) => {
      if (n.state) currentInputMask |= 1 << (prep.numInputs - 1 - idx);
    });

    let html = '<table class="truth-table"><thead><tr>';
    tt.headers.forEach((h, idx) => {
      const isOut = idx === tt.headers.length - 1;
      html += `<th class="${isOut ? 'out-col' : ''}">${h}</th>`;
    });
    html += '</tr></thead><tbody>';

    tt.rows.forEach((row) => {
      const isActiveRow = row.index === currentInputMask;
      html += `<tr class="${isActiveRow ? 'active-row' : ''}">`;
      row.inputs.forEach((val) => {
        html += `<td class="val-${val}">${val}</td>`;
      });
      html += `<td class="out-col val-${row.output}">${row.output}</td>`;
      html += '</tr>';
    });
    html += '</tbody></table>';

    truthTableContainer.innerHTML = html;
  }

  function copyTruthTableToClipboard() {
    const table = truthTableContainer.querySelector('table');
    if (!table) return;

    let text = '';
    const headers = Array.from(table.querySelectorAll('th')).map((th) => th.textContent.trim());
    text += headers.join('\t') + '\n';
    text += headers.map(() => '---').join('\t') + '\n';

    table.querySelectorAll('tbody tr').forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim());
      text += cells.join('\t') + '\n';
    });

    navigator.clipboard.writeText(text).then(() => {
      const oldText = btnCopyTable.textContent;
      btnCopyTable.textContent = 'Copied!';
      setTimeout(() => (btnCopyTable.textContent = oldText), 1200);
    });
  }

  function zoomIn() {
    state.scale = Math.min(state.scale + 0.15, 2.0);
    updateCanvasTransform();
    renderWires();
  }

  function zoomOut() {
    state.scale = Math.max(state.scale - 0.15, 0.4);
    updateCanvasTransform();
    renderWires();
  }

  function resetView() {
    state.scale = 1.0;
    state.panX = 60;
    state.panY = 60;
    updateCanvasTransform();
    renderWires();
  }

  function setupEventListeners() {
    setupPaletteDrag();
    setupWiringInteractions();

    btnTruthTable.addEventListener('click', showTruthTableModal);
    btnCloseModal.addEventListener('click', () => truthTableModal.classList.add('hidden'));
    btnCopyTable.addEventListener('click', copyTruthTableToClipboard);

    truthTableModal.addEventListener('click', (e) => {
      if (e.target === truthTableModal) truthTableModal.classList.add('hidden');
    });

    btnClear.addEventListener('click', () => {
      state.nodes = [];
      state.wires = [];
      state.selectedNodeId = null;
      state.selectedWireId = null;
      renderNodes();
      triggerSimulation();
    });

    btnZoomIn.addEventListener('click', zoomIn);
    btnZoomOut.addEventListener('click', zoomOut);
    btnFitView.addEventListener('click', resetView);
    btnDeleteSelected.addEventListener('click', deleteSelected);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!e.target.matches('input, textarea, select')) {
          deleteSelected();
        }
      } else if (e.key === 'Escape') {
        truthTableModal.classList.add('hidden');
        if (state.connecting) {
          state.connecting = null;
          renderWires();
        }
      }
    });

    canvasWrapper.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.08 : -0.08;
        const newScale = Math.min(Math.max(state.scale + delta, 0.4), 2.0);

        const coords = getCanvasCoords(e.clientX, e.clientY);
        const rect = canvasWrapper.getBoundingClientRect();

        state.panX = e.clientX - rect.left - coords.x * newScale;
        state.panY = e.clientY - rect.top - coords.y * newScale;
        state.scale = newScale;

        updateCanvasTransform();
        renderWires();
      },
      { passive: false }
    );
  }

  document.addEventListener('DOMContentLoaded', init);
})();
