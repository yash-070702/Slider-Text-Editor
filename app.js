class TextElement {
    constructor(id, text = 'New Text', x = 50, y = 50) {
        this.id = id;
        this.text = text;
        this.x = x;
        this.y = y;
        this.fontSize = 24;
        this.fontFamily = 'Arial';
        this.color = '#000000';
        this.bold = false;
        this.italic = false;
        this.zIndex = 1;
        this.startAnimation = 'none';
        this.endAnimation = 'none';
        this.align = 'left'; 
    }

    toJSON() {
        return {
            id: this.id,
            text: this.text,
            x: this.x,
            y: this.y,
            fontSize: this.fontSize,
            fontFamily: this.fontFamily,
            color: this.color,
            bold: this.bold,
            italic: this.italic,
            zIndex: this.zIndex,
            startAnimation: this.startAnimation,
            endAnimation: this.endAnimation,
            align: this.align 
        };
    }

    static fromJSON(data) {
        const element = new TextElement(data.id, data.text, data.x, data.y);
        element.fontSize = data.fontSize;
        element.fontFamily = data.fontFamily;
        element.color = data.color;
        element.bold = data.bold;
        element.italic = data.italic;
        element.zIndex = data.zIndex;
        element.startAnimation = data.startAnimation || 'none';
        element.endAnimation = data.endAnimation || 'none';
        element.align = data.align || 'left'; 
        return element;
    }
}

class Slide {
    constructor(id, imageSrc) {
        this.id = id;
        this.imageSrc = imageSrc;
        this.textElements = [];
        this.nextTextId = 1;
    }

    addTextElement(textElement) {
        if (!textElement.id) {
            textElement.id = `text-${this.nextTextId++}`;
        } else {
            const idNum = parseInt(textElement.id.split('-')[1]);
            if (idNum >= this.nextTextId) {
                this.nextTextId = idNum + 1;
            }
        }
        this.textElements.push(textElement);
        return textElement;
    }

    removeTextElement(id) {
        this.textElements = this.textElements.filter(el => el.id !== id);
    }

    getTextElement(id) {
        return this.textElements.find(el => el.id === id);
    }

    toJSON() {
        return {
            id: this.id,
            imageSrc: this.imageSrc,
            textElements: this.textElements.map(el => el.toJSON()),
            nextTextId: this.nextTextId
        };
    }

    static fromJSON(data) {
        const slide = new Slide(data.id, data.imageSrc);
        slide.textElements = data.textElements.map(el => TextElement.fromJSON(el));
        slide.nextTextId = data.nextTextId || 1;
        return slide;
    }
}

class SlideEditor {
    constructor() {
        this.slides = [];
        this.currentSlideIndex = 0;
        this.selectedTextId = null;
        this.nextSlideId = 3;
        this.dragState = {
            isDragging: false,
            startX: 0,
            startY: 0,
            elementStartX: 0,
            elementStartY: 0
        };

        this.initializeSlides();
        this.initializeUI();
        this.loadFromStorage();
        this.renderSlideThumbnails();
        this.renderCurrentSlide();
        this.setupKeyboardHandlers();
    }


    
async exportAllSlidesToPDF(filename = 'slides.pdf') {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert('jsPDF not loaded. Ensure the jsPDF script tag is present.');
        return;
    }
    const { jsPDF } = window.jspdf;

   
    const pdf = new jsPDF({ unit: 'px', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    
    const renderSlideToDataURL = async (slide) => {
       
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = slide.imageSrc;
        await img.decode();

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 1280;
        canvas.height = img.naturalHeight || img.height || 720;
        const ctx = canvas.getContext('2d');

        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Draw text elements (respect z-index, alignment & styles)
        const sorted = [...slide.textElements].sort((a,b)=> (a.zIndex||0) - (b.zIndex||0));
        sorted.forEach(t => {
           
            let anchorX = (t.x / 100) * canvas.width;
            const anchorY = (t.y / 100) * canvas.height;

            // font string
            const fontParts = [];
            if (t.italic) fontParts.push('italic');
            if (t.bold) fontParts.push('bold');
            fontParts.push(`${t.fontSize}px`);
            fontParts.push(t.fontFamily || 'Arial');
            ctx.font = fontParts.join(' ');
            ctx.fillStyle = t.color || '#000';
            ctx.textBaseline = 'top';

            const lines = String(t.text).split('\n');
            
            let maxWidth = 0;
            for (let i = 0; i < lines.length; i++) {
                maxWidth = Math.max(maxWidth, ctx.measureText(lines[i]).width);
            }

         
            if (t.align === 'center') anchorX -= maxWidth / 2;
            else if (t.align === 'right') anchorX -= maxWidth;

            const lineHeight = (t.fontSize || 24) * 1.2;
            for (let i = 0; i < lines.length; i++) {
                ctx.fillText(lines[i], anchorX, anchorY + i * lineHeight);
            }
        });

      
        return canvas.toDataURL('image/jpeg', 0.95);
    };

    
    for (let i = 0; i < this.slides.length; i++) {
        const slide = this.slides[i];
        const dataUrl = await renderSlideToDataURL(slide);

       
        const tmp = new Image();
        tmp.src = dataUrl;
        await new Promise((res, rej) => {
            tmp.onload = res;
            tmp.onerror = rej;
        });
        const imgW = tmp.width;
        const imgH = tmp.height;
        const imgRatio = imgW / imgH;

        let drawW = pageW;
        let drawH = pageW / imgRatio;
        if (drawH > pageH) {
            drawH = pageH;
            drawW = pageH * imgRatio;
        }
        const offsetX = Math.round((pageW - drawW) / 2);
        const offsetY = Math.round((pageH - drawH) / 2);

        if (i > 0) pdf.addPage();
        pdf.addImage(dataUrl, 'JPEG', offsetX, offsetY, drawW, drawH);
    }

   
    pdf.save(filename);
}


    initializeSlides() {
        this.slides = [
            new Slide(1, 'assets/slide1.jpg'),
            new Slide(2, 'assets/slide2.jpg')
        ];
    }

    initializeUI() {
        this.slideImage = document.getElementById('slideImage');
        this.textOverlay = document.getElementById('textOverlay');
        this.slideInfo = document.getElementById('slideInfo');
        this.slidesList = document.getElementById('slidesList');

        document.getElementById('addSlide').addEventListener('click', () => this.addSlide());
        document.getElementById('addText').addEventListener('click', () => this.addText());
        document.getElementById('deleteText').addEventListener('click', () => this.deleteSelectedText());
        document.getElementById('exportPng').addEventListener('click', () => this.exportToPNG());
        document.getElementById('textAlign').addEventListener('change', (e) => this.updateSelectedText('align', e.target.value));


        document.getElementById('textContent').addEventListener('input', (e) => this.updateSelectedText('text', e.target.value));
        document.getElementById('fontFamily').addEventListener('change', (e) => this.updateSelectedText('fontFamily', e.target.value));
        document.getElementById('fontSize').addEventListener('input', (e) => {
            this.updateSelectedText('fontSize', parseInt(e.target.value));
            document.getElementById('fontSizeValue').textContent = e.target.value;
        });
        document.getElementById('fontColor').addEventListener('input', (e) => this.updateSelectedText('color', e.target.value));
        document.getElementById('toggleBold').addEventListener('click', () => this.toggleStyle('bold'));
        document.getElementById('toggleItalic').addEventListener('click', () => this.toggleStyle('italic'));

        document.getElementById('placeTL').addEventListener('click', () => this.placeAtCorner('tl'));
        document.getElementById('placeTR').addEventListener('click', () => this.placeAtCorner('tr'));
        document.getElementById('placeBL').addEventListener('click', () => this.placeAtCorner('bl'));
        document.getElementById('placeBR').addEventListener('click', () => this.placeAtCorner('br'));

        document.getElementById('bringForward').addEventListener('click', () => this.adjustZOrder(1));
        document.getElementById('sendBackward').addEventListener('click', () => this.adjustZOrder(-1));

        document.getElementById('startAnimation').addEventListener('change', (e) => this.updateSelectedText('startAnimation', e.target.value));
        document.getElementById('endAnimation').addEventListener('change', (e) => this.updateSelectedText('endAnimation', e.target.value));

        this.textOverlay.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
        document.addEventListener('pointermove', (e) => this.handlePointerMove(e));
        document.addEventListener('pointerup', () => this.handlePointerUp());

        const exportAllPdfBtn = document.getElementById('exportAllPdf');
if (exportAllPdfBtn) {
    exportAllPdfBtn.addEventListener('click', async () => {
        exportAllPdfBtn.disabled = true;
        try {
            await this.exportAllSlidesToPDF('slides.pdf');
        } catch (err) {
            console.error('Export PDF failed', err);
            alert('Export to PDF failed: ' + (err.message || err));
        } finally {
            exportAllPdfBtn.disabled = false;
        }
    });
}

        
    }

    setupKeyboardHandlers() {
        document.addEventListener('keydown', (e) => {
            if (!this.selectedTextId) return;

            const selectedElement = this.getCurrentSlide().getTextElement(this.selectedTextId);
            if (!selectedElement) return;

            const nudgeAmount = e.shiftKey ? 10 : 1;

            switch(e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    selectedElement.y = Math.max(0, selectedElement.y - nudgeAmount);
                    this.renderTextElements();
                    this.saveToStorage();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    selectedElement.y = Math.min(100, selectedElement.y + nudgeAmount);
                    this.renderTextElements();
                    this.saveToStorage();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    selectedElement.x = Math.max(0, selectedElement.x - nudgeAmount);
                    this.renderTextElements();
                    this.saveToStorage();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    selectedElement.x = Math.min(100, selectedElement.x + nudgeAmount);
                    this.renderTextElements();
                    this.saveToStorage();
                    break;
                case 'Delete':
                case 'Backspace':
                    if (e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') {
                        e.preventDefault();
                        this.deleteSelectedText();
                    }
                    break;
            }
        });
    }

    getCurrentSlide() {
        return this.slides[this.currentSlideIndex];
    }

    switchToSlide(index) {
        if (index >= 0 && index < this.slides.length) {
            this.currentSlideIndex = index;
            this.selectedTextId = null;
            this.renderSlideThumbnails();
            this.renderCurrentSlide();
        }
    }

    addSlide() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const newSlide = new Slide(this.nextSlideId++, event.target.result);
                    this.slides.push(newSlide);
                    this.currentSlideIndex = this.slides.length - 1;
                    this.renderSlideThumbnails();
                    this.renderCurrentSlide();
                    this.saveToStorage();
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    }

    deleteSlide(index) {
        if (this.slides.length <= 1) {
            alert('Cannot delete the last slide!');
            return;
        }

        if (confirm(`Delete slide ${index + 1}?`)) {
            this.slides.splice(index, 1);
            if (this.currentSlideIndex >= this.slides.length) {
                this.currentSlideIndex = this.slides.length - 1;
            }
            this.renderSlideThumbnails();
            this.renderCurrentSlide();
            this.saveToStorage();
        }
    }

    renderSlideThumbnails() {
        this.slidesList.innerHTML = '';

        this.slides.forEach((slide, index) => {
            const thumbnail = document.createElement('div');
            thumbnail.className = 'slide-thumbnail';
            if (index === this.currentSlideIndex) {
                thumbnail.classList.add('active');
            }

            const img = document.createElement('img');
            img.className = 'slide-thumbnail-image';
            img.src = slide.imageSrc;
            img.alt = `Slide ${index + 1}`;

            const label = document.createElement('div');
            label.className = 'slide-thumbnail-label';
            label.textContent = `Slide ${index + 1}`;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'slide-thumbnail-delete';
            deleteBtn.innerHTML = '×';
            deleteBtn.setAttribute('aria-label', `Delete slide ${index + 1}`);
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.deleteSlide(index);
            };

            thumbnail.appendChild(img);
            thumbnail.appendChild(label);
            thumbnail.appendChild(deleteBtn);

            thumbnail.onclick = () => this.switchToSlide(index);

            this.slidesList.appendChild(thumbnail);
        });
    }

    renderCurrentSlide() {
        const slide = this.getCurrentSlide();
        this.slideImage.src = slide.imageSrc;
        this.slideInfo.textContent = `Slide ${this.currentSlideIndex + 1} of ${this.slides.length}`;
        this.renderTextElements();
        this.updateControlsPanel();
    }

   renderTextElements() {
    this.textOverlay.innerHTML = '';
    const slide = this.getCurrentSlide();

    const sortedElements = [...slide.textElements].sort((a, b) => a.zIndex - b.zIndex);

    sortedElements.forEach(textElement => {
        const div = document.createElement('div');
        div.className = 'text-element';
        if (textElement.id === this.selectedTextId) {
            div.classList.add('selected');
        }
        div.dataset.id = textElement.id;
        div.textContent = textElement.text;
        // anchor left/top in percentages (model unchanged)
        div.style.left = `${textElement.x}%`;
        div.style.top = `${textElement.y}%`;
        div.style.fontSize = `${textElement.fontSize}px`;
        div.style.fontFamily = textElement.fontFamily;
        div.style.color = textElement.color;
        div.style.fontWeight = textElement.bold ? 'bold' : 'normal';
        div.style.fontStyle = textElement.italic ? 'italic' : 'normal';
        div.style.zIndex = textElement.zIndex;

     
        div.style.textAlign = textElement.align || 'left';
        switch (textElement.align) {
            case 'center':
                div.style.transform = 'translateX(-50%)';
                break;
            case 'right':
                div.style.transform = 'translateX(-100%)';
                break;
            default:
                div.style.transform = 'translateX(0)';
        }

    
        div.addEventListener('pointerdown', (ev) => {
           
            this.selectedTextId = textElement.id;
            this.updateControlsPanel();
            this.renderTextElements();
        });

        this.textOverlay.appendChild(div);
    });
}

    addText() {
        const slide = this.getCurrentSlide();
        const newText = new TextElement(null, 'New Text', 50, 50);
        slide.addTextElement(newText);
        this.selectedTextId = newText.id;
        this.renderTextElements();
        this.updateControlsPanel();
        this.saveToStorage();
    }

    deleteSelectedText() {
        if (!this.selectedTextId) return;

        const slide = this.getCurrentSlide();
        slide.removeTextElement(this.selectedTextId);
        this.selectedTextId = null;
        this.renderTextElements();
        this.updateControlsPanel();
        this.saveToStorage();
    }

    updateSelectedText(property, value) {
        if (!this.selectedTextId) return;

        const slide = this.getCurrentSlide();
        const textElement = slide.getTextElement(this.selectedTextId);
        if (textElement) {
            textElement[property] = value;
            this.renderTextElements();
            this.saveToStorage();
        }
    }

    toggleStyle(style) {
        if (!this.selectedTextId) return;

        const slide = this.getCurrentSlide();
        const textElement = slide.getTextElement(this.selectedTextId);
        if (textElement) {
            textElement[style] = !textElement[style];
            this.renderTextElements();
            this.updateControlsPanel();
            this.saveToStorage();
        }
    }

    placeAtCorner(corner) {
        if (!this.selectedTextId) return;

        const slide = this.getCurrentSlide();
        const textElement = slide.getTextElement(this.selectedTextId);
        if (!textElement) return;

        const padding = 2;

        switch(corner) {
            case 'tl':
                textElement.x = padding;
                textElement.y = padding;
                break;
            case 'tr':
                textElement.x = 100 - padding;
                textElement.y = padding;
                break;
            case 'bl':
                textElement.x = padding;
                textElement.y = 100 - padding;
                break;
            case 'br':
                textElement.x = 100 - padding;
                textElement.y = 100 - padding;
                break;
        }

        this.renderTextElements();
        this.saveToStorage();
    }

    adjustZOrder(direction) {
        if (!this.selectedTextId) return;

        const slide = this.getCurrentSlide();
        const textElement = slide.getTextElement(this.selectedTextId);
        if (!textElement) return;

        textElement.zIndex += direction;
        textElement.zIndex = Math.max(1, textElement.zIndex);

        this.renderTextElements();
        this.saveToStorage();
    }

    handlePointerDown(e) {
        const target = e.target.closest('.text-element');
        if (!target) {
            this.selectedTextId = null;
            this.updateControlsPanel();
            this.renderTextElements();
            return;
        }

        this.selectedTextId = target.dataset.id;
        this.updateControlsPanel();
        this.renderTextElements();

        this.dragState.isDragging = true;
        this.dragState.startX = e.clientX;
        this.dragState.startY = e.clientY;

        const slide = this.getCurrentSlide();
        const textElement = slide.getTextElement(this.selectedTextId);
        this.dragState.elementStartX = textElement.x;
        this.dragState.elementStartY = textElement.y;

        e.preventDefault();
    }

    handlePointerMove(e) {
        if (!this.dragState.isDragging || !this.selectedTextId) return;

        const slide = this.getCurrentSlide();
        const textElement = slide.getTextElement(this.selectedTextId);
        if (!textElement) return;

        const containerRect = this.textOverlay.getBoundingClientRect();
        const deltaX = e.clientX - this.dragState.startX;
        const deltaY = e.clientY - this.dragState.startY;

        const deltaXPercent = (deltaX / containerRect.width) * 100;
        const deltaYPercent = (deltaY / containerRect.height) * 100;

        let newX = this.dragState.elementStartX + deltaXPercent;
        let newY = this.dragState.elementStartY + deltaYPercent;

        newX = Math.max(0, Math.min(100, newX));
        newY = Math.max(0, Math.min(100, newY));

        const snapThreshold = 5;
        if (newX < snapThreshold) newX = 0;
        if (newX > 100 - snapThreshold) newX = 100;
        if (newY < snapThreshold) newY = 0;
        if (newY > 100 - snapThreshold) newY = 100;

        textElement.x = newX;
        textElement.y = newY;

        this.renderTextElements();
    }

    handlePointerUp() {
        if (this.dragState.isDragging) {
            this.dragState.isDragging = false;
            this.saveToStorage();
        }
    }

    updateControlsPanel() {
        const deleteBtn = document.getElementById('deleteText');
        const noSelection = document.getElementById('noSelection');
        const controlsContent = document.getElementById('controlsContent');

        if (!this.selectedTextId) {
            deleteBtn.disabled = true;
            noSelection.style.display = 'block';
            controlsContent.style.display = 'none';
            return;
        }

        const slide = this.getCurrentSlide();
        const textElement = slide.getTextElement(this.selectedTextId);
        if (!textElement) {
            deleteBtn.disabled = true;
            noSelection.style.display = 'block';
            controlsContent.style.display = 'none';
            return;
        }

        deleteBtn.disabled = false;
        noSelection.style.display = 'none';
        controlsContent.style.display = 'flex';

        document.getElementById('textContent').value = textElement.text;
        document.getElementById('fontFamily').value = textElement.fontFamily;
        document.getElementById('fontSize').value = textElement.fontSize;
        document.getElementById('fontSizeValue').textContent = textElement.fontSize;
        document.getElementById('fontColor').value = textElement.color;
        document.getElementById('startAnimation').value = textElement.startAnimation || 'none';
        document.getElementById('endAnimation').value = textElement.endAnimation || 'none';
        document.getElementById('textAlign').value = textElement.align || 'left';


        const boldBtn = document.getElementById('toggleBold');
        const italicBtn = document.getElementById('toggleItalic');
        boldBtn.style.backgroundColor = textElement.bold ? '#2196F3' : '';
        boldBtn.style.color = textElement.bold ? 'white' : '';
        italicBtn.style.backgroundColor = textElement.italic ? '#2196F3' : '';
        italicBtn.style.color = textElement.italic ? 'white' : '';
    }

    saveToStorage() {
        const data = {
            slides: this.slides.map(slide => slide.toJSON()),
            currentSlideIndex: this.currentSlideIndex,
            nextSlideId: this.nextSlideId
        };
        localStorage.setItem('slideEditorData', JSON.stringify(data));
    }

    loadFromStorage() {
        const stored = localStorage.getItem('slideEditorData');
        if (!stored) return;

        try {
            const data = JSON.parse(stored);
            if (data.slides && data.slides.length > 0) {
                this.slides = data.slides.map(slideData => Slide.fromJSON(slideData));
                this.currentSlideIndex = data.currentSlideIndex || 0;
                this.nextSlideId = data.nextSlideId || 3;
            }
        } catch (e) {
            console.error('Failed to load from storage:', e);
        }
    }

    async exportToPNG() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const img = this.slideImage;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        await new Promise((resolve, reject) => {
            const tempImg = new Image();
            tempImg.onload = () => {
                ctx.drawImage(tempImg, 0, 0);
                resolve();
            };
            tempImg.onerror = reject;
            tempImg.src = img.src;
        });

        const slide = this.getCurrentSlide();
        const sortedElements = [...slide.textElements].sort((a, b) => a.zIndex - b.zIndex);

        sortedElements.forEach(textElement => {
            let anchorX = (textElement.x / 100) * canvas.width;
            const y = (textElement.y / 100) * canvas.height;

            ctx.fillStyle = textElement.color;

            let fontStyle = '';
            if (textElement.italic) fontStyle += 'italic ';
            if (textElement.bold) fontStyle += 'bold ';

            // compute font size scaled to canvas width relative to displayed image
            const displayWidth = this.slideImage.width || this.slideImage.naturalWidth;
            const scaleFactor = canvas.width / (displayWidth || canvas.width);
            const fontSize = Math.max(1, Math.round(textElement.fontSize * scaleFactor));
            ctx.font = `${fontStyle}${fontSize}px ${textElement.fontFamily}`;
            ctx.textBaseline = 'top';

            const lines = String(textElement.text).split('\n');
            
            let maxWidth = 0;
            for (let i = 0; i < lines.length; i++) {
                const m = ctx.measureText(lines[i]);
                maxWidth = Math.max(maxWidth, m.width);
            }

           
            if (textElement.align === 'center') {
                anchorX = anchorX - (maxWidth / 2);
            } else if (textElement.align === 'right') {
                anchorX = anchorX - maxWidth;
            }
            const lineHeight = fontSize * 1.2;
            for (let i = 0; i < lines.length; i++) {
                ctx.fillText(lines[i], anchorX, y + i * lineHeight);
            }
        });

        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `slide-${this.currentSlideIndex + 1}.png`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }
}

const editor = new SlideEditor();