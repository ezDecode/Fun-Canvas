class NoteTakingApp {
    constructor() {
        this.canvas = document.getElementById('drawingCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.pages = [{
            name: 'Page 1',
            paths: []
        }];
        this.currentPage = 0;
        this.isDrawing = false;
        this.currentTool = 'pen';
        this.currentColor = '#000000';
        this.currentWidth = 2;
        this.paths = [];
        this.currentPath = [];
        this.undoStack = [];
        
        // Page style properties
        this.pageStyle = 'grid';
        this.pageColor = '#ffffff';
        this.gridColor = '#f0f0f0';
        
        // Shape properties
        this.isDrawingShape = false;
        this.shapeStart = { x: 0, y: 0 };
        this.fillStyle = 'outline'; // outline, fill, or both

        this.isFullscreen = false;
        this.isToolbarCollapsed = false;

        this.lastScrollPosition = 0;
        this.scrollTimeout = null;

        // Shape dragging properties
        this.isDraggingShape = false;
        this.selectedShape = null;
        this.dragOffset = { x: 0, y: 0 };
        
        // Shape menu state
        this.shapesMenuVisible = false;

        this.isTabsVisible = false;

        this.initializeCanvas();
        this.setupEventListeners();
        this.updatePageStyle();
        
        // Set initial tool
        this.setTool('pen');

        // Load JSZip library
        this.loadJSZip();
    }

    initializeCanvas() {
        const resizeCanvas = () => {
            const container = this.canvas.parentElement;
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
            this.updatePageStyle();
            this.redrawCanvas();
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }

    setupEventListeners() {
        // Basic tools
        document.getElementById('penTool').addEventListener('click', () => this.setTool('pen'));
        document.getElementById('pencilTool').addEventListener('click', () => this.setTool('pencil'));
        document.getElementById('eraserTool').addEventListener('click', () => this.setTool('eraser'));

        // Shape tools
        const shapeTools = ['rectangle', 'square', 'circle', 'ellipse', 'arrow', 'line', 'triangle'];
        shapeTools.forEach(tool => {
            const element = document.getElementById(`${tool}Tool`);
            if (element) {
                element.addEventListener('click', () => this.setTool(tool));
            }
        });

        // Fill style control
        const fillStyle = document.getElementById('fillStyle');
        if (fillStyle) {
            fillStyle.addEventListener('change', (e) => {
                this.fillStyle = e.target.value;
            });
        }

        // Color and width controls
        const colorPicker = document.getElementById('colorPicker');
        if (colorPicker) {
            colorPicker.addEventListener('input', (e) => {
                this.currentColor = e.target.value;
            });
        }

        const strokeWidth = document.getElementById('strokeWidth');
        if (strokeWidth) {
            strokeWidth.addEventListener('input', (e) => {
                this.currentWidth = parseInt(e.target.value);
            });
        }

        // Action buttons
        document.getElementById('undoBtn')?.addEventListener('click', () => this.undo());
        document.getElementById('clearBtn')?.addEventListener('click', () => this.clearPage());
        document.getElementById('saveBtn')?.addEventListener('click', () => this.savePage());
        document.getElementById('newPageBtn')?.addEventListener('click', () => this.addPage());

        // Page style controls
        const pageStyle = document.getElementById('pageStyle');
        if (pageStyle) {
            pageStyle.addEventListener('change', (e) => {
                this.pageStyle = e.target.value;
                this.updatePageStyle();
            });
        }

        const pageColor = document.getElementById('pageColor');
        if (pageColor) {
            pageColor.addEventListener('input', (e) => {
                this.pageColor = e.target.value;
                this.updatePageStyle();
            });
        }

        // Canvas drawing events
        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.lastX = e.clientX - rect.left;
            this.lastY = e.clientY - rect.top;
            
            if (this.isShapeTool(this.currentTool)) {
                this.startShape(this.lastX, this.lastY);
            } else {
                this.startDrawing(e);
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.lastX = e.clientX - rect.left;
            this.lastY = e.clientY - rect.top;
            
            if (this.isDraggingShape) {
                this.dragShape(e);
            } else if (this.isDrawingShape) {
                this.drawShapePreview(this.lastX, this.lastY);
            } else {
                this.draw(e);
            }
        });

        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        // Touch events support
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.startDrawing(touch);
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.draw(touch);
        });

        this.canvas.addEventListener('touchend', () => this.stopDrawing());

        // Fullscreen controls
        document.getElementById('fullscreenBtn')?.addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('toggleToolbar')?.addEventListener('click', () => this.toggleToolbar());
        document.getElementById('showToolbarBtn')?.addEventListener('click', () => this.showToolbar());

        // Handle fullscreen change
        document.addEventListener('fullscreenchange', () => {
            this.isFullscreen = !!document.fullscreenElement;
            this.updateFullscreenButton();
        });

        // Add scroll event listener
        const canvasContainer = document.querySelector('.canvas-container');
        canvasContainer.addEventListener('scroll', () => this.handleScroll());

        // Show toolbar button
        document.getElementById('showToolbarBtn')?.addEventListener('click', () => {
            this.showToolbar();
        });

        // Update shape menu toggle
        const shapesToggle = document.getElementById('shapesToggle');
        if (shapesToggle) {
            shapesToggle.addEventListener('click', (e) => {
                this.shapesMenuVisible = !this.shapesMenuVisible;
                const menu = document.querySelector('.shapes-menu');
                if (menu) {
                    menu.classList.toggle('visible', this.shapesMenuVisible);
                }
                e.stopPropagation();
            });
        }

        // Close shapes menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.shapes-dropdown')) {
                this.shapesMenuVisible = false;
                const menu = document.querySelector('.shapes-menu');
                if (menu) {
                    menu.classList.remove('visible');
                }
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            this.initializeCanvas();
        });

        // Tab management
        document.getElementById('addTabBtn')?.addEventListener('click', () => this.addPage());
        document.getElementById('saveAllBtn')?.addEventListener('click', () => this.saveAllPages());

        // Handle tab clicks and names
        document.querySelector('.tab-list')?.addEventListener('click', (e) => {
            const tab = e.target.closest('.tab');
            const closeBtn = e.target.closest('.tab-close');
            
            if (closeBtn) {
                const pageIndex = parseInt(tab.dataset.page);
                this.removePage(pageIndex);
                e.stopPropagation();
            } else if (tab) {
                const pageIndex = parseInt(tab.dataset.page);
                this.switchToPage(pageIndex);
            }
        });

        // Handle tab name changes
        document.querySelector('.tab-list')?.addEventListener('input', (e) => {
            const tabName = e.target.closest('.tab-name');
            if (tabName) {
                const tab = tabName.closest('.tab');
                const pageIndex = parseInt(tab.dataset.page);
                this.pages[pageIndex].name = tabName.textContent;
            }
        });

        // Add tabs toggle button listener
        document.getElementById('toggleTabsBtn')?.addEventListener('click', () => this.toggleTabs());

        // Add click handler to hide tabs when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isTabsVisible) {
                const pageTabs = document.querySelector('.page-tabs');
                const toggleTabsBtn = document.getElementById('toggleTabsBtn');
                
                // Check if click is outside tabs and not on the toggle button
                if (!pageTabs.contains(e.target) && !toggleTabsBtn.contains(e.target)) {
                    this.hideTabs();
                }
            }
        });
    }

    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`${tool}Tool`)?.classList.add('active');

        // Update cursor style
        if (['rectangle', 'square', 'circle', 'ellipse', 'arrow', 'line', 'triangle'].includes(tool)) {
            this.canvas.classList.add('shape-drawing');
        } else {
            this.canvas.classList.remove('shape-drawing');
            if (tool === 'eraser') {
                this.canvas.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' fill=\'none\' stroke=\'black\'%3E%3Crect x=\'4\' y=\'4\' width=\'16\' height=\'16\' /%3E%3C/svg%3E") 12 12, auto';
            } else {
                this.canvas.style.cursor = 'default';
            }
        }
    }

    updatePageStyle() {
        // Remove all existing classes
        this.canvas.className = '';
        // Add the current style class
        this.canvas.classList.add(this.pageStyle);
        // Update CSS variables for colors
        this.canvas.style.setProperty('--grid-color', this.gridColor);
        this.canvas.style.backgroundColor = this.pageColor;
    }

    startDrawing(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX || e.pageX) - rect.left;
        const y = (e.clientY || e.pageY) - rect.top;

        this.isDrawing = true;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.currentPath = [{ x, y }];

        // Set drawing styles
        if (this.currentTool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.lineWidth = this.currentWidth * 2;
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = this.currentWidth;
            this.ctx.lineCap = this.currentTool === 'pen' ? 'round' : 'square';
        }
    }

    draw(e) {
        if (!this.isDrawing) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX || e.pageX) - rect.left;
        const y = (e.clientY || e.pageY) - rect.top;

        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        this.currentPath.push({ x, y });
    }

    stopDrawing() {
        if (this.isDraggingShape) {
            this.isDraggingShape = false;
            this.selectedShape = null;
            this.canvas.classList.remove('shape-dragging');
            return;
        }

        if (this.isDrawingShape) {
            this.finalizeShape();
            return;
        }

        if (!this.isDrawing) return;

        this.isDrawing = false;
        this.ctx.globalCompositeOperation = 'source-over';

        if (this.currentPath.length > 0) {
            this.paths.push({
                points: this.currentPath,
                tool: this.currentTool,
                color: this.currentColor,
                width: this.currentWidth
            });
            this.currentPath = [];
        }
    }

    isShapeTool(tool) {
        return ['rectangle', 'square', 'circle', 'ellipse', 'arrow', 'line', 'triangle'].includes(tool);
    }

    startShape(x, y) {
        this.isDrawingShape = true;
        this.shapeStart = { x, y };
    }

    drawShapePreview(x, y) {
        if (!this.isDrawingShape) return;

        // Clear and redraw
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.redrawCanvas();

        // Set shape styles
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.fillStyle = this.currentColor;
        this.ctx.lineWidth = this.currentWidth;

        const width = x - this.shapeStart.x;
        const height = y - this.shapeStart.y;

        switch (this.currentTool) {
            case 'rectangle':
                this.drawRectangle(this.shapeStart.x, this.shapeStart.y, width, height);
                break;
            case 'square':
                const size = Math.max(Math.abs(width), Math.abs(height)) * Math.sign(width);
                this.drawRectangle(this.shapeStart.x, this.shapeStart.y, size, size);
                break;
            case 'circle':
                const radius = Math.sqrt(width * width + height * height) / 2;
                const centerX = this.shapeStart.x + width / 2;
                const centerY = this.shapeStart.y + height / 2;
                this.drawCircle(centerX, centerY, radius);
                break;
            case 'ellipse':
                this.drawEllipse(
                    this.shapeStart.x + width / 2,
                    this.shapeStart.y + height / 2,
                    Math.abs(width) / 2,
                    Math.abs(height) / 2
                );
                break;
            case 'line':
                this.drawLine(this.shapeStart.x, this.shapeStart.y, x, y);
                break;
            case 'arrow':
                this.drawArrow(this.shapeStart.x, this.shapeStart.y, x, y);
                break;
            case 'triangle':
                this.drawTriangle(this.shapeStart.x, this.shapeStart.y, x, y);
                break;
        }
    }

    drawRectangle(x, y, width, height) {
        if (this.fillStyle === 'fill' || this.fillStyle === 'both') {
            this.ctx.fillRect(x, y, width, height);
        }
        if (this.fillStyle === 'outline' || this.fillStyle === 'both') {
            this.ctx.strokeRect(x, y, width, height);
        }
    }

    drawCircle(x, y, radius) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        if (this.fillStyle === 'fill' || this.fillStyle === 'both') {
            this.ctx.fill();
        }
        if (this.fillStyle === 'outline' || this.fillStyle === 'both') {
            this.ctx.stroke();
        }
    }

    drawEllipse(x, y, width, height) {
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, Math.abs(width), Math.abs(height), 0, 0, Math.PI * 2);
        if (this.fillStyle === 'fill' || this.fillStyle === 'both') {
            this.ctx.fill();
        }
        if (this.fillStyle === 'outline' || this.fillStyle === 'both') {
            this.ctx.stroke();
        }
    }

    drawLine(x1, y1, x2, y2) {
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    }

    drawArrow(x1, y1, x2, y2) {
        const headLength = 20;
        const angle = Math.atan2(y2 - y1, x2 - x1);

        // Draw the main line
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();

        // Draw the arrow head
        this.ctx.beginPath();
        this.ctx.moveTo(x2, y2);
        this.ctx.lineTo(
            x2 - headLength * Math.cos(angle - Math.PI / 6),
            y2 - headLength * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.lineTo(
            x2 - headLength * Math.cos(angle + Math.PI / 6),
            y2 - headLength * Math.sin(angle + Math.PI / 6)
        );
        this.ctx.closePath();
        this.ctx.fill();
    }

    drawTriangle(x1, y1, x2, y2) {
        const height = y2 - y1;
        const width = x2 - x1;
        
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x1 - width/2, y2);
        this.ctx.lineTo(x2, y2);
        this.ctx.closePath();
        
        if (this.fillStyle === 'fill' || this.fillStyle === 'both') {
            this.ctx.fill();
        }
        if (this.fillStyle === 'outline' || this.fillStyle === 'both') {
            this.ctx.stroke();
        }
    }

    finalizeShape() {
        this.isDrawingShape = false;
        const lastX = this.lastX;
        const lastY = this.lastY;
        
        this.paths.push({
            tool: this.currentTool,
            start: { ...this.shapeStart },
            end: { x: lastX, y: lastY },
            color: this.currentColor,
            width: this.currentWidth,
            fillStyle: this.fillStyle
        });

        // Keep shapes menu visible
        this.shapesMenuVisible = true;
        document.querySelector('.shapes-menu').classList.add('visible');
    }

    redrawCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        for (const path of this.paths) {
            if (path.tool === 'eraser') {
                this.ctx.globalCompositeOperation = 'destination-out';
                this.ctx.lineWidth = path.width * 2;
            } else if (this.isShapeTool(path.tool)) {
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.strokeStyle = path.color;
                this.ctx.fillStyle = path.color;
                this.ctx.lineWidth = path.width;
                
                const width = path.end.x - path.start.x;
                const height = path.end.y - path.start.y;
                
                switch (path.tool) {
                    case 'rectangle':
                        this.drawRectangle(path.start.x, path.start.y, width, height);
                        break;
                    case 'square':
                        const size = Math.max(Math.abs(width), Math.abs(height)) * Math.sign(width);
                        this.drawRectangle(path.start.x, path.start.y, size, size);
                        break;
                    case 'circle':
                        const radius = Math.sqrt(width * width + height * height) / 2;
                        const centerX = path.start.x + width / 2;
                        const centerY = path.start.y + height / 2;
                        this.drawCircle(centerX, centerY, radius);
                        break;
                    case 'ellipse':
                        this.drawEllipse(
                            path.start.x + width / 2,
                            path.start.y + height / 2,
                            Math.abs(width) / 2,
                            Math.abs(height) / 2
                        );
                        break;
                    case 'line':
                        this.drawLine(path.start.x, path.start.y, path.end.x, path.end.y);
                        break;
                    case 'arrow':
                        this.drawArrow(path.start.x, path.start.y, path.end.x, path.end.y);
                        break;
                    case 'triangle':
                        this.drawTriangle(path.start.x, path.start.y, path.end.x, path.end.y);
                        break;
                }
            } else {
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.strokeStyle = path.color;
                this.ctx.lineWidth = path.width;
                this.ctx.lineCap = path.tool === 'pen' ? 'round' : 'square';
                
                this.ctx.beginPath();
                this.ctx.moveTo(path.points[0].x, path.points[0].y);
                for (const point of path.points) {
                    this.ctx.lineTo(point.x, point.y);
                }
                this.ctx.stroke();
            }
        }
        
        this.ctx.globalCompositeOperation = 'source-over';
    }

    undo() {
        if (this.paths.length > 0) {
            this.undoStack.push(this.paths.pop());
            this.redrawCanvas();
        }
    }

    clearPage() {
        this.paths = [];
        this.undoStack = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    savePage() {
        try {
            const pageName = this.pages[this.currentPage].name.replace(/[^a-z0-9]/gi, '_');
            const canvas = this.canvas;
            const link = document.createElement('a');
            link.download = `${pageName}.png`;
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Error saving page:', error);
        }
    }

    addPage() {
        // Save current page
        this.pages[this.currentPage].paths = [...this.paths];
        
        // Create new page
        const newPageIndex = this.pages.length;
        this.pages.push({
            name: `Page ${newPageIndex + 1}`,
            paths: []
        });

        // Create new tab
        const tabList = document.querySelector('.tab-list');
        const newTab = document.createElement('div');
        newTab.className = 'tab';
        newTab.dataset.page = newPageIndex;
        newTab.innerHTML = `
            <span class="tab-name" contenteditable="true">Page ${newPageIndex + 1}</span>
            <button class="tab-close"><i class="fas fa-times"></i></button>
        `;
        tabList.appendChild(newTab);

        // Switch to new page
        this.switchToPage(newPageIndex);
        
        // Show tabs if they're hidden
        if (!this.isTabsVisible) {
            this.toggleTabs();
        }
    }

    switchToPage(pageIndex) {
        // Save current page
        this.pages[this.currentPage].paths = [...this.paths];
        
        // Update active tab
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', parseInt(tab.dataset.page) === pageIndex);
        });

        // Load new page
        this.currentPage = pageIndex;
        this.paths = [...this.pages[pageIndex].paths];
        this.undoStack = [];
        
        // Update page indicator
        const pageIndicator = document.getElementById('pageIndicator');
        if (pageIndicator) {
            pageIndicator.textContent = `Page ${pageIndex + 1} of ${this.pages.length}`;
        }

        // Redraw canvas
        this.redrawCanvas();
    }

    removePage(pageIndex) {
        if (this.pages.length <= 1) return; // Don't remove last page

        // Remove page data
        this.pages.splice(pageIndex, 1);
        
        // Remove tab
        const tab = document.querySelector(`.tab[data-page="${pageIndex}"]`);
        tab.remove();

        // Update remaining tab indices
        document.querySelectorAll('.tab').forEach((tab, index) => {
            tab.dataset.page = index;
            if (!tab.querySelector('.tab-name').isContentEditable) {
                tab.querySelector('.tab-name').textContent = `Page ${index + 1}`;
            }
        });

        // Switch to another page if removing current
        if (pageIndex === this.currentPage) {
            this.switchToPage(Math.max(0, pageIndex - 1));
        } else if (pageIndex < this.currentPage) {
            this.currentPage--;
        }
    }

    async saveAllPages() {
        try {
            // Save current page
            this.pages[this.currentPage].paths = [...this.paths];

            // Create ZIP file
            const zip = new JSZip();
            
            // Add each page to ZIP
            for (let i = 0; i < this.pages.length; i++) {
                const page = this.pages[i];
                const canvas = await this.renderPageToCanvas(page);
                const blob = await new Promise(resolve => canvas.toBlob(resolve));
                const fileName = `${page.name.replace(/[^a-z0-9]/gi, '_')}.png`;
                zip.file(fileName, blob);
            }

            // Generate and download ZIP
            const blob = await zip.generateAsync({type: 'blob'});
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'canvas_notes.zip';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error('Error saving pages:', error);
        }
    }

    async renderPageToCanvas(page) {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;

        // Draw background
        tempCtx.fillStyle = this.pageColor;
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Draw page content
        for (const path of page.paths) {
            if (path.tool === 'eraser') {
                tempCtx.globalCompositeOperation = 'destination-out';
                tempCtx.lineWidth = path.width * 2;
            } else if (this.isShapeTool(path.tool)) {
                tempCtx.globalCompositeOperation = 'source-over';
                tempCtx.strokeStyle = path.color;
                tempCtx.fillStyle = path.color;
                tempCtx.lineWidth = path.width;
                
                const width = path.end.x - path.start.x;
                const height = path.end.y - path.start.y;
                
                switch (path.tool) {
                    case 'rectangle':
                    case 'square':
                        if (path.fillStyle === 'fill' || path.fillStyle === 'both') {
                            tempCtx.fillRect(path.start.x, path.start.y, width, height);
                        }
                        if (path.fillStyle === 'outline' || path.fillStyle === 'both') {
                            tempCtx.strokeRect(path.start.x, path.start.y, width, height);
                        }
                        break;
                    case 'circle':
                    case 'ellipse':
                        tempCtx.beginPath();
                        tempCtx.ellipse(
                            path.start.x + width/2,
                            path.start.y + height/2,
                            Math.abs(width)/2,
                            Math.abs(height)/2,
                            0, 0, Math.PI * 2
                        );
                        if (path.fillStyle === 'fill' || path.fillStyle === 'both') {
                            tempCtx.fill();
                        }
                        if (path.fillStyle === 'outline' || path.fillStyle === 'both') {
                            tempCtx.stroke();
                        }
                        break;
                    case 'line':
                        tempCtx.beginPath();
                        tempCtx.moveTo(path.start.x, path.start.y);
                        tempCtx.lineTo(path.end.x, path.end.y);
                        tempCtx.stroke();
                        break;
                    case 'arrow':
                        this.drawArrow.call({ ctx: tempCtx }, 
                            path.start.x, path.start.y, 
                            path.end.x, path.end.y);
                        break;
                    case 'triangle':
                        tempCtx.beginPath();
                        tempCtx.moveTo(path.start.x, path.start.y);
                        tempCtx.lineTo(path.start.x - width/2, path.end.y);
                        tempCtx.lineTo(path.end.x, path.end.y);
                        tempCtx.closePath();
                        if (path.fillStyle === 'fill' || path.fillStyle === 'both') {
                            tempCtx.fill();
                        }
                        if (path.fillStyle === 'outline' || path.fillStyle === 'both') {
                            tempCtx.stroke();
                        }
                        break;
                }
            } else {
                tempCtx.globalCompositeOperation = 'source-over';
                tempCtx.strokeStyle = path.color;
                tempCtx.lineWidth = path.width;
                tempCtx.lineCap = path.tool === 'pen' ? 'round' : 'square';
                
                tempCtx.beginPath();
                tempCtx.moveTo(path.points[0].x, path.points[0].y);
                path.points.forEach(point => {
                    tempCtx.lineTo(point.x, point.y);
                });
                tempCtx.stroke();
            }
        }

        return tempCanvas;
    }

    toggleFullscreen() {
        const container = document.querySelector('.container');
        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }

    updateFullscreenButton() {
        const container = document.querySelector('.container');
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        const icon = fullscreenBtn.querySelector('i');

        if (this.isFullscreen) {
            container.classList.add('fullscreen');
            icon.className = 'fas fa-compress';
        } else {
            container.classList.remove('fullscreen');
            icon.className = 'fas fa-expand';
        }
    }

    toggleToolbar() {
        const floatingControls = document.querySelector('.floating-controls');
        const showToolbarBtn = document.getElementById('showToolbarBtn');
        this.isToolbarCollapsed = !this.isToolbarCollapsed;
        
        if (this.isToolbarCollapsed) {
            floatingControls.classList.add('collapsed');
            showToolbarBtn.classList.add('visible');
        } else {
            floatingControls.classList.remove('collapsed');
            showToolbarBtn.classList.remove('visible');
        }
    }

    showToolbar() {
        const floatingControls = document.querySelector('.floating-controls');
        const showToolbarBtn = document.getElementById('showToolbarBtn');
        this.isToolbarCollapsed = false;
        floatingControls.classList.remove('collapsed');
        showToolbarBtn.classList.remove('visible');
    }

    trySelectShape(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Find if we clicked on a shape
        for (let i = this.paths.length - 1; i >= 0; i--) {
            const path = this.paths[i];
            if (this.isShapeTool(path.tool) && this.isPointInShape(x, y, path)) {
                this.selectedShape = path;
                this.isDraggingShape = true;
                this.dragOffset = {
                    x: x - path.start.x,
                    y: y - path.start.y
                };
                this.canvas.classList.add('shape-dragging');
                return;
            }
        }
    }

    isPointInShape(x, y, shape) {
        const bounds = this.getShapeBounds(shape);
        return x >= bounds.left && x <= bounds.right && 
               y >= bounds.top && y <= bounds.bottom;
    }

    getShapeBounds(shape) {
        const left = Math.min(shape.start.x, shape.end.x);
        const right = Math.max(shape.start.x, shape.end.x);
        const top = Math.min(shape.start.y, shape.end.y);
        const bottom = Math.max(shape.start.y, shape.end.y);
        
        return { left, right, top, bottom };
    }

    dragShape(e) {
        if (!this.isDraggingShape || !this.selectedShape) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const dx = x - this.dragOffset.x - this.selectedShape.start.x;
        const dy = y - this.dragOffset.y - this.selectedShape.start.y;

        this.selectedShape.start.x += dx;
        this.selectedShape.start.y += dy;
        this.selectedShape.end.x += dx;
        this.selectedShape.end.y += dy;

        this.redrawCanvas();
    }

    handleScroll() {
        // Clear the existing timeout
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }

        // Set a new timeout
        this.scrollTimeout = setTimeout(() => {
            const container = document.querySelector('.canvas-container');
            const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;

            if (isAtBottom) {
                this.addPage();
                // Scroll to the new page after a brief delay
                setTimeout(() => {
                    container.scrollTop = container.scrollHeight;
                }, 100);
            }
        }, 150); // Debounce time
    }

    loadJSZip() {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        document.head.appendChild(script);
    }

    hideTabs() {
        this.isTabsVisible = false;
        const pageTabs = document.querySelector('.page-tabs');
        const canvasContainer = document.querySelector('.canvas-container');
        
        if (pageTabs) {
            pageTabs.classList.remove('show');
            canvasContainer.classList.remove('tabs-visible');
            
            // Trigger canvas resize after transition
            setTimeout(() => {
                this.initializeCanvas();
            }, 300);
        }
    }

    toggleTabs() {
        if (!this.isTabsVisible) {
            this.isTabsVisible = true;
            const pageTabs = document.querySelector('.page-tabs');
            const canvasContainer = document.querySelector('.canvas-container');
            
            if (pageTabs) {
                pageTabs.classList.add('show');
                canvasContainer.classList.add('tabs-visible');
                
                // Trigger canvas resize after transition
                setTimeout(() => {
                    this.initializeCanvas();
                }, 300);
            }
        } else {
            this.hideTabs();
        }
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NoteTakingApp();
}); 