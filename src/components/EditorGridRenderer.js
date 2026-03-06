
/**
 * EditorGridRenderer.js
 * 
 * Pure utility to generate CSS styles for Editor Grid/Backgrounds.
 * Isolates complexity of:
 * - Linear vs Repeating Gradients
 * - Vertical vs Horizontal Writing Mode Layouts
 * - Lined vs Grid vs Manuscript vs Plain modes
 * 
 * @param {Object} settings - The editor settings object (paperStyle, isVertical, showGrid).
 * @param {Object} metrics - { pxRowHeight, pxCellPitch, paddingVal }.
 * @returns {Object} CSS style object for the background.
 */
export const getGridStyle = (settings, metrics) => {
    const { pxRowHeight, pxCellPitch } = metrics;

    // 1. Plain Mode or Grid Hidden (unless Manuscript, which forces grid)
    // Manuscript always shows grid unless explicitly implemented otherwise, but user requested visibility.
    const isManuscript = settings.paperStyle === 'manuscript';
    const shouldShow = settings.showGrid || isManuscript;

    if (!shouldShow && !isManuscript) {
        return { backgroundImage: 'none' };
    }
    if (settings.paperStyle === 'plain' || settings.paperStyle === 'clean') {
        return { backgroundImage: 'none' };
    }

    // Safety check
    if (!pxRowHeight || !pxCellPitch || pxRowHeight <= 0 || pxCellPitch <= 0) {
        return { backgroundImage: 'none' };
    }

    // Colors
    // Standard Manuscript Green: 'rgba(46, 139, 87, 0.4)'
    // User reference shows a warm brown/orange for Genkou Youshi.
    const gridColor = 'rgba(175, 120, 80, 0.4)';
    const colorLined = 'rgba(0, 0, 0, 0.3)';

    // Base Style: Use Repeats for Infinite Tiling
    const style = {
        backgroundRepeat: 'repeat',
        backgroundAttachment: 'local', // Verified: Native Textarea requires 'local' to scroll with content
        backgroundPosition: '0 0',
    };


    // A. Lined Mode (University Notebook)
    if (settings.paperStyle === 'lined') {
        if (settings.isVertical) {
            // Vertical Lined (RL): Line is at the LEFT of the column.
            // Spacing is RowHeight.
            style.backgroundImage = `linear-gradient(to right, ${colorLined} 1px, transparent 1px)`;
            style.backgroundSize = `${pxRowHeight}px 100%`;
        } else {
            // Horizontal Lined: Line is at the BOTTOM of the row.
            // Spacing is RowHeight (pxRowHeight).
            style.backgroundImage = `linear-gradient(to bottom, transparent ${pxRowHeight - 1}px, ${colorLined} 1px)`;
            style.backgroundSize = `100% ${pxRowHeight}px`;
        }
        return style;
    }

    // B. Grid / Manuscript Mode
    if (settings.paperStyle === 'grid' || isManuscript) {
        const isVert = settings.isVertical;

        // Tile Dimensions
        const svgW = isVert ? pxRowHeight : pxCellPitch;
        const svgH = isVert ? pxCellPitch : pxRowHeight;

        const boxSize = metrics.fSizePx || pxCellPitch;

        let boxX, boxY, boxW, boxH;

        if (isVert) {
            // Vertical Writing: Boxes touch Vertically (Y), Rails are Horizontal (X)
            boxW = boxSize;
            boxH = svgH; // Spans full pitch (fSizePx) to touch next tile

            boxX = Math.floor((svgW - boxW) / 2);
            boxY = 0;
        } else {
            // Horizontal Writing: Boxes touch Horizontally (X), Rails are Vertical (Y)
            boxW = svgW; // Spans full pitch (fSizePx)
            boxH = boxSize;

            boxX = 0;
            boxY = Math.floor((svgH - boxH) / 2);
        }

        const svgString = `
<svg width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" 
        fill="none" stroke="${gridColor}" stroke-width="1" shape-rendering="crispEdges" />
</svg>
`.trim();

        const encodedSVG = encodeURIComponent(svgString);

        style.backgroundImage = `url("data:image/svg+xml;charset=utf-8,${encodedSVG}")`;
        style.backgroundSize = `${svgW}px ${svgH}px`;

        return style;
    };
};
